import { ErrorCode } from '@senda/protocol';
import { detectCapabilities } from '../../core/capabilities';
import { trackAgentTab } from '../agent-tabs';
import { CommandError, target } from './shared';
export default async function navigate(p: { url: string; tabId?: number }) {
  const id = await target(p.tabId, true);
  let tabId: number | undefined = id < 0 ? undefined : id;
  const completed = new Set<number>();
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new CommandError(ErrorCode.TIMEOUT, 'Navigation timed out.'));
    }, 25000);
    const listener = (updated: number, change: { status?: string }) => {
      if (change.status === 'complete') {
        completed.add(updated);
        if (updated === tabId) {
          clearTimeout(timer);
          browser.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
    };
    browser.tabs.onUpdated.addListener(listener);
    void (async () => {
      const created = id < 0;
      const tab = created ? await browser.tabs.create({ url: p.url }) : await browser.tabs.update(id, { url: p.url });
      if (!tab?.id) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open tab.');
      tabId = tab.id;
      trackAgentTab(tab.id);
      if (completed.has(tab.id)) {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
      if (created) {
        if (detectCapabilities(browser).includes('tabGroups'))
          try {
            const groupId = await browser.tabs.group({ tabIds: [tab.id] });
            await browser.tabGroups.update(groupId, { title: '🤖 MCP' });
          } catch {}
      }
    })().catch((error) => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      reject(error);
    });
  });
  await loaded;
  const done = await browser.tabs.get(tabId!);
  return { tabId: done.id, url: done.url, title: done.title };
}
