import { expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ErrorCode } from '@senda/protocol';

it('fails a navigation right away when its tab closes', async () => {
  vi.stubGlobal('browser', fakeBrowser);
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 5 } as any);
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5 } as any);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const pending = navigate({ url: 'https://example.com/', tabId: 5 });
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  await fakeBrowser.tabs.onRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
  await expect(pending).rejects.toMatchObject({ code: ErrorCode.TAB_GONE });
});
