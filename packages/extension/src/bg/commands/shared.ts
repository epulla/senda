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
export const LEAVE_HINT =
  "The page may be showing a 'Leave site?' dialog (unsaved changes). Ask the user to click Leave, or use the page's own Cancel button.";
// Tabs whose navigation never started, likely held by a "Leave site?" dialog that blocks the page's scripts.
const stalledTabs = new Set<number>();
export async function target(tabId?: number, create = false): Promise<number> {
  const id = await pickTab(tabId, create);
  if (!stalledTabs.has(id)) return id;
  const responds = await Promise.race([
    browser.scripting.executeScript({ target: { tabId: id }, func: () => true }).then(() => true, () => true),
    new Promise<boolean>((resolve) => setTimeout(resolve, 1000, false)),
  ]);
  if (!responds) throw new CommandError(ErrorCode.PAGE_DIALOG, LEAVE_HINT);
  stalledTabs.delete(id);
  return id;
}
async function pickTab(tabId?: number, create = false): Promise<number> {
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
// Runs start, which loads a page and calls track with the tab id as soon as it knows it; resolves once start is done and that tab finishes loading.
// track(id, true) also forgets earlier loads of that tab, for when start loads another page in it (a new tab's blank page).
export function waitForLoad(start: (track: (id: number, reload?: boolean) => void) => Promise<unknown>, tabId?: number): Promise<number> {
  const completed = new Set<number>();
  const loading = new Set<number>();
  let started = false;
  return new Promise<number>((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      clearTimeout(stall);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
      browser.tabs.onReplaced.removeListener(replaced);
      if (error) reject(error);
      else resolve(tabId!);
    };
    const timer = setTimeout(() => finish(new CommandError(ErrorCode.TIMEOUT, 'Navigation timed out.')), 25000);
    // Chrome marks a tab loading as soon as a navigation starts; a "Leave site?" dialog holds it back.
    const stall = setTimeout(() => {
      if (tabId === undefined || loading.has(tabId)) return;
      stalledTabs.add(tabId);
      finish(new CommandError(ErrorCode.PAGE_DIALOG, LEAVE_HINT));
    }, 3000);
    const updated = (id: number, change: { status?: string }) => {
      if (change.status) loading.add(id);
      if (change.status !== 'complete') return;
      completed.add(id);
      if (started && id === tabId) finish();
    };
    const removed = (closed: number) => {
      if (closed === tabId) finish(new CommandError(ErrorCode.TAB_GONE, `Tab ${closed} was closed during navigation; another extension (e.g. one that closes duplicate tabs) may have closed it.`));
    };
    // Chrome can swap a tab for a new one (e.g. a discarded or prerendered page); keep following it.
    const replaced = (added: number, old: number) => {
      if (old !== tabId) return;
      tabId = added;
      loading.add(added);
      if (started && completed.has(added)) finish();
    };
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    browser.tabs.onReplaced.addListener(replaced);
    const track = (id: number, reload = false) => {
      tabId = id;
      if (reload) completed.delete(id);
    };
    start(track).then(() => {
      started = true;
      if (completed.has(tabId!)) finish();
    }, finish);
  });
}
