import { settleDom, snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { refNotFound, target } from './shared';
import { noteExternal } from '../approvals';
const frameGone = (error: unknown) => /Frame with ID \d+ was removed/.test(String(error));
// Resolves once the tab has finished loading, or after ms.
const loaded = (tabId: number, ms: number) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(updated);
      resolve();
    };
    const updated = (id: number, change: { status?: string }) => id === tabId && change.status === 'complete' && finish();
    const timer = setTimeout(finish, Math.max(0, ms));
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.get(tabId).then((tab) => tab.status === 'complete' && finish(), finish);
  });
// Runs a page script until it answers, the tab starts loading another page (or its frame goes away), or ms pass.
// A page left for the back/forward cache is frozen and never answers, so the load event is what ends the wait.
async function guard<T>(tabId: number, ms: number, run: () => Promise<T>): Promise<T | 'navigated' | 'timeout'> {
  let stop = () => {};
  const watch = new Promise<'navigated' | 'timeout'>((resolve) => {
    const updated = (id: number, change: { status?: string }) => id === tabId && change.status === 'loading' && resolve('navigated');
    const timer = setTimeout(resolve, Math.max(0, ms), 'timeout');
    browser.tabs.onUpdated.addListener(updated);
    stop = () => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(updated);
    };
  });
  try {
    return await Promise.race([run().catch((error) => (frameGone(error) ? ('navigated' as const) : Promise.reject(error))), watch]);
  } finally {
    stop();
  }
}
const run = <T>(tabId: number, func: (...args: any[]) => T | Promise<T>, args: unknown[] = []) => async () => {
  const [{ result } = {}] = await browser.scripting.executeScript({ target: { tabId }, func, args } as any);
  return result as Awaited<T> | undefined;
};
const LOADING = 'page shows no content yet; it may still be loading — snapshot again';
// Settles and reads the page; whenever the tab loads another page meanwhile, waits for it and starts over on the new page.
// The whole call takes at most 8 s; past that it returns what it has with a "may still be loading" note.
export default async function snapshot(p: { ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const deadline = Date.now() + 8000;
  const left = () => deadline - Date.now();
  let busy = false;
  let result: string | null | undefined;
  while (result === undefined && left() > 0) {
    const settled = await guard(tabId, left() - 1000, run(tabId, settleDom));
    if (settled !== 'navigated') {
      busy = settled === true || settled === 'timeout';
      const read = await guard(tabId, left(), run(tabId, snapshotPage, p.ref === undefined ? [] : [p.ref]));
      if (read === 'timeout') break;
      if (read !== 'navigated') {
        result = read === undefined ? '' : read;
        break;
      }
    }
    await loaded(tabId, left());
  }
  if (result === null) throw refNotFound(p.ref!);
  const text = result ?? '';
  const tab = await browser.tabs.get(tabId);
  let origin = 'unknown';
  try {
    origin = new URL(tab.url || '').host || 'unknown';
  } catch {}
  await noteExternal(origin, text);
  const note =
    result === undefined || (p.ref === undefined && !text.trim())
      ? LOADING
      : busy && 'page still busy after your last action (e.g. button loading); snapshot again';
  return { tabId, url: tab.url, title: tab.title, snapshot: wrapExternal(origin, text), ...(note && { note }) };
}
