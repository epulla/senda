import { describe, expect, it } from 'vitest';
import { Hello, methods } from '../src/index.js';

describe('protocol schemas', () => {
  it('accepts valid hello and rejects missing token', () => {
    const hello = { token: 'x', extensionVersion: '1', protocolVersion: 1, engineVersion: 1, browser: 'chrome', capabilities: [], adapters: [] };
    expect(Hello.safeParse(hello).success).toBe(true);
    expect(Hello.safeParse({ ...hello, token: undefined }).success).toBe(false);
  });
  it.each(Object.entries(methods))('rejects unknown params for %s', (_name, schema) => {
    expect(schema.safeParse({ unexpected: true }).success).toBe(false);
  });
});
