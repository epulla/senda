import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { CLOSE_INVALID_TOKEN, PROTOCOL_VERSION } from "@senda/protocol";
import { tokenItem, statusItem } from "../src/bg/state";

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen?: () => void;
  onclose?: (event: { code: number }) => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  sent: string[] = [];
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
  open() { this.readyState = 1; this.onopen?.(); }
}

describe("connection", () => {
  beforeEach(async () => {
    vi.resetModules(); FakeSocket.instances = [];
    vi.stubGlobal("browser", fakeBrowser);
    vi.stubGlobal("WebSocket", FakeSocket);
    await tokenItem.setValue("secret");
  });
  it("sends hello with pairing and protocol capabilities on open", async () => {
    const { startConnection } = await import("../src/bg/connection");
    startConnection();
    const ws = FakeSocket.instances[0]; ws.open();
    const hello = JSON.parse(ws.sent[0]);
    expect(hello).toMatchObject({ event: "hello", data: { token: "secret", protocolVersion: PROTOCOL_VERSION, capabilities: expect.any(Array) } });
  });
  it("marks invalid token and does not retry", async () => {
    vi.useFakeTimers();
    const { startConnection } = await import("../src/bg/connection");
    startConnection(); FakeSocket.instances[0].close(CLOSE_INVALID_TOKEN);
    await vi.waitFor(async () => expect(await statusItem.getValue()).toBe("invalid_token"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.useRealTimers();
  });
  it("marks ordinary close disconnected and schedules retry", async () => {
    vi.useFakeTimers();
    const { startConnection } = await import("../src/bg/connection");
    startConnection(); FakeSocket.instances[0].close(1006);
    await vi.waitFor(async () => expect(await statusItem.getValue()).toBe("disconnected"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});
