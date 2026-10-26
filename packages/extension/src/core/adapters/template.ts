export function render(
  value: unknown,
  ctx: { args: Record<string, unknown>; vars: Record<string, unknown>; now: number },
  escape: (text: string) => string = (text) => text,
): unknown {
  if (Array.isArray(value)) return value.map((v) => render(v, ctx, escape));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, render(v, ctx, escape)]));
  if (typeof value !== 'string') return value;
  const token = /^(?:\{\{(args|vars)\.([\w.]+)\}\}|\{\{now\}\})$/.exec(value);
  const lookup = (root: 'args' | 'vars', path: string): unknown =>
    path
      .split('.')
      .reduce<unknown>((v, k) => (v != null ? (v as any)[/^\d+$/.test(k) ? Number(k) : k] : undefined), ctx[root]);
  if (token) return token[0] === '{{now}}' ? ctx.now : lookup(token[1] as 'args' | 'vars', token[2]!);
  return value.replace(/\{\{(args|vars)\.([\w.]+)\}\}|\{\{now\}\}/g, (_, root, path) =>
    escape(String(root ? (lookup(root, path) ?? '') : ctx.now)),
  );
}
// Keeps values inserted into a quoted CSS selector (e.g. [title="{{args.chat}}"]) from breaking out of the quotes.
export const cssString = (text: string) => text.replace(/[\\"]/g, '\\$&').replace(/\n/g, '\\a ');
