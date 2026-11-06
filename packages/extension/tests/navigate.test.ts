import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithoutTabGroups } from './no-tab-groups';
import { ErrorCode } from '@senda/protocol';

// fake-browser has no tabs.onReplaced; keep the listener so tests can fire it.
let replaced: ((added: number, removed: number) => void) | undefined;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(fakeBrowser.tabs.onReplaced, 'addListener').mockImplementation((fn) => void (replaced = fn));
  vi.spyOn(fakeBrowser.tabs.onReplaced, 'removeListener').mockImplementation(() => void (replaced = undefined));
});

it('fails a navigation right away when its tab closes', async () => {
  stubBrowserWithoutTabGroups();
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 5 } as any);
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5 } as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const pending = navigate({ url: 'https://example.com/', tabId: 5 });
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  await fakeBrowser.tabs.onRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
  await expect(pending).rejects.toMatchObject({ code: ErrorCode.TAB_GONE });
});

it('follows a tab that Chrome replaces during navigation', async () => {
  stubBrowserWithoutTabGroups();
  vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async (id: number) => ({ id }) as any);
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5 } as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const pending = navigate({ url: 'https://example.com/', tabId: 5 });
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  replaced!(6, 5);
  await fakeBrowser.tabs.onUpdated.trigger(6, { status: 'complete' }, { id: 6 } as any);
  await expect(pending).resolves.toMatchObject({ tabId: 6 });
});

it('retries once in a new tab when the reused agent tab vanishes and no tabId was given', async () => {
  stubBrowserWithoutTabGroups();
  let gone = false;
  vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async (id: number) => {
    if (id === 5 && gone) throw new Error('No tab with id: 5');
    return { id } as any;
  });
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5 } as any);
  const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({ id: 7 } as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const pending = navigate({ url: 'https://example.com/' });
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  gone = true;
  await fakeBrowser.tabs.onRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
  await vi.waitFor(() => expect(create).toHaveBeenCalled());
  await fakeBrowser.tabs.onUpdated.trigger(7, { status: 'complete' }, { id: 7 } as any);
  await expect(pending).resolves.toMatchObject({ tabId: 7 });
});
