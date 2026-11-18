import { test, expect } from './fixtures';

test('browser_snapshot right after browser_navigate finds the new agent tab', async ({ context, mcp, fixtureUrl }) => {
  const worker = context.serviceWorkers()[0]!;
  for (let i = 0; i < 20; i++) {
    await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const groups = await chrome.tabGroups.query({ title: '🤖 MCP' });
      const tabs = (await chrome.tabs.query({})).filter((t: any) => groups.some((g: any) => g.id === t.groupId));
      if (tabs.length) await chrome.tabs.remove(tabs.map((t: any) => t.id));
    });
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
    const result = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    expect(result.isError, `run ${i}: ${(result.content as { text: string }[])[0]?.text}`).toBeFalsy();
  }
});

test('browser_navigate without tabId opens a new tab after the agent tab was closed', async ({ context, mcp, fixtureUrl }) => {
  await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/mail.html` } });
  await context.pages().find((p) => p.url().endsWith('/site/mail.html'))!.close();
  const result = await mcp.callTool({ name: 'browser_navigate', arguments: { url: `${fixtureUrl}/site/snapshot.html` } });
  expect(result.isError).toBeFalsy();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).url).toBe(`${fixtureUrl}/site/snapshot.html`);
});

test('new agent tabs survive a tab-reuse extension that closes ungrouped duplicates', async ({ context, mcp, fixtureUrl }) => {
  const url = `${fixtureUrl}/site/mail.html`;
  const userPage = await context.newPage();
  await userPage.goto(url);
  const worker = context.serviceWorkers()[0]!;
  // Mimics TabJury-style reuse once it skips grouped tabs (PROJ-270): close a fresh ungrouped tab whose URL is already open.
  await worker.evaluate((url) => {
    const chrome = (globalThis as any).chrome;
    const dedupe = async (id: number, opened?: string) => {
      if (opened !== url) return;
      const tabs = await chrome.tabs.query({ url });
      const tab = await chrome.tabs.get(id).catch(() => undefined);
      if (tab && tab.groupId === -1 && tabs.some((t: any) => t.id !== id)) await chrome.tabs.remove(id);
    };
    chrome.tabs.onCreated.addListener((tab: any) => dedupe(tab.id, tab.pendingUrl));
    chrome.tabs.onUpdated.addListener((id: number, change: any) => dedupe(id, change.url));
  }, url);
  for (const call of [{ name: 'browser_navigate', arguments: { url } }, { name: 'browser_tabs', arguments: { action: 'new', url } }]) {
    const result = await mcp.callTool(call);
    const text = (result.content as { text: string }[])[0]!.text;
    expect(result.isError, text).toBeFalsy();
    const { tabId } = JSON.parse(text);
    expect(await worker.evaluate(async (id) => (await (globalThis as any).chrome.tabs.get(id)).url, tabId)).toBe(url);
    const listed = JSON.parse(((await mcp.callTool({ name: 'browser_tabs', arguments: { action: 'list' } })).content as { text: string }[])[0]!.text);
    expect(listed.map((t: { id: number }) => t.id)).toContain(tabId);
  }
  // A blank new tab has no page to load after joining the group.
  expect((await mcp.callTool({ name: 'browser_tabs', arguments: { action: 'new' } })).isError).toBeFalsy();
});

test('browser_navigate away from unsaved changes reports the Leave site? dialog instead of timing out', async ({ context, mcp, fixtureUrl }) => {
  const call = (name: string, arguments_: Record<string, unknown> = {}) => mcp.callTool({ name, arguments: arguments_ });
  const text = (result: Awaited<ReturnType<typeof call>>) => (result.content as { text: string }[])[0]!.text;
  await call('browser_navigate', { url: `${fixtureUrl}/site/leave.html` });
  const page = context.pages().find((p) => p.url().endsWith('/site/leave.html'))!;
  // A real keystroke gives the page the user activation Chrome needs before it shows the dialog.
  await page.getByLabel('Draft').fill('unsaved');
  const dialog = page.waitForEvent('dialog');
  const started = Date.now();
  const away = await call('browser_navigate', { url: `${fixtureUrl}/site/mail.html` });
  expect(away.isError).toBe(true);
  expect(text(away)).toContain("PAGE_DIALOG: The page may be showing a 'Leave site?' dialog");
  expect(Date.now() - started).toBeLessThan(6000);
  expect((await dialog).type()).toBe('beforeunload');
  const stuck = await call('browser_snapshot');
  expect(text(stuck)).toContain('PAGE_DIALOG');
  await (await dialog).accept();
  await expect(page).toHaveURL(/mail\.html$/);
  expect((await call('browser_snapshot')).isError).toBeFalsy();
});
