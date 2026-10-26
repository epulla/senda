import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test('adapter compact row opens detail with tools, export, import, and removal', async ({ context, extensionId, fixtureUrl, mcp, openSidepanel }) => {
  const file = new URL('../tests/fixtures/adapters/fixturemoodle.json', import.meta.url);
  const recipe = JSON.parse((await readFile(file, 'utf8')).replaceAll('http://127.0.0.1:18766', fixtureUrl));
  expect((await mcp.callTool({ name: 'adapter_draft', arguments: { recipe } })).isError).toBeFalsy();
  expect((await mcp.callTool({ name: 'adapter_submit', arguments: { id: 'fixturemoodle' } })).isError).toBeFalsy();

  const panel = await openSidepanel();
  await panel.getByRole('button', { name: 'Approve', exact: true }).click();
  const row = panel.getByRole('button', { name: /Fixture Moodle/ });
  await expect(row).toBeVisible();

  const detailPromise = context.waitForEvent('page');
  await row.click();
  const detail = await detailPromise;
  await expect(detail).toHaveURL(`chrome-extension://${extensionId}/adapter.html?id=fixturemoodle`);
  for (const tool of ['my_courses', 'upcoming_deadlines', 'rename_course'])
    await expect(detail.getByText(tool, { exact: true })).toBeVisible();
  await expect(detail.getByText('What your AI can do (3)')).toBeVisible();
  await expect(detail.getByText('Rename course [id]: [old_full] → [fullname]')).toBeVisible();

  const downloadPromise = detail.waitForEvent('download');
  await detail.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path()!, 'utf8'));
  expect(exported.id).toBe('fixturemoodle');
  expect(Object.keys(exported.tools)).toHaveLength(3);

  await panel.getByRole('button', { name: '+ Add a shortcut' }).click();
  await panel.getByRole('button', { name: /Someone shared one with me/ }).click();
  const input = panel.locator('input[type="file"]');
  await input.setInputFiles({ name: 'fixturemoodle.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(panel.getByRole('heading', { name: 'Import Fixture Moodle' })).toBeVisible();
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(panel.getByText('Not verified: this comes from outside Senda.', { exact: false })).toBeVisible();

  detail.on('dialog', (dialog) => dialog.accept());
  const closed = detail.waitForEvent('close');
  await detail.getByRole('button', { name: 'Remove', exact: true }).click();
  await closed;
  await expect(panel.getByRole('button', { name: /Fixture Moodle/ })).toHaveCount(0);
});

test('Import also accepts pasted shortcut text and lands it as a not verified draft', async ({ fixtureUrl, openSidepanel }) => {
  const file = new URL('../tests/fixtures/adapters/fixturemoodle.json', import.meta.url);
  const recipe = (await readFile(file, 'utf8')).replaceAll('http://127.0.0.1:18766', fixtureUrl);
  const panel = await openSidepanel();
  await expect(panel.getByText('Let your AI use a site in one step instead of clicking around.')).toBeVisible();
  await panel.getByRole('button', { name: '+ Add a shortcut' }).click();
  await panel.getByRole('button', { name: /Someone shared one with me/ }).click();
  await panel.getByRole('textbox', { name: 'Link or shortcut text' }).fill(recipe);
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Import Fixture Moodle' })).toBeVisible();
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(panel.getByText('Not verified: this comes from outside Senda.', { exact: false })).toBeVisible();
});

test('Add a shortcut offers Senda templates (search, pick, then address), ask-your-AI and shared choices', async ({ openSidepanel }) => {
  const panel = await openSidepanel();
  await panel.getByRole('button', { name: '+ Add a shortcut' }).click();
  await panel.getByRole('button', { name: /Use a Senda template/ }).click();
  await expect(panel.getByRole('heading', { name: 'Senda templates' })).toBeVisible();
  await expect(panel.getByRole('textbox', { name: /Site address/ })).toHaveCount(0);
  await panel.getByRole('searchbox', { name: 'Search templates' }).fill('whatsapp');
  await expect(panel.getByText('No template matches.')).toBeVisible();
  await panel.getByRole('searchbox', { name: 'Search templates' }).fill('deadlines');
  await panel.getByText('Moodle', { exact: true }).click();
  await expect(panel.getByRole('textbox', { name: /Site address/ })).toBeVisible();
  await panel.getByRole('button', { name: /Not in the list/ }).click();
  await expect(panel.getByText('Make a Senda site shortcut for https://example.com')).toBeVisible();

  await panel.getByRole('button', { name: 'ES' }).click();
  await panel.getByRole('button', { name: '+ Agregar un atajo' }).click();
  await panel.getByRole('button', { name: /Usar una plantilla de Senda/ }).click();
  await expect(panel.getByText(/Muestra las próximas fechas de entrega/)).toBeVisible();
  await panel.getByText('Moodle', { exact: true }).click();
  await expect(panel.getByText('La dirección de tu Moodle', { exact: false })).toBeVisible();
});
