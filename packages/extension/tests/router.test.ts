// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { CommandError, handle } from '../src/bg/router';
describe('router validation', () => {
  it.each([
    { method: 'unknown', params: {} },
    { method: 'navigate', params: { url: 'not a URL' } },
  ])('$method rejects invalid request', async ({ method, params }) => {
    await expect(handle(method, params)).rejects.toBeInstanceOf(CommandError);
  });
});
