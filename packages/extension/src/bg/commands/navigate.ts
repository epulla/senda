import { ErrorCode } from '@senda/protocol';
import { addAgentTab } from '../agent-tabs';
import { CommandError, target } from './shared';
import { needsApproval } from '../../core/approvals';
import { requestApproval, riskSource } from '../approvals';
import { settingsItem, visitedHostsItem, openedTabsItem } from '../state';
import { bgText } from '../text';
export default async function navigate(p: { url: string; tabId?: number; newTab?: boolean; internal?: boolean }) {
  const host = new URL(p.url).host;
  const settings = await settingsItem.getValue();
  const text = await bgText();
  if (settings.blockedDomains.some((d) => host === d || host.endsWith(`.${d}`)))
    throw new CommandError(ErrorCode.DOMAIN_BLOCKED, `Domain ${host} is blocked.`);
  const taint = await riskSource(settings.askBefore);
  const reason = needsApproval({
    action: 'navigate',
    url: p.url,
    visitedHosts: await visitedHostsItem.getValue(),
    allowedDomains: settings.allowedDomains,
    alwaysSites: settings.alwaysSites,
    askBefore: settings.askBefore,
    tainted: !!taint,
  }, text.approval);
  if (reason && !p.internal)
    await requestApproval({
      kind: 'generic',
      summary: text.approval.navigateSummary(host),
      host,
      url: p.url,
      tabId: p.tabId,
      details: [[text.approval.reasonLabel, reason]],
      source: taint || undefined,
      allowAlways: true,
    });
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
      if (created) await openedTabsItem.setValue([...new Set([...(await openedTabsItem.getValue()), tab.id])]);
      await addAgentTab(tab.id);
      if (completed.has(tab.id)) finish();
    })().catch(finish);
  });
  await loaded;
  const done = await browser.tabs.get(tabId!);
  const hosts = await visitedHostsItem.getValue();
  if (!hosts.includes(host)) await visitedHostsItem.setValue([...hosts, host]);
  return { tabId: done.id, url: done.url, title: done.title };
}
