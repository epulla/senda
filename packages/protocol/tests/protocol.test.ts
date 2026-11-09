import { describe, expect, it } from 'vitest';
import { compareVersions, Hello, isNewerServer, methods } from '../src/index.js';

describe('protocol schemas', () => {
  it('accepts valid hello and rejects missing token', () => {
    const hello = {
      token: 'x',
      extensionVersion: '1',
      protocolVersion: 1,
      engineVersion: 1,
      browser: 'chrome',
      capabilities: [],
      adapters: [],
    };
    expect(Hello.safeParse(hello).success).toBe(true);
    expect(Hello.safeParse({ ...hello, token: undefined }).success).toBe(false);
  });
  it.each(Object.entries(methods))('rejects unknown params for %s', (_name, schema) => {
    expect(schema.safeParse({ unexpected: true }).success).toBe(false);
  });
});

describe('server versions', () => {
  it.each([
    ['0.2.0', '0.1.1', 1],
    ['0.1.1', '0.2.0', -1],
    ['0.10.0', '0.9.9', 1],
    ['0.2.0', '0.2.0', 0],
    ['1.0', '1.0.0', 0],
  ])('compares %s with %s', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b))).toBe(sign);
  });
  it('prefers the later build only when versions match', () => {
    expect(isNewerServer({ version: '0.2.0', build: 2 }, { version: '0.2.0', build: 1 })).toBe(true);
    expect(isNewerServer({ version: '0.2.0', build: 1 }, { version: '0.2.0', build: 1 })).toBe(false);
    expect(isNewerServer({ version: '0.1.1', build: 9 }, { version: '0.2.0', build: 1 })).toBe(false);
  });
});
