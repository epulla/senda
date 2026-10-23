import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ErrorCode } from '@senda/protocol';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../src/bg/commands/navigate', () => ({ default: navigate }));

const recipe = {
  id: 'example',
  name: 'Example',
  version: '1.0.0',
  engine: 1,
  source: 'official',
  sites: ['https://example.com/*'],
  mode: 'read',
  description: 'Test adapter',
  tools: { search: { description: 'Search', effect: 'read', params: {}, steps: [{ return: 'value' }] } },
};
const writeRecipe = {
  ...recipe,
  id: 'writer',
  mode: 'write',
  tools: { write: { ...recipe.tools.search, effect: 'write' } },
};

describe('adapter background', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('browser', fakeBrowser);
    const { adaptersItem, draftsItem } = await import('../src/bg/state');
    await adaptersItem.setValue({});
    await draftsItem.setValue({});
  });

  it('rejects invalid drafts and stores valid recipes as local with changes', async () => {
    const { saveDraft } = await import('../src/bg/adapters/store');
    expect(await saveDraft({ nope: true })).toMatchObject({ ok: false, errors: expect.any(Array) });
    const saved = await saveDraft(recipe);
    expect(saved).toMatchObject({ ok: true, changes: expect.any(Array) });
    const { draftsItem } = await import('../src/bg/state');
    expect((await draftsItem.getValue()).example?.adapter.source).toBe('local');
  });

  it('approves draft as active summary', async () => {
    const { saveDraft, approveDraft, summaries } = await import('../src/bg/adapters/store');
    await saveDraft(recipe);
    expect(await approveDraft('example')).toBe(true);
    expect(await summaries()).toMatchObject([{ id: 'example', status: 'active', source: 'local' }]);
  });

  it('rejects runs for paused adapters', async () => {
    const { saveDraft, approveDraft, setStatus } = await import('../src/bg/adapters/store');
    const { runAdapter } = await import('../src/bg/adapters/run');
    await saveDraft(recipe);
    await approveDraft('example');
    await setStatus('example', 'paused');
    await expect(runAdapter({ adapter: 'example', tool: 'search', args: {} })).rejects.toMatchObject({
      code: ErrorCode.ADAPTER_NOT_FOUND,
    });
  });

  it('runs in matching agent tab and ignores matching user tabs', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    await adaptersItem.setValue({ example: { adapter: recipe as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 1, url: 'https://example.com/user' },
      { id: 2, url: 'https://example.com/agent' },
    ] as any);
    trackAgentTab(2);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(async (details: any) =>
      details.files ? [] : [{ result: { ok: true, value: 'ok' } }],
    );
    const { runAdapter } = await import('../src/bg/adapters/run');
    await runAdapter({ adapter: 'example', tool: 'search', args: {} });
    expect(fakeBrowser.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 2 } }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens a new agent tab when no matching agent tab exists', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    await adaptersItem.setValue({ example: { adapter: recipe as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 1, url: 'https://example.com/user' }] as any);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(async (details: any) =>
      details.files ? [] : [{ result: { ok: true, value: null } }],
    );
    navigate.mockImplementation(async () => {
      trackAgentTab(9);
    });
    const { runAdapter } = await import('../src/bg/adapters/run');
    await runAdapter({ adapter: 'example', tool: 'search', args: {} });
    expect(navigate).toHaveBeenCalledWith({ url: 'https://example.com/', newTab: true });
  });

  it('blocks write tools', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    await adaptersItem.setValue({ writer: { adapter: writeRecipe as any, status: 'active', installed_at: '' } });
    const { runAdapter } = await import('../src/bg/adapters/run');
    await expect(runAdapter({ adapter: 'writer', tool: 'write', args: {} })).rejects.toMatchObject({
      code: ErrorCode.READ_ONLY,
    });
  });
});
