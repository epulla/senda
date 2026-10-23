import { DEFAULT_PORT } from '@senda/protocol';
import { storage } from 'wxt/utils/storage';
import type { Adapter } from '@senda/adapter-schema';

export type ConnectionStatus = 'connected' | 'disconnected' | 'invalid_token';
export const tokenItem = storage.defineItem<string>('local:token', { fallback: '' });
export const portItem = storage.defineItem<number>('local:port', { fallback: DEFAULT_PORT });
export const statusItem = storage.defineItem<ConnectionStatus>('session:status', { fallback: 'disconnected' });
export const instanceIdItem = storage.defineItem<string>('local:instanceId', { init: () => crypto.randomUUID() });
export const adaptersItem = storage.defineItem<
  Record<string, { adapter: Adapter; status: 'active' | 'paused'; installed_at: string }>
>('local:adapters', { fallback: {} });
export const draftsItem = storage.defineItem<
  Record<string, { adapter: Adapter; updated_at: string; pending: boolean; test?: string }>
>('local:drafts', { fallback: {} });
