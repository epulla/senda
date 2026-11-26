import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithoutTabGroups } from './no-tab-groups';

const gone = () => Promise.reject(new Error('Frame with ID 0 was removed.'));
// Each executeScript call takes the next step for its function; calls are logged by function name.
const page = (steps: Record<string, Array<() => Promise<unknown>>>, status = 'complete') => {
  const calls: string[] = [];
  vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 5, url: 'https://example.com/', status } as any);
  vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation((async ({ func }: any) => {
    calls.push(func.name);
    const step = steps[func.name]!;
    return [{ result: await (step.length > 1 ? step.shift()! : step[0]!)() }];
  }) as any);
  return calls;
};
const load = async () => {
  stubBrowserWithoutTabGroups();
  (await import('../src/bg/agent-tabs')).trackAgentTab(5);
  return (await import('../src/bg/commands/snapshot')).default;
};
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.useRealTimers());

it('notes an empty page that may still be loading and a page still busy after an action', async () => {
  const steps = { settleDom: [async () => false], snapshotPage: [async () => ' '] };
  page(steps);
  const snapshot = await load();
  expect(await snapshot({ tabId: 5 })).toMatchObject({ note: expect.stringContaining('may still be loading') });
  steps.snapshotPage = [async () => 'text: Dashboard'];
  expect(await snapshot({ tabId: 5 })).not.toHaveProperty('note');
  steps.settleDom = [async () => true];
  expect(await snapshot({ tabId: 5 })).toMatchObject({ note: expect.stringContaining('still busy after your last action') });
});

it('settles the new page again when the frame goes away while reading', async () => {
  const calls = page({ settleDom: [async () => false], snapshotPage: [gone, async () => 'text: Dashboard'] });
  const snapshot = await load();
  expect(await snapshot({ tabId: 5 })).toMatchObject({ snapshot: expect.stringContaining('Dashboard') });
  expect(calls).toEqual(['settleDom', 'snapshotPage', 'settleDom', 'snapshotPage']);
});

it('keeps following loads that happen while settling the new page', async () => {
  const calls = page({ settleDom: [gone, gone, async () => true], snapshotPage: [async () => 'text: Dashboard'] });
  const snapshot = await load();
  expect(await snapshot({ tabId: 5 })).toMatchObject({ snapshot: expect.stringContaining('Dashboard'), note: expect.stringContaining('still busy') });
  expect(calls).toEqual(['settleDom', 'settleDom', 'settleDom', 'snapshotPage']);
});

it('returns within 8 s with a loading note when the new page never finishes loading', async () => {
  vi.useFakeTimers();
  page({ settleDom: [gone], snapshotPage: [async () => 'text: Old'] }, 'loading');
  const snapshot = await load();
  let done: unknown;
  snapshot({ tabId: 5 }).then((r) => (done = r));
  await vi.advanceTimersByTimeAsync(8100);
  expect(done).toMatchObject({ note: expect.stringContaining('may still be loading') });
});

it('still reports a stale ref', async () => {
  page({ settleDom: [async () => false], snapshotPage: [async () => null] });
  const snapshot = await load();
  await expect(snapshot({ ref: '9', tabId: 5 })).rejects.toThrow(/take a new snapshot/);
});
