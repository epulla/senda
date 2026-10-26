import { test, expect } from './fixtures';

test('MCP server reads fixture page through loaded extension', async ({ mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/chat/` } });
  let result;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    result = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    if (JSON.stringify(result).includes('Chat 001')) break;
  }
  expect(JSON.stringify(result)).toContain('Chat 001');
});

test('types without submitting and scrolls the page without a target', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
  let ref: string | undefined;
  await expect.poll(async () => {
    const result = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const [first] = result.content as { text: string }[];
    ref = result.isError ? undefined : String(JSON.parse(first?.text ?? '{}').snapshot).match(/\[(\d+)\] textarea/)?.[1];
    return ref;
  }).toBeTruthy();
  expect((await mcp.callTool({ name: 'browser_type', arguments: { ref, text: 'hola' } })).isError).toBeFalsy();
  const tab = context.pages().find((page) => page.url().endsWith('/site/mail.html'))!;
  await expect(tab.locator('textarea')).toHaveValue('hola');
  expect((await mcp.callTool({ name: 'browser_scroll', arguments: {} })).isError).toBeFalsy();
});
