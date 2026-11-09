import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stubBrowserWithoutTabGroups } from './no-tab-groups';
import { CLOSE_INVALID_TOKEN, PROTOCOL_VERSION } from '@senda/protocol';
import { tokenItem, statusItem, adaptersItem, panicItem, browserNameItem, otherBrowsersItem } from '../src/bg/state';

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen?: () => void;
  onclose?: (event: { code: number }) => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  sent: string[] = [];
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

function latestSocket(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error('Expected connection to create a WebSocket');
  return socket;
}

describe('connection', () => {
  beforeEach(async () => {
    vi.resetModules();
    // Drops storage and the watchers earlier tests' connection modules left behind.
    fakeBrowser.reset();
    FakeSocket.instances = [];
    stubBrowserWithoutTabGroups();
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()));
    vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({ version: '1.0.0' } as ReturnType<
      typeof fakeBrowser.runtime.getManifest
    >);
    await tokenItem.setValue('secret');
  });
  it('sends hello with pairing and protocol capabilities on open', async () => {
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const ws = latestSocket();
    ws.open();
    await vi.waitFor(() => expect(ws.sent).toHaveLength(1));
    const payload = ws.sent[0];
    if (!payload) throw new Error('Expected hello payload');
    const hello = JSON.parse(payload);
    expect(hello).toMatchObject({
      event: 'hello',
      data: {
        token: 'secret',
        protocolVersion: PROTOCOL_VERSION,
        capabilities: expect.any(Array),
        instanceId: expect.any(String),
        name: expect.any(String),
      },
    });
  });
  it('marks invalid token and does not retry', async () => {
    vi.useFakeTimers();
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    latestSocket().close(CLOSE_INVALID_TOKEN);
    await vi.waitFor(async () => expect(await statusItem.getValue()).toBe('invalid_token'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.useRealTimers();
  });
  it('marks ordinary close disconnected and schedules retry', async () => {
    vi.useFakeTimers();
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    latestSocket().open();
    await vi.waitFor(() => expect(latestSocket().sent).toHaveLength(1));
    latestSocket().close(1006);
    await vi.waitFor(async () => expect(await statusItem.getValue()).toBe('disconnected'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    latestSocket().open();
    await vi.advanceTimersByTimeAsync(0);
    const firstHello = JSON.parse(FakeSocket.instances[0]!.sent[0]!);
    const secondHello = JSON.parse(latestSocket().sent[0]!);
    expect(secondHello.data.instanceId).toBe(firstHello.data.instanceId);
    vi.useRealTimers();
  });
  it('skips the WebSocket while the server port refuses, then connects once it answers', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(async () => expect(await statusItem.getValue()).toBe('disconnected'));
    expect(FakeSocket.instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.useRealTimers();
  });
  it('sends adapters_changed when installed adapters change', async () => {
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const ws = latestSocket();
    ws.open();
    await vi.waitFor(() => expect(ws.sent).toHaveLength(1));
    await adaptersItem.setValue({
      demo: {
        adapter: {
          id: 'demo',
          name: 'Demo',
          version: '1.0.0',
          source: 'local',
          mode: 'read',
          sites: ['https://example.com/*'],
          tools: {},
          engine: 1,
          description: '',
        },
        status: 'active',
        installed_at: 'now',
      },
    });
    await vi.waitFor(() => expect(ws.sent).toHaveLength(2));
    expect(JSON.parse(ws.sent[1]!).event).toBe('adapters_changed');
  });
  it('stays disconnected when panic switch is set at worker startup', async () => {
    await panicItem.setValue(Date.now());
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(async () => expect(await statusItem.getValue()).toBe('disconnected'));
    expect(FakeSocket.instances).toHaveLength(0);
  });
  it('reconnects with a new browser name, but not while stopped', async () => {
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    latestSocket().open();
    await browserNameItem.setValue('Work');
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    latestSocket().open();
    await vi.waitFor(() => expect(JSON.parse(latestSocket().sent[0]!).data.name).toBe('Work'));

    await panicItem.setValue(Date.now());
    const { stopConnection } = await import('../src/bg/connection');
    stopConnection();
    await browserNameItem.setValue('Personal');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(FakeSocket.instances).toHaveLength(2);
    await panicItem.setValue(0);
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(3));
    latestSocket().open();
    await vi.waitFor(() => expect(JSON.parse(latestSocket().sent[0]!).data.name).toBe('Personal'));
  });
  it('keeps the names of the other connected browsers until the link closes', async () => {
    const { startConnection } = await import('../src/bg/connection');
    startConnection();
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const ws = latestSocket();
    ws.open();
    ws.onmessage?.({ data: JSON.stringify({ event: 'browsers', data: ['Work', 7] }) });
    await vi.waitFor(async () => expect(await otherBrowsersItem.getValue()).toEqual(['Work']));
    ws.close(1006);
    await vi.waitFor(async () => expect(await otherBrowsersItem.getValue()).toEqual([]));
  });
});
