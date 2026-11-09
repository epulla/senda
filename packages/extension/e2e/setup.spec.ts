import { test, expect } from './fixtures';

test('setup page guides by AI app and pairs with the code the AI shows', async ({ context, extensionId, server }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(6);
  for (const radio of await radios.all()) await expect(radio).not.toBeChecked();
  await expect(page.getByText('Pick your AI app to see its steps.')).toBeVisible();
  await expect(page.getByText('Connect Senda')).toHaveCount(0);

  for (const width of [900, 420]) {
    await page.setViewportSize({ width, height: 900 });
    const boxes = await page.locator('[role=radiogroup] label').evaluateAll((labels) =>
      labels.map((label) => {
        const { width, height } = label.getBoundingClientRect();
        return `${Math.round(width)}x${Math.round(height)}`;
      }),
    );
    expect(new Set(boxes).size).toBe(1);
  }

  await page.locator('label', { hasText: 'Patio' }).click();
  await expect(page.getByRole('link', { name: 'Download Patio' })).toHaveAttribute('href', 'https://github.com/epulla/patio/releases/latest');
  await expect(page.getByText('Set up Senda in Patio for me (this computer may be macOS, Windows or Linux')).toBeVisible();
  const byHand = page.locator('details', { hasText: 'Or set it up by hand' });
  await expect(byHand.getByText('Command', { exact: true })).toBeHidden();
  await byHand.locator('summary').click();
  await expect(byHand.getByText('Command', { exact: true })).toBeVisible();
  await expect(byHand.getByText('C:\\Users\\you\\.senda\\senda-mcp.mjs')).toBeVisible();

  await page.locator('label', { hasText: 'Claude Desktop' }).click();
  await expect(page.getByRole('link', { name: 'Download Senda for Claude' })).toHaveAttribute('href', /\/releases\/latest\/download\/senda\.mcpb$/);
  await expect(page.getByText('Node.js')).toHaveCount(0);

  await page.keyboard.press('ArrowRight');
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
