import { Adapter, WRITE_STEPS, type Adapter as AdapterType } from '@senda/adapter-schema';
import { matchesSites } from './sites';

export function validateAdapter(
  input: unknown,
  opts?: { blockedDomains?: string[] },
): { ok: true; adapter: AdapterType } | { ok: false; errors: string[] } {
  const parsed = Adapter.safeParse(input);
  if (!parsed.success)
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'adapter'}: ${i.message}`) };
  const adapter = parsed.data;
  const errors: string[] = [];
  for (const site of adapter.sites) {
    const m = /^(https?):\/\/([^/*?:#]+(?::\d+)?)\/(.*)$/.exec(site);
    if (site === '<all_urls>' || !m || (site.indexOf('*') >= 0 && site.indexOf('*') < site.indexOf('/'))) {
      errors.push(`Invalid site pattern: ${site}`);
      continue;
    }
    const host = m[2] ?? '';
    if (
      (opts?.blockedDomains ?? []).some(
        (domain) => host.split(':')[0] === domain || host.split(':')[0]!.endsWith(`.${domain}`),
      )
    )
      errors.push(`Site is blocked: ${site}`);
  }
  const siteMatches = (url: string) => matchesSites(url, adapter.sites);
  if (adapter.start_url && !siteMatches(adapter.start_url)) errors.push('start_url must match one of the listed sites');
  for (const [name, tool] of Object.entries(adapter.tools)) {
    if (adapter.mode === 'read' && tool.effect === 'write')
      errors.push(`Read-only adapter cannot have write tool: ${name}`);
    const inspect = (steps: Record<string, any>[]) =>
      steps.forEach((step) => {
        for (const key of WRITE_STEPS)
          if (tool.effect === 'read' && step[key] !== undefined) errors.push(`Read tool ${name} cannot use ${key}`);
        if (step.if_exists) {
          inspect(step.if_exists.then as Record<string, any>[]);
          if (step.if_exists.else) inspect(step.if_exists.else as Record<string, any>[]);
        }
        if (step.navigate) {
          const url = step.navigate.url,
            originText = url.split('{{')[0];
          if (url.startsWith('/')) {
            if (/^\/[/\\]/.test(url)) errors.push(`Tool ${name} has invalid navigation URL: ${url}`);
          } else {
            try {
              // The literal part must contain the whole origin plus "/", so templates can't change the host.
              const u = new URL(originText);
              if (!originText.startsWith(`${u.origin}/`) || !siteMatches(originText))
                errors.push(`Tool ${name} navigates outside its sites: ${url}`);
            } catch {
              errors.push(`Tool ${name} has invalid navigation URL: ${url}`);
            }
          }
        }
        if (step.request) {
          const path = step.request.path;
          if (!path.startsWith('/') || /^\/[/\\{]/.test(path))
            errors.push(`Tool ${name} has invalid request path: ${path}`);
          if (
            tool.effect === 'read' &&
            step.request.method === 'POST' &&
            !adapter.read_endpoints?.includes(path.split('?')[0])
          )
            errors.push(`POST endpoint is not approved for read tool ${name}: ${path}`);
        }
      });
    inspect(tool.steps as Record<string, any>[]);
  }
  return errors.length ? { ok: false, errors } : { ok: true, adapter };
}
