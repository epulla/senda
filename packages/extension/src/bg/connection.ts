import { CLOSE_INVALID_TOKEN, ErrorCode, PROTOCOL_VERSION, type Request } from '@senda/protocol';
import { detectCapabilities } from '../core/capabilities';
import { detectBrowserName } from '../core/browser-name';
import { nextDelay } from '../core/backoff';
import { handle } from './router';
import { adaptersItem, instanceIdItem, portItem, statusItem, tokenItem } from './state';
import { summaries } from './adapters/store';

let socket: WebSocket | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let ping: ReturnType<typeof setInterval> | undefined;
let attempt = 0;
let stoppedForToken = false;
let started = false;
let socketToken: string | undefined;
let socketPort: number | undefined;

async function badge(status: 'connected' | 'disconnected' | 'invalid_token') {
  await statusItem.setValue(status);
  await browser.action.setBadgeBackgroundColor({
    color: status === 'connected' ? '#16a34a' : status === 'invalid_token' ? '#dc2626' : '#9ca3af',
  });
  await browser.action.setBadgeText({ text: status === 'connected' ? 'on' : status === 'invalid_token' ? '!' : 'off' });
  await browser.action.setTitle({
    title:
      status === 'connected'
        ? 'Senda: connected'
        : status === 'invalid_token'
          ? 'Senda: wrong token'
          : 'Senda: server not running',
  });
}
function schedule() {
  if (timer !== undefined || stoppedForToken) return;
  timer = setTimeout(() => {
    timer = undefined;
    void connect();
  }, nextDelay(attempt++));
}
function clearSocket() {
  if (ping !== undefined) clearInterval(ping);
  ping = undefined;
  socket = undefined;
}
async function connect() {
  const token = await tokenItem.getValue();
  const port = await portItem.getValue();
  const instanceId = await instanceIdItem.getValue();
  if (!token || stoppedForToken) {
    await badge('disconnected');
    return;
  }
  if (socket && socketToken === token && socketPort === port && socket.readyState < WebSocket.CLOSING) return;
  clearSocket();
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  socket = ws;
  socketToken = token;
  socketPort = port;
  ws.onopen = async () => {
    if (socket !== ws) return;
    ws.send(
      JSON.stringify({
        event: 'hello',
        data: {
          token,
          instanceId,
          name: detectBrowserName(navigator as never, import.meta.env.BROWSER),
          extensionVersion: browser.runtime.getManifest().version,
          protocolVersion: PROTOCOL_VERSION,
          engineVersion: 1,
          browser: import.meta.env.BROWSER,
          capabilities: detectCapabilities(browser),
          adapters: await summaries(),
        },
      }),
    );
    attempt = 0;
    void badge('connected');
    ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
    }, 20_000);
  };
  ws.onmessage = async ({ data }) => {
    if (socket !== ws) return;
    let request: Request;
    try {
      request = JSON.parse(String(data)) as Request;
    } catch {
      return;
    }
    if (typeof request.id !== 'string' || typeof request.method !== 'string') return;
    try {
      ws.send(JSON.stringify({ id: request.id, result: await handle(request.method, request.params) }));
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
          ? error.code
          : ErrorCode.INTERNAL;
      ws.send(
        JSON.stringify({
          id: request.id,
          error: {
            code,
            message: error instanceof Error ? error.message : String(error),
            ...(error && typeof error === 'object' && 'data' in error && error.data !== undefined
              ? { data: error.data }
              : {}),
          },
        }),
      );
    }
  };
  ws.onclose = ({ code }) => {
    if (socket !== ws) return;
    clearSocket();
    if (code === CLOSE_INVALID_TOKEN) {
      stoppedForToken = true;
      void badge('invalid_token');
      return;
    }
    void badge('disconnected');
    schedule();
  };
  ws.onerror = () => ws.close();
}
function reconnect() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  if (socket) {
    const old = socket;
    clearSocket();
    old.close();
  }
  attempt = 0;
  stoppedForToken = false;
  void connect();
}
export function startConnection() {
  if (started) return;
  started = true;
  tokenItem.watch(reconnect);
  adaptersItem.watch(async () => {
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ event: 'adapters_changed', data: await summaries() }));
  });
  portItem.watch(reconnect);
  browser.alarms.create('reconnect', { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'reconnect' && (!socket || socket.readyState !== WebSocket.OPEN)) reconnect();
  });
  reconnect();
}
