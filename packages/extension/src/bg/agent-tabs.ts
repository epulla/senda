const agentTabs = new Set<number>();
export function trackAgentTab(id: number): void {
  agentTabs.add(id);
}
export function untrackAgentTab(id: number): void {
  agentTabs.delete(id);
}
export function isAgentTab(id: number): boolean {
  return agentTabs.has(id);
}
export function listAgentIds(): number[] {
  return [...agentTabs];
}
browser.tabs.onRemoved.addListener(untrackAgentTab);
