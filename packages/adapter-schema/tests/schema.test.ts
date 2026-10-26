import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Adapter, adapterJsonSchema } from '../src/index.js';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
describe('adapter schema', () => {
  it('accepts WhatsApp and Moodle recipes', () => {
    expect(Adapter.safeParse(fixture('whatsapp')).success).toBe(true);
    expect(Adapter.safeParse(fixture('moodle')).success).toBe(true);
  });
  it('rejects unknown fields, invalid tool names, long descriptions, and multi-key steps', () => {
    const recipe = fixture('whatsapp');
    expect(Adapter.safeParse({ ...recipe, extra: true }).success).toBe(false);
    expect(Adapter.safeParse({ ...recipe, tools: { 'Bad-name': recipe.tools.list_chats } }).success).toBe(false);
    expect(Adapter.safeParse({ ...recipe, description: 'x'.repeat(501) }).success).toBe(false);
    const bad = structuredClone(recipe);
    bad.tools.list_chats.steps[0].click = { selector: 'x' };
    expect(Adapter.safeParse(bad).success).toBe(false);
  });
  it('accepts UI translations and rejects unknown translation fields', () => {
    const recipe = fixture('whatsapp');
    const es = { description: 'Lee tus chats.', tools: { list_chats: { description: 'Lista tus chats.' } } };
    expect(Adapter.safeParse({ ...recipe, i18n: { es } }).success).toBe(true);
    expect(Adapter.safeParse({ ...recipe, i18n: { es: { ...es, steps: [] } } }).success).toBe(false);
  });
  it('exports JSON Schema object', () => expect(adapterJsonSchema).toMatchObject({ type: 'object' }));
});
