import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { PROTOCOL_VERSION } from '@senda/protocol';
import { test, expect } from './fixtures';

const listed = async (mcp: Client) =>
  ((await mcp.callTool({ name: 'browser_list', arguments: {} })).content as { text: string }[])[0]!.text;

test('renaming the browser in Settings updates browser_list', async ({ mcp, openSidepanel }) => {
  const panel = await openSidepanel();
  await panel.getByText('Settings', { exact: true }).click();
  await expect(panel.getByLabel('Code', { exact: true })).toBeVisible();
  await panel.getByLabel('Name this browser').fill('Work');
  await panel.getByLabel('Name this browser').press('Enter');
  await expect.poll(() => listed(mcp), { timeout: 15_000 }).toContain('"name":"Work"');
});

test('renames from the popup; Esc cancels', async ({ context, extensionId, mcp }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: /^Rename this browser: / }).click();
  await popup.getByLabel('Name this browser').fill('Personal');
  await popup.getByLabel('Name this browser').press('Enter');
  await expect(popup.getByRole('button', { name: 'Rename this browser: Personal' })).toBeVisible();
  await expect.poll(() => listed(mcp), { timeout: 15_000 }).toContain('"name":"Personal"');

  await popup.getByRole('button', { name: 'Rename this browser: Personal' }).click();
  await popup.getByLabel('Name this browser').fill('Other');
  await popup.getByLabel('Name this browser').press('Escape');
  await expect(popup.getByRole('button', { name: 'Rename this browser: Personal' })).toBeVisible();
});

test('warns when another connected browser already uses the name', async ({ context, extensionId, mcp, server }) => {
  // A second "browser" on the same server, named Work.
  const other = new WebSocket(`ws://127.0.0.1:${server.port}`, { headers: { origin: `chrome-extension://${extensionId}` } } as never);
  await new Promise((resolve) => other.addEventListener('open', resolve));
  other.send(JSON.stringify({ event: 'hello', data: { token: server.token, instanceId: 'other', name: 'Work', extensionVersion: '0', protocolVersion: PROTOCOL_VERSION, engineVersion: 1, browser: 'chrome', capabilities: [], adapters: [] } }));
  await expect.poll(() => listed(mcp)).toContain('"name":"Work"');

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: /^Rename this browser: / }).click();
  await popup.getByLabel('Name this browser').fill('work');
  await popup.getByLabel('Name this browser').press('Enter');
  await expect(popup.getByText('Another browser is already named work')).toBeVisible({ timeout: 15_000 });
  other.close();
});
