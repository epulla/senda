import { Adapter, type Adapter as AdapterType } from '@senda/adapter-schema';
import { validateAdapter } from './validate';

export function applyOverride(adapter: AdapterType, override?: Record<string, unknown>): AdapterType {
  return override ? { ...adapter, tools: { ...adapter.tools, ...override } } as AdapterType : adapter;
}

export function computeOverride(materialized: AdapterType, edited: AdapterType): { override: Record<string, unknown> } | null {
  const { tools: before, ...a } = materialized;
  const { tools: after, ...b } = edited;
  if (JSON.stringify(a) !== JSON.stringify(b)) return null;
  const override: Record<string, unknown> = {};
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) {
      if (!(name in after)) return null;
      override[name] = after[name];
    }
  return { override };
}

export function materialize(
  template: unknown,
  site: string,
  label: string,
  opts?: { blockedDomains?: string[] },
): { ok: true; adapter: AdapterType } | { ok: false; errors: string[] } {
  const parsed = Adapter.safeParse(template);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'adapter'}: ${issue.message}`) };
  const source = parsed.data;
  if (!source.template) return { ok: false, errors: ['Adapter is not a template'] };
  let url: URL;
  try {
    url = new URL(site);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error();
  } catch {
    return { ok: false, errors: ['Invalid site URL'] };
  }
  if (!/^[a-z0-9_]{1,20}$/.test(label)) return { ok: false, errors: ['Invalid label'] };
  if (source.sites.some((entry) => !entry.startsWith('{{site}}/')))
    return { ok: false, errors: ['Template sites must start with {{site}}/'] };
  const pathname = url.pathname.replace(/\/+$/, '');
  const siteUrl = url.origin + pathname;
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replaceAll('{{site_path}}', pathname).replaceAll('{{site}}', siteUrl);
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  const { template: _template, ...rest } = source;
  const result = replace({ ...rest, id: `${source.id}_${label}`, name: `${source.name} (${url.host}${pathname})` });
  return validateAdapter(result, opts);
}
