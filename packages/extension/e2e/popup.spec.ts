import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test('popup shows the Senda app version without an outdated warning', async ({ context, extensionId, mcp }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  await expect(popup.getByText(`Senda app v${version}`, { exact: true })).toBeVisible();
  await expect(popup.getByText('Your Senda app is out of date')).toHaveCount(0);
});
