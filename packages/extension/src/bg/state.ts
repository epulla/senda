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
export type ApprovalCard = { id: string; kind: 'generic'|'adapter'; summary: string; host: string; url?: string; details?: [string, string][]; source?: string; allowAlways: boolean; created_at: string };
export const approvalsItem = storage.defineItem<Record<string, ApprovalCard & { answer?: 'allow'|'deny'|'always' }>>('session:approvals', { fallback: {} });
export const settingsItem = storage.defineItem<{
  askBefore: 'destructive' | 'changes' | 'everything';
  allowedDomains: string[];
  blockedDomains: string[];
  alwaysSites: string[];
}>('local:settings', { fallback: { askBefore: 'destructive', allowedDomains: [], blockedDomains: [], alwaysSites: [] } });
export const activityItem = storage.defineItem<
  Array<{
    at: string;
    kind: 'approval' | 'denied' | 'injection' | 'adapter' | 'panic';
    text: string;
  }>
>('local:activity', { fallback: [] });
export const visitedHostsItem = storage.defineItem<string[]>('session:visitedHosts', { fallback: [] });
export const taintItem = storage.defineItem<string|null>('session:taint', { fallback: null });
export const panicItem = storage.defineItem<number>('session:panic', { fallback: 0 });
