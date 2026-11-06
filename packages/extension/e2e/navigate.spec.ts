import { test, expect } from './fixtures';

test('browser_snapshot right after browser_navigate finds the new agent tab', async ({ context, mcp, fixtureUrl }) => {
  const worker = context.serviceWorkers()[0]!;
  for (let i = 0; i < 20; i++) {
    await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const groups = await chrome.tabGroups.query({ title: '🤖 MCP' });
      const tabs = (await chrome.tabs.query({})).filter((t: any) => groups.some((g: any) => g.id === t.groupId));
      if (tabs.length) await chrome.tabs.remove(tabs.map((t: any) => t.id));
    });
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
    const result = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    expect(result.isError, `run ${i}: ${(result.content as { text: string }[])[0]?.text}`).toBeFalsy();
  }
});

test('browser_navigate without tabId opens a new tab after the agent tab was closed', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
  await context.pages().find((p) => p.url().endsWith('/site/mail.html'))!.close();
  const result = await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/snapshot.html` } });
  expect(result.isError).toBeFalsy();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).url).toBe(`${fixtureUrl}/site/snapshot.html`);
});
