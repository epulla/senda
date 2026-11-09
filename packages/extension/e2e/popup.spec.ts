import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test('popup shows the Senda app version and warns only when it is older', async ({ context, extensionId, mcp }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  await expect(popup.getByText(`Senda app v${version}`, { exact: true })).toBeVisible();
  await expect(popup.getByText('Your Senda app is out of date')).toHaveCount(0);

  // As if an older Senda app answered.
  await popup.evaluate(() => (globalThis as any).chrome.storage.session.set({ serverVersion: '0.1.0' }));
  await expect(popup.getByText('Your Senda app is out of date. Restart your AI app. (Senda app v0.1.0)')).toBeVisible();
});
