import { clickRef } from '../../injected/actions';
import type { FoundRef } from '../../injected/snapshot';
import { refNotFound, target } from './shared';
import { needsApproval } from '../../core/approvals';
import { requestApproval, riskSource } from '../approvals';
import { settingsItem, visitedHostsItem } from '../state';
import { bgText } from '../text';
export default async function click(p: { ref: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  const url = tab.url || '';
  const host = new URL(url).host;
  const [{ result: label = '' } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: (ref: string) => {
      const { el: e } = ((globalThis as any).__sendaFindRef?.(ref) ?? { el: document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) }) as FoundRef;
      return [e?.textContent, e?.getAttribute('aria-label'), (e as HTMLInputElement)?.value, e?.getAttribute('title')]
        .filter(Boolean)
        .join(' ');
    },
    args: [p.ref],
  });
  const settings = await settingsItem.getValue();
  const text = await bgText();
  const taint = await riskSource(settings.askBefore);
  const reason = needsApproval({
    action: 'click',
    label,
    url,
    visitedHosts: await visitedHostsItem.getValue(),
    allowedDomains: settings.allowedDomains,
    alwaysSites: settings.alwaysSites,
    askBefore: settings.askBefore,
    tainted: !!taint,
  }, text.approval);
  if (reason)
    await requestApproval({
      kind: 'generic',
      summary: text.approval.clickSummary(label || text.approval.element, host),
      host,
      url,
      tabId,
      ref: p.ref,
      details: [[text.approval.reasonLabel, reason]],
      source: taint || undefined,
      allowAlways: true,
    });
  await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
  const [{ result } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: clickRef, args: [p.ref] });
  if (!result) throw refNotFound(p.ref);
  return { tabId, ...result };
}
