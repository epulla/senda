import { DEFAULT_PORT } from "@senda/protocol";
import { storage } from "wxt/utils/storage";

export type ConnectionStatus = "connected" | "disconnected" | "invalid_token";
export const tokenItem = storage.defineItem<string>("local:token", { fallback: "" });
export const portItem = storage.defineItem<number>("local:port", { fallback: DEFAULT_PORT });
export const statusItem = storage.defineItem<ConnectionStatus>("session:status", { fallback: "disconnected" });
