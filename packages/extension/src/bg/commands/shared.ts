import { ErrorCode } from '@senda/protocol';
import { listAgentIds, untrackAgentTab } from '../agent-tabs';
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
      return tabId;
    } catch {
      throw new CommandError(ErrorCode.TAB_GONE, `Tab ${tabId} is closed.`);
    }
  }
  for (const id of listAgentIds().reverse()) {
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
