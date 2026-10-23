import type { Adapter } from '@senda/adapter-schema';

export const siteNames = (adapter: Adapter) =>
  adapter.sites.map((site) => site.replace(/^https?:\/\//, '').replace(/\/\*$/, '')).join(', ');
export const modeLabel = (adapter: Adapter) => (adapter.mode === 'read' ? 'read only' : 'can make changes');
export const sourceLabel: Record<Adapter['source'], string> = {
  official: 'Official, from Senda',
  community: 'Imported, not verified by Senda',
  local: 'Made by your AI',
};

export function ModeBadge({ mode }: { mode: 'read' | 'write' }) {
  return mode === 'read' ? (
    <span className="rounded-full border border-line px-2 text-xs font-medium whitespace-nowrap text-muted">Only reads</span>
  ) : (
    <span className="rounded-full border border-error-text/40 bg-error/10 px-2 text-xs font-medium whitespace-nowrap text-error-text">
      Can make changes
    </span>
  );
}
