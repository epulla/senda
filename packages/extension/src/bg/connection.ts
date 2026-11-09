import { CLOSE_INVALID_TOKEN, ErrorCode, PROTOCOL_VERSION, type Request } from '@senda/protocol';
import { detectCapabilities } from '../core/capabilities';
import { browserName, detectBrowserName } from '../core/browser-name';
import { nextDelay } from '../core/backoff';
import { handle } from './router';
import { adaptersItem, approvalsItem, browserNameItem, draftsItem, instanceIdItem, panicItem, portItem, settingsItem, statusItem, tokenItem } from './state';
import { summaries } from './adapters/store';

let socket: WebSocket | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let ping: ReturnType<typeof setInterval> | undefined;
let attempt = 0;
let stoppedForToken = false;
let started = false;
let socketToken: string | undefined;
let socketPort: number | undefined;
let inFlight = 0;

async function badge(status: 'connected' | 'disconnected' | 'invalid_token') {
  await statusItem.setValue(status);
  const pending = stoppedForToken ? 0 :
    Object.values(await approvalsItem.getValue()).filter((item) => !item.answer).length +
    Object.values(await draftsItem.getValue()).filter((item) => item.pending).length;
  const never = pending === 0 && (await settingsItem.getValue()).askBefore === 'never';
  await browser.action.setBadgeBackgroundColor({
    color: pending
      ? '#d97706'
      : never
        ? '#dc2626'
        : status === 'connected'
        ? '#16a34a'
        : status === 'invalid_token'
          ? '#dc2626'
          : '#9ca3af',
  });
  await browser.action.setBadgeText({
    text: pending ? String(pending) : status === 'connected' ? 'on' : status === 'invalid_token' ? '!' : 'off',
  });
  const title = status === 'connected'
    ? 'Senda: connected'
    : status === 'invalid_token'
      ? 'Senda: wrong token'
      : 'Senda: server not running';
  await browser.action.setTitle({ title: never ? `${title} (never asks)` : title });
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
  // Chrome logs every refused WebSocket handshake as an extension error; a caught fetch stays quiet.
  // Timeout counts as up: older servers never answer plain HTTP.
  const up = await fetch(`http://127.0.0.1:${port}/`, { mode: 'no-cors', signal: AbortSignal.timeout(3000) }).then(
    () => true,
    (error: unknown) => error instanceof DOMException && error.name === 'TimeoutError',
  );
  if (!up) {
    await badge('disconnected');
    schedule();
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
          name: browserName(await browserNameItem.getValue(), detectBrowserName(navigator as never, import.meta.env.BROWSER)),
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
    inFlight++;
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
    } finally {
      inFlight--;
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
export function stopConnection() {
  stoppedForToken = true;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  if (socket) {
    const old = socket;
    clearSocket();
    old.close();
  }
  void badge('disconnected');
}
// Lets denied calls reach the AI before the link closes.
export async function waitForReplies(ms = 2000) {
  const end = Date.now() + ms;
  while (inFlight > 0 && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 20));
}
export async function resumeAfterPanic() {
  await panicItem.setValue(0);
}
export function startConnection() {
  if (started) return;
  started = true;
  tokenItem.watch(reconnect);
  // watchPanic stops the link once denied calls have replied.
  panicItem.watch((value) => {
    if (!value && stoppedForToken) reconnect();
  });
  approvalsItem.watch(() => void statusItem.getValue().then(badge));
  draftsItem.watch(() => void statusItem.getValue().then(badge));
  settingsItem.watch(() => void statusItem.getValue().then(badge));
  adaptersItem.watch(async () => {
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ event: 'adapters_changed', data: await summaries() }));
  });
  portItem.watch(reconnect);
  browserNameItem.watch(reconnect);
  browser.alarms.create('reconnect', { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'reconnect' && !stoppedForToken && (!socket || socket.readyState !== WebSocket.OPEN)) reconnect();
  });
  void panicItem.getValue().then((value) => (value ? stopConnection() : reconnect()));
}
