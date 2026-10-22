export function detectCapabilities(api: object): string[] {
  const capabilities: string[] = [];
  if ('tabGroups' in api) capabilities.push('tabGroups');
  return capabilities;
}
