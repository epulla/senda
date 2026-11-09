import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { CLOSE_INVALID_TOKEN, EXTENSION_ID, EXTENSION_IDS, PROTOCOL_VERSION } from '@senda/protocol';
import { createRelay } from '../src/index.js';

const token = 'a'.repeat(64);
const hello = (value = token, instanceId?: string, name?: string, adapters: unknown[] = []) => ({
  event: 'hello',
  data: {
    token: value,
    extensionVersion: '1',
    protocolVersion: PROTOCOL_VERSION,
    engineVersion: 1,
    browser: name ?? 'chrome',
    ...(instanceId ? { instanceId } : {}),
    ...(name ? { name } : {}),
    capabilities: [],
    adapters,
  },
});
const servers: ReturnType<typeof createRelay>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});
async function setup(timeout = 5000) {
  const server = createRelay(token, 0, timeout);
  servers.push(server);
  await new Promise<void>((resolve) => server.http.once('listening', resolve));
  const port = (server.http.address() as any).port;
  return { server, port };
}
// Takeover tests need a fixed port: a relay on port 0 would re-listen on a new random port.
async function onFreePort(...stamps: { version: string; build: number }[]) {
  const probe = createRelay(token, 0);
  await new Promise<void>((resolve) => probe.http.once('listening', resolve));
  const port = (probe.http.address() as any).port;
  probe.close();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const [first, ...rest] = stamps.map((stamp) => () => createRelay(token, port, 5000, stamp));
  const leader = first!();
  servers.push(leader);
  await new Promise<void>((resolve) => leader.http.once('listening', resolve));
  // The rest start together while the first one leads.
  const others = rest.map((start) => start());
  servers.push(...others);
  return { port, relays: [leader, ...others] };
}
function connect(port: number, origin?: string) {
  return new WebSocket(`ws://127.0.0.1:${port}`, { ...(origin ? { origin } : {}) });
}
function connected(ws: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}
function closed(ws: WebSocket) {
  return new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));
}
function authenticate(ws: WebSocket, value = token) {
  ws.send(JSON.stringify(hello(value)));
}
function replyOn(ws: WebSocket, result: unknown) {
  return new Promise<void>((resolve) =>
    ws.once('message', (raw) => {
      const request = JSON.parse(raw.toString());
      ws.send(JSON.stringify({ id: request.id, result }));
      resolve();
    }),
  );
}

