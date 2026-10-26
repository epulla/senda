import { ErrorCode } from '@senda/protocol';
import { validateAdapter } from '../../core/adapters/validate';
import { matchesSites } from '../../core/adapters/sites';
import { wrapExternal } from '../../core/snapshot-format';
import { CommandError } from '../commands/shared';
import navigate from '../commands/navigate';
import { listAgentIds } from '../agent-tabs';
import { getAdapter } from './store';
import { requestApproval, noteExternal, logActivity, riskSource } from '../approvals';
import { settingsItem } from '../state';
import { bgText } from '../text';
import { resolveLang } from '../../core/i18n';

export async function runAdapter(input: {
  adapter: string;
  tool: string;
  args: Record<string, unknown>;
  draft?: boolean;
}) {
  const candidate = await getAdapter(input.adapter, input.draft);
  if (!candidate) throw new CommandError(ErrorCode.ADAPTER_NOT_FOUND, 'Adapter not found or paused.');
  const checked = validateAdapter(candidate, { blockedDomains: (await settingsItem.getValue()).blockedDomains });
  if (!checked.ok) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter validation failed.', checked.errors);
  const adapter = checked.adapter;
  const definition = adapter.tools[input.tool];
  if (!definition) throw new CommandError(ErrorCode.INVALID_PARAMS, 'Unknown adapter tool.');
  const start = adapter.start_url ?? adapter.sites[0]!.replace(/\*$/, '');
  const open = await browser.tabs.query({});
  const matching = (await listAgentIds())
    .reverse()
    .map((id) => open.find((candidate) => candidate.id === id))
    .filter((candidate) => candidate && matchesSites(candidate.url ?? '', adapter.sites));
  const tab = matching.find((candidate) => candidate!.url?.startsWith(start)) ?? matching[0];
  let tabId = tab?.id;
  if (tabId === undefined) {
    tabId = (await navigate({ url: start, newTab: true, internal: true }))?.tabId;
  } else if (adapter.start_url && !tab!.url?.startsWith(adapter.start_url)) {
    await navigate({ url: adapter.start_url, tabId, internal: true });
  }
  if (tabId === undefined) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open agent tab.');
  if (adapter.login_check) {
    const check = async () =>
      (
        await browser.scripting.executeScript({
          target: { tabId: tabId! },
          func: (selector: string) => !!document.querySelector(selector),
          args: [adapter.login_check!.exists],
        })
      )[0]?.result;
    // The current page may lack the marker (e.g. after a redirect); only the start page is authoritative.
    let loggedIn = await check();
    if (!loggedIn) {
      await navigate({ url: start, tabId, internal: true });
      loggedIn = await check();
    }
    if (!loggedIn)
      throw new CommandError(
        ErrorCode.ADAPTER_NEEDS_LOGIN,
        `Open ${new URL(start).host} in the 🤖 MCP tab and log in, then try again.`,
      );
  }
  const host = new URL(tab?.url ?? start).host;
  let resume: { step: number; vars: Record<string, unknown> } | undefined;
  let approved = false;
  for (let hop = 0; hop <= 50; hop++) {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
    const [{ result } = {}] = await browser.scripting.executeScript({
      target: { tabId },
      func: (input: unknown) => (globalThis as any).__sendaRun(input),
      args: [{ adapter, tool: input.tool, args: input.args, resume, approved }],
    });
    if (result && 'navigate' in result) {
      if (hop === 50) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter exceeded navigation limit.');
      await navigate({ url: result.navigate, tabId, internal: true });
      resume = result.resume;
      continue;
    }
    if (result && 'settle' in result) {
      await settle(tabId);
      resume = result.settle;
      continue;
    }
    if (result && 'confirm' in result) {
      const vars = result.confirm.vars;
      const uiText = await bgText();
      const settings = await settingsItem.getValue();
      const confirm =
        adapter.i18n?.[resolveLang(settings.language, navigator.language)]?.tools?.[input.tool]?.confirm ?? definition.confirm;
      const text = confirm
        ? String(
            (await import('../../core/adapters/template')).render(confirm, {
              args: input.args,
              vars,
              now: Math.floor(Date.now() / 1000),
            }),
          )
        : uiText.approval.adapterSummary(input.tool, adapter.name, host);
      const taint = await riskSource(settings.askBefore);
      if (settings.askBefore !== 'never' || taint) await requestApproval({
        kind: 'adapter',
        summary: text,
        host,
        url: tab?.url,
        tabId,
        // Only plain values people can read; skip internal lists and values that repeat an argument.
        details: [
          ...Object.entries(input.args).map(([k, v]) => [k, String(v).slice(0, 200)] as [string, string]),
          ...Object.entries(vars)
            .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
            .filter(([, v]) => !Object.values(input.args).some((arg) => String(arg) === String(v)))
            .map(([k, v]) => [uiText.approval.current(k), String(v).slice(0, 200)] as [string, string]),
        ],
        source: taint || undefined,
        allowAlways: false,
      });
      approved = true;
      resume = { step: result.confirm.step, vars };
      continue;
    }
    if (!result)
      throw new CommandError(
        ErrorCode.ADAPTER_BROKEN,
        `Page navigated during step ${resume?.step ?? 0}.`,
        { step_index: resume?.step ?? 0 },
      );
    if (!result.ok) throw new CommandError(result.code, result.message, result.data);
    const json = JSON.stringify(result.value ?? null, null, 2);
    if (definition.effect === 'write') await logActivity('adapter', `${adapter.name}: ${input.tool}`);
    await noteExternal(host, json);
    return wrapExternal(host, json);
  }
  throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter exceeded navigation limit.');
}

async function settle(tabId: number) {
  await new Promise((r) => setTimeout(r, 500));
  const end = Date.now() + 25000;
  while ((await browser.tabs.get(tabId)).status === 'loading') {
    if (Date.now() > end) throw new CommandError(ErrorCode.TIMEOUT, 'Page load timed out.');
    await new Promise((r) => setTimeout(r, 100));
  }
}
