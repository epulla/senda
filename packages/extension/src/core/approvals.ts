import { isSensitiveLabel } from './sensitive';
import { en } from './text/en';
import type { Text } from './i18n';

export function needsApproval(input: {
  action: 'click' | 'type' | 'navigate' | 'read';
  label?: string;
  url: string;
  submit?: boolean;
  visitedHosts: string[];
  allowedDomains: string[];
  alwaysSites: string[];
  askBefore: 'never' | 'destructive' | 'changes' | 'everything';
  tainted: boolean;
}, t: Text['approval'] = en.approval): string | null {
  let host = '';
  try {
    host = new URL(input.url).host;
  } catch {}
  const includes = (list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));
  if (input.askBefore === 'never' && !input.tainted) return null;
  if (!input.tainted && includes(input.alwaysSites)) return null;
  const askBefore = input.askBefore === 'never' ? 'destructive' : input.askBefore;
  if (askBefore === 'everything') return t.reasons.everything;
  if (input.action === 'click' && input.label && isSensitiveLabel(input.label))
    return t.reasons.sensitiveClick;
  if (input.action === 'type' && input.submit) return t.reasons.submit;
  if (askBefore === 'changes' && (input.action === 'click' || input.action === 'type'))
    return t.reasons.changes;
  if (input.action === 'navigate' && !input.visitedHosts.includes(host) && !includes(input.allowedDomains)) {
    try {
      const url = new URL(input.url);
      if (url.search || url.hash) return t.reasons.newSiteData;
    } catch {}
  }
  return null;
}
