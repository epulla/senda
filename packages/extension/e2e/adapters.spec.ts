import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test('approved adapter draft reads data and renames a course after Allow', async ({ context, mcp, fixtureUrl, openSidepanel }) => {
  const login = await context.newPage();
  await login.goto(`${fixtureUrl}/moodle/login/index.php`);
  await login.locator('#login').click();
  await login.waitForURL('**/moodle/my/');

  const file = new URL('../tests/fixtures/adapters/fixturemoodle.json', import.meta.url);
  const recipe = JSON.parse((await readFile(file, 'utf8')).replaceAll('http://127.0.0.1:18766', fixtureUrl));
  expect((await mcp.callTool({ name: 'adapter_draft', arguments: { recipe } })).isError).toBeFalsy();
  expect((await mcp.callTool({ name: 'adapter_submit', arguments: { id: 'fixturemoodle' } })).isError).toBeFalsy();
  const panel = await openSidepanel();
  await panel.getByRole('button', { name: 'Approve', exact: true }).click();

  await expect.poll(async () => JSON.stringify(await mcp.callTool({ name: 'fixturemoodle__my_courses', arguments: {} }))).toContain('Fixture course');

  const rename = mcp.callTool({ name: 'fixturemoodle__rename_course', arguments: { id: 2, fullname: 'Renamed course', shortname: 'FIX2' } });
  await expect(panel.getByText('Rename course 2: Fixture course → Renamed course')).toBeVisible();
  await panel.getByRole('button', { name: 'Allow', exact: true }).click();
  expect((await rename).isError).toBeFalsy();
  await login.goto(`${fixtureUrl}/moodle/course/view.php?id=2`);
  await expect(login.locator('h1')).toHaveText('Renamed course');
});
