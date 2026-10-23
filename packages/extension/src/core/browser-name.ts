export function detectBrowserName(
  nav: { brave?: unknown; userAgentData?: { brands?: { brand: string }[] } },
  target: string,
): string {
  if (target === 'firefox') return 'Firefox';
  if (nav.brave) return 'Brave';
  const brands = nav.userAgentData?.brands?.map(({ brand }) => brand) ?? [];
  if (brands.includes('Microsoft Edge')) return 'Edge';
  if (brands.includes('Opera')) return 'Opera';
  if (brands.includes('Vivaldi')) return 'Vivaldi';
  if (brands.includes('Google Chrome')) return 'Chrome';
  return 'Chromium';
}
