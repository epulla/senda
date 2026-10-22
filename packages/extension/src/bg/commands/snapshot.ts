import { snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { target } from './shared';
export default async function snapshot(p: { tabId?: number }) { const tabId = await target(p.tabId); const tab = await browser.tabs.get(tabId); const [{ result = '' } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: snapshotPage }); return { tabId, url: tab.url, title: tab.title, snapshot: wrapExternal(new URL(tab.url || '').host, result) }; }
