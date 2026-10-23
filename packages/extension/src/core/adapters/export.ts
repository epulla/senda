import type { Adapter } from '@senda/adapter-schema';

export function exportRecipe(
  entry: { adapter: Adapter; from?: { site: string; [key: string]: unknown }; override?: Record<string, Adapter['tools'][string]> },
  template?: Adapter & { tools: Adapter['tools'] },
) {
  if (!entry.from || !template) return entry.adapter;
  const url = new URL(entry.from.site);
  const siteUrl = url.origin + url.pathname.replace(/\/+$/, '');
  const restore = (value: unknown): unknown => typeof value === 'string'
    ? value.replaceAll(siteUrl, '{{site}}')
    : Array.isArray(value) ? value.map(restore)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restore(item)])) : value;
  return { ...template, tools: { ...template.tools, ...restore(entry.override ?? {}) as Record<string, Adapter['tools'][string]> } };
}
