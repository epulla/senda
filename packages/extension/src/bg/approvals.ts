import { ErrorCode } from '@senda/protocol';
import {
  adaptersItem,
  activityItem,
  approvalsItem,
  panicItem,
  settingsItem,
  taintItem,
  openedTabsItem,
  type ApprovalCard,
} from './state';
import { CommandError } from './commands/shared';
import { listAgentIds } from './agent-tabs';
import { stopConnection, waitForReplies } from './connection';
import { looksLikeInjection } from '../core/injection';
import { bgText } from './text';

export async function logActivity(kind: 'approval' | 'denied' | 'injection' | 'adapter' | 'panic' | 'tab', text: string) {
  const rows = await activityItem.getValue();
  await activityItem.setValue([...rows, { at: new Date().toISOString(), kind, text }].slice(-200));
}
export async function answerApproval(id: string, answer: 'allow' | 'deny' | 'always') {
  const rows = await approvalsItem.getValue();
  if (rows[id]) await approvalsItem.setValue({ ...rows, [id]: { ...rows[id], answer } });
}
export async function requestApproval(card: Omit<ApprovalCard, 'id' | 'created_at'>): Promise<'allow' | 'always'> {
  const id = crypto.randomUUID();
  const rows = await approvalsItem.getValue();
  await approvalsItem.setValue({
    ...rows,
    [id]: { ...card, id, created_at: new Date().toISOString() },
  });
  try {
    const answer = await new Promise<'allow' | 'deny' | 'always'>((resolve, reject) => {
      const timer = setTimeout(() => {
        stop();
        reject(
          new CommandError(
            ErrorCode.DENIED_BY_USER,
            'No answer in the Senda side panel within 110 s. Ask the user to open the Senda side panel, then try again.',
          ),
        );
      }, 110_000);
      const stop = approvalsItem.watch((value) => {
        const a = value[id]?.answer;
        if (a) {
          clearTimeout(timer);
          stop();
          resolve(a);
        }
      });
    });
    if (answer === 'deny')
      throw new CommandError(ErrorCode.DENIED_BY_USER, 'The user denied this in the Senda side panel.');
    if (answer === 'always') {
      const settings = await settingsItem.getValue();
      await settingsItem.setValue({
        ...settings,
        alwaysSites: [...new Set([...settings.alwaysSites, card.host])],
      });
    }
    await logActivity('approval', card.summary);
    return answer;
  } catch (error) {
    await logActivity('denied', card.summary);
    throw error;
  } finally {
    const current = await approvalsItem.getValue();
    delete current[id];
    await approvalsItem.setValue(current);
  }
}
export async function noteExternal(host: string, text: string) {
  await taintItem.setValue(host);
  if (looksLikeInjection(text)) await logActivity('injection', (await bgText()).activity.injection(host));
}
export async function requestPanic() {
  await panicItem.setValue(Date.now());
}
export function watchPanic() {
  void approvalsItem.setValue({});
  panicItem.watch(async (value) => {
    if (!value) return;
    const rows = await approvalsItem.getValue();
    await approvalsItem.setValue(
      Object.fromEntries(Object.entries(rows).map(([id, c]) => [id, { ...c, answer: 'deny' as const }])),
    );
    const adapters = await adaptersItem.getValue();
    await adaptersItem.setValue(
      Object.fromEntries(Object.entries(adapters).map(([id, a]) => [id, { ...a, status: 'paused' as const }])),
    );
    const opened = new Set(await openedTabsItem.getValue());
    for (const id of await listAgentIds()) {
      if (opened.has(id)) await browser.tabs.remove(id).catch(() => undefined);
      else if ('tabGroups' in browser) await browser.tabs.ungroup(id).catch(() => undefined);
    }
    await openedTabsItem.setValue([]);
    await waitForReplies();
    stopConnection();
    await logActivity('panic', (await bgText()).activity.panic);
  });
}
