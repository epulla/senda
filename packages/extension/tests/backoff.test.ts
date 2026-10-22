import { describe, expect, it } from 'vitest';
import { nextDelay } from '../src/core/backoff';

describe('nextDelay', () => {
  it.each([
    [0, 1000],
    [1, 2000],
    [2, 4000],
    [3, 8000],
    [4, 16000],
    [5, 30000],
    [6, 30000],
  ])('attempt %i → %i ms', (attempt, delay) => {
    expect(nextDelay(attempt)).toBe(delay);
  });
});
