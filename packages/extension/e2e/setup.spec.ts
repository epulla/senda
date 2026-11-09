import { test, expect } from './fixtures';

test('setup page guides by AI app and pairs with the code the AI shows', async ({ context, extensionId, server }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
  const claude = page.getByRole('radio', { name: /Claude Desktop/ });
  await expect(claude).toBeChecked();
  await expect(page.getByRole('link', { name: 'Download Senda for Claude' })).toHaveAttribute('href', /\/releases\/latest\/download\/senda\.mcpb$/);
  await expect(page.getByText('Node.js')).toHaveCount(0);

  await claude.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Patio' })).toBeChecked();
  await page.locator('label', { hasText: 'Cursor' }).click();
  await expect(page.getByRole('radio', { name: 'Cursor' })).toBeChecked();
  await expect(page.getByRole('link', { name: /Node\.js/ })).toBeVisible();
  await expect(page.getByText('"mcpServers"')).toBeVisible();

  await expect(page.getByText('Waiting for your AI app…')).toBeVisible();
  await page.locator('details summary').click();
  await page.locator('input[type=number]').fill(String(server.port));
  const result = await server.client.callTool({ name: 'senda_pairing_code', arguments: {} });
  await page.getByLabel('Code', { exact: true }).fill((result.content as { text: string }[])[0]!.text.split('\n')[0]!);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Connected to Senda on this computer')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Open example.com and tell me the title')).toBeVisible();
});
