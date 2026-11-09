import { describe, expect, it } from 'vitest';
import { browserName, detectBrowserName } from '../src/core/browser-name';

describe('detectBrowserName', () => {
  it.each([
    [{}, 'firefox', 'Firefox'],
    [{ brave: true }, 'chrome', 'Brave'],
    [{ userAgentData: { brands: [{ brand: 'Microsoft Edge' }] } }, 'chrome', 'Edge'],
    [{ userAgentData: { brands: [{ brand: 'Opera' }] } }, 'chrome', 'Opera'],
    [{ userAgentData: { brands: [{ brand: 'Vivaldi' }] } }, 'chrome', 'Vivaldi'],
    [{ userAgentData: { brands: [{ brand: 'Google Chrome' }] } }, 'chrome', 'Chrome'],
    [{}, 'chrome', 'Chromium'],
  ])('detects %s on %s as %s', (nav, target, expected) => {
    expect(detectBrowserName(nav, target)).toBe(expected);
  });
});

describe('browserName', () => {
  it.each([
    ['', 'Chrome', 'Chrome'],
    ['  Work  ', 'Chrome', 'Work'],
    ['x'.repeat(40), 'Chrome', 'x'.repeat(30)],
  ])('uses %j over %s as %s', (custom, detected, expected) => {
    expect(browserName(custom, detected)).toBe(expected);
  });
});
