import type { Adapter } from '@senda/adapter-schema';
import { ErrorCode } from '@senda/protocol';
import { matchesSites } from '../core/adapters/sites';
import { render } from '../core/adapters/template';
import { isSensitiveLabel } from '../core/sensitive';

type Input = {
  adapter: Adapter;
  tool: string;
  args: Record<string, unknown>;
  resume?: { step: number; vars: Record<string, unknown> };
  approved?: boolean;
};
export type RunResult =
  | { ok: true; value: unknown }
  | { ok: false; code: string; message: string; data?: unknown }
  | { navigate: string; resume: { step: number; vars: Record<string, unknown> } }
  | { confirm: { step: number; vars: Record<string, unknown> } }
  | { settle: { step: number; vars: Record<string, unknown> } };
const path = (o: any, p: string): any => p.split('.').reduce((v, k) => v?.[/^\d+$/.test(k) ? +k : k], o);
const safe = (el: Element | null): boolean =>
  !el || !el.matches('input[type=password], [autocomplete~=cc-number], [autocomplete~=cc-csc], [autocomplete~=cc-exp]');
function select(selector: string, root: ParentNode = document): Element | null {
  if (selector === ':scope') return root instanceof Element ? root : null;
  if (selector.startsWith('text=')) {
    const q = selector.slice(5).toLowerCase();
    return (
      [...root.querySelectorAll('*')].find(
        (e) =>
          e.textContent?.toLowerCase().includes(q) &&
          ![...e.children].some((c) => c.textContent?.toLowerCase().includes(q)),
      ) ?? null
    );
  }
  if (selector.startsWith('role=')) {
    const role = selector.slice(5),
      implicit: Record<string, string> = {
        button: 'button',
        link: 'a[href]',
        listitem: 'li',
        textbox: 'input,textarea',
      };
    return root.querySelector(`[role="${CSS.escape(role)}"]${implicit[role] ? `,${implicit[role]}` : ''}`);
  }
  return root.querySelector(selector);
}
export async function runRecipe(input: Input): Promise<RunResult> {
  const { adapter, tool } = input,
    def = adapter.tools[tool];
  if (!def) return { ok: false, code: ErrorCode.INVALID_PARAMS, message: 'Unknown tool' };
  const args = { ...input.args };
  for (const [k, p] of Object.entries(def.params)) {
    if (args[k] === undefined && 'default' in p) args[k] = p.default;
    if (args[k] === undefined && p.required)
      return { ok: false, code: ErrorCode.INVALID_PARAMS, message: `Missing required parameter: ${k}` };
  }
  const vars = { ...(input.resume?.vars ?? {}) };
  let count = 0,
    current = -1,
    currentStep: any;
  const ctx = () => ({ args, vars, now: Math.floor(Date.now() / 1000) });
  const sel = (selector: string | undefined, root?: ParentNode) =>
    selector ? select(String(render(selector, ctx())), root) : null;
  const get = (el: Element, f: any) => {
    if (!safe(el)) return null;
    let v: any = f.text
      ? el.textContent?.trim()
      : f.attr
        ? el.getAttribute(f.attr)
        : f.selector
          ? sel(f.selector, el)?.textContent?.trim()
          : el.getAttribute('href')
            ? new URL(el.getAttribute('href')!, location.href).href
            : el.textContent?.trim();
    if (f.pattern && v) {
      const m = new RegExp(f.pattern).exec(v);
      v = m?.[1] ?? undefined;
    }
    if (v === undefined || v === null || v === '') {
      if ('default' in f) return f.default;
      throw Error('Missing extracted value');
    }
    if (f.as === 'number') v = Number(v);
    if (f.as === 'date') v = new Date(v).toISOString();
    return v;
  };
  const fail = (code: string, message: string, data?: unknown): RunResult => ({ ok: false, code, message, data });
  const bad = (message: string): RunResult => {
    const body = currentStep?.[Object.keys(currentStep ?? {}).find((k) => k !== 'save') ?? ''];
    return fail(ErrorCode.ADAPTER_BROKEN, message, {
      tool,
      step_index: current,
      step: currentStep,
      selector: body?.selector ?? body?.item,
      page: {
        url: location.href,
        title: document.title,
        summary: (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 2000),
      },
    });
  };
  const execute = async (steps: any[]): Promise<RunResult | undefined> => {
    for (let i = input.resume && steps === def.steps ? input.resume.step : 0; i < steps.length; i++) {
      if (++count > 200) return fail(ErrorCode.ADAPTER_BROKEN, 'Step limit exceeded');
      current = i;
      currentStep = steps[i];
      const [kind, payload] = Object.entries(currentStep).find(([k]) => k !== 'save') as [string, any];
      if (def.effect === 'write' && !input.approved && ['type', 'select', 'press', 'submit'].includes(kind))
        return { confirm: { step: i, vars } };
      if (def.effect === 'write' && !input.approved && kind === 'request' && payload.method === 'POST') {
        const u = new URL(render(payload.path, ctx()) as string, location.origin);
        if (!(adapter.read_endpoints ?? []).includes(u.pathname)) return { confirm: { step: i, vars } };
      }
      let out: any;
      try {
        switch (kind) {
          case 'wait_for': {
            const until = Date.now() + (payload.timeout_ms ?? 10000);
            while (!(payload.selector ? sel(payload.selector) : payload.text ? sel(`text=${payload.text}`) : null)) {
              if (Date.now() > until) throw Error('Timed out waiting for selector');
              await new Promise((r) => setTimeout(r, 100));
            }
            break;
          }
          case 'exists':
            out = !!sel(payload.selector);
            break;
          case 'if_exists': {
            const r = await execute(sel(payload.selector) ? payload.then : (payload.else ?? []));
            if (r) return r;
            break;
          }
          case 'extract':
          case 'extract_list': {
            const container = kind === 'extract' ? document : sel(payload.container ?? 'body');
            if (!container) throw Error('Missing container');
            if (kind === 'extract') {
              const el = sel(payload.selector);
              if (el) out = get(el, payload);
              else if ('default' in payload) out = payload.default;
              else throw Error('Missing extraction target');
            } else {
              const items = [...container.querySelectorAll(String(render(payload.item, ctx())))].slice(
                0,
                payload.limit ?? Infinity,
              );
              if (!items.length && !payload.allow_empty) throw Error(`No items match ${payload.item}`);
              out = items.map((el) =>
                Object.fromEntries(
                  Object.entries(payload.fields).map(([k, f]) => {
                    const field = f as any,
                      child = field.selector ? sel(field.selector, el) : el;
                    return [k, child ? get(child, field) : 'default' in field ? field.default : null];
                  }),
                ),
              );
            }
            break;
          }
          case 'scroll_until': {
            const el = sel(payload.container) as HTMLElement | null;
            if (!el) throw Error('Missing scroll container');
            const found = new Map();
            const end = Date.now() + (payload.timeout_ms ?? 20000);
            let last = Date.now();
            while (
              Date.now() < end &&
              Date.now() - last < (payload.idle_ms ?? 1000) &&
              found.size < (payload.limit ?? Infinity)
            ) {
              for (const row of el.querySelectorAll(String(render(payload.item, ctx())))) {
                const v = Object.fromEntries(
                  Object.entries(payload.fields).map(([k, f]) => {
                    const field = f as any;
                    const ch = field.selector ? sel(field.selector, row) : row;
                    if (!ch) return [k, 'default' in field ? field.default : null];
                    return [k, get(ch, field)];
                  }),
                );
                const key = path(v, payload.key);
                if (!found.has(key)) {
                  found.set(key, v);
                  last = Date.now();
                }
              }
              if (found.size >= (payload.limit ?? Infinity)) break;
              el.scrollTop += el.clientHeight;
              el.dispatchEvent(new Event('scroll'));
              await new Promise((r) => setTimeout(r, 100));
            }
            if (!found.size && !payload.allow_empty) throw Error(`No items match ${payload.item}`);
            out = [...found.values()];
            break;
          }
          case 'click': {
            const el = sel(payload.selector) as HTMLElement | null;
            if (!el) throw Error('Missing click target');
            if (
              isSensitiveLabel(
                [
                  el.textContent,
                  el.getAttribute('aria-label'),
                  el.getAttribute('value'),
                  el.getAttribute('title'),
                ].join(' '),
              )
            ) {
              if (def.effect === 'read') return fail(ErrorCode.READ_ONLY, 'Sensitive action blocked');
              if (!input.approved) return { confirm: { step: i, vars } };
            }
            for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup'])
              el.dispatchEvent(new MouseEvent(t, { bubbles: true }));
            el.click();
            // The click may load a new page and end this script; the background resumes after it settles.
            if (steps === def.steps) return { settle: { step: i + 1, vars } };
            break;
          }
          case 'navigate': {
            const url = new URL(render(payload.url, ctx()) as string, location.href).href;
            if (!matchesSites(url, adapter.sites))
              return fail(ErrorCode.DOMAIN_BLOCKED, 'Navigation outside adapter sites');
            return { navigate: url, resume: { step: i + 1, vars } };
          }
          case 'request': {
            const u = new URL(render(payload.path, ctx()) as string, location.origin);
            for (const [k, v] of Object.entries(render(payload.query ?? {}, ctx()) as any))
              u.searchParams.set(k, String(v));
            if (u.origin !== location.origin)
              return fail(ErrorCode.DOMAIN_BLOCKED, 'Requests can only go to the site the tab is on');
            if (
              def.effect === 'read' &&
              payload.method === 'POST' &&
              !(adapter.read_endpoints ?? []).includes(u.pathname)
            )
              return fail(ErrorCode.READ_ONLY, `POST to ${u.pathname} is not an approved read endpoint`);
            const res = await fetch(u, {
              method: payload.method,
              credentials: 'same-origin',
              headers: payload.method === 'POST' ? { 'content-type': 'application/json' } : undefined,
              body: payload.method === 'POST' ? JSON.stringify(render(payload.json, ctx())) : undefined,
            });
            if (!res.ok) throw Error(`Request failed: ${res.status}`);
            try {
              out = await res.json();
            } catch {
              throw Error(`Request returned non-JSON: ${res.status}`);
            }
            break;
          }
          case 'filter':
            out = ((vars[payload.from] ?? []) as any[]).filter((v: any) =>
              !payload.if_param || args[payload.if_param]
                ? Object.entries(payload.where).every(([k, ops]: any) =>
                    Object.entries(ops).every(([op, x]: any) =>
                      op === 'eq'
                        ? path(v, k) === x
                        : op === 'ne'
                          ? path(v, k) !== x
                          : op === 'gt'
                            ? path(v, k) > x
                            : op === 'lt'
                              ? path(v, k) < x
                              : op === 'contains'
                                ? String(path(v, k)).includes(String(x))
                                : true,
                    ),
                  )
                : true,
            );
            break;
          case 'map':
            out = ((vars[payload.from] ?? []) as any[]).map((v: any) =>
              Object.fromEntries(Object.entries(payload.fields).map(([k, p]) => [k, path(v, p as string)])),
            );
            break;
          case 'pick':
            out = path(vars[payload.from], payload.path);
            break;
          case 'join':
            out = ((vars[payload.from] ?? []) as any[])
              .map((x: any) => (payload.field ? path(x, payload.field) : x))
              .join(payload.sep ?? '');
            break;
          case 'type': {
            const e = sel(payload.selector) as HTMLInputElement | null;
            if (!e) throw Error('Missing input');
            e.focus();
            e.value = String(render(payload.text, ctx()));
            e.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
          case 'select': {
            const e = sel(payload.selector) as HTMLSelectElement | null;
            if (!e) throw Error('Missing select');
            e.value = payload.value;
            e.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
          case 'press': {
            const e = sel(payload.selector ?? 'body')!;
            e.dispatchEvent(new KeyboardEvent('keydown', { key: payload.key, bubbles: true }));
            break;
          }
          case 'submit': {
            const e = sel(payload.selector) as HTMLElement | null;
            if (!e) throw Error('Missing submit');
            if (e instanceof HTMLFormElement) e.requestSubmit();
            else e.click();
            if (steps === def.steps) return { settle: { step: i + 1, vars } };
            break;
          }
          case 'return': {
            const missing = (typeof payload === 'string' ? [payload] : Object.values(payload)).find(
              (name) => !Object.hasOwn(vars, name as string),
            );
            if (missing !== undefined) throw Error(`Unknown variable: ${missing}`);
            out =
              typeof payload === 'string'
                ? vars[payload]
                : Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, vars[v as string]]));
            return { ok: true, value: out };
          }
          default:
            throw Error(`Unsupported step: ${kind}`);
        }
      } catch (e) {
        return bad(e instanceof Error ? e.message : String(e));
      }
      if (currentStep.save) vars[currentStep.save] = out;
    }
    return { ok: true, value: undefined };
  };
  const timeout = def.timeout_ms ?? 120000;
  const result = await Promise.race([
    execute(def.steps).catch((e) => bad(e instanceof Error ? e.message : String(e))),
    new Promise<RunResult>((r) => setTimeout(() => r(fail(ErrorCode.TIMEOUT, 'Recipe timed out')), timeout)),
  ]);
  const final = result ?? { ok: true, value: undefined };
  if ('ok' in final && final.ok && (JSON.stringify(final.value)?.length ?? 0) > 1024 * 1024)
    return fail(ErrorCode.ADAPTER_BROKEN, 'Recipe output exceeds 1 MB');
  return final;
}
