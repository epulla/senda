import { settleDom, snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { refNotFound, target } from './shared';
import { noteExternal } from '../approvals';
export default async function snapshot(p: { ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  await browser.scripting.executeScript({ target: { tabId }, func: settleDom });
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
  const empty = p.ref === undefined && !result.trim() && { note: 'page shows no content yet; it may still be loading — snapshot again' };
  return { tabId, url: tab.url, title: tab.title, snapshot: wrapExternal(origin, result), ...empty };
}
