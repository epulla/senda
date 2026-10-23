import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Adapter } from '@senda/adapter-schema';
import { validateAdapter } from '../src/core/adapters/validate';
import { matchesSites } from '../src/core/adapters/sites';
import { describeChanges } from '../src/core/adapters/diff';
import { permissionIncrease } from '../src/core/adapters/permissions';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../adapter-schema/tests/fixtures/${name}.json`, import.meta.url), 'utf8'));
const valid = fixture('whatsapp') as Adapter;
const withTool = (steps: unknown[], effect = 'read') => ({
  ...valid,
  tools: { sample: { description: 'Sample', effect, params: {}, steps: [...steps, { return: 'x' }] } },
});

describe('adapter policies', () => {
  it('accepts both fixture recipes', () => {
    expect(validateAdapter(fixture('whatsapp')).ok).toBe(true);
    expect(validateAdapter(fixture('moodle')).ok).toBe(true);
  });
  it('matches exact host, port, and path prefix', () => {
    expect(matchesSites('http://127.0.0.1:18766/moodle/x', ['http://127.0.0.1:18766/moodle/*'])).toBe(true);
    expect(matchesSites('http://127.0.0.1:18767/moodle/x', ['http://127.0.0.1:18766/moodle/*'])).toBe(false);
  });
  it('rejects unsafe sites and blocked domains', () => {
    expect(validateAdapter({ ...valid, sites: ['<all_urls>'] }).ok).toBe(false);
    expect(validateAdapter({ ...valid, sites: ['https://*.x.com/*'] }).ok).toBe(false);
    expect(validateAdapter(valid, { blockedDomains: ['whatsapp.com'] }).ok).toBe(false);
  });
  it('rejects outside navigation and invalid request paths', () => {
    for (const url of ['https://evil.com/x', 'https://web.whatsapp.com{{args.x}}', '//evil.com', '/\\evil.com'])
      expect(validateAdapter(withTool([{ navigate: { url } }])).ok).toBe(false);
    expect(validateAdapter(withTool([{ navigate: { url: 'https://web.whatsapp.com/chat/{{args.id}}' } }])).ok).toBe(
      true,
    );
    for (const path of ['https://x.com/a', '//x.com/a', '/\\x.com/a'])
      expect(validateAdapter(withTool([{ request: { method: 'GET', path } }])).ok).toBe(false);
  });
  it('rejects unapproved POST and write steps including nested branches', () => {
    expect(validateAdapter(withTool([{ request: { method: 'POST', path: '/not-approved' } }])).ok).toBe(false);
    for (const steps of [
      [{ type: { selector: 'input', text: 'x' } }],
      [{ if_exists: { selector: 'x', then: [{ type: { selector: 'input', text: 'x' } }] } }],
    ])
      expect(validateAdapter(withTool(steps)).ok).toBe(false);
  });
  it('rejects tools that do not end with return', () => {
    const steps = [{ extract: { selector: 'h1' }, save: 'title' }];
    const tool = { description: 'Sample', effect: 'read', params: {}, steps };
    expect(validateAdapter({ ...valid, tools: { sample: tool } })).toMatchObject({
      ok: false,
      errors: ['tools.sample.steps: last step must be "return"'],
    });
  });
  it.each([
    [{ t: withTool([]).tools.sample }, 'tools.t: invalid name, must match ^[a-z][a-z0-9_]{1,40}$'],
    [withTool([{ extract: { selector: 'h1' }, save: 'x' }]).tools, 'tools.sample.steps.0.save: must match ^[a-z][a-z0-9_]{1,40}$'],
  ])('explains short names (%#)', (tools, error) => {
    const result = validateAdapter({ ...valid, tools });
    expect(result.ok ? [] : result.errors).toEqual([expect.stringContaining(error)]);
  });
  it('describes additions and selector changes', () => {
    expect(describeChanges(undefined, valid)[0]).toContain('WhatsApp');
    const updated = structuredClone(valid);
    updated.tools.list_chats!.steps[0] = { exists: { selector: '.new' } };
    expect(describeChanges(valid, updated).join(' ')).toContain('→ .new');
  });
  it('reports permission increases only', () => {
    const next = structuredClone(valid);
    next.sites.push('https://extra.example/*');
    next.mode = 'write';
    next.read_endpoints = ['/api'];
    next.tools.change = { description: 'Change', effect: 'write', params: {}, steps: [] };
    expect(permissionIncrease(valid, next)).toHaveLength(4);
    expect(permissionIncrease(valid, valid)).toEqual([]);
  });
});
