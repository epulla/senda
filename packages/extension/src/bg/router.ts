import { ErrorCode, methods } from '@senda/protocol';
import navigate from './commands/navigate'; import snapshot from './commands/snapshot'; import click from './commands/click'; import typeCommand from './commands/type'; import scroll from './commands/scroll'; import tabs from './commands/tabs';
export class CommandError extends Error { constructor(public code: ErrorCode, message: string) { super(message); } }
const commands: Record<string, (p: any) => Promise<unknown>> = { navigate, snapshot, click, type: typeCommand, scroll, tabs };
export async function handle(method: string, params: unknown): Promise<unknown> {
  if (!(method in methods)) throw new CommandError(ErrorCode.ADAPTER_NOT_FOUND, `Unknown method: ${method}`);
  let parsed: unknown; try { parsed = methods[method as keyof typeof methods].parse(params); } catch (error) { throw new CommandError(ErrorCode.READ_ONLY, error instanceof Error ? error.message : 'Invalid parameters.'); }
  return commands[method]!(parsed);
}
