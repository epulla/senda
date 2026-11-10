import { ErrorCode } from '@senda/protocol';
import { pressKeyRef, probeKeyTarget } from '../../injected/actions';
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
  const marker = crypto.randomUUID();
  const [{ result: targetInfo = { missing: false, focusFailed: false, label: '', formField: false } } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: probeKeyTarget,
    args: p.ref === undefined ? [marker] : [marker, p.ref],
  });
  if (targetInfo.missing) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  if (targetInfo.focusFailed)
    throw new CommandError(ErrorCode.INVALID_PARAMS, `Ref ${p.ref} can't take keyboard focus; use browser_click instead.`);
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
    if (reason) {
      try {
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
      } catch (error) {
        await browser.scripting.executeScript({
          target: { tabId },
          func: (token: string) =>
            document
              .querySelector(`[data-senda-key-target="${CSS.escape(token)}"]`)
              ?.removeAttribute('data-senda-key-target'),
          args: [marker],
        });
        throw error;
      }
    }
  }
  await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
  const [{ result } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: pressKeyRef,
    args: [p.key, marker],
  });
  if (result === 'FOCUS_MOVED')
    throw new CommandError(ErrorCode.INVALID_PARAMS, 'Focus moved before the key press; try again.');
  return { tabId, focused: result };
}
