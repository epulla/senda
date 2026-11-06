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
  const worker = context.serviceWorkers()[0]!;
  // A screenshot counts as reading the site, so later risky actions still ask first.
  expect(await worker.evaluate(async () => (await (globalThis as any).chrome.storage.session.get('taint')).taint)).toBe(new URL(fixtureUrl).host);
  expect(view.image?.mimeType).toBe('image/jpeg');
  expect(view.image?.data?.startsWith('/9j/')).toBe(true);
  const full = await shot(mcp, { fullPage: true });
  expect(full.info.height, full.text).toBeGreaterThan(view.info.height * 2);
  expect(await page.locator('[data-senda-mask], style[data-senda-mask-style]').count()).toBe(0);

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

test('browser_screenshot blurs card fields inside closed shadow roots and restores them', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/shadow.html` } });
  const page = context.pages().find((p) => p.url().endsWith('/site/shadow.html'))!;
  const { image, info, text } = await shot(mcp);
  expect(image, text).toBeTruthy();
  // Count dark (text) pixels over each field in the returned image.
  const dark = await page.evaluate(async ({ data, width }) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const scale = width / window.innerWidth;
    const count = (id: string) => {
      const r = document.getElementById(id)!.getBoundingClientRect();
      const px = ctx.getImageData(r.x * scale, r.y * scale, r.width * scale, r.height * scale).data;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! + px[i + 1]! + px[i + 2]! < 200) n++;
      return n;
    };
    return { card: count('card'), plain: count('plain') };
  }, { data: image!.data!, width: info.width });
  expect(dark.plain).toBeGreaterThan(500);
  expect(dark.card).toBeLessThan(20);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('plain')!.shadowRoot!.querySelector('input')!).filter)).toBe('none');
});

test('browser_screenshot fails instead of capturing another tab that comes to the front', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/long.html` } });
  const userPage = await context.newPage();
  await userPage.goto(`${fixtureUrl}/site/mail.html`);
  const pending = shot(mcp, { fullPage: true });
  await userPage.waitForTimeout(700);
  await userPage.bringToFront();
  const { result, text } = await pending;
  expect(result.isError).toBe(true);
  expect(text).toContain('stopped showing');
});
