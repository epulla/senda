import { test, expect } from './fixtures';

test('setup page guides by AI app and pairs with the code the AI shows', async ({ context, mcp }) => {
  const page = context.pages().find((p) => p.url().endsWith('/onboarding.html'))!;
  await expect(page.getByRole('radio', { name: /Claude Desktop/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('link', { name: 'Download Senda for Claude' })).toHaveAttribute('href', /\/releases\/latest\/download\/senda\.mcpb$/);
  await expect(page.getByText('Node.js')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Cursor' }).click();
  await expect(page.getByRole('link', { name: /Node\.js/ })).toBeVisible();
  await expect(page.getByText('"mcpServers"')).toBeVisible();

  const result = await mcp.callTool({ name: 'senda_pairing_code', arguments: {} });
  const code = (result.content as { text: string }[])[0]!.text.split('\n')[0];
  await expect(page.getByLabel('Code')).toHaveValue(code!);
  await expect(page.getByText('Open example.com and tell me the title')).toBeVisible();
});
