import { test, expect } from './fixtures';

test('browser_back and browser_forward move through the tab history', async ({ mcp, fixtureUrl }) => {
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await mcp.callTool({ name, arguments: args });
    const [first] = result.content as { text: string }[];
    expect(result.isError, first?.text).toBeFalsy();
    return JSON.parse(first!.text) as { url: string };
  };
  await call('browser_navigate', { url: `${fixtureUrl}/site/mail.html` });
  await call('browser_navigate', { url: `${fixtureUrl}/site/snapshot.html` });
  expect((await call('browser_back')).url).toBe(`${fixtureUrl}/site/mail.html`);
  expect((await call('browser_forward')).url).toBe(`${fixtureUrl}/site/snapshot.html`);
  const result = await mcp.callTool({ name: 'browser_forward', arguments: {} });
  expect(result.isError).toBeTruthy();
});
