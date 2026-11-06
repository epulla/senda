import { ErrorCode, methods } from '@senda/protocol';
import navigate from './commands/navigate';
import snapshot from './commands/snapshot';
import click from './commands/click';
import typeCommand from './commands/type';
import scroll from './commands/scroll';
import tabs from './commands/tabs';
import { back, forward } from './commands/history';
import { installRecipe, list, removeAdapter, saveDraft, saveTestResult, setStatus, submitDraft } from './adapters/store';
import { runAdapter } from './adapters/run';
import { CommandError } from './commands/shared';
export { CommandError } from './commands/shared';
const commands: Record<string, (p: any) => Promise<unknown>> = {
  navigate,
  snapshot,
  click,
  type: typeCommand,
  scroll,
  tabs,
  back,
  forward,
  'adapter.list': list,
  'adapter.install': installRecipe,
  'adapter.draft': (p: any) => saveDraft(p.recipe),
  'adapter.test': async (p: any) => {
    try {
      const text = await runAdapter({ adapter: p.id, tool: p.tool, args: p.args ?? {}, draft: true });
      await saveTestResult(p.id, `${p.tool}: ${text}`);
      return text;
    } catch (error) {
      await saveTestResult(p.id, `${p.tool} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  },
  'adapter.run': (p: any) => runAdapter({ adapter: p.adapter, tool: p.tool, args: p.args ?? {} }),
  'adapter.submit': submitDraft,
  'adapter.disable': (p: any) => setStatus(p.id, 'paused'),
  'adapter.remove': (p: any) => removeAdapter(p.id),
};
export async function handle(method: string, params: unknown): Promise<unknown> {
  if (!(method in methods)) throw new CommandError(ErrorCode.INVALID_PARAMS, `Unknown method: ${method}`);
  let parsed: unknown;
  try {
    parsed = methods[method as keyof typeof methods].parse(params);
  } catch (error) {
    throw new CommandError(ErrorCode.INVALID_PARAMS, error instanceof Error ? error.message : 'Invalid parameters.');
  }
  return commands[method]!(parsed);
}
