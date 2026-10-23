import { ErrorCode } from '@senda/protocol';
import { validateAdapter } from '../../core/adapters/validate';
import { matchesSites } from '../../core/adapters/sites';
import { wrapExternal } from '../../core/snapshot-format';
import { CommandError } from '../commands/shared';
import navigate from '../commands/navigate';
import { isAgentTab, listAgentIds } from '../agent-tabs';
import { getAdapter } from './store';

export async function runAdapter(input: {
  adapter: string;
  tool: string;
  args: Record<string, unknown>;
  draft?: boolean;
}) {
  const candidate = await getAdapter(input.adapter, input.draft);
  if (!candidate) throw new CommandError(ErrorCode.ADAPTER_NOT_FOUND, 'Adapter not found or paused.');
  const checked = validateAdapter(candidate);
  if (!checked.ok) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter validation failed.', checked.errors);
  const adapter = checked.adapter;
  const definition = adapter.tools[input.tool];
  if (!definition) throw new CommandError(ErrorCode.INVALID_PARAMS, 'Unknown adapter tool.');
  if (definition.effect === 'write')
    throw new CommandError(ErrorCode.READ_ONLY, 'Changing things on sites comes in a later version.');
  const start = adapter.start_url ?? adapter.sites[0]!.replace(/\*$/, '');
  const tab = (await browser.tabs.query({})).find(
    (candidate) =>
      candidate.id !== undefined && isAgentTab(candidate.id) && matchesSites(candidate.url ?? '', adapter.sites),
  );
  let tabId = tab?.id;
  if (tabId === undefined) {
    await navigate({ url: start, newTab: true });
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
  for (let hop = 0; hop <= 10; hop++) {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/runner.js'] });
    const [{ result } = {}] = await browser.scripting.executeScript({
      target: { tabId },
      func: (input: unknown) => (globalThis as any).__sendaRun(input),
      args: [{ adapter, tool: input.tool, args: input.args, resume }],
    });
    if (result && 'navigate' in result) {
      if (hop === 10) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter exceeded navigation limit.');
      await navigate({ url: result.navigate, tabId });
      resume = result.resume;
      continue;
    }
    if (!result?.ok)
      throw new CommandError(
        result?.code ?? ErrorCode.ADAPTER_BROKEN,
        result?.message ?? 'Adapter failed.',
        result?.data,
      );
    return wrapExternal(host, JSON.stringify(result.value ?? null, null, 2));
  }
  throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter exceeded navigation limit.');
}
