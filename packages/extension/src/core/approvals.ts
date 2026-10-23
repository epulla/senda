import { isSensitiveLabel } from './sensitive';

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
}): string | null {
  let host = '';
  try {
    host = new URL(input.url).host;
  } catch {}
  const includes = (list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));
  if (input.askBefore === 'never' && !input.tainted) return null;
  if (!input.tainted && includes(input.alwaysSites)) return null;
  const askBefore = input.askBefore === 'never' ? 'destructive' : input.askBefore;
  if (askBefore === 'everything') return 'You asked to approve every browser action.';
  if (input.action === 'click' && input.label && isSensitiveLabel(input.label))
    return 'This click may send, change, or delete information.';
  if (input.action === 'type' && input.submit) return 'This will submit a form.';
  if (askBefore === 'changes' && (input.action === 'click' || input.action === 'type'))
    return 'You asked to approve changes.';
  if (input.action === 'navigate' && !input.visitedHosts.includes(host) && !includes(input.allowedDomains)) {
    try {
      const url = new URL(input.url);
      if (url.search || url.hash) return 'This may send data to a new site.';
    } catch {}
  }
  return null;
}
