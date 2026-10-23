import { z } from 'zod';

export const ENGINE_VERSION = 1;
const name = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);
const selector = z.string();
const field = z.object({
  selector, text: z.boolean().optional(), attr: z.string().optional(),
  as: z.enum(['string', 'number', 'date']).optional(), pattern: z.string().optional(),
  default: z.unknown().optional(),
}).strict();
const fields = z.record(name, field);
const stepPayloads = {
  wait_for: z.object({ selector, text: z.string(), timeout_ms: z.number().int().optional() }).partial().strict(),
  exists: z.object({ selector }).strict(),
  if_exists: z.object({ selector, then: z.array(z.lazy(() => Step)), else: z.array(z.lazy(() => Step)).optional() }).strict(),
  extract: field,
  extract_list: z.object({ container: selector.optional(), item: selector, fields, limit: z.number().int().optional() }).strict(),
  scroll_until: z.object({ container: selector, item: selector, fields, key: name, limit: z.number().int().optional(), idle_ms: z.number().int().optional(), timeout_ms: z.number().int().optional() }).strict(),
  click: z.object({ selector }).strict(),
  navigate: z.object({ url: z.string() }).strict(),
  request: z.object({ method: z.enum(['GET', 'POST']), path: z.string(), query: z.record(z.string(), z.string()).optional(), json: z.unknown().optional() }).strict(),
  filter: z.object({ from: name, if_param: name.optional(), where: z.record(z.string(), z.object({ eq: z.unknown().optional(), ne: z.unknown().optional(), gt: z.unknown().optional(), lt: z.unknown().optional(), contains: z.unknown().optional() }).strict()) }).strict(),
  map: z.object({ from: name, fields: z.record(name, z.string()) }).strict(),
  pick: z.object({ from: name, path: z.string() }).strict(),
  join: z.object({ from: name, field: z.string().optional(), sep: z.string().optional() }).strict(),
  type: z.object({ selector, text: z.string() }).strict(),
  press: z.object({ key: z.string(), selector: selector.optional() }).strict(),
  select: z.object({ selector, value: z.string() }).strict(),
  submit: z.object({ selector }).strict(),
  return: z.union([z.string(), z.record(name, z.string())]),
} as const;
export const WRITE_STEPS = ['type', 'press', 'select', 'submit'] as const;
export const STEP_KINDS = [
  { name: 'wait_for', description: 'Wait for selector or text', read: true }, { name: 'exists', description: 'Check selector existence', read: true },
  { name: 'if_exists', description: 'Branch on selector existence', read: true }, { name: 'extract', description: 'Extract a field', read: true },
  { name: 'extract_list', description: 'Extract list of items', read: true }, { name: 'scroll_until', description: 'Scroll and collect items', read: true },
  { name: 'click', description: 'Click selector', read: true }, { name: 'navigate', description: 'Navigate to URL', read: true },
  { name: 'request', description: 'Make same-origin request', read: true }, { name: 'filter', description: 'Filter values', read: true },
  { name: 'map', description: 'Map object fields', read: true }, { name: 'pick', description: 'Pick nested value', read: true },
  { name: 'join', description: 'Join values', read: true }, ...WRITE_STEPS.map((name) => ({ name, description: `Perform ${name}`, read: false })),
  { name: 'return', description: 'Return value', read: true },
];
export const Step: z.ZodTypeAny = z.lazy(() => z.object({
  ...Object.fromEntries(Object.entries(stepPayloads).map(([key, schema]) => [key, schema.optional()])),
  save: name.optional(),
}).strict().superRefine((value, ctx) => {
  const keys = Object.keys(value).filter((key) => key !== 'save');
  if (keys.length !== 1) ctx.addIssue({ code: 'custom', message: 'Step must have exactly one step key' });
}));
export type Step = z.infer<typeof Step>;
const parameter = z.object({ type: z.enum(['string', 'number', 'boolean']), default: z.unknown().optional(), description: z.string().max(500).optional(), required: z.boolean().optional() }).strict();
const tool = z.object({ description: z.string().max(500), effect: z.enum(['read', 'write']), params: z.record(name, parameter), steps: z.array(Step), output: z.unknown().optional(), timeout_ms: z.number().int().max(120000).optional() }).strict();
export const Adapter = z.object({
  id: name, name: z.string(), version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/), engine: z.literal(1),
  source: z.enum(['official', 'community', 'local']), sites: z.array(z.string()).min(1), start_url: z.string().url().optional(), mode: z.enum(['read', 'write']),
  description: z.string().max(500), login_check: z.object({ exists: selector }).strict().optional(), read_endpoints: z.array(z.string()).optional(), tools: z.record(name, tool),
}).strict();
export type Adapter = z.infer<typeof Adapter>;
export const AdapterSummary = z.object({ id: name, name: z.string(), version: z.string(), source: z.enum(['official', 'community', 'local']), mode: z.enum(['read', 'write']), sites: z.array(z.string()), status: z.enum(['active', 'paused']), tools: z.array(z.object({ name, description: z.string(), effect: z.enum(['read', 'write']), params: z.record(name, parameter) }).strict()) }).strict();
export type AdapterSummary = z.infer<typeof AdapterSummary>;
export const adapterJsonSchema = z.toJSONSchema(Adapter);
