import { test, expect } from './fixtures';

test('select and type pick options in a controlled dropdown', async ({ context, mcp, fixtureUrl }) => {
  const call = (name: string, arguments_: Record<string, unknown> = {}) => mcp.callTool({ name, arguments: arguments_ });
  const text = (result: Awaited<ReturnType<typeof call>>) => (result.content as { text: string }[])[0]!.text;
  await call('browser_navigate', { url: `${fixtureUrl}/site/select.html` });
  const tab = context.pages().find((page) => page.url().endsWith('/site/select.html'))!;
  const snapshot = JSON.parse(text(await call('browser_snapshot'))).snapshot as string;
  expect(snapshot).toContain('select "Role" (options: Choose, Gerente, Empleado) selected="Choose"');
  const ref = snapshot.match(/\[(\d+)\] select "Role"/)![1]!;
  const picked = await call('browser_select', { ref, value: 'Gerente' });
  expect(JSON.parse(text(picked)).selected).toEqual(['Gerente']);
  await expect(tab.locator('#state')).toHaveText('m');
  expect((await call('browser_type', { ref, text: 'e' })).isError).toBeFalsy();
  await expect(tab.locator('#state')).toHaveText('e');
  const wrong = await call('browser_select', { ref, value: 'Nobody' });
  expect(wrong.isError).toBe(true);
  expect(text(wrong)).toContain('Options: Choose, Gerente (m), Empleado (e)');
  await call('browser_select', { ref, value: 'gerente' });
  const langs = snapshot.match(/\[(\d+)\] select "Languages"/)![1]!;
  expect(JSON.parse(text(await call('browser_select', { ref: langs, value: ['English', 'es'] }))).selected).toEqual(['English', 'Español']);
  await tab.locator('button').click();
  await expect(tab.locator('#sent')).toHaveText('m,en,es');
});
