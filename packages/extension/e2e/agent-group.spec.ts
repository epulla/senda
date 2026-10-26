import { test, expect } from './fixtures';

test('only tabs in the 🤖 MCP group are controlled, and Stop everything preserves user tabs', async ({ context, mcp, fixtureUrl, openSidepanel }) => {
  const worker = context.serviceWorkers()[0]!;
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/chat.html` } });
  const userPage = await context.newPage();
  await userPage.goto(`${fixtureUrl}/site/mail.html`);
  const userTabId = await worker.evaluate(async (url) => {
    const tabs = await (globalThis as any).chrome.tabs.query({ url });
    return tabs.find((tab: { id: number; url: string }) => tab.url === url)?.id;
  }, userPage.url());
  expect(userTabId).toBeDefined();

  const denied = await mcp.callTool({ name: 'browser_snapshot', arguments: { tabId: userTabId } });
  expect(denied.isError).toBe(true);

  const { groupId, groups } = await worker.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const groups = await chrome.tabGroups.query({ title: '🤖 MCP' });
    return { groupId: groups[0]?.id, groups: groups.length };
  });
  expect(groups).toBe(1);
  await worker.evaluate(async ({ id, group }: { id: number; group: number }) => (globalThis as any).chrome.tabs.group({ tabIds: [id], groupId: group }), { id: userTabId, group: groupId });
  const allowed = await mcp.callTool({ name: 'browser_snapshot', arguments: { tabId: userTabId } });
  expect(allowed.isError).toBeFalsy();
  expect(JSON.parse(((allowed.content as { text: string }[])[0]!).text).snapshot).toContain('Send');
  expect(await worker.evaluate(async () => (globalThis as any).chrome.tabGroups.query({ title: '🤖 MCP' }).then((items: unknown[]) => items.length))).toBe(1);

  await worker.evaluate(async (id) => (globalThis as any).chrome.tabs.ungroup(id), userTabId);
  expect((await mcp.callTool({ name: 'browser_snapshot', arguments: { tabId: userTabId } })).isError).toBe(true);

  await worker.evaluate(async ({ id, group }: { id: number; group: number }) => (globalThis as any).chrome.tabs.group({ tabIds: [id], groupId: group }), { id: userTabId, group: groupId });
  const agentTabId = await worker.evaluate(async () => {
    const chrome = (globalThis as any).chrome;
    const groups = await chrome.tabGroups.query({ title: '🤖 MCP' });
    const tabs = await chrome.tabs.query({ groupId: groups[0].id });
    return tabs.find((tab: { id: number; url: string }) => tab.url.includes('/site/chat.html'))?.id;
  });
  const panel = await openSidepanel();
  await panel.getByRole('button', { name: 'Stop everything' }).click();
  await expect.poll(async () => worker.evaluate(async (id) => (globalThis as any).chrome.tabs.get(id).then(() => true, () => false), agentTabId)).toBe(false);
  await expect.poll(async () => worker.evaluate(async (id) => (globalThis as any).chrome.tabs.get(id).then((tab: { groupId: number }) => tab.groupId, () => -1), userTabId)).toBe(-1);
  await expect(userPage).toHaveURL(`${fixtureUrl}/site/mail.html`);
});
