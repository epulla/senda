import { test, expect } from './fixtures';

test('press_key handles menus and traps focus in modal dialogs', async ({ mcp, fixtureUrl }) => {
  const call = (name: string, arguments_: Record<string, unknown> = {}) => mcp.callTool({ name, arguments: arguments_ });
  await call('browser_navigate', { url: `${fixtureUrl}/site/keys.html` });
  const snap = async () => {
    const result = await call('browser_snapshot');
    const raw = (result.content as { text: string }[])[0]!.text;
    if (result.isError) throw new Error(raw);
    return JSON.parse(raw).snapshot as string;
  };
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

test('Escape closes top-layer popovers and innermost or focused dialogs', async ({ mcp, fixtureUrl }) => {
  const call = (name: string, arguments_: Record<string, unknown> = {}) => mcp.callTool({ name, arguments: arguments_ });
  await call('browser_navigate', { url: `${fixtureUrl}/site/keys.html` });
  const read = async () => JSON.parse(((await call('browser_snapshot')).content as { text: string }[])[0]!.text).snapshot as string;
  const key = async () => call('browser_press_key', { key: 'Escape' });
  let snapshot = await read();
  const nestedRef = snapshot.match(/\[(\d+)\] button "Open nested dialogs"/)![1]!;
  await call('browser_click', { ref: nestedRef });
  snapshot = await read();
  const innerRef = snapshot.match(/\[(\d+)\] button "Open inner"/)![1]!;
  await call('browser_click', { ref: innerRef });
  let result = await key();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).focused).toContain('Open inner');
  snapshot = await read();
  expect(snapshot).toContain('Outer action');
  expect(snapshot).not.toContain('Inner action');
  await key();

  snapshot = await read();
  const stackedRef = snapshot.match(/\[(\d+)\] button "Open B then A"/)![1]!;
  await call('browser_click', { ref: stackedRef });
  result = await key();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).focused).toContain('B inside');
  snapshot = await read();
  expect(snapshot).toContain('B inside');
  expect(snapshot).not.toContain('A inside');
  await key();

  snapshot = await read();
  const popoverDialogRef = snapshot.match(/\[(\d+)\] button "Open popover dialog"/)![1]!;
  await call('browser_click', { ref: popoverDialogRef });
  snapshot = await read();
  const popoverRef = snapshot.match(/\[(\d+)\] button "Open popover"/)![1]!;
  await call('browser_click', { ref: popoverRef });
  result = await key();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).focused).toContain('Open popover');
  snapshot = await read();
  expect(snapshot).toContain('Dialog outside pop');
  expect(snapshot).not.toContain('Popover inside');

  snapshot = await read();
  const cancelLauncher = snapshot.match(/\[(\d+)\] button "Open cancel dialog"/)![1]!;
  await call('browser_click', { ref: cancelLauncher });
  result = await key();
  expect(JSON.parse((result.content as { text: string }[])[0]!.text).focused).toContain('Cancel target');
  snapshot = await read();
  expect(snapshot).toContain('Close cancel dialog');
  const closeRef = snapshot.match(/\[(\d+)\] button "Close cancel dialog"/)![1]!;
  await call('browser_click', { ref: closeRef });
});
