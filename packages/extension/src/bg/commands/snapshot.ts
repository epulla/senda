import { settleDom, snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { refNotFound, target } from './shared';
import { noteExternal } from '../approvals';
const frameGone = (error: unknown) => /Frame with ID \d+ was removed/.test(String(error));
// Resolves once the tab has finished loading, or after 10 s.
const loaded = (tabId: number) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(updated);
      resolve();
    };
    const updated = (id: number, change: { status?: string }) => id === tabId && change.status === 'complete' && finish();
    const timer = setTimeout(finish, 10000);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.get(tabId).then((tab) => tab.status === 'complete' && finish(), finish);
  });
// Runs settleDom, but stops when the tab starts loading another page: a page left for the back/forward cache is frozen
// and never answers. Also gives up after 4 s, counting the page as busy.
async function settle(tabId: number): Promise<boolean | 'navigated'> {
  let stop = () => {};
  const navigated = new Promise<'navigated' | true>((resolve) => {
    const updated = (id: number, change: { status?: string }) => id === tabId && change.status === 'loading' && resolve('navigated');
    browser.tabs.onUpdated.addListener(updated);
    const timer = setTimeout(() => resolve(true), 4000);
    stop = () => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(updated);
    };
  });
  const settled = browser.scripting
    .executeScript({ target: { tabId }, func: settleDom })
    .then(([{ result = false } = {}]) => result, (error) => (frameGone(error) ? ('navigated' as const) : Promise.reject(error)));
  try {
    return await Promise.race([settled, navigated]);
  } finally {
    stop();
  }
}
const read = (tabId: number, ref?: string) =>
  browser.scripting.executeScript({ target: { tabId }, func: snapshotPage, args: ref === undefined ? [] : [ref] });
export default async function snapshot(p: { ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  let busy = await settle(tabId);
  if (busy === 'navigated') {
    await loaded(tabId);
    busy = (await settle(tabId)) === true;
  }
  let results;
  try {
    results = await read(tabId, p.ref);
  } catch (error) {
    if (!frameGone(error)) throw error;
    await loaded(tabId);
    results = await read(tabId, p.ref);
  }
  const [{ result = '' } = {}] = results;
  const tab = await browser.tabs.get(tabId);
  if (result === null) throw refNotFound(p.ref!);
  let origin = 'unknown';
  try {
    origin = new URL(tab.url || '').host || 'unknown';
  } catch {}
  await noteExternal(origin, result);
  const note =
    p.ref === undefined && !result.trim()
      ? 'page shows no content yet; it may still be loading — snapshot again'
      : busy && 'page still busy after your last action (e.g. button loading); snapshot again';
  return { tabId, url: tab.url, title: tab.title, snapshot: wrapExternal(origin, result), ...(note && { note }) };
}
