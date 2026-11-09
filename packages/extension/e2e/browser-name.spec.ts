import { test, expect } from './fixtures';

test('renaming the browser in Settings updates browser_list', async ({ mcp, openSidepanel }) => {
  const panel = await openSidepanel();
  await panel.getByText('Settings', { exact: true }).click();
  await panel.getByLabel('Name this browser').fill('Work');
  await panel.getByLabel('Name this browser').press('Enter');
  await expect
    .poll(async () => ((await mcp.callTool({ name: 'browser_list', arguments: {} })).content as { text: string }[])[0]!.text, { timeout: 15_000 })
    .toContain('"name":"Work"');
});
