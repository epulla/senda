import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { CLOSE_INVALID_TOKEN, EXTENSION_ID, PROTOCOL_VERSION } from '@senda/protocol';
import { createRelay } from '../src/index.js';

const token = 'a'.repeat(64);
const hello = (value = token) => ({ event: 'hello', data: { token: value, extensionVersion: '1', protocolVersion: PROTOCOL_VERSION, engineVersion: 1, browser: 'chrome', capabilities: [], adapters: [] } });
const servers: ReturnType<typeof createRelay>[] = [];
afterEach(() => { for (const server of servers.splice(0)) server.close(); });
async function setup(timeout = 5000) {
  const server = createRelay(token, 0, timeout); servers.push(server);
  await new Promise<void>(resolve => server.http.once('listening', resolve));
  const port = (server.http.address() as any).port;
  return { server, port };
}
function connect(port: number, origin?: string) {
  return new WebSocket(`ws://127.0.0.1:${port}`, { ...(origin ? { origin } : {}) });
}
function connected(ws: WebSocket) { return new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); }
function closed(ws: WebSocket) { return new Promise<number>(resolve => ws.once('close', code => resolve(code))); }
function authenticate(ws: WebSocket, value = token) { ws.send(JSON.stringify(hello(value))); }

describe('Senda WebSocket relay', () => {
  it('rejects invalid token with protocol close code', async () => {
    const { port } = await setup(); const ws = connect(port, `chrome-extension://${EXTENSION_ID}`); await connected(ws);
    const close = closed(ws); authenticate(ws, 'wrong'); expect(await close).toBe(CLOSE_INVALID_TOKEN);
  });
  it('rejects invalid peer token with protocol close code', async () => {
    const { port } = await setup(); const ws = connect(port); await connected(ws);
    const close = closed(ws); ws.send(JSON.stringify({ event: 'peer_hello', data: { token: 'wrong' } }));
    expect(await close).toBe(CLOSE_INVALID_TOKEN);
  });
  it('rejects http origin', async () => {
    const { port } = await setup(); const ws = connect(port, 'http://localhost');
    await expect(connected(ws)).rejects.toBeDefined();
  });
  it('rejects extension hello on a no-origin peer socket', async () => {
    const { port } = await setup(); const ws = connect(port); await connected(ws); const close = closed(ws);
    authenticate(ws); expect(await close).toBe(1008);
  });
  it('closes clients that do not hello before timeout', async () => {
    const { port } = await setup(30); const ws = connect(port, `chrome-extension://${EXTENSION_ID}`); await connected(ws);
    expect(await closed(ws)).toBe(1008);
  });
  it('round-trips a navigate response after valid hello', async () => {
    const { port, server } = await setup(); const ws = connect(port, `chrome-extension://${EXTENSION_ID}`); await connected(ws);
    authenticate(ws); await new Promise(resolve => setTimeout(resolve, 10));
    const response = server.relay.call('navigate', { url: 'https://example.com' });
    const request = await new Promise<any>(resolve => ws.once('message', raw => resolve(JSON.parse(raw.toString()))));
    ws.send(JSON.stringify({ id: request.id, result: { title: 'Example' } }));
    await expect(response).resolves.toEqual({ id: request.id, result: { title: 'Example' } });
  });
  it('returns NOT_CONNECTED without an extension', async () => {
    const { server } = await setup();
    await expect(server.relay.call('navigate', {})).rejects.toThrow('NOT_CONNECTED: Open your browser and check that the Senda extension is connected.');
  });
  it('relays follower calls through leader and takes over after leader exits', async () => {
    const { server: first, port } = await setup();
    const second = createRelay(token, port); servers.push(second);
    await new Promise<void>(resolve => second.http.once('error', () => resolve()));
    const extension = connect(port, `chrome-extension://${EXTENSION_ID}`); await connected(extension); authenticate(extension);
    await new Promise(resolve => setTimeout(resolve, 50));
    const call = second.relay.call('navigate', { url: 'https://example.com' });
    const request = await new Promise<any>(resolve => extension.once('message', raw => resolve(JSON.parse(raw.toString()))));
    extension.send(JSON.stringify({ id: request.id, result: { title: 'Example' } }));
    await expect(call).resolves.toMatchObject({ result: { title: 'Example' } });
    first.close();
    await new Promise<void>(resolve => second.http.once('listening', resolve));
    await expect(second.relay.call('navigate', {})).rejects.toThrow('NOT_CONNECTED: Open your browser');
  }, 10000);
});
