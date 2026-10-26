import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test('Stop everything denies approvals, closes Senda tabs, pauses adapters and disconnects', async ({ context, mcp, fixtureUrl, openSidepanel }) => {
  const file = new URL('../tests/fixtures/adapters/fixturemoodle.json', import.meta.url);
  const recipe = JSON.parse((await readFile(file, 'utf8')).replaceAll('http://127.0.0.1:18766', fixtureUrl));
  await mcp.callTool({ name: 'adapter_draft', arguments: { recipe } });
  await mcp.callTool({ name: 'adapter_submit', arguments: { id: 'fixturemoodle' } });
  const panel = await openSidepanel();
  await panel.getByRole('button', { name: 'Approve', exact: true }).click();

  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
  let ref: string | undefined;
  await expect.poll(async () => {
    const [first] = (await mcp.callTool({ name: 'browser_snapshot', arguments: {} })).content as { text: string }[];
    ref = String(JSON.parse(first?.text ?? '{}').snapshot).match(/\[(\d+)\] button "Send"/)?.[1];
    return ref;
  }).toBeTruthy();
  const click = mcp.callTool({ name: 'browser_click', arguments: { ref } });
  await expect(panel.getByRole('button', { name: 'Allow', exact: true })).toBeVisible();

  await panel.getByRole('button', { name: 'Stop everything' }).click();
  expect(JSON.stringify(await click)).toContain('DENIED_BY_USER');
  await expect.poll(() => context.pages().some((page) => page.url().endsWith('/site/mail.html'))).toBe(false);
  const [worker] = context.serviceWorkers();
  const adapters = await worker!.evaluate(async () => (await (globalThis as any).chrome.storage.local.get('adapters')).adapters);
  expect(adapters.fixturemoodle.status).toBe('paused');
  await expect.poll(async () => JSON.stringify(await mcp.callTool({ name: 'browser_snapshot', arguments: {} }))).toContain('NOT_CONNECTED');
});
