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

test('snapshot prints input values without doubled quotes', async ({ mcp, fixtureUrl }) => {
  const text = await open(mcp, `${fixtureUrl}/site/snapshot.html`, 'Buscar modulo');
  expect(text).not.toContain('""""');
  expect(text).toMatch(/\[\d+\] input "Buscar modulo"\n/);
  expect(text).toMatch(/\[\d+\] input "Filtro" value="abc"\n/);
  expect(text).toMatch(/\[\d+\] input "Clave" \(hidden\)/);
});

test('snapshot names icon-only buttons and links', async ({ mcp, fixtureUrl }) => {
  const text = await open(mcp, `${fixtureUrl}/site/snapshot.html`, 'Labelled');
  for (const line of ['a "Ver"', 'button "Gestionar"', 'button "icon:pencil"', 'a "href:/pro_especies?acc=1"', 'button "Labelled"', 'button "Borrar"'])
    expect(text).toMatch(new RegExp(`\\[\\d+\\] ${line.replace(/[?]/g, '\\$&')}`));
  expect(text).not.toMatch(/\] (button|a) ""/);
});

test('snapshot with ref reads only that element and rejects stale refs', async ({ mcp, fixtureUrl }) => {
  const text = await open(mcp, `${fixtureUrl}/site/snapshot.html`, 'SOL-002');
  const ref = text.match(/\[(\d+)\] table:/)![1];
  const scoped = await read(mcp, { ref });
  expect(scoped).toContain(`[${ref}] table:\nrow: Número | Estudiante | Estado`);
  expect(scoped).toContain('SOL-002');
  expect(scoped).not.toContain('Solicitudes Asignadas');
  expect(scoped).not.toContain('Card Alpha');
  expect(await read(mcp, { ref: '9999' })).toMatch(/REF_NOT_FOUND.*take a new snapshot/);
});
