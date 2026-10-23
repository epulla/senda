import type { Adapter } from '@senda/adapter-schema';
import { useText } from '@/src/ui/i18n';

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
