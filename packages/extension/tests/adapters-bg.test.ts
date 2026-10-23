import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AdaptersChanged, ErrorCode } from '@senda/protocol';

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
    const nested = {
      ...recipe,
      tools: { search: { ...recipe.tools.search, steps: [{ extract: { selector: 'title', save: 'x' } }] } },
    };
    await expect(saveDraft(nested)).rejects.toMatchObject({
      code: ErrorCode.ADAPTER_BROKEN,
      data: ['tools.search.steps.0.extract: Unrecognized key: "save"'],
    });
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
    expect(AdaptersChanged.safeParse(await summaries()).success).toBe(true);
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
    const approval = vi.spyOn(await import('../src/bg/approvals'), 'requestApproval');
    await runAdapter({ adapter: 'example', tool: 'search', args: {} });
    expect(approval).not.toHaveBeenCalled();
    expect(fakeBrowser.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 2 } }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 2, undefined],
    ['https://example.com/chat/', 3, undefined],
    ['https://example.com/inbox/', 2, { url: 'https://example.com/inbox/', tabId: 2, internal: true }],
  ])('with two matching agent tabs and start_url %s runs in tab %s', async (start_url, tabId, navigated) => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    await adaptersItem.setValue({ example: { adapter: { ...recipe, start_url } as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 3, url: 'https://example.com/chat/' },
      { id: 2, url: 'https://example.com/other' },
    ] as any);
    trackAgentTab(3);
    trackAgentTab(2);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(async (details: any) =>
      details.files ? [] : [{ result: { ok: true, value: 'ok' } }],
    );
    const { runAdapter } = await import('../src/bg/adapters/run');
    await runAdapter({ adapter: 'example', tool: 'search', args: {} });
    expect(fakeBrowser.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId } }));
    if (navigated) expect(navigate).toHaveBeenCalledWith(navigated);
    else expect(navigate).not.toHaveBeenCalled();
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
    expect(navigate).toHaveBeenCalledWith({ url: 'https://example.com/', newTab: true, internal: true });
  });

  it('returns null when the run has no value', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    await adaptersItem.setValue({ example: { adapter: recipe as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 2, url: 'https://example.com/agent' }] as any);
    trackAgentTab(2);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(async (details: any) =>
      details.files ? [] : [{ result: { ok: true } }],
    );
    const { runAdapter } = await import('../src/bg/adapters/run');
    expect(await runAdapter({ adapter: 'example', tool: 'search', args: {} })).toContain('null');
  });

  it('waits for the page after a click step and resumes with saved vars', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    await adaptersItem.setValue({ example: { adapter: recipe as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 2, url: 'https://example.com/agent' }] as any);
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 2, status: 'complete' } as any);
    trackAgentTab(2);
    const results = [{ settle: { step: 3, vars: { title: 'old' } } }, { ok: true, value: 'done' }];
    const run = vi
      .spyOn(fakeBrowser.scripting, 'executeScript')
      .mockImplementation(async (details: any) => (details.files ? [] : [{ result: results.shift() }]));
    const { runAdapter } = await import('../src/bg/adapters/run');
    expect(await runAdapter({ adapter: 'example', tool: 'search', args: {} })).toContain('done');
    expect(run.mock.calls.at(-1)![0]).toMatchObject({ args: [{ resume: { step: 3, vars: { title: 'old' } } }] });
  });

  it('names the step when the page navigates away mid-run', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    await adaptersItem.setValue({ example: { adapter: recipe as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 2, url: 'https://example.com/agent' }] as any);
    trackAgentTab(2);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockResolvedValue([{}] as any);
    const { runAdapter } = await import('../src/bg/adapters/run');
    await expect(runAdapter({ adapter: 'example', tool: 'search', args: {} })).rejects.toMatchObject({
      code: ErrorCode.ADAPTER_BROKEN,
      message: 'Page navigated during step 0.',
    });
  });

  it('removes drafts and rejects unknown ids', async () => {
    const { saveDraft, removeAdapter, list } = await import('../src/bg/adapters/store');
    await saveDraft(recipe);
    await removeAdapter('example');
    expect((await list()).drafts).toEqual([]);
    await expect(removeAdapter('example')).rejects.toMatchObject({ code: ErrorCode.ADAPTER_NOT_FOUND });
  });

  it('requests approval for write tools', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    await adaptersItem.setValue({ writer: { adapter: writeRecipe as any, status: 'active', installed_at: '' } });
    const { runAdapter } = await import('../src/bg/adapters/run');
    await expect(runAdapter({ adapter: 'writer', tool: 'write', args: {} })).rejects.toMatchObject({
      code: ErrorCode.TAB_GONE,
    });
  });
  it('approves write only after showing previous value, and rejects denial without resuming', async () => {
    const { adaptersItem } = await import('../src/bg/state');
    const { trackAgentTab } = await import('../src/bg/agent-tabs');
    const approval = await import('../src/bg/approvals');
    await adaptersItem.setValue({ writer: { adapter: writeRecipe as any, status: 'active', installed_at: '' } });
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 2, url: 'https://example.com/edit' }] as any);
    trackAgentTab(2);
    const ask = vi.spyOn(approval, 'requestApproval').mockResolvedValue('allow');
    let calls = 0;
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(async (details: any) => {
      if (details.files) return [];
      calls++;
      return [
        { result: calls === 1 ? { confirm: { step: 1, vars: { old: 'Old name' } } } : { ok: true, value: 'done' } },
      ];
    });
    const { runAdapter } = await import('../src/bg/adapters/run');
    await runAdapter({ adapter: 'writer', tool: 'write', args: { name: 'New name' } });
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        details: [
          ['name', 'New name'],
          ['Current old', 'Old name'],
        ],
      }),
    );
    expect(calls).toBe(2);
    ask.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: ErrorCode.DENIED_BY_USER }));
    calls = 0;
    await expect(runAdapter({ adapter: 'writer', tool: 'write', args: {} })).rejects.toMatchObject({
      code: ErrorCode.DENIED_BY_USER,
    });
    expect(calls).toBe(1);
  });
  it('rejects adapters whose site is blocked', async () => {
    const { settingsItem } = await import('../src/bg/state');
    const { saveDraft } = await import('../src/bg/adapters/store');
    await settingsItem.setValue({
      askBefore: 'destructive',
      allowedDomains: [],
      blockedDomains: ['example.com'],
      alwaysSites: [],
    });
    await expect(saveDraft(recipe)).rejects.toMatchObject({ code: ErrorCode.ADAPTER_BROKEN });
  });
});
