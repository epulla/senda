import { snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { target } from './shared';
export default async function snapshot(p: { tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  const [{ result = '' } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: snapshotPage });
  let origin = 'unknown';
  try {
    origin = new URL(tab.url || '').host || 'unknown';
  } catch {}
  return { tabId, url: tab.url, title: tab.title, snapshot: wrapExternal(origin, result) };
}
