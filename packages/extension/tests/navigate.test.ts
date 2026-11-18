import { beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithoutTabGroups } from './no-tab-groups';
import { ErrorCode } from '@senda/protocol';

beforeEach(() => {
  vi.restoreAllMocks();
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
  await expect(pending).rejects.toMatchObject({ code: ErrorCode.TAB_GONE, message: expect.stringContaining('another extension') });
});

it('follows a tab that Chrome replaces during navigation', async () => {
  stubBrowserWithoutTabGroups();
  vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async (id: number) => ({ id }) as any);
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5 } as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const pending = navigate({ url: 'https://example.com/', tabId: 5 });
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  await (fakeBrowser.tabs.onReplaced as any).trigger(6, 5);
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
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockImplementation(async (id: any) => ({ id }) as any);
  const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({ id: 7 } as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const pending = navigate({ url: 'https://example.com/' });
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  gone = true;
  await fakeBrowser.tabs.onRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(7, { url: 'https://example.com/' }));
  expect(create).toHaveBeenCalledWith({ url: 'about:blank' });
  await fakeBrowser.tabs.onUpdated.trigger(7, { status: 'complete' }, { id: 7 } as any);
  await expect(pending).resolves.toMatchObject({ tabId: 7 });
});

it('opens a blank new tab whose load finished before tabs.create returned', async () => {
  stubBrowserWithoutTabGroups();
  vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async (id: number) => ({ id }) as any);
  const update = vi.spyOn(fakeBrowser.tabs, 'update');
  vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(async () => {
    await fakeBrowser.tabs.onUpdated.trigger(7, { status: 'complete' }, { id: 7 } as any);
    return { id: 7 } as any;
  });
  const { default: navigate } = await import('../src/bg/commands/navigate');
  await expect(navigate({ url: 'about:blank', newTab: true, internal: true })).resolves.toMatchObject({ tabId: 7 });
  expect(update).not.toHaveBeenCalled();
});

it('reports a likely Leave site? dialog when the navigation never starts, until the page responds again', async () => {
  stubBrowserWithoutTabGroups();
  vi.useFakeTimers();
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 5 } as any);
  vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({ id: 5 } as any);
  let respond = false;
  const script = vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(() => (respond ? Promise.resolve([]) : new Promise(() => {})) as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: navigate } = await import('../src/bg/commands/navigate');
  const { target } = await import('../src/bg/commands/shared');
  const pending = expect(navigate({ url: 'https://example.com/', tabId: 5 })).rejects.toMatchObject({ code: ErrorCode.PAGE_DIALOG, message: expect.stringContaining('Leave site?') });
  await vi.advanceTimersByTimeAsync(3000);
  await pending;
  const blocked = expect(target(5)).rejects.toMatchObject({ code: ErrorCode.PAGE_DIALOG });
  await vi.advanceTimersByTimeAsync(1000);
  await blocked;
  respond = true;
  await expect(target(5)).resolves.toBe(5);
  script.mockClear();
  await expect(target(5)).resolves.toBe(5);
  expect(script).not.toHaveBeenCalled();
  vi.useRealTimers();
});
