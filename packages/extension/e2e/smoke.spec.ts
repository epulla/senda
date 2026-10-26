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
