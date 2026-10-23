import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithTabGroups, stubBrowserWithoutTabGroups } from './no-tab-groups';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../src/bg/commands/navigate', () => ({ default: navigate }));

describe('agent tabs', () => {
  beforeEach(() => {
    vi.resetModules();
    fakeBrowser.reset();
    stubBrowserWithoutTabGroups();
  });

  it('untracks an agent tab when it is closed', async () => {
    const { trackAgentTab, isAgentTab } = await import('../src/bg/agent-tabs');
    trackAgentTab(7);
    await fakeBrowser.tabs.onRemoved.trigger(7, { windowId: 1, isWindowClosing: false });
    expect(await isAgentTab(7)).toBe(false);
  });

  it('target skips closed agent tabs and falls back to a live one or a new tab', async () => {
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    const { target } = await import('../src/bg/commands/shared');
    const live = new Set([1]);
    vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async (id) => {
      if (!live.has(id)) throw Error('No tab');
      return { id } as any;
    });
    trackAgentTab(1);
    trackAgentTab(2);
    expect(await target()).toBe(1);
    live.clear();
    expect(await target(undefined, true)).toBe(-1);
  });

  it('opens a new tab for browser_tabs new', async () => {
    const { default: tabs } = await import('../src/bg/commands/tabs');
    await tabs({ action: 'new', url: 'https://example.com/' });
    expect(navigate).toHaveBeenCalledWith({ url: 'https://example.com/', newTab: true });
  });

  it('uses one MCP group, observes moved tabs live, and survives module reload', async () => {
    stubBrowserWithTabGroups();
    const groups = new Map<number, { id: number; title?: string; windowId?: number }>();
    const tabs = new Map<number, any>([[1, { id: 1, windowId: 1, groupId: -1, lastAccessed: 1 }], [2, { id: 2, windowId: 1, groupId: -1, lastAccessed: 2 }], [3, { id: 3, windowId: 1, groupId: -1, lastAccessed: 3 }]]);
    let nextGroup = 10;
    vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async (id) => tabs.get(id) as any);
    vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(async () => [...tabs.values()] as any);
    vi.spyOn(fakeBrowser.tabGroups, 'query').mockImplementation(async (q: any) => [...groups.values()].filter((g) => (!q.title || g.title === q.title) && (!q.windowId || g.windowId === q.windowId)) as any);
    vi.spyOn(fakeBrowser.tabGroups, 'get').mockImplementation(async (id) => groups.get(id) as any);
    vi.spyOn(fakeBrowser.tabGroups, 'update').mockImplementation(async (id, update: any) => Object.assign(groups.get(id)!, update) as any);
    vi.spyOn(fakeBrowser.tabs, 'group').mockImplementation(async ({ tabIds, groupId }: any) => {
      const id = groupId ?? nextGroup++;
      if (!groups.has(id)) groups.set(id, { id, windowId: 1 });
      for (const tabId of tabIds) tabs.get(tabId)!.groupId = id;
      return id;
    });
    vi.spyOn(fakeBrowser.tabs, 'ungroup').mockImplementation(async (ids: any) => { for (const id of Array.isArray(ids) ? ids : [ids]) tabs.get(id)!.groupId = -1; });
    const { addAgentTab, isAgentTab, listAgentIds } = await import('../src/bg/agent-tabs');
    await addAgentTab(1);
    await addAgentTab(2);
    expect((await fakeBrowser.tabGroups.query({ title: '🤖 MCP' }) as any[])).toHaveLength(1);
    tabs.get(3)!.groupId = 10;
    expect(await isAgentTab(3)).toBe(true);
    tabs.get(1)!.groupId = -1;
    expect(await isAgentTab(1)).toBe(false);
    vi.resetModules();
    const fresh = await import('../src/bg/agent-tabs');
    expect(await fresh.listAgentIds()).toEqual([2, 3]);
    expect(await listAgentIds()).toEqual([2, 3]);
  });

  it('denies explicit non-group tab ids', async () => {
    stubBrowserWithTabGroups();
    const { target } = await import('../src/bg/commands/shared');
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 90, groupId: -1 } as any);
    vi.spyOn(fakeBrowser.tabGroups, 'get').mockResolvedValue({ title: 'Other' } as any);
    await expect(target(90)).rejects.toMatchObject({ code: 'DENIED_BY_USER' });
  });
});
