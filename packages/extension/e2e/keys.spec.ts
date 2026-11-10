import { test, expect } from './fixtures';

test('press_key handles menus and traps focus in modal dialogs', async ({ mcp, fixtureUrl }) => {
  const call = (name: string, arguments_: Record<string, unknown> = {}) => mcp.callTool({ name, arguments: arguments_ });
  await call('browser_navigate', { url: `${fixtureUrl}/site/keys.html` });
  const snap = async () => JSON.parse(((await call('browser_snapshot')).content as { text: string }[])[0]!.text).snapshot as string;
  let text = await snap();
  const summary = text.match(/\[(\d+)\] summary "Menu"/)![1];
  await call('browser_click', { ref: summary });
  text = await snap();
  expect(text).toContain('(open)');
  expect(text).toContain('a "One"');
  expect(text).toContain('a "Two"');
  const open = text.match(/\[(\d+)\] button "Open dialog"/)![1];
  await call('browser_click', { ref: open });
  text = await snap();
  let first = text.match(/\[(\d+)\] button "First"/)![1];
  let focused = (await call('browser_press_key', { key: 'Tab', ref: first })).content as { text: string }[];
  expect(JSON.parse(focused[0]!.text).focused).toContain('Dialog input');
  focused = (await call('browser_press_key', { key: 'Tab' })).content as { text: string }[];
  expect(JSON.parse(focused[0]!.text).focused).toContain('Last');
  const back = await call('browser_press_key', { key: 'Shift+Tab' });
  expect(JSON.parse((back.content as { text: string }[])[0]!.text).focused).toContain('Dialog input');
  focused = (await call('browser_press_key', { key: 'Tab' })).content as { text: string }[];
  expect(JSON.parse(focused[0]!.text).focused).toContain('Last');
  focused = (await call('browser_press_key', { key: 'Tab' })).content as { text: string }[];
  expect(JSON.parse(focused[0]!.text).focused).toContain('First');
  expect(JSON.parse(focused[0]!.text).focused).not.toContain('Outside');
  const escaped = await call('browser_press_key', { key: 'Escape' });
  expect(JSON.parse((escaped.content as { text: string }[])[0]!.text).focused).toContain('Open dialog');
  expect(await snap()).not.toContain('Dialog input');
});

test('press_key resumes approved Enter and Space actions after card focus', async ({ context, mcp, fixtureUrl }) => {
  const call = (name: string, arguments_: Record<string, unknown> = {}) => mcp.callTool({ name, arguments: arguments_ });
  await call('browser_navigate', { url: `${fixtureUrl}/site/keys.html` });
  const tab = context.pages().find((page) => page.url().endsWith('/site/keys.html'))!;
  const read = async () => JSON.parse(((await call('browser_snapshot')).content as { text: string }[])[0]!.text).snapshot as string;
  const allowPress = async (key: 'Enter' | 'Space', ref: string) => {
    const press = call('browser_press_key', { key, ref });
    const card = tab.locator('senda-approval');
    await expect(card.getByRole('button', { name: 'Allow', exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Allow', exact: true }).click();
    expect((await press).isError).toBeFalsy();
    await expect(card).toHaveCount(0);
  };
  let snapshot = await read();
  const enterRef = snapshot.match(/\[(\d+)\] button "Delete everything"/)![1]!;
  await allowPress('Enter', enterRef);
  await expect(tab.locator('#enter-count')).toHaveText('1');
  snapshot = await read();
  const checkboxRef = snapshot.match(/\[(\d+)\] checkbox "Delete everything"/)![1]!;
  await allowPress('Space', checkboxRef);
  await expect(tab.locator('#space-check')).toBeChecked();
  await expect(tab.locator('#space-state')).toHaveText('on');
});
