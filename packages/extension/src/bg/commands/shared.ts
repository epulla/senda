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
