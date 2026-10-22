import { ErrorCode } from '@senda/protocol';
import { detectCapabilities } from '../../core/capabilities';
import { isAgentTab, listAgentIds, trackAgentTab, untrackAgentTab } from '../agent-tabs';
import { CommandError } from './shared';
export default async function tabs(p: { action: 'list'|'new'|'select'|'close'; tabId?: number; url?: string }) {
  if (p.action === 'list') { const all = await browser.tabs.query({}); return all.filter(t => t.id !== undefined && isAgentTab(t.id)).map(t => ({ id: t.id, title: t.title, url: t.url, active: !!t.active })); }
  if (p.action === 'new') { const tab = await browser.tabs.create({ url: p.url }); if (tab.id) { trackAgentTab(tab.id); if (detectCapabilities(browser).includes('tabGroups')) try { const groupId = await browser.tabs.group({ tabIds: [tab.id] }); await browser.tabGroups.update(groupId, { title: '🤖 MCP' }); } catch {} } return { tabId: tab.id, url: tab.url, title: tab.title }; }
  if (p.tabId === undefined || !isAgentTab(p.tabId)) throw new CommandError(ErrorCode.DENIED_BY_USER, 'Can only select or close agent tabs.');
  if (p.action === 'select') { await browser.tabs.update(p.tabId, { active: true }); return { tabId: p.tabId }; }
  await browser.tabs.remove(p.tabId); untrackAgentTab(p.tabId); return { tabId: p.tabId };
}
