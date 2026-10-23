export function matchesSites(url: string, sites: string[]): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return sites.some((site) => {
    const match = /^(https?):\/\/([^/*?:#]+(?::\d+)?)\/(.*)$/.exec(site);
    if (!match || parsed.protocol !== `${match[1]}:` || parsed.host !== match[2]) return false;
    const patternPath = match[3] ?? '';
    const path = patternPath.endsWith('*') ? patternPath.slice(0, -1) : patternPath;
    return parsed.pathname.startsWith(`/${path}`);
  });
}
