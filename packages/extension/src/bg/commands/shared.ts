import { ErrorCode } from '@senda/protocol';
import { isAgentTab, listAgentIds, untrackAgentTab } from '../agent-tabs';
export class CommandError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}
export async function target(tabId?: number, create = false): Promise<number> {
  if (tabId !== undefined) {
    try {
      await browser.tabs.get(tabId);
    } catch {
      throw new CommandError(ErrorCode.TAB_GONE, `Tab ${tabId} is closed.`);
    }
    if (!(await isAgentTab(tabId)))
      throw new CommandError(ErrorCode.DENIED_BY_USER, 'Senda can only use tabs in the 🤖 MCP group. Move the tab into that group first.');
    return tabId;
  }
  for (const id of (await listAgentIds()).reverse()) {
    try {
      await browser.tabs.get(id);
      return id;
    } catch {
      untrackAgentTab(id);
    }
  }
  if (create) return -1;
  throw new CommandError(ErrorCode.TAB_GONE, 'No agent tab yet; call browser_navigate first.');
}
// Runs start, which loads a page and calls track with the tab id as soon as it knows it; resolves once that tab finishes loading.
export function waitForLoad(start: (track: (id: number) => void) => Promise<unknown>, tabId?: number): Promise<number> {
  const completed = new Set<number>();
  return new Promise<number>((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
      if (error) reject(error);
      else resolve(tabId!);
    };
    const timer = setTimeout(() => finish(new CommandError(ErrorCode.TIMEOUT, 'Navigation timed out.')), 25000);
    const updated = (id: number, change: { status?: string }) => {
      if (change.status !== 'complete') return;
      completed.add(id);
      if (id === tabId) finish();
    };
    const removed = (closed: number) => {
      if (closed === tabId) finish(new CommandError(ErrorCode.TAB_GONE, `Tab ${closed} was closed during navigation.`));
    };
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    const track = (id: number) => {
      tabId = id;
    };
    start(track).then(() => {
      if (completed.has(tabId!)) finish();
    }, finish);
  });
}
