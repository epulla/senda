import { settleDom, snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { refNotFound, target } from './shared';
import { noteExternal } from '../approvals';
export default async function snapshot(p: { ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const [{ result: busy = false } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: settleDom });
  const tab = await browser.tabs.get(tabId);
  const [{ result = '' } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: snapshotPage,
    args: p.ref === undefined ? [] : [p.ref],
  });
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
