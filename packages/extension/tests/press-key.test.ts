// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { pressKeyRef } from '../src/injected/actions';
import { pressKeyAction, pressKey, realClick, typeText } from '../src/injected/input';
(globalThis as any).__sendaInput = { pressKeyAction, pressKey, realClick, typeText };
beforeEach(() => {
  document.body.innerHTML = '<button>A</button><button>B</button><button>C</button>';
  Element.prototype.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
  Element.prototype.getClientRects = () => [{ width: 10, height: 10 }] as unknown as DOMRectList;
});
describe('press key', () => {
  it('moves and wraps focus in both directions', () => {
    document.querySelector('button')!.focus(); pressKeyAction('Tab'); expect(document.activeElement?.textContent).toBe('B');
    document.querySelectorAll('button')[2]!.focus(); pressKeyAction('Tab'); expect(document.activeElement?.textContent).toBe('A');
    document.querySelector('button')!.focus(); pressKeyAction('Shift+Tab'); expect(document.activeElement?.textContent).toBe('C');
  });
  it('skips default when keydown is prevented and returns focused description', () => {
    const a = document.querySelector('button')!; a.dataset.sendaRef = '7'; a.setAttribute('aria-label', 'First'); a.focus();
    a.addEventListener('keydown', (e) => e.preventDefault());
    expect(pressKeyRef('Tab')).toBe('[7] button "First"');
  });
  it('activates summary with Enter', () => {
    document.body.innerHTML = '<details><summary>Menu</summary><a href="#">Link</a></details>';
    const summary = document.querySelector('summary')!; summary.focus(); pressKeyAction('Enter');
    expect(document.querySelector('details')!.open).toBe(true);
  });
  it('returns null for missing ref', () => expect(pressKeyRef('Tab', 'missing')).toBeNull());
});
