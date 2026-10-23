// @vitest-environment happy-dom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Adapter } from '@senda/adapter-schema';
import { materialize } from '../src/core/adapters/materialize';
import { runRecipe } from '../src/injected/runner';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const templates = readdirSync(path.join(root, 'adapters'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && readdirSync(path.join(root, 'adapters', entry.name)).includes('adapter.json'))
  .map((entry) => ({ id: entry.name, value: JSON.parse(readFileSync(path.join(root, 'adapters', entry.name, 'adapter.json'), 'utf8')) }));

describe('official adapters', () => {
  it.each(templates.flatMap(({ id, value }) => [
    [id, 'https://moodle.example.edu'], [id, 'https://example.edu/moodle'],
  ]))('materializes %s at %s', (id, site) => {
    const template = templates.find((item) => item.id === id)!.value;
    expect(materialize(template, site, 'test').ok).toBe(true);
  });

  const source = templates.find((item) => item.id === 'moodle')!.value;
  const fixture = JSON.parse(readFileSync(path.join(root, 'adapters/moodle/fixtures/service.json'), 'utf8'));
  it.each([
    ['my_courses', {}, 'core_course_get_enrolled_courses_by_timeline_classification', [{ id: 2, fullname: 'Fixture course', shortname: 'FIX1', viewurl: '/course/view.php?id=2' }]],
    ['upcoming_deadlines', {}, 'core_calendar_get_action_events_by_timesort', [{ name: 'Fixture deadline', timesort: 1900000000, url: '/mod/assign/view.php?id=3' }]],
    ['search_courses', { query: 'Fixture' }, 'core_course_search_courses', [{ id: 2, fullname: 'Fixture course', shortname: 'FIX1', categoryname: 'Fixture category' }]],
  ])('runs %s against root and subpath service fixtures', async (tool, args, method, expected) => {
    for (const site of ['https://moodle.example.edu', 'https://example.edu/moodle']) {
      const ready = materialize(source, site, 'test');
      expect(ready.ok).toBe(true);
      if (!ready.ok) continue;
      const adapter = Adapter.parse(ready.adapter);
      document.body.innerHTML = '<a href="/login/logout.php?sesskey=fixSESS123">Log out</a>';
      Object.defineProperty(window, 'location', { configurable: true, value: new URL(`${site}/my/`) });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: any, init: any) => {
        const url = new URL(input);
        expect(url.pathname).toBe(`${new URL(site).pathname.replace(/\/$/, '')}/lib/ajax/service.php`);
        expect(url.searchParams.get('sesskey')).toBe('fixSESS123');
        expect(JSON.parse(init.body)[0].methodname).toBe(method);
        return new Response(JSON.stringify(fixture[method]), { status: 200 });
      }) as any;
      try { expect(await runRecipe({ adapter, tool: tool as string, args })).toMatchObject({ ok: true, value: expected }); }
      finally { globalThis.fetch = originalFetch; }
    }
  });

  it('validates and pauses rename_course before writes', async () => {
    const ready = materialize(source, 'https://moodle.example.edu', 'test');
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    const adapter = Adapter.parse(ready.adapter);
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', { configurable: true, value: new URL('https://moodle.example.edu/my/') });
    const result = await runRecipe({ adapter, tool: 'rename_course', args: { course_id: 2, fullname: 'New course', shortname: 'NEW' } });
    expect(result).toHaveProperty('navigate');
    document.body.innerHTML = '<input id="id_fullname" value="Fixture course"><input id="id_shortname" value="FIX1">';
    expect(await runRecipe({ adapter, tool: 'rename_course', args: { course_id: 2, fullname: 'New course', shortname: 'NEW' }, resume: { step: 1, vars: {} } }))
      .toMatchObject({ confirm: { vars: { old_full: 'Fixture course', old_short: 'FIX1' } } });
  });

  it('runs get_course against the anonymized settings page', async () => {
    const ready = materialize(source, 'https://example.edu/moodle', 'test');
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    const adapter = Adapter.parse(ready.adapter);
    Object.defineProperty(window, 'location', { configurable: true, value: new URL('https://example.edu/moodle/my/') });
    const first = await runRecipe({ adapter, tool: 'get_course', args: { course_id: 2 } });
    expect(first).toHaveProperty('navigate', 'https://example.edu/moodle/course/edit.php?id=2');
    document.body.innerHTML = readFileSync(path.join(root, 'adapters/moodle/fixtures/course-edit.html'), 'utf8');
    expect(await runRecipe({ adapter, tool: 'get_course', args: { course_id: 2 }, resume: { step: 1, vars: {} } }))
      .toMatchObject({ ok: true, value: { fullname: 'Fixture course', shortname: 'FIX1' } });
  });
});
