import { ErrorCode } from '@senda/protocol';
import { CommandError } from '../commands/shared';

const bundled = import.meta.glob('../../../../../adapters/*/adapter.json', { eager: true, import: 'default' });
export function bundledTemplates(): Record<string, any> {
  return Object.fromEntries(Object.values(bundled).map((template: any) => [template.id, template]));
}
export async function fetchTemplate(url: string): Promise<unknown> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error();
    const response = await fetch(parsed);
    if (!response.ok) throw new Error();
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > 1024 * 1024) throw new Error();
    return JSON.parse(text);
  } catch {
    throw new CommandError(ErrorCode.INVALID_PARAMS, 'Template URL must return valid JSON over HTTPS (maximum 1 MB).');
  }
}