describe('Senda WebSocket relay', () => {
  it('rejects invalid token with protocol close code', async () => {
    const { port } = await setup();
    const ws = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(ws);
    const close = closed(ws);
    authenticate(ws, 'wrong');
    expect(await close).toBe(CLOSE_INVALID_TOKEN);
  });
  it('rejects invalid peer token with protocol close code', async () => {
    const { port } = await setup();
    const ws = connect(port);
    await connected(ws);
    const close = closed(ws);
    ws.send(JSON.stringify({ event: 'peer_hello', data: { token: 'wrong' } }));
    expect(await close).toBe(CLOSE_INVALID_TOKEN);
  });
  it('rejects http origin', async () => {
    const { port } = await setup();
    const ws = connect(port, 'http://localhost');
    await expect(connected(ws)).rejects.toBeDefined();
  });
  it.each(EXTENSION_IDS)('accepts extension origin %s', async (id) => {
    const { port } = await setup();
    await connected(connect(port, `chrome-extension://${id}`));
  });
  it('answers plain HTTP with an empty 426', async () => {
    const { port } = await setup();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(426);
    expect(await res.text()).toBe('');
  });
  it('rejects extension hello on a no-origin peer socket', async () => {
    const { port } = await setup();
    const ws = connect(port);
    await connected(ws);
    const close = closed(ws);
    authenticate(ws);
    expect(await close).toBe(1008);
  });
  it('closes clients that do not hello before timeout', async () => {
    const { port } = await setup(30);
    const ws = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(ws);
    expect(await closed(ws)).toBe(1008);
  });
  it('round-trips a navigate response after valid hello', async () => {
    const { port, server } = await setup();
    const ws = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(ws);
    authenticate(ws);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const response = server.relay.call('navigate', { url: 'https://example.com' });
    const request = await new Promise<any>((resolve) =>
      ws.once('message', (raw) => resolve(JSON.parse(raw.toString()))),
    );
    ws.send(JSON.stringify({ id: request.id, result: { title: 'Example' } }));
    await expect(response).resolves.toMatchObject({
      id: request.id,
      result: { title: 'Example' },
      browser: { name: 'chrome' },
    });
  });
  it('returns NOT_CONNECTED without an extension', async () => {
    const { server } = await setup();
    await expect(server.relay.call('navigate', {})).rejects.toThrow(
      'NOT_CONNECTED: Open your browser and check that the Senda extension is connected.',
    );
  });
  it('honors an explicit relay timeout', async () => {
    const { port, server } = await setup();
    const ws = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(ws);
    authenticate(ws);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(server.relay.call('snapshot', {}, {}, 20)).rejects.toThrow('TIMEOUT: Request timed out.');
    ws.close();
  });
  it('keeps browsers connected and routes by name', async () => {
    const { port, server } = await setup();
    const chrome = connect(port, `chrome-extension://${EXTENSION_ID}`);
    const edge = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await Promise.all([connected(chrome), connected(edge)]);
    chrome.send(JSON.stringify(hello(token, 'chrome-id', 'Chrome')));
    edge.send(JSON.stringify(hello(token, 'edge-id', 'Edge')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chrome.readyState).toBe(WebSocket.OPEN);
    expect(edge.readyState).toBe(WebSocket.OPEN);
    const reply = replyOn(edge, { browser: 'edge' });
    await expect(server.relay.call('snapshot', {}, { browser: 'Edge' })).resolves.toMatchObject({
      result: { browser: 'edge' },
      browser: { name: 'Edge' },
    });
    await reply;
    expect(chrome.listenerCount('message')).toBe(0);
  });
  it('rejects a name shared by two browsers and still routes by id', async () => {
    const { port, server } = await setup();
    const work = connect(port, `chrome-extension://${EXTENSION_ID}`);
    const personal = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await Promise.all([connected(work), connected(personal)]);
    work.send(JSON.stringify(hello(token, 'work-id', 'Chrome')));
    personal.send(JSON.stringify(hello(token, 'personal-id', 'Chrome')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(server.relay.call('snapshot', {}, { browser: 'chrome' })).rejects.toThrow(
      '2 browsers are named "chrome": work-id, personal-id.',
    );
    const reply = replyOn(personal, { ok: true });
    await expect(server.relay.call('snapshot', {}, { browser: 'personal-id' })).resolves.toMatchObject({ result: { ok: true } });
    await reply;
  });
  it('tells each browser the names the other browsers use', async () => {
    const { port } = await setup();
    const work = connect(port, `chrome-extension://${EXTENSION_ID}`);
    const personal = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await Promise.all([connected(work), connected(personal)]);
    const events: string[][] = [];
    work.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'browsers') events.push(msg.data);
    });
    work.send(JSON.stringify(hello(token, 'work-id', 'Work')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    personal.send(JSON.stringify(hello(token, 'personal-id', 'Personal')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    personal.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(events).toEqual([[], ['Personal'], []]);
  });
  it('sends adapter calls for uninstalled ids to the preferred browser', async () => {
    const { port, server } = await setup();
    const chrome = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(chrome);
    chrome.send(JSON.stringify(hello(token, 'chrome-id', 'Chrome')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const reply = replyOn(chrome, { ok: true });
    await expect(server.relay.call('adapter.submit', { id: 'draft_only' }, { prefer: 'chrome-id' })).resolves.toMatchObject({
      result: { ok: true },
    });
    await reply;
  });
  it('unions hello adapters, updates from adapters_changed, and drops them on disconnect', async () => {
    const { port, server } = await setup();
    const adapter = {
      id: 'example',
      name: 'Example',
      version: '1.0.0',
      source: 'local',
      mode: 'read',
      sites: ['https://example.com/*'],
      status: 'active',
      tools: [],
    };
    const ws = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(ws);
    ws.send(JSON.stringify(hello(token, 'adapter-browser', 'Chrome', [adapter])));
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(server.relay.adapters()).toEqual([adapter]);
    const changed = { ...adapter, version: '1.1.0' };
    ws.send(JSON.stringify({ event: 'adapters_changed', data: [changed] }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(server.relay.adapters()).toEqual([changed]);
    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(server.relay.adapters()).toEqual([]);
  });
  it('reconnect with same instance id replaces only that socket', async () => {
    const { port } = await setup();
    const a = connect(port, `chrome-extension://${EXTENSION_ID}`);
    const b = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await Promise.all([connected(a), connected(b)]);
    a.send(JSON.stringify(hello(token, 'same', 'A')));
    b.send(JSON.stringify(hello(token, 'other', 'B')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const replacement = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(replacement);
    const wasClosed = closed(a);
    replacement.send(JSON.stringify(hello(token, 'same', 'A2')));
    await wasClosed;
    expect(a.readyState).toBe(WebSocket.CLOSED);
    expect(b.readyState).toBe(WebSocket.OPEN);
    expect(replacement.readyState).toBe(WebSocket.OPEN);
  });
  it('rejects unknown browser name', async () => {
    const { server } = await setup();
    await expect(server.relay.call('snapshot', {}, { browser: 'Missing' })).rejects.toThrow(
      'No connected browser named',
    );
  });
  it('relays follower calls through leader and takes over after leader exits', async () => {
    const { server: first, port } = await setup();
    const second = createRelay(token, port);
    servers.push(second);
    await new Promise<void>((resolve) => second.http.once('error', () => resolve()));
    const extension = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(extension);
    const adapter = {
      id: 'example',
      name: 'Example',
      version: '1.0.0',
      source: 'local',
      mode: 'read',
      sites: ['https://example.com/*'],
      status: 'active',
      tools: [],
    };
    extension.send(JSON.stringify(hello(token, 'first', undefined, [adapter])));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(second.relay.adapters()).toEqual([adapter]);
    const changed = { ...adapter, version: '1.0.1' };
    extension.send(JSON.stringify({ event: 'adapters_changed', data: [changed] }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(second.relay.adapters()).toEqual([changed]);
    const other = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(other);
    other.send(JSON.stringify(hello(token, 'edge', 'Edge')));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const listed = second.relay.call('list_browsers', {});
    await expect(listed).resolves.toMatchObject({ result: [{ name: 'chrome' }, { id: 'edge', name: 'Edge' }] });
    const call = second.relay.call('navigate', { url: 'https://example.com' });
    const request = await new Promise<any>((resolve) =>
      extension.once('message', (raw) => resolve(JSON.parse(raw.toString()))),
    );
    extension.send(JSON.stringify({ id: request.id, result: { title: 'Example' } }));
    await expect(call).resolves.toMatchObject({ result: { title: 'Example' } });
    first.close();
    await new Promise<void>((resolve) => second.http.once('listening', resolve));
    await expect(second.relay.call('navigate', {})).rejects.toThrow('NOT_CONNECTED: Open your browser');
  }, 10000);
  it('a newer server takes over from an older leader; an older one never does', async () => {
    const {
      port,
      relays: [old],
    } = await onFreePort({ version: '0.1.1', build: 5 });
    const origin = `chrome-extension://${EXTENSION_ID}`;
    const before = connect(port, origin);
    await connected(before);
    before.send(JSON.stringify(hello(token, 'browser', 'Chrome')));
    const newer = createRelay(token, port, 5000, { version: '0.2.0', build: 1 });
    servers.push(newer);
    await closed(before);
    await vi.waitFor(() => expect(newer.http.listening).toBe(true), { timeout: 3000 });

    const after = connect(port, origin);
    await connected(after);
    const events: string[] = [];
    after.on('message', (raw) => events.push(JSON.parse(raw.toString()).event));
    after.send(JSON.stringify(hello(token, 'browser', 'Chrome')));
    await vi.waitFor(() => expect(events).toContain('server'));
    await expect(newer.relay.call('list_browsers', {})).resolves.toMatchObject({ result: [{ id: 'browser' }] });
    // The old one rejoins as a peer and reaches the browser through the new leader.
    await vi.waitFor(
      async () => {
        expect(old.http.listening).toBe(false);
        await expect(old.relay.call('list_browsers', {})).resolves.toMatchObject({ result: [{ id: 'browser' }] });
      },
      { timeout: 5000 },
    );

    const older = createRelay(token, port, 5000, { version: '0.1.0', build: 9 });
    servers.push(older);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(newer.http.listening).toBe(true);
    expect(after.readyState).toBe(WebSocket.OPEN);
  }, 15000);
  it('several newer servers starting at once settle on the newest, and every server reaches the browser', async () => {
    const { port, relays: all } = await onFreePort(...[1, 2, 3, 4].map((build) => ({ version: '0.2.0', build })));
    const relisten = vi.spyOn(all[0]!.http, 'listen');
    const newest = all[3]!;
    await vi.waitFor(
      () => expect(all.map((server) => server.http.listening)).toEqual([false, false, false, true]),
      { timeout: 10000, interval: 100 },
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(newest.http.listening).toBe(true);
    // The first leader stepped down once and tried to listen again once, not once per newer peer.
    expect(relisten).toHaveBeenCalledTimes(1);
    const browser = connect(port, `chrome-extension://${EXTENSION_ID}`);
    await connected(browser);
    browser.send(JSON.stringify(hello(token, 'browser', 'Chrome')));
    await vi.waitFor(
      async () => {
        for (const server of all)
          await expect(server.relay.call('list_browsers', {})).resolves.toMatchObject({ result: [{ id: 'browser' }] });
      },
      { timeout: 5000 },
    );
    browser.close();
  }, 20000);
});
