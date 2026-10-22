import { ErrorCode } from '@senda/protocol';
import { detectCapabilities } from '../../core/capabilities';
import { trackAgentTab } from '../agent-tabs';
import { CommandError, target } from './shared';
export default async function navigate(p: { url: string; tabId?: number }) {
  const id = await target(p.tabId, true);
  const tab = id < 0 ? await browser.tabs.create({ url: p.url }) : await browser.tabs.update(id, { url: p.url });
  if (!tab?.id) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open tab.');
  trackAgentTab(tab.id);
  if (detectCapabilities(browser).includes('tabGroups')) { try { const groupId = await browser.tabs.group({ tabIds: [tab.id] }); await browser.tabGroups.update(groupId, { title: '🤖 MCP' }); } catch {} }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { browser.tabs.onUpdated.removeListener(listener); reject(new CommandError(ErrorCode.TIMEOUT, 'Navigation timed out.')); }, 25000);
    const listener = (updated: number, change: { status?: string }) => { if (updated === tab.id && change.status === 'complete') { clearTimeout(timer); browser.tabs.onUpdated.removeListener(listener); resolve(); } };
    browser.tabs.onUpdated.addListener(listener);
    browser.tabs.get(tab.id!).then(t => { if (t.status === 'complete') { clearTimeout(timer); browser.tabs.onUpdated.removeListener(listener); resolve(); } });
  });
  const done = await browser.tabs.get(tab.id); return { tabId: done.id, url: done.url, title: done.title };
}
