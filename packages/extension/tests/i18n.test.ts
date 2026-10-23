import { expect, it } from 'vitest';
import { text } from '../src/core/i18n';

const shape = (value: unknown): unknown =>
  typeof value === 'object' && value
    ? Object.fromEntries(Object.entries(value).sort().map(([key, child]) => [key, shape(child)]))
    : typeof value === 'function'
      ? `function/${value.length}`
      : typeof value;

it('has the same text keys in English and Spanish', () => {
  expect(shape(text.es)).toEqual(shape(text.en));
});
