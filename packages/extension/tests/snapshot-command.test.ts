import { expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithoutTabGroups } from './no-tab-groups';

it('notes that an empty page may still be loading', async () => {
  stubBrowserWithoutTabGroups();
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 5, url: 'https://example.com/' } as any);
  const run = vi.spyOn(fakeBrowser.scripting, 'executeScript').mockResolvedValue([{ result: ' ' }] as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: snapshot } = await import('../src/bg/commands/snapshot');
  expect(await snapshot({ tabId: 5 })).toMatchObject({ note: expect.stringContaining('may still be loading') });
  run.mockResolvedValue([{ result: 'text: Dashboard' }] as any);
  expect(await snapshot({ tabId: 5 })).not.toHaveProperty('note');
});
