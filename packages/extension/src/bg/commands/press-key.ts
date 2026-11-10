import { ErrorCode } from '@senda/protocol';
import { pressKeyRef } from '../../injected/actions';
import { CommandError, target } from './shared';
import { needsApproval } from '../../core/approvals';
import { requestApproval, riskSource } from '../approvals';
import { settingsItem, visitedHostsItem } from '../state';
import { bgText } from '../text';

export default async function pressKey(p: { key: string; ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  const url = tab.url || '';
  const host = new URL(url).host;
  const [{ result: targetInfo = { label: '', formField: false } } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: (ref?: string) => {
      const e = ref ? document.querySelector<HTMLElement>(`[data-senda-ref="${CSS.escape(ref)}"]`) : document.activeElement as HTMLElement;
      const textInput = e?.matches('input:not([type]),input[type=text],input[type=search],input[type=email],input[type=url],input[type=tel],input[type=password]');
      return {
        label: [e?.textContent, e?.getAttribute('aria-label'), (e as HTMLInputElement)?.value, e?.getAttribute('title')]
          .filter(Boolean)
          .join(' '),
        formField: !!textInput && !!e?.closest('form'),
      };
    },
    args: p.ref === undefined ? [] : [p.ref],
  });
  const submitting = p.key === 'Enter' && targetInfo.formField;
  if (p.key === 'Enter' || p.key === 'Space') {
    const settings = await settingsItem.getValue();
    const text = await bgText();
    const taint = await riskSource(settings.askBefore);
    const reason = needsApproval(
      {
        action: submitting ? 'type' : 'click',
        label: targetInfo.label,
        submit: submitting,
        url,
        visitedHosts: await visitedHostsItem.getValue(),
        allowedDomains: settings.allowedDomains,
        alwaysSites: settings.alwaysSites,
        askBefore: settings.askBefore,
        tainted: !!taint,
      },
      text.approval,
    );
    if (reason)
      await requestApproval({
        kind: 'generic',
        summary: submitting
          ? text.approval.typeSummary(host, true)
          : text.approval.clickSummary(targetInfo.label || text.approval.element, host),
        host,
        url,
        tabId,
        ref: p.ref,
        details: [[text.approval.reasonLabel, reason]],
        source: taint || undefined,
        allowAlways: true,
      });
  }
  await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
  const [{ result } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: pressKeyRef,
    args: p.ref === undefined ? [p.key] : [p.key, p.ref],
  });
  if (result == null) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  return { tabId, focused: result };
}
