import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

// Regenerates the README screenshots in docs/assets and the 1280×800 Chrome Web Store ones in docs/assets/store/screenshots: SENDA_SHOTS=1 pnpm e2e readme-shots
test.skip(!process.env.SENDA_SHOTS, 'set SENDA_SHOTS=1 to regenerate README screenshots');

const out = (name: string) => new URL(`../../../docs/assets/${name}`, import.meta.url).pathname;
const store = { width: 1280, height: 800 };
const style = `body{font:15px/1.5 system-ui,sans-serif;max-width:560px;margin:48px auto;color:#1f2937}
form{display:grid;gap:12px;padding:24px;border:1px solid #e5e7eb;border-radius:12px}
label{display:grid;gap:4px;font-weight:600}input,textarea{font:inherit;padding:8px;border:1px solid #d1d5db;border-radius:6px}
textarea{height:96px}button{justify-self:start;padding:8px 20px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:inherit}`;

test('README screenshots', async ({ context, mcp, openSidepanel }) => {
  const setup = context.pages().find((p) => p.url().endsWith('/onboarding.html'))!;
  await setup.setViewportSize({ width: 900, height: 760 });
  await setup.locator('label', { hasText: 'Patio' }).click();
  await setup.screenshot({ path: out('setup.png'), fullPage: true });
  await setup.setViewportSize(store);
  // The whole page is taller than 800 px; shrink it so the store shot shows every step.
  await setup.evaluate((height) => (document.body.style.zoom = String(height / document.documentElement.scrollHeight)), store.height);
  await setup.screenshot({ path: out('store/screenshots/setup.png') });

  const file = new URL('../tests/fixtures/adapters/fixturemoodle.json', import.meta.url);
  const recipe = { ...JSON.parse((await readFile(file, 'utf8')).replaceAll('http://127.0.0.1:18766', 'https://campus.example.edu')), name: 'Campus Moodle', description: 'Read your courses and deadlines, rename a course' };
  await mcp.callTool({ name: 'adapter_draft', arguments: { recipe } });
  await mcp.callTool({ name: 'adapter_submit', arguments: { id: 'fixturemoodle' } });
  const panel = await openSidepanel();
  await panel.setViewportSize({ width: 400, height: 640 });
  await panel.getByRole('button', { name: 'Approve', exact: true }).click();
  const row = panel.getByRole('button', { name: /Campus Moodle/ });
  await expect(row).toBeVisible();

  const detailPromise = context.waitForEvent('page');
  await row.click();
  const detail = await detailPromise;
  await detail.setViewportSize({ width: 900, height: 760 });
  await expect(detail.getByText('What your AI can do (3)')).toBeVisible();
  await detail.screenshot({ path: out('adapter.png') });
  await detail.setViewportSize(store);
  await detail.screenshot({ path: out('store/screenshots/adapter.png') });
  await detail.close();

  const mail = await readFile(new URL('../tests/fixtures/site/mail.html', import.meta.url), 'utf8');
  await context.route('https://mail.example.com/**', (route) => route.fulfill({ contentType: 'text/html', body: `${mail}<style>${style}</style>` }));
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: 'https://mail.example.com/compose' } });
  await expect.poll(() => context.pages().some((page) => page.url() === 'https://mail.example.com/compose')).toBe(true);
  const tab = context.pages().find((page) => page.url() === 'https://mail.example.com/compose')!;
  await tab.setViewportSize({ width: 1100, height: 640 });
  const inputs = tab.locator('input');
  await inputs.nth(0).fill('sam@example.com');
  await inputs.nth(1).fill('Notes from today');
  await tab.locator('textarea').fill('Hi Sam, here are the notes from our call.');
  let ref: string | undefined;
  await expect.poll(async () => {
    const result = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const [first] = result.content as { text: string }[];
    ref = result.isError ? undefined : String(JSON.parse(first?.text ?? '{}').snapshot).match(/\[(\d+)\] button "Send"/)?.[1];
    return ref;
  }).toBeTruthy();
  void mcp.callTool({ name: 'browser_click', arguments: { ref } }).catch(() => undefined);
  await expect(tab.locator('senda-approval').locator('.hl')).toBeVisible();
  await tab.waitForTimeout(500);
  await tab.screenshot({ path: out('approval.png') });
  await tab.setViewportSize(store);
  await tab.waitForTimeout(500);
  await tab.screenshot({ path: out('store/screenshots/approval.png') });

  await panel.bringToFront();
  await expect(panel.getByRole('button', { name: 'Deny', exact: true })).toBeVisible();
  await panel.screenshot({ path: out('sidepanel.png') });

  // Chrome's side panel can't be captured, so place the real panel next to the page.
  await panel.setViewportSize({ width: 400, height: store.height });
  await tab.setViewportSize({ width: store.width - 400, height: store.height });
  await tab.waitForTimeout(500);
  const [page, side] = await Promise.all([tab.screenshot(), panel.screenshot()]);
  const combo = await context.newPage();
  await combo.setViewportSize(store);
  const img = (png: Buffer) => `<img src="data:image/png;base64,${png.toString('base64')}">`;
  await combo.setContent(`<body style="margin:0;display:flex">${img(page)}${img(side)}</body>`);
  await combo.screenshot({ path: out('store/screenshots/sidepanel.png') });
});
