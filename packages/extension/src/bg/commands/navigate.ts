import { ErrorCode } from '@senda/protocol';
import { addAgentTab } from '../agent-tabs';
import { CommandError, target, waitForLoad } from './shared';
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
  const open = (reuse: number) => waitForLoad(async (track) => {
    let id = reuse;
    // New tabs join the agent group while still blank, so tab-reuse extensions never see an ungrouped duplicate.
    if (reuse < 0) {
      const created = await browser.tabs.create({ url: 'about:blank' });
      if (!created?.id) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open tab.');
      id = created.id;
      track(id);
      await openedTabsItem.setValue([...new Set([...(await openedTabsItem.getValue()), id])]);
      await addAgentTab(id);
      if (p.url === 'about:blank') return;
      track(id);
    }
    const tab = await browser.tabs.update(id, { url: p.url });
    if (!tab?.id) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open tab.');
    if (tab.id !== id) track(tab.id);
    if (reuse >= 0) await addAgentTab(tab.id);
  }, reuse < 0 ? undefined : reuse);
  let tabId: number;
  try {
    tabId = await open(id);
  } catch (error) {
    // The reused agent tab can vanish while loading; when the AI named no tab, start over once in a new one.
    if (id < 0 || p.tabId !== undefined || (await browser.tabs.get(id).then(() => true, () => false))) throw error;
    tabId = await open(-1);
  }
  const done = await browser.tabs.get(tabId);
  const hosts = await visitedHostsItem.getValue();
  if (!hosts.includes(host)) await visitedHostsItem.setValue([...hosts, host]);
  return { tabId: done.id, url: done.url, title: done.title };
}
