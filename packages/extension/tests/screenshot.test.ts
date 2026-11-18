import { describe, expect, it } from 'vitest';
import { captureError } from '../src/bg/commands/screenshot';

describe('screenshot capture errors', () => {
  it('explains a hidden window instead of the readback error', () => {
    const hidden = "Chrome window isn't visible; bring it to the front and retry.";
    expect(captureError(new Error('image readback failed'), false)).toMatchObject({ code: 'TAB_GONE', message: hidden });
    expect(captureError(new Error('Failed to capture tab'), true)).toMatchObject({ message: hidden });
    const other = new Error('Failed to capture tab');
    expect(captureError(other, false)).toBe(other);
  });
});
