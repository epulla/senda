import type { Adapter } from '@senda/adapter-schema';
import { en } from '../text/en';
import type { Text } from '../i18n';

export function permissionIncrease(prev: Adapter, next: Adapter, t: Text['permissions'] = en.permissions): string[] {
  const lines = next.sites.filter((s) => !prev.sites.includes(s)).map((s) => t.newSite(s));
  if (prev.mode === 'read' && next.mode === 'write') lines.push(t.canChange);
  for (const e of (next.read_endpoints ?? []).filter((x) => !prev.read_endpoints?.includes(x)))
    lines.push(t.newEndpoint(e));
  for (const [name, tool] of Object.entries(next.tools))
    if (tool.effect === 'write' && prev.tools[name]?.effect !== 'write') lines.push(t.newWriteTool(name));
  return lines;
}
