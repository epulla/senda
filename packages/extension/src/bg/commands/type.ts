import { ErrorCode } from '@senda/protocol';
import { typeRef } from '../../injected/actions';
import { CommandError, target } from './shared';
import { needsApproval } from '../../core/approvals';
import { requestApproval, riskSource } from '../approvals';
import { settingsItem, visitedHostsItem } from '../state';
import { bgText } from '../text';
export default function type(p: { ref: string; text: string; submit?: boolean; tabId?: number }) {
  return fill(p.ref, p.text, p.submit ?? false, p.tabId, false);
}
// Types into a field, or picks the option in a dropdown; selectOnly rejects anything but a dropdown.
export async function fill(ref: string, text: string | string[], submit: boolean, tabIdParam: number | undefined, selectOnly: boolean) {
  const tabId = await target(tabIdParam);
  const tab = await browser.tabs.get(tabId);
  const url = tab.url || '';
  const host = new URL(url).host;
  const settings = await settingsItem.getValue();
  const strings = await bgText();
  const taint = await riskSource(settings.askBefore);
  const reason = needsApproval({
    action: 'type',
    url,
    submit,
    visitedHosts: await visitedHostsItem.getValue(),
    allowedDomains: settings.allowedDomains,
    alwaysSites: settings.alwaysSites,
    askBefore: settings.askBefore,
    tainted: !!taint,
  }, strings.approval);
  if (reason)
    await requestApproval({
      kind: 'generic',
      summary: selectOnly ? strings.approval.selectSummary(host) : strings.approval.typeSummary(host, submit),
      host,
      url,
      tabId,
      ref,
      details: [[strings.approval.reasonLabel, reason]],
      source: taint || undefined,
      allowAlways: true,
    });
  await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
  const [{ result } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: typeRef,
    args: [ref, text, submit, selectOnly],
  });
  if (!result?.ok) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${ref} not found; take a new snapshot.`);
  if (result.error) throw new CommandError(ErrorCode.INVALID_PARAMS, result.error);
  if (result.selected) return { tabId, selected: result.selected };
  if (result.value !== undefined && result.value !== text)
    return { tabId, warning: `field value changed after typing (now "${result.value}")` };
  return { tabId };
}
