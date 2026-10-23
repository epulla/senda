import { ErrorCode } from '@senda/protocol';
import { validateAdapter } from '../../core/adapters/validate';
import { matchesSites } from '../../core/adapters/sites';
import { wrapExternal } from '../../core/snapshot-format';
import { CommandError } from '../commands/shared';
import navigate from '../commands/navigate';
import { isAgentTab, listAgentIds } from '../agent-tabs';
import { getAdapter } from './store';
import { requestApproval, noteExternal, logActivity } from '../approvals';
import { settingsItem, taintItem } from '../state';

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
  const tab = (await browser.tabs.query({})).find(
    (candidate) =>
      candidate.id !== undefined && isAgentTab(candidate.id) && matchesSites(candidate.url ?? '', adapter.sites),
  );
  let tabId = tab?.id;
  if (tabId === undefined) {
    await navigate({ url: start, newTab: true, internal: true });
    tabId = listAgentIds().at(-1);
  }
  if (tabId === undefined) throw new CommandError(ErrorCode.TAB_GONE, 'Could not open agent tab.');
  if (adapter.login_check) {
    const [{ result: loggedIn } = {}] = await browser.scripting.executeScript({
      target: { tabId },
      func: (selector: string) => !!document.querySelector(selector),
      args: [adapter.login_check.exists],
    });
    if (!loggedIn)
      throw new CommandError(
        ErrorCode.ADAPTER_NEEDS_LOGIN,
        `Open ${new URL(start).host} in the 🤖 MCP tab and log in, then try again.`,
      );
  }
  const host = new URL(tab?.url ?? start).host;
  let resume: { step: number; vars: Record<string, unknown> } | undefined;
  let approved = false;
  for (let hop = 0; hop <= 10; hop++) {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
    const [{ result } = {}] = await browser.scripting.executeScript({
      target: { tabId },
      func: (input: unknown) => (globalThis as any).__sendaRun(input),
      args: [{ adapter, tool: input.tool, args: input.args, resume, approved }],
    });
    if (result && 'navigate' in result) {
      if (hop === 10) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter exceeded navigation limit.');
      await navigate({ url: result.navigate, tabId, internal: true });
      resume = result.resume;
      continue;
    }
    if (result && 'confirm' in result) {
      const vars = result.confirm.vars;
      const text = definition.confirm
        ? String(
            (await import('../../core/adapters/template')).render(definition.confirm, {
              args: input.args,
              vars,
              now: Math.floor(Date.now() / 1000),
            }),
          )
        : `Your AI wants to use ${input.tool} on ${adapter.name} (${host}).`;
      const taint = await taintItem.getValue();
      await requestApproval({
        kind: 'adapter',
        summary: text,
        host,
        url: tab?.url,
        details: [
          ...Object.entries(input.args).map(([k, v]) => [k, String(v).slice(0, 200)] as [string, string]),
          ...Object.entries(vars).map(([k, v]) => [`Current ${k}`, String(v).slice(0, 200)] as [string, string]),
        ],
        source: taint || undefined,
        allowAlways: false,
      });
      approved = true;
      resume = { step: result.confirm.step, vars };
      continue;
    }
    if (!result?.ok)
      throw new CommandError(
        result?.code ?? ErrorCode.ADAPTER_BROKEN,
        result?.message ?? 'Adapter failed.',
        result?.data,
      );
    const json = JSON.stringify(result.value ?? null, null, 2);
    if (definition.effect === 'write') await logActivity('adapter', `${adapter.name}: ${input.tool}`);
    await noteExternal(host, json);
    return wrapExternal(host, json);
  }
  throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter exceeded navigation limit.');
}
