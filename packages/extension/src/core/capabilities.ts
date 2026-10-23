export function detectCapabilities(api: object): string[] {
  const capabilities: string[] = [];
  if ('tabGroups' in api) capabilities.push('tabGroups');
  if ('sidePanel' in api) capabilities.push('sidePanel');
  return capabilities;
}
