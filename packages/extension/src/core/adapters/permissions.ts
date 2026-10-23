import type { Adapter } from '@senda/adapter-schema';

export function permissionIncrease(prev: Adapter, next: Adapter): string[] {
  const lines = next.sites.filter((s) => !prev.sites.includes(s)).map((s) => `New site: ${s}`);
  if (prev.mode === 'read' && next.mode === 'write') lines.push('Adapter can now make changes');
  for (const e of (next.read_endpoints ?? []).filter((x) => !prev.read_endpoints?.includes(x))) lines.push(`New approved endpoint: ${e}`);
  for (const [name, tool] of Object.entries(next.tools)) if (tool.effect === 'write' && prev.tools[name]?.effect !== 'write') lines.push(`New write tool: ${name}`);
  return lines;
}
