import { z } from 'zod';
import { AdapterSummary } from '@senda/adapter-schema';

export const PROTOCOL_VERSION = 1;
export const EXTENSION_ID = 'ljggnmhahelgodcecefjnfijlgomcoce';
export const DEFAULT_PORT = 18765;
export const CLOSE_INVALID_TOKEN = 4001;
export enum ErrorCode {
  NOT_CONNECTED = 'NOT_CONNECTED',
  REF_NOT_FOUND = 'REF_NOT_FOUND',
  DENIED_BY_USER = 'DENIED_BY_USER',
  DOMAIN_BLOCKED = 'DOMAIN_BLOCKED',
  TIMEOUT = 'TIMEOUT',
  TAB_GONE = 'TAB_GONE',
  UNSUPPORTED_IN_BROWSER = 'UNSUPPORTED_IN_BROWSER',
  ADAPTER_NOT_FOUND = 'ADAPTER_NOT_FOUND',
  ADAPTER_BROKEN = 'ADAPTER_BROKEN',
  ADAPTER_NEEDS_LOGIN = 'ADAPTER_NEEDS_LOGIN',
  READ_ONLY = 'READ_ONLY',
  INVALID_PARAMS = 'INVALID_PARAMS',
  INTERNAL = 'INTERNAL',
}
export type Request = { id: string; method: string; params: unknown };
export type Response = {
  id: string;
  result?: unknown;
  error?: { code: ErrorCode; message: string; data?: unknown };
  // Set by the server: which browser answered and how many are connected.
  browser?: { id: string; name: string; connected: number };
};
export type Event = {
  event: 'hello' | 'peer_hello' | 'tab_closed' | 'approval_pending' | 'adapters_changed' | 'ping';
  data?: unknown;
};
export const Hello = z.object({
  token: z.string(),
  extensionVersion: z.string(),
  protocolVersion: z.number(),
  engineVersion: z.number(),
  browser: z.string(),
  capabilities: z.array(z.string()),
  adapters: z.array(AdapterSummary),
  // Optional so older extensions still connect.
  instanceId: z.string().optional(),
  name: z.string().optional(),
});
export const PeerHello = z.object({ token: z.string() });
const tabId = z.number().optional();
export const methods = {
  navigate: z.object({ url: z.string().url(), tabId }).strict(),
  snapshot: z.object({ tabId }).strict(),
  click: z.object({ ref: z.string(), tabId }).strict(),
  type: z.object({ ref: z.string(), text: z.string(), submit: z.boolean().optional(), tabId }).strict(),
  scroll: z
    .object({ dx: z.number().optional(), dy: z.number().optional(), ref: z.string().optional(), tabId })
    .strict(),
  tabs: z
    .object({ action: z.enum(['list', 'new', 'select', 'close']), tabId, url: z.string().url().optional() })
    .strict(),
  'adapter.list': z.object({}).strict(),
  'adapter.install': z.object({ template: z.string().optional(), recipe: z.unknown().optional(), url: z.string().url().optional(), site: z.string(), label: z.string() }).strict(),
  'adapter.draft': z.object({ recipe: z.unknown() }).strict(),
  'adapter.test': z
    .object({ id: z.string(), tool: z.string(), args: z.record(z.string(), z.unknown()).optional() })
    .strict(),
  'adapter.submit': z.object({ id: z.string() }).strict(),
  'adapter.disable': z.object({ id: z.string() }).strict(),
  'adapter.remove': z.object({ id: z.string() }).strict(),
  'adapter.run': z
    .object({ adapter: z.string(), tool: z.string(), args: z.record(z.string(), z.unknown()).optional() })
    .strict(),
} as const;
export const adapterMethods = methods;
export const AdaptersChanged = z.array(AdapterSummary);
