import { DEFAULT_PORT } from '@senda/protocol';
import { storage } from 'wxt/utils/storage';
import type { Adapter } from '@senda/adapter-schema';
import type { Language } from '../core/i18n';

export type ConnectionStatus = 'connected' | 'disconnected' | 'invalid_token';
export const tokenItem = storage.defineItem<string>('local:token', { fallback: '' });
export const portItem = storage.defineItem<number>('local:port', { fallback: DEFAULT_PORT });
export const statusItem = storage.defineItem<ConnectionStatus>('session:status', { fallback: 'disconnected' });
// Empty means the detected brand (Chrome, Edge…).
export const browserNameItem = storage.defineItem<string>('local:browserName', { fallback: '' });
export const instanceIdItem = storage.defineItem<string>('local:instanceId', { init: () => crypto.randomUUID() });
export const adaptersItem = storage.defineItem<
  Record<string, { adapter: Adapter; status: 'active' | 'paused'; installed_at: string }>
>('local:adapters', { fallback: {} });
export const draftsItem = storage.defineItem<
  Record<string, { adapter: Adapter; updated_at: string; pending: boolean; test?: string; source?: Adapter['source'] }>
>('local:drafts', { fallback: {} });
export type ApprovalCard = { id: string; kind: 'generic'|'adapter'; summary: string; host: string; url?: string; tabId?: number; ref?: string; details?: [string, string][]; source?: string; allowAlways: boolean; created_at: string };
export const approvalsItem = storage.defineItem<Record<string, ApprovalCard & { answer?: 'allow'|'deny'|'always' }>>('session:approvals', { fallback: {} });
export const settingsItem = storage.defineItem<{
  askBefore: 'never' | 'destructive' | 'changes' | 'everything';
  allowedDomains: string[];
  blockedDomains: string[];
  alwaysSites: string[];
  theme?: 'system' | 'light' | 'dark';
  language?: Language;
}>('local:settings', { fallback: { askBefore: 'destructive', allowedDomains: [], blockedDomains: [], alwaysSites: [] } });
export const activityItem = storage.defineItem<
  Array<{
    at: string;
    kind: 'approval' | 'denied' | 'injection' | 'adapter' | 'panic' | 'tab';
    text: string;
  }>
>('local:activity', { fallback: [] });
export const visitedHostsItem = storage.defineItem<string[]>('session:visitedHosts', { fallback: [] });
export const taintItem = storage.defineItem<string|null>('session:taint', { fallback: null });
// Host of content that looked like a prompt injection; the only thing that brings back cards under "Never ask".
export const suspectItem = storage.defineItem<string|null>('session:suspect', { fallback: null });
export const panicItem = storage.defineItem<number>('session:panic', { fallback: 0 });
export const openedTabsItem = storage.defineItem<number[]>('session:openedTabs', { fallback: [] });
