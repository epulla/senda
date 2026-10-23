import { ErrorCode } from '@senda/protocol';
import { clickRef } from '../../injected/actions';
import { CommandError, target } from './shared';
import { needsApproval } from '../../core/approvals';
import { requestApproval } from '../approvals';
import { settingsItem, visitedHostsItem, taintItem } from '../state';
import { bgText } from '../text';
export default async function click(p: { ref: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  const url = tab.url || '';
  const host = new URL(url).host;
  const [{ result: label = '' } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: (ref: string) => {
      const e = document.querySelector<HTMLElement>(`[data-senda-ref="${CSS.escape(ref)}"]`);
      return [e?.textContent, e?.getAttribute('aria-label'), (e as HTMLInputElement)?.value, e?.getAttribute('title')]
        .filter(Boolean)
        .join(' ');
    },
    args: [p.ref],
  });
  const settings = await settingsItem.getValue();
  const text = await bgText();
  const taint = await taintItem.getValue();
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
      details: [[text.approval.reasonLabel, reason]],
      source: taint || undefined,
      allowAlways: true,
    });
  const [{ result } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: clickRef, args: [p.ref] });
  if (!result) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  return { tabId };
}
