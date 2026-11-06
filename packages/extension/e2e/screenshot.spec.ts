import { test, expect } from './fixtures';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const shot = async (mcp: Client, args: Record<string, unknown> = {}) => {
  const result = await mcp.callTool({ name: 'browser_screenshot', arguments: args });
  const content = result.content as { type: string; data?: string; mimeType?: string; text?: string }[];
  const text = content.find((c) => c.type === 'text')?.text ?? '';
  return { result, text, image: content.find((c) => c.type === 'image'), info: result.isError ? {} : JSON.parse(text.split('\n')[0]!) };
};

test('browser_screenshot returns a JPEG of the viewport, a ref or the full page', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/long.html` } });
  const page = context.pages().find((p) => p.url().endsWith('/site/long.html'))!;
  const view = await shot(mcp);
  expect(view.result.isError).toBeFalsy();
  expect(view.image?.mimeType).toBe('image/jpeg');
  expect(view.image?.data?.startsWith('/9j/')).toBe(true);
  const full = await shot(mcp, { fullPage: true });
  expect(full.info.height, full.text).toBeGreaterThan(view.info.height * 2);
  expect(await page.locator('[data-senda-mask], #senda-mask-style').count()).toBe(0);

  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/snapshot.html` } });
  const snap = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
  const ref = String(JSON.parse((snap.content as { text: string }[])[0]!.text).snapshot).match(/\[(\d+)\] table:/)![1];
  const part = await shot(mcp, { ref });
  expect(part.image, part.text).toBeTruthy();
  expect(part.info.width).toBeLessThan(view.info.width);
  expect((await shot(mcp, { ref: '9999' })).result.isError).toBe(true);
});

test('browser_screenshot refuses tabs outside the agent group', async ({ context, mcp, fixtureUrl }) => {
  const worker = context.serviceWorkers()[0]!;
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/chat.html` } });
  const userPage = await context.newPage();
  await userPage.goto(`${fixtureUrl}/site/mail.html`);
  const userTabId = await worker.evaluate(async (url) => (await (globalThis as any).chrome.tabs.query({ url }))[0]?.id, userPage.url());
  expect((await shot(mcp, { tabId: userTabId })).result.isError).toBe(true);
});
