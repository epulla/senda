import type { Adapter } from '@senda/adapter-schema';
import { useText } from '@/src/ui/i18n';

export function localize(adapter: Adapter, language: string) {
  const tr = adapter.i18n?.[language];
  return {
    name: tr?.name ?? adapter.name,
    description: tr?.description ?? adapter.description,
    tool: (name: string) => tr?.tools?.[name]?.description ?? adapter.tools[name]?.description ?? '',
  };
}

export const siteNames = (adapter: Adapter) =>
  adapter.sites.map((site) => site.replace(/^https?:\/\//, '').replace(/\/\*$/, '')).join(', ');

export function ModeBadge({ mode }: { mode: 'read' | 'write' }) {
  const t = useText().labels.badge;
  return mode === 'read' ? (
    <span className="rounded-full border border-line px-2 text-xs font-medium whitespace-nowrap text-muted">{t.read}</span>
  ) : (
    <span className="rounded-full border border-error-text/40 bg-error/10 px-2 text-xs font-medium whitespace-nowrap text-error-text">
      {t.write}
    </span>
  );
}
