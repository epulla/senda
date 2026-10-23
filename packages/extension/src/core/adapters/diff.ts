import type { Adapter } from '@senda/adapter-schema';
import { en } from '../text/en';
import type { Text } from '../i18n';

export function describeChanges(prev: Adapter | undefined, next: Adapter, t: Text['diff'] = en.diff): string[] {
  const tools = Object.keys(next.tools);
  const siteNames = next.sites.map((s) => s.replace(/^https?:\/\//, '').replace(/\/\*$/, ''));
  if (!prev)
    return [
      t.add(next.name, next.mode === 'read' ? t.mode.read : t.mode.write, tools.length, tools.join(', '), siteNames.join(', ')),
    ];
  const lines: string[] = [];
  for (const tool of tools.filter((x) => !prev.tools[x])) lines.push(t.addTool(tool));
  for (const tool of Object.keys(prev.tools).filter((x) => !next.tools[x])) lines.push(t.removeTool(tool));
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
  for (const tool of tools.filter((x) => prev.tools[x])) {
    const a = selectors(prev.tools[tool]!.steps as Record<string, any>[]),
      b = selectors(next.tools[tool]!.steps as Record<string, any>[]);
    if (JSON.stringify(prev.tools[tool]!.steps) !== JSON.stringify(next.tools[tool]!.steps)) {
      const changed = a.map((old, i) => (b[i] && old !== b[i] ? `${old} → ${b[i]}` : '')).filter(Boolean);
      lines.push(t.updateTool(tool, changed.length ? `: ${t.selector} ${changed.join(', ')}` : ''));
    }
  }
  for (const s of next.sites.filter((x) => !prev.sites.includes(x))) lines.push(t.addSite(s));
  for (const s of prev.sites.filter((x) => !next.sites.includes(x))) lines.push(t.removeSite(s));
  if (prev.mode !== next.mode) lines.push(t.changeAccess(t.mode[prev.mode], t.mode[next.mode]));
  for (const e of (next.read_endpoints ?? []).filter((x) => !prev.read_endpoints?.includes(x)))
    lines.push(t.addEndpoint(e));
  if (prev.version !== next.version) lines.push(t.updateVersion(prev.version, next.version));
  return lines;
}
