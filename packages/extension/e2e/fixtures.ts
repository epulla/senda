import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
let fixturePort = 0;
const freePort = () => new Promise<number>((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const port = (server.address() as net.AddressInfo).port;
    server.close(() => resolve(port));
  });
});
const ready = (child: ChildProcess) => new Promise<void>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => reject(Error(`process exited: ${code}`)));
  setTimeout(resolve, 500);
});

export const test = base.extend<{ context: BrowserContext; extensionId: string; fixtureUrl: string; server: { client: Client; port: number; token: string }; mcp: Client; openSidepanel: () => Promise<Page> }>({
  context: async ({}, use) => {
    fixturePort = await freePort();
    const fixture = spawn('node', ['tests/fixtures/server.mjs'], { cwd: path.join(root, 'packages/extension'), env: { ...process.env, FIXTURE_PORT: String(fixturePort) } });
    let context: BrowserContext | undefined;
    try {
      await ready(fixture);
      context = await chromium.launchPersistentContext('', { channel: 'chromium', args: [`--disable-extensions-except=${path.join(root, 'packages/extension/.output/chrome-mv3')}`, `--load-extension=${path.join(root, 'packages/extension/.output/chrome-mv3')}`] });
      await use(context);
    } finally {
      await context?.close();
      fixture.kill();
    }
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
  fixtureUrl: async ({}, use) => use(`http://127.0.0.1:${fixturePort}`),
  server: async ({}, use) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'senda-mcp-'));
    const port = await freePort();
    const transport = new StdioClientTransport({ command: 'node', args: [path.join(root, 'packages/server/dist/index.js')], env: { ...process.env, HOME: dir, SENDA_PORT: String(port) } });
    const client = new Client({ name: 'senda-e2e', version: '1.0.0' });
    await client.connect(transport);
    try {
      await use({ client, port, token: (await readFile(path.join(dir, '.senda/token'), 'utf8')).trim() });
    } finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
  },
  mcp: async ({ context, extensionId, server }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
    await page.locator('details summary').click();
    await page.locator('input[type=number]').fill(String(server.port));
    await page.locator('input[type=password]').fill(server.token);
    await page.locator('button[type=submit]').click();
    await page.getByText('Connected to Senda on this computer').waitFor({ timeout: 15_000 });
    await use(server.client);
  },
  openSidepanel: async ({ context, extensionId }, use) => use(async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    return page;
  }),
});
export { expect } from '@playwright/test';
