// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { snapshotPage } from '../src/injected/snapshot';
import { clickRef, typeRef } from '../src/injected/actions';
import { pressKey, realClick, typeText } from '../src/injected/input';
(globalThis as any).__sendaInput = { realClick, typeText, pressKey };
import { looksLikeInjection } from '../src/core/injection';
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');
beforeEach(() => {
  document.body.innerHTML = fixture('login-form.html');
  Element.prototype.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
});
describe('snapshot refs and actions', () => {
  it('assigns sequential refs and describes controls', () => {
    const text = snapshotPage();
    expect(text).toContain('[1] input');
    expect(text).toContain('[4] a');
    expect(text).toContain('[5] button');
  });
  it('never exposes password or card values', () => {
    const text = snapshotPage();
    expect(text).not.toContain('secret');
    expect(text).not.toContain('4111111111111111');
    expect(text).toContain('(hidden)');
  });
  it('renumbers and actions target current refs', () => {
    snapshotPage();
    expect(typeRef('1', 'new value')).toBe(true);
    expect(document.querySelector('input[type=text]')?.getAttribute('value')).toBe('old');
    expect((document.querySelector('input[type=text]') as HTMLInputElement).value).toBe('new value');
    let clicked = false;
    document.querySelector('button')!.addEventListener('click', () => {
      clicked = true;
    });
    snapshotPage();
    expect(clickRef('5')).toBe(true);
    expect(clicked).toBe(true);
  });
  it('flags injection in snapshot-formatted text', () => {
    expect(looksLikeInjection(snapshotPage())).toBe(false);
    document.body.innerHTML = fixture('site/injection.html');
    expect(looksLikeInjection(snapshotPage())).toBe(true);
  });
  it('reports missing refs', () => {
    expect(clickRef('999')).toBe(false);
    expect(typeRef('999', 'x')).toBe(false);
  });
});
