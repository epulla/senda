import { fakeBrowser } from 'wxt/testing/fake-browser';
import { vi } from 'vitest';

// Source code sees fakeBrowser directly, so tab groups are toggled on the shared object.
const tabGroups = fakeBrowser.tabGroups;
export function stubBrowserWithoutTabGroups() {
  Reflect.deleteProperty(fakeBrowser, 'tabGroups');
  vi.stubGlobal('browser', fakeBrowser);
}
export function stubBrowserWithTabGroups() {
  Object.assign(fakeBrowser, { tabGroups });
  vi.stubGlobal('browser', fakeBrowser);
}
