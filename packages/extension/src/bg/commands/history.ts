import { ErrorCode } from '@senda/protocol';
import { CommandError, target, waitForLoad } from './shared';
// Chromium's tabs.goBack skips entries the page never interacted with (every browser_navigate),
// so fall back to the page's Navigation API, which does not.
const viaPage = (back: boolean) => {
  const nav = (globalThis as any).navigation;
  if (!nav || !(back ? nav.canGoBack : nav.canGoForward)) return false;
  const result = back ? nav.back() : nav.forward();
  result.committed?.catch(() => {});
  result.finished?.catch(() => {});
  return true;
};
const move = (direction: 'back' | 'forward') => async (p: { tabId?: number }) => {
  const tabId = await target(p.tabId);
  const back = direction === 'back';
  await waitForLoad(async () => {
    try {
      await (back ? browser.tabs.goBack(tabId) : browser.tabs.goForward(tabId));
    } catch {
      const [{ result = false } = {}] = await browser.scripting
        .executeScript({ target: { tabId }, func: viaPage, args: [back] })
        .catch(() => []);
      if (!result) throw new CommandError(ErrorCode.INVALID_PARAMS, `No ${back ? 'previous' : 'next'} page in this tab.`);
    }
  }, tabId);
  const tab = await browser.tabs.get(tabId);
  return { tabId, url: tab.url, title: tab.title };
};
export const back = move('back');
export const forward = move('forward');
