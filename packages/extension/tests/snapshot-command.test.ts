import { expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithoutTabGroups } from './no-tab-groups';

it('notes an empty page that may still be loading and a page still busy after an action', async () => {
  stubBrowserWithoutTabGroups();
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 5, url: 'https://example.com/' } as any);
  let page = ' ';
  let busy = false;
  vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation((async ({ func }: any) => [{ result: func.name === 'settleDom' ? busy : page }]) as any);
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  const { default: snapshot } = await import('../src/bg/commands/snapshot');
  expect(await snapshot({ tabId: 5 })).toMatchObject({ note: expect.stringContaining('may still be loading') });
  page = 'text: Dashboard';
  expect(await snapshot({ tabId: 5 })).not.toHaveProperty('note');
  busy = true;
  expect(await snapshot({ tabId: 5 })).toMatchObject({ note: expect.stringContaining('still busy after your last action') });
});
