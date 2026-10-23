import { ErrorCode } from '@senda/protocol';
import navigate from './navigate';
import { isAgentTab, untrackAgentTab } from '../agent-tabs';
import { CommandError } from './shared';
export default async function tabs(p: { action: 'list' | 'new' | 'select' | 'close'; tabId?: number; url?: string }) {
  if (p.action === 'list') {
    const all = await browser.tabs.query({});
    return all
      .filter((t) => t.id !== undefined && isAgentTab(t.id))
      .map((t) => ({ id: t.id, title: t.title, url: t.url, active: !!t.active }));
  }
  if (p.action === 'new') return navigate({ url: p.url ?? 'about:blank', newTab: true });
  if (p.tabId === undefined || !isAgentTab(p.tabId))
    throw new CommandError(ErrorCode.DENIED_BY_USER, 'Can only select or close agent tabs.');
  if (p.action === 'select') {
    await browser.tabs.update(p.tabId, { active: true });
    return { tabId: p.tabId };
  }
  await browser.tabs.remove(p.tabId);
  untrackAgentTab(p.tabId);
  return { tabId: p.tabId };
}
