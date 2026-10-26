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
import { detectCapabilities } from '../core/capabilities';
import { hideApprovalCard, showApprovalCard } from '../injected/approval-card';

export async function logActivity(kind: 'approval' | 'denied' | 'injection' | 'adapter' | 'panic' | 'tab', text: string) {
  const rows = await activityItem.getValue();
  await activityItem.setValue([...rows, { at: new Date().toISOString(), kind, text }].slice(-200));
}
export async function answerApproval(id: string, answer: 'allow' | 'deny' | 'always') {
  const rows = await approvalsItem.getValue();
  if (rows[id]) await approvalsItem.setValue({ ...rows, [id]: { ...rows[id], answer } });
}
async function showOnPage(card: ApprovalCard) {
  if (card.tabId === undefined) return;
  const t = await bgText();
  const always = card.allowAlways && !card.source ? t.sidepanel.alwaysOn(card.host) : undefined;
  await browser.scripting
    .executeScript({
      target: { tabId: card.tabId },
      func: showApprovalCard,
      args: [
        { id: card.id, summary: card.summary, url: card.url, details: card.details, source: card.source, ref: card.ref, always },
        {
          title: t.approval.pageTitle,
          allow: t.sidepanel.allow,
          deny: t.sidepanel.deny,
          openPanel: t.approval.openPanel,
          readFrom: card.source ? t.sidepanel.readFrom(card.source) : undefined,
        },
      ],
    })
    .catch(() => undefined);
}
export function watchPageAnswers() {
  browser.runtime.onMessage.addListener((message: any, sender) => {
    const tabId = sender.tab?.id;
    if (sender.id !== browser.runtime.id || sender.frameId !== 0 || tabId === undefined) return;
    if (message?.type === 'senda:open-panel') {
      // Must run before any await so Chrome still sees the user's click.
      if (detectCapabilities(browser).includes('sidePanel')) void browser.sidePanel.open({ tabId }).catch(() => undefined);
      else void browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html' as never) });
      return;
    }
    if (message?.type !== 'senda:answer' || !['allow', 'deny', 'always'].includes(message.answer)) return;
    void approvalsItem.getValue().then((rows) => {
      const card = rows[message.id];
      if (!card || card.tabId !== tabId) return;
      if (message.answer === 'always' && !(card.allowAlways && !card.source)) return;
      return answerApproval(card.id, message.answer);
    });
  });
}
export async function requestApproval(card: Omit<ApprovalCard, 'id' | 'created_at'>): Promise<'allow' | 'always'> {
  const id = crypto.randomUUID();
  const rows = await approvalsItem.getValue();
  const stored = { ...card, id, created_at: new Date().toISOString() };
  await approvalsItem.setValue({ ...rows, [id]: stored });
  void showOnPage(stored);
  // The card only shows inside that tab: bring it (and its window) to the front so the user sees it.
  if (card.tabId !== undefined)
    void browser.tabs
      .update(card.tabId, { active: true })
      .then(async (tab) => {
        // drawAttention bounces the Dock icon (macOS) / flashes the taskbar when the user is in another app.
        if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true, drawAttention: true });
      })
      .catch(() => undefined);
  const reshow = (tabId: number, info: { status?: string }) => {
    if (tabId === card.tabId && info.status === 'complete') void showOnPage(stored);
  };
  browser.tabs.onUpdated.addListener(reshow);
  try {
    const answer = await new Promise<'allow' | 'deny' | 'always'>((resolve, reject) => {
      const timer = setTimeout(() => {
        stop();
        reject(
          new CommandError(
            ErrorCode.DENIED_BY_USER,
            'No answer within 110 s. Ask the user to answer the Senda card on the page (or in the Senda side panel), then try again.',
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
      throw new CommandError(ErrorCode.DENIED_BY_USER, 'The user denied this.');
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
    browser.tabs.onUpdated.removeListener(reshow);
    if (card.tabId !== undefined)
      void browser.scripting.executeScript({ target: { tabId: card.tabId }, func: hideApprovalCard, args: [id] }).catch(() => undefined);
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
