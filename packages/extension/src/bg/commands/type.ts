import { ErrorCode } from '@senda/protocol';
import { typeRef } from '../../injected/actions';
import { CommandError, target } from './shared';
import { needsApproval } from '../../core/approvals';
import { requestApproval } from '../approvals';
import { settingsItem, visitedHostsItem, taintItem } from '../state';
import { bgText } from '../text';
export default async function type(p: { ref: string; text: string; submit?: boolean; tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  const url = tab.url || '';
  const host = new URL(url).host;
  const settings = await settingsItem.getValue();
  const text = await bgText();
  const taint = await taintItem.getValue();
  const reason = needsApproval({
    action: 'type',
    url,
    submit: p.submit,
    visitedHosts: await visitedHostsItem.getValue(),
    allowedDomains: settings.allowedDomains,
    alwaysSites: settings.alwaysSites,
    askBefore: settings.askBefore,
    tainted: !!taint,
  }, text.approval);
  if (reason)
    await requestApproval({
      kind: 'generic',
      summary: text.approval.typeSummary(host, !!p.submit),
      host,
      url,
      details: [[text.approval.reasonLabel, reason]],
      source: taint || undefined,
      allowAlways: true,
    });
  const [{ result } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: typeRef,
    args: [p.ref, p.text, p.submit],
  });
  if (!result) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  return { tabId };
}
