import { ErrorCode } from '@senda/protocol';
import { detectCapabilities } from '../../core/capabilities';
import { trackAgentTab } from '../agent-tabs';
import { CommandError, target } from './shared';
export default async function navigate(p: { url: string; tabId?: number; newTab?: boolean }) {
  const id = p.newTab ? -1 : await target(p.tabId, true);
  let tabId: number | undefined = id < 0 ? undefined : id;
  const completed = new Set<number>();
  const loaded = new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      browser.tabs.onRemoved.removeListener(removed);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new CommandError(ErrorCode.TIMEOUT, 'Navigation timed out.')), 25000);
    const listener = (updated: number, change: { status?: string }) => {
      if (change.status === 'complete') {
        completed.add(updated);
        if (updated === tabId) finish();
      }
    };
    const removed = (closed: number) => {
      if (closed === tabId) finish(new CommandError(ErrorCode.TAB_GONE, `Tab ${closed} was closed during navigation.`));
    };
    browser.tabs.onUpdated.addListener(listener);
    browser.tabs.onRemoved.addListener(removed);
    void (async () => {
      const created = id < 0;
      const tab = created ? await browser.tabs.create({ url: p.url }) : await browser.tabs.update(id, { url: p.url });
      if (!tab?.id) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open tab.');
      tabId = tab.id;
      trackAgentTab(tab.id);
      if (completed.has(tab.id)) finish();
      if (created) {
        if (detectCapabilities(browser).includes('tabGroups'))
          try {
            const groupId = await browser.tabs.group({ tabIds: [tab.id] });
            await browser.tabGroups.update(groupId, { title: '🤖 MCP' });
          } catch {}
      }
    })().catch(finish);
  });
  await loaded;
  const done = await browser.tabs.get(tabId!);
  return { tabId: done.id, url: done.url, title: done.title };
}
