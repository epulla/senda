import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../src/bg/commands/navigate', () => ({ default: navigate }));

describe('agent tabs', () => {
  beforeEach(() => {
    vi.resetModules();
    fakeBrowser.reset();
    vi.stubGlobal('browser', fakeBrowser);
  });

  it('untracks an agent tab when it is closed', async () => {
    const { trackAgentTab, isAgentTab } = await import('../src/bg/agent-tabs');
    trackAgentTab(7);
    await fakeBrowser.tabs.onRemoved.trigger(7, { windowId: 1, isWindowClosing: false });
    expect(isAgentTab(7)).toBe(false);
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
});
