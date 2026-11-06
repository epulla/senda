import { test, expect } from './fixtures';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const read = async (mcp: Client, args: Record<string, unknown> = {}) => {
  const result = await mcp.callTool({ name: 'browser_snapshot', arguments: args });
  const [first] = result.content as { text: string }[];
  return result.isError ? `ERROR ${first?.text}` : String(JSON.parse(first?.text ?? '{}').snapshot);
};
const open = async (mcp: Client, url: string, until: string) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url } });
  let text = '';
  await expect.poll(async () => (text = await read(mcp)).includes(until)).toBe(true);
  return text;
};

test('snapshot lists table rows, plain div text once and same-origin iframes', async ({ mcp, fixtureUrl }) => {
  const text = await open(mcp, `${fixtureUrl}/site/snapshot.html`, 'Frame Ingeniería');
  expect(text).toContain('row: Número | Estudiante | Estado\nrow: SOL-001 | Ana Ruiz | Pendiente\nrow: SOL-002 | Luis Mora | Pendiente');
  expect(text.match(/Card Alpha/g)).toHaveLength(1);
  expect(text).toContain('div: Card Alpha');
  expect(text).toContain('div: owner: Ana');
  expect(text).toContain('frame "details":\n  table:\n  row: Campo | Valor\n  row: Carrera | Frame Ingeniería');
});
