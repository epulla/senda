import type { Adapter } from '@senda/adapter-schema';

export function describeChanges(prev: Adapter | undefined, next: Adapter): string[] {
  const tools = Object.keys(next.tools);
  const siteNames = next.sites.map((s) => s.replace(/^https?:\/\//, '').replace(/\/\*$/, ''));
  if (!prev)
    return [
      `Add "${next.name}" (${next.mode === 'read' ? 'read only' : 'can make changes'}) with ${tools.length} tools: ${tools.join(', ')}. Only works on ${siteNames.join(', ')}.`,
    ];
  const lines: string[] = [];
  for (const t of tools.filter((x) => !prev.tools[x])) lines.push(`Add tool: ${t}.`);
  for (const t of Object.keys(prev.tools).filter((x) => !next.tools[x])) lines.push(`Remove tool: ${t}.`);
  const selectors = (steps: Record<string, any>[]): string[] =>
    steps.flatMap((s) => {
      const val =
        s.click ??
        s.exists ??
        s.wait_for ??
        s.type ??
        s.select ??
        s.submit ??
        s.extract ??
        s.extract_list ??
        s.navigate;
      const selector = val && 'selector' in val ? val.selector : undefined;
      return [
        ...(selector ? [selector] : []),
        ...(s.extract_list?.item ? [s.extract_list.item] : []),
        ...(s.if_exists ? [...selectors(s.if_exists.then), ...selectors(s.if_exists.else ?? [])] : []),
      ];
    });
  for (const t of tools.filter((x) => prev.tools[x])) {
    const a = selectors(prev.tools[t]!.steps as Record<string, any>[]),
      b = selectors(next.tools[t]!.steps as Record<string, any>[]);
    if (JSON.stringify(prev.tools[t]!.steps) !== JSON.stringify(next.tools[t]!.steps)) {
      const changed = a.map((old, i) => (b[i] && old !== b[i] ? `${old} → ${b[i]}` : '')).filter(Boolean);
      lines.push(`Update tool ${t}${changed.length ? `: selector ${changed.join(', ')}` : ''}.`);
    }
  }
  for (const s of next.sites.filter((x) => !prev.sites.includes(x))) lines.push(`Add site: ${s}.`);
  for (const s of prev.sites.filter((x) => !next.sites.includes(x))) lines.push(`Remove site: ${s}.`);
  if (prev.mode !== next.mode) lines.push(`Change access from ${prev.mode} to ${next.mode}.`);
  for (const e of (next.read_endpoints ?? []).filter((x) => !prev.read_endpoints?.includes(x)))
    lines.push(`Add approved endpoint: ${e}.`);
  if (prev.version !== next.version) lines.push(`Update version from ${prev.version} to ${next.version}.`);
  return lines;
}
