import { detectCapabilities } from '@/src/core/capabilities';

export async function openSidePanel() {
  if (detectCapabilities(browser).includes('sidePanel')) {
    const win = await browser.windows.getCurrent();
    await browser.sidePanel.open({ windowId: win.id! });
  } else await browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html' as never) });
}
