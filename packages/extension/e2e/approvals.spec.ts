import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { test, expect } from './fixtures';

const text = (result: unknown) => JSON.stringify(result);

async function sendRef(mcp: Client, url: string) {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url } });
  for (let i = 0; i < 20; i++) {
    const result = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const [first] = result.content as { text: string }[];
    const ref = result.isError ? undefined : String(JSON.parse(first?.text ?? '{}').snapshot).match(/\[(\d+)\] button "Send"/)?.[1];
    if (ref) return ref;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Send button not found in snapshot');
}

test('click on a sensitive button shows a card on the page, highlights it and waits for Allow', async ({ context, mcp, fixtureUrl }) => {
  const ref = await sendRef(mcp, `${fixtureUrl}/site/mail.html`);
  const tab = context.pages().find((page) => page.url().endsWith('/site/mail.html'))!;
  const click = mcp.callTool({ name: 'browser_click', arguments: { ref } });
  const card = tab.locator('senda-approval');
  await expect(card.getByText('Your AI wants to click “Send”')).toBeVisible();
  await expect(card.locator('.hl')).toBeVisible();
  await card.getByRole('button', { name: 'Allow', exact: true }).click();
  expect((await click).isError).toBeFalsy();
  await expect(tab.locator('#status')).toHaveText('Sent');
  await expect(card).toHaveCount(0);
});

test('a page script cannot approve the card', async ({ context, mcp, fixtureUrl }) => {
  const ref = await sendRef(mcp, `${fixtureUrl}/site/mail.html`);
  const tab = context.pages().find((page) => page.url().endsWith('/site/mail.html'))!;
  void mcp.callTool({ name: 'browser_click', arguments: { ref } }).catch(() => undefined);
  await expect(tab.locator('senda-approval').getByRole('button', { name: 'Allow', exact: true })).toBeVisible();
  await tab.evaluate(() => (document.querySelector('senda-approval')!.shadowRoot!.querySelector('button.primary') as HTMLElement).click());
  await tab.waitForTimeout(500);
  await expect(tab.locator('#status')).toHaveText('');
  await expect(tab.locator('senda-approval')).toHaveCount(1);
});

test('click on a sensitive button fails when denied in the side panel', async ({ context, mcp, fixtureUrl, openSidepanel }) => {
  const ref = await sendRef(mcp, `${fixtureUrl}/site/mail.html`);
  const panel = await openSidepanel();
  const click = mcp.callTool({ name: 'browser_click', arguments: { ref } });
  await panel.getByRole('button', { name: 'Deny', exact: true }).click();
  const result = await click;
  expect(result.isError).toBe(true);
  expect(text(result)).toContain('DENIED_BY_USER');
  const tab = context.pages().find((page) => page.url().endsWith('/site/mail.html'))!;
  await expect(tab.locator('#status')).toHaveText('');
  await expect(tab.locator('senda-approval')).toHaveCount(0);
});
