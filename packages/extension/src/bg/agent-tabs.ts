const agentTabs = new Set<number>();
import { openedTabsItem } from './state';
const hasGroups = () => 'tabGroups' in browser;
export async function addAgentTab(id: number): Promise<void> {
  if (hasGroups()) {
    const tab = await browser.tabs.get(id);
    const groups = await browser.tabGroups.query({ title: '🤖 MCP', windowId: tab.windowId });
    if (groups.length) await browser.tabs.group({ tabIds: [id], groupId: groups[0]!.id });
    else {
      const groupId = await browser.tabs.group({ tabIds: [id] });
      await browser.tabGroups.update(groupId, { title: '🤖 MCP' });
    }
    return;
  }
  trackAgentTab(id);
}
// Fallback recency for browsers without tab groups.
export function trackAgentTab(id: number): void {
  agentTabs.delete(id);
  agentTabs.add(id);
}
export function untrackAgentTab(id: number): void {
  agentTabs.delete(id);
}
export async function isAgentTab(id: number): Promise<boolean> {
  if (!hasGroups()) return agentTabs.has(id);
  const tab = await browser.tabs.get(id).catch(() => undefined);
  if (!tab || tab.groupId === undefined || tab.groupId < 0) return false;
  const group = await browser.tabGroups.get(tab.groupId).catch(() => undefined);
  return group?.title === '🤖 MCP';
}
export async function listAgentIds(): Promise<number[]> {
  if (!hasGroups()) return [...agentTabs];
  const groups = await browser.tabGroups.query({ title: '🤖 MCP' });
  const ids = new Set(groups.map((g) => g.id));
  return (await browser.tabs.query({})).filter((t) => t.id !== undefined && ids.has(t.groupId!))
    .sort((a, b) => (a.lastAccessed ?? 0) - (b.lastAccessed ?? 0)).map((t) => t.id!);
}
browser.tabs.onRemoved.addListener(async (id) => {
  untrackAgentTab(id);
  const opened = await openedTabsItem.getValue();
  if (opened.includes(id)) await openedTabsItem.setValue(opened.filter((tabId) => tabId !== id));
});

if (hasGroups()) {
  const membership = new Map<number, boolean>();
  void listAgentIds()
    .then((ids) => ids.forEach((id) => membership.set(id, true)))
    .catch(() => undefined);
  browser.tabs.onUpdated.addListener(async (id, change, tab) => {
    if (change.groupId === undefined) return;
    const opened = await openedTabsItem.getValue();
    if (opened.includes(id)) return;
    const now = tab.groupId !== undefined && tab.groupId >= 0 && await isAgentTab(id);
    const before = membership.get(id) ?? false;
    membership.set(id, now);
    if (before === now) return;
    const { logActivity } = await import('./approvals');
    const { activity } = await (await import('./text')).bgText();
    await logActivity('tab', activity.tab(now, tab.title || activity.untitled));
  });
}
