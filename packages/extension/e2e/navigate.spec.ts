import { test, expect } from './fixtures';

test('browser_navigate without tabId opens a new tab after the agent tab was closed', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
  await context.pages().find((p) => p.url().endsWith('/site/mail.html'))!.close();
  const result = await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/snapshot.html` } });
  expect(result.isError).toBeFalsy();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).url).toBe(`${fixtureUrl}/site/snapshot.html`);
});
