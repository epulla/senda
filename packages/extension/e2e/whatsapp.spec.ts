import { readFile } from 'node:fs/promises';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test, expect } from './fixtures';

const value = (result: unknown) => {
  const text = ((result as { content: { text: string }[] }).content[0]?.text ?? '').replace(/^\[[^\]]+\] /, '');
  return JSON.parse(/<external_content[^>]*>\n([\s\S]*)\n<\/external_content/.exec(text)?.[1] ?? text);
};
const call = async (mcp: Client, name: string, args: Record<string, unknown> = {}) => {
  const result = await mcp.callTool({ name: `whatsapp__${name}`, arguments: args });
  expect(result.isError, JSON.stringify(result)).toBeFalsy();
  return value(result);
};

test('WhatsApp template lists, searches, reads, marks read and sends only after Allow', async ({ context, mcp, fixtureUrl, openSidepanel }) => {
  const file = new URL('../../../adapters/whatsapp/adapter.json', import.meta.url);
  const recipe = JSON.parse(
    (await readFile(file, 'utf8'))
      .replace('https://web.whatsapp.com/*', `${fixtureUrl}/site/*`)
      .replace('"https://web.whatsapp.com/"', `"${fixtureUrl}/site/whatsapp.html"`),
  );
  expect((await mcp.callTool({ name: 'adapter_draft', arguments: { recipe } })).isError).toBeFalsy();
  await mcp.callTool({ name: 'adapter_submit', arguments: { id: 'whatsapp' } });
  const panel = await openSidepanel();
  await panel.getByRole('button', { name: 'Approve', exact: true }).click();

  await expect.poll(async () => !(await mcp.callTool({ name: 'whatsapp__list_chats', arguments: {} })).isError).toBe(true);
  const chats = await call(mcp, 'list_chats');
  expect(chats).toContainEqual({ name: 'Ana', time: '3:13 p.m.', unread: 2, last_message: 'See you at 4' });

  expect((await call(mcp, 'search_chats', { query: 'ana' })).map((c: { name: string }) => c.name)).toEqual(['Ana', "Ana's group"]);

  expect(await call(mcp, 'read_chat', { chat: 'Zoe' })).toEqual({ not_found: [] });
  const read = await call(mcp, 'read_chat', { chat: 'Ana', limit: 2 });
  expect(read).toEqual({
    chat: 'Ana',
    messages: [
      { from: 'Ana', time: '3:11 p.m.', date: '26/10/2026', text: '[media]' },
      { from: 'Ana', time: '3:13 p.m.', date: '26/10/2026', text: 'See you at 4' },
    ],
  });

  expect(await call(mcp, 'mark_as_read', { chat: "Ana's group" })).toEqual({ chat: "Ana's group" });
  expect((await call(mcp, 'list_chats')).find((c: { name: string }) => c.name === "Ana's group").unread).toBe(0);

  const send = mcp.callTool({ name: 'whatsapp__send_message', arguments: { chat: 'Book club 📚', text: 'Hello from Senda' } });
  const tab = context.pages().find((page) => page.url().includes('/site/whatsapp.html'))!;
  const card = tab.locator('senda-approval');
  await expect(card.getByText('Send to Book club 📚: Hello from Senda')).toBeVisible();
  await expect(tab.locator('#main [role=row]', { hasText: 'Hello from Senda' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(value(await send)).toEqual({ sent_to: 'Book club 📚' });
  await expect(tab.locator('#main [role=row]').last()).toHaveText('Hello from Senda');
});
