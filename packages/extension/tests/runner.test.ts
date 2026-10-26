// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { Adapter } from '@senda/adapter-schema';
import { cssString, render } from '../src/core/adapters/template';
import { runRecipe } from '../src/injected/runner';
import { validateAdapter } from '../src/core/adapters/validate';
import { materialize } from '../src/core/adapters/materialize';
import chat from './fixtures/adapters/fixturechat.json';
import moodle from './fixtures/adapters/fixturemoodle.json';
import { handleMoodle } from './fixtures/moodle-api.mjs';

describe('recipe runner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  it('validates reference Moodle adapter including write confirmation', () => {
    expect(validateAdapter(moodle).ok).toBe(true);
    expect(() =>
      Adapter.parse({
        ...moodle,
        tools: { ...moodle.tools, rename_course: { ...moodle.tools.rename_course, confirm: 'x'.repeat(201) } },
      }),
    ).toThrow();
  });
  it('pauses before write and resumes with approval using extracted old names', async () => {
    const a = Adapter.parse(moodle);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://127.0.0.1:18766/moodle/my/'),
    });
    const args = { id: 2, fullname: 'New title', shortname: 'NEW' };
    const first = await runRecipe({ adapter: a, tool: 'rename_course', args });
    expect(first).toHaveProperty('navigate');
    document.body.innerHTML =
      '<input id="id_fullname" value="Fixture course"><input id="id_shortname" value="FIX1"><form></form>';
    const edit = await runRecipe({ adapter: a, tool: 'rename_course', args, resume: { step: 1, vars: {} } });
    expect(edit).toMatchObject({ confirm: { vars: { old_full: 'Fixture course', old_short: 'FIX1' } } });
    if (!('confirm' in edit)) throw new Error('Expected write confirmation');
    const submitted = await runRecipe({ adapter: a, tool: 'rename_course', args, approved: true, resume: edit.confirm });
    if (!('settle' in submitted)) throw new Error('Expected settle after submit');
    const resumed = await runRecipe({ adapter: a, tool: 'rename_course', args, approved: true, resume: submitted.settle });
    expect(resumed).toMatchObject({ ok: true, value: { fullname: 'Fixture course', shortname: 'FIX1' } });
  });
  it('renders raw values and interpolated strings', () =>
    expect([
      render('{{args.n}}', { args: { n: 3 }, vars: {}, now: 1 }),
      render('x{{vars.a}}', { args: {}, vars: { a: 'y' }, now: 1 }),
    ]).toEqual([3, 'xy']));
  it('fills only search boxes with the search step, also in read tools', async () => {
    const tool = (selector: string) =>
      Adapter.parse({
        ...chat,
        tools: { find: { description: 'x', effect: 'read', params: { query: { type: 'string' } }, steps: [{ search: { selector, text: '{{args.query}}' } }, { extract: { selector, attr: 'aria-label' }, save: 'label' }, { return: 'label' }] } },
      });
    document.body.innerHTML = '<input id="s" aria-label="Buscar un chat"><div id="m" contenteditable="true" aria-label="Escribir un mensaje"></div>';
    expect(validateAdapter(tool('#s')).ok).toBe(true);
    await runRecipe({ adapter: tool('#s'), tool: 'find', args: { query: 'mami' } });
    expect((document.querySelector('#s') as HTMLInputElement).value).toBe('mami');
    expect(await runRecipe({ adapter: tool('#m'), tool: 'find', args: { query: 'hola' } })).toMatchObject({ ok: false, code: 'READ_ONLY' });
    expect(document.querySelector('#m')!.textContent).toBe('');
    document.body.innerHTML = '<span id="lbl">Buscar un chat</span><input id="s" type="text" aria-labelledby="lbl">';
    await runRecipe({ adapter: tool('#s'), tool: 'find', args: { query: 'ana' } });
    expect((document.querySelector('#s') as HTMLInputElement).value).toBe('ana');
    document.body.innerHTML = '<input id="s" type="text"><form><input id="f" type="text"></form>';
    await runRecipe({ adapter: tool('#s'), tool: 'find', args: { query: 'ana' } });
    expect((document.querySelector('#s') as HTMLInputElement).value).toBe('ana');
    expect(await runRecipe({ adapter: tool('#f'), tool: 'find', args: { query: 'x' } })).toMatchObject({ ok: false, code: 'READ_ONLY' });
  });
  it('takes the last N items, filters by arguments ignoring case, and escapes inserted names', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        last: {
          description: 'x',
          effect: 'read',
          params: { count: { type: 'number', default: 2 }, query: { type: 'string' } },
          steps: [
            { extract_list: { item: 'li', limit: '{{args.count}}', from_end: true, fields: { text: { selector: 'span', text: true } } }, save: 'items' },
            { filter: { from: 'items', where: { text: { icontains: '{{args.query}}' } } }, save: 'hits' },
            { return: 'hits' },
          ],
        },
      },
    });
    document.body.innerHTML = '<ul><li><span>Old mami</span></li><li><span>Hi MAMI</span></li><li><span>bye</span></li></ul>';
    expect(await runRecipe({ adapter: a, tool: 'last', args: { query: 'mami' } })).toMatchObject({ ok: true, value: [{ text: 'Hi MAMI' }] });
    expect(render('[title="{{args.name}}"]', { args: { name: 'Say "hi" \\ bye' }, vars: {}, now: 1 }, cssString)).toBe('[title="Say \\"hi\\" \\\\ bye"]');
  });
  it('continues after an if_exists branch finishes', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        branch: {
          description: 'x',
          effect: 'read',
          params: {},
          steps: [
            { if_exists: { selector: '#a', then: [{ extract: { selector: '#a', text: true }, save: 'first' }] } },
            { extract: { selector: '#b', text: true }, save: 'second' },
            { return: { first: 'first', second: 'second' } },
          ],
        },
      },
    });
    document.body.innerHTML = '<i id="a">one</i><i id="b">two</i>';
    expect(await runRecipe({ adapter: a, tool: 'branch', args: {} })).toEqual({ ok: true, value: { first: 'one', second: 'two' } });
  });
  it('validates fixture and reports variant selector breakage', async () => {
    const a = Adapter.parse(chat);
    document.body.innerHTML = '<article class="chat-row">row</article>';
    const result = await runRecipe({ adapter: a, tool: 'list_chats', args: {} });
    expect(result).toMatchObject({ ok: false, code: 'ADAPTER_BROKEN' });
  });
  it('blocks sensitive click in read tool', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        click_send: { description: 'x', effect: 'read', params: {}, steps: [{ click: { selector: 'button' } }] },
      },
    });
    document.body.innerHTML = '<button>Send</button>';
    expect(await runRecipe({ adapter: a, tool: 'click_send', args: {} })).toMatchObject({
      ok: false,
      code: 'READ_ONLY',
    });
  });
  it('scrolls virtualized chat rows and returns 30 unique chats', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        ...chat.tools,
        list_chats: {
          ...chat.tools.list_chats,
          steps: [
            {
              scroll_until: { ...(chat.tools.list_chats.steps[0] as any).scroll_until, idle_ms: 1000 },
              save: 'chats',
            },
            { return: 'chats' },
          ],
        },
      },
    });
    document.body.innerHTML = '<div id="list"></div>';
    const list = document.querySelector('#list')!;
    Object.defineProperty(list, 'clientHeight', { value: 600 });
    const draw = () => {
      list.innerHTML = '';
      const first = Math.floor((list as HTMLElement).scrollTop / 40);
      for (const i of Array.from({ length: 15 }, (_, n) => first + n)) {
        const row = document.createElement('div');
        row.setAttribute('role', 'listitem');
        row.innerHTML = `<span title="Chat ${String(i + 1).padStart(3, '0')}">Chat ${String(i + 1).padStart(3, '0')}</span><span class="last">last</span><span class="unread">1</span>`;
        list.append(row);
      }
    };
    list.addEventListener('scroll', draw);
    draw();
    const result = await runRecipe({ adapter: a, tool: 'list_chats', args: {} });
    expect('ok' in result && result.ok ? result.value : null).toHaveLength(30);
    expect(new Set((result as any).value.map((x: any) => x.name)).size).toBe(30);
  });
  it('hands back after a click and continues on the next page', async () => {
    const a = Adapter.parse(chat);
    const args = { chat: 'Chat 003' };
    document.body.innerHTML = '<button>Chat 003</button>';
    const first = await runRecipe({ adapter: a, tool: 'read_chat', args });
    expect(first).toMatchObject({ settle: { step: 1 } });
    if (!('settle' in first)) throw new Error('Expected settle');
    document.body.innerHTML = '<div class="messages open"><p>Chat 003 says hello</p></div>';
    const result = await runRecipe({ adapter: a, tool: 'read_chat', args, resume: first.settle });
    expect(result).toMatchObject({ ok: true, value: [{ message: 'Chat 003 says hello' }] });
  });
  it('calls Moodle endpoint with sesskey and methodname', async () => {
    const a = Adapter.parse(moodle);
    document.body.innerHTML = '<a href="/moodle/login/logout.php?sesskey=fixSESS123">Log out</a>';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://127.0.0.1:18766/moodle/my/'),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      expect(new URL(url).searchParams.get('sesskey')).toBe('fixSESS123');
      const body = JSON.parse(init.body);
      expect(body[0].methodname).toBe('core_calendar_get_action_events_by_timesort');
      return new Response(JSON.stringify(handleMoodle(body, 'MoodleSession=fixture', 'fixSESS123')), { status: 200 });
    }) as any;
    try {
      expect(await runRecipe({ adapter: a, tool: 'upcoming_deadlines', args: {} })).toMatchObject({
        ok: true,
        value: [{ name: 'Fixture deadline' }],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it('runs my_courses from a materialized subpath template', async () => {
    const replace = (value: any): any => typeof value === 'string'
      ? value.replaceAll('http://127.0.0.1:18766/moodle', '{{site}}').replaceAll('/moodle', '{{site_path}}')
      : Array.isArray(value) ? value.map(replace) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)])) : value;
    const template = { ...replace(moodle), template: { site: { description: 'Moodle site', example: 'https://moodle.example.edu' } } };
    const result = materialize(template, 'http://127.0.0.1:18766/moodle', 'runner');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    document.body.innerHTML = '<a href="/moodle/login/logout.php?sesskey=fixSESS123">Log out</a>';
    Object.defineProperty(window, 'location', { configurable: true, value: new URL('http://127.0.0.1:18766/moodle/my/') });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify(handleMoodle(body, 'MoodleSession=fixture', 'fixSESS123')), { status: 200 });
    }) as any;
    try {
      expect(await runRecipe({ adapter: result.adapter, tool: 'my_courses', args: {} })).toMatchObject({ ok: true, value: [{ fullname: 'Fixture course' }] });
    } finally { globalThis.fetch = originalFetch; }
  });
  it('blocks outside navigation and resumes inside navigation', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        go: { description: 'go', effect: 'read', params: {}, steps: [{ navigate: { url: 'https://outside.test' } }] },
      },
    });
    expect(await runRecipe({ adapter: a, tool: 'go', args: {} })).toMatchObject({ ok: false, code: 'DOMAIN_BLOCKED' });
    const inside = Adapter.parse({
      ...chat,
      tools: {
        go: {
          description: 'go',
          effect: 'read',
          params: {},
          steps: [{ navigate: { url: 'http://127.0.0.1:18766/chat/next' } }],
        },
      },
    });
    expect(await runRecipe({ adapter: inside, tool: 'go', args: {} })).toMatchObject({
      navigate: 'http://127.0.0.1:18766/chat/next',
      resume: { step: 1 },
    });
  });
  it('blocks requests that resolve to another origin', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        leak: {
          description: 'leak',
          effect: 'read',
          params: {},
          steps: [{ request: { method: 'GET', path: '/\\evil.test/collect' } }],
        },
      },
    });
    expect(await runRecipe({ adapter: a, tool: 'leak', args: {} })).toMatchObject({
      ok: false,
      code: 'DOMAIN_BLOCKED',
    });
  });
  it('never returns password field value', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        password: {
          description: 'password',
          effect: 'read',
          params: {},
          steps: [
            { extract: { selector: 'input[type=password]', attr: 'value', default: null }, save: 'secretvar' },
            { return: 'secretvar' },
          ],
        },
      },
    });
    document.body.innerHTML = '<input type="password" value="secret">';
    expect(await runRecipe({ adapter: a, tool: 'password', args: {} })).toMatchObject({ ok: true, value: null });
  });
  it('keeps step data when a step throws outside its handler', async () => {
    const steps = [{ save: 'x' }];
    const a = { ...chat, tools: { odd: { description: 'odd', effect: 'read', params: {}, steps } } } as any;
    expect(await runRecipe({ adapter: a, tool: 'odd', args: {} })).toMatchObject({
      ok: false,
      code: 'ADAPTER_BROKEN',
      data: { step_index: 0, step: { save: 'x' }, page: { url: expect.any(String) } },
    });
  });
  it('reports returning an unknown variable', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: { ret: { description: 'ret', effect: 'read', params: {}, steps: [{ return: 'x' }] } },
    });
    expect(await runRecipe({ adapter: a, tool: 'ret', args: {} })).toMatchObject({
      ok: false,
      code: 'ADAPTER_BROKEN',
      message: 'Unknown variable: x',
      data: { step_index: 0, step: { return: 'x' } },
    });
  });
  it.each([
    [undefined, { ok: false, code: 'ADAPTER_BROKEN', data: { selector: '.row' } }],
    [true, { ok: true, value: [] }],
  ])('empty list with allow_empty=%s', async (allow_empty, expected) => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        rows: {
          description: 'rows',
          effect: 'read',
          params: {},
          steps: [
            { extract_list: { item: '.row', fields: { name: { selector: ':scope' } }, allow_empty }, save: 'rows' },
            { return: 'rows' },
          ],
        },
      },
    });
    document.body.innerHTML = '<main></main>';
    expect(await runRecipe({ adapter: a, tool: 'rows', args: {} })).toMatchObject(expected);
  });
  it('returns extract default when the target is missing', async () => {
    const a = Adapter.parse({
      ...chat,
      tools: {
        title: {
          description: 'title',
          effect: 'read',
          params: {},
          steps: [{ extract: { selector: '#none', default: 'n/a' }, save: 'title' }, { return: 'title' }],
        },
      },
    });
    expect(await runRecipe({ adapter: a, tool: 'title', args: {} })).toMatchObject({ ok: true, value: 'n/a' });
  });
  it('enforces 200-step limit', async () => {
    const steps = Array.from({ length: 201 }, () => ({ exists: { selector: 'body' } }));
    const a = Adapter.parse({ ...chat, tools: { many: { description: 'many', effect: 'read', params: {}, steps } } });
    expect(await runRecipe({ adapter: a, tool: 'many', args: {} })).toMatchObject({
      ok: false,
      message: 'Step limit exceeded',
    });
  });
});
