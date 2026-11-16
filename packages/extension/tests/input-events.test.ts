// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { pressKeyAction, realClick, typeText } from '../src/injected/input';

(globalThis as any).__sendaInput = { pressKeyAction, realClick, typeText };

beforeEach(() => {
  document.body.innerHTML = '<button>A</button><button>B</button><input>';
  Element.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 }) as DOMRect;
  Element.prototype.getClientRects = () => [{ width: 10, height: 10 }] as unknown as DOMRectList;
  document.elementFromPoint = () => document.querySelector('button');
});

const logEvents = (el: HTMLElement, types: string[]) => {
  const log: string[] = [];
  for (const type of types) el.addEventListener(type, (event) => log.push(type + (event instanceof KeyboardEvent ? `:${event.key}` : '')));
  return log;
};

describe('injected input events', () => {
  it('uses native click focus events without duplicates', () => {
    const [a, b] = [...document.querySelectorAll('button')];
    const log = logEvents(a!, ['focus', 'blur', 'focusout']);
    realClick(a!);
    realClick(b!);
    expect(log).toEqual(['focus', 'blur', 'focusout']);
  });

  it('synthesizes focus events when background window suppresses native events', () => {
    const [a, b] = [...document.querySelectorAll('button')];
    let active: Element = document.body;
    const oldFocus = HTMLElement.prototype.focus;
    const oldBlur = HTMLElement.prototype.blur;
    const oldDescriptor = Object.getOwnPropertyDescriptor(document, 'activeElement');
    HTMLElement.prototype.focus = function () { active = this; };
    HTMLElement.prototype.blur = function () { active = document.body; };
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => active });
    try {
      const logA = logEvents(a!, ['focus', 'blur', 'focusout']);
      const logB = logEvents(b!, ['focus', 'focusin']);
      document.elementFromPoint = () => a!;
      realClick(a!);
      document.elementFromPoint = () => b!;
      realClick(b!);
      expect(logA).toEqual(['focus', 'blur', 'focusout']);
      expect(logB).toEqual(['focus', 'focusin']);
    } finally {
      HTMLElement.prototype.focus = oldFocus;
      HTMLElement.prototype.blur = oldBlur;
      if (oldDescriptor) Object.defineProperty(document, 'activeElement', oldDescriptor);
      else delete (document as any).activeElement;
    }
  });

  it('dispatches per-character keyboard and input events', () => {
    const input = document.querySelector('input')!;
    const types = ['keydown', 'keypress', 'beforeinput', 'input', 'keyup'];
    const log = logEvents(input, types);
    input.addEventListener('change', () => log.push('change'));
    typeText(input, 'a1');
    expect(log).toEqual(['keydown:a', 'keypress:a', 'beforeinput', 'input', 'keyup:a', 'keydown:1', 'keypress:1', 'beforeinput', 'input', 'keyup:1', 'change']);
    expect(input.value).toBe('a1');
  });

  it('blurs typed field when Tab moves focus', () => {
    document.body.innerHTML = '<input><button>Next</button>';
    const input = document.querySelector('input')!;
    const log = logEvents(input, ['blur', 'focusout']);
    typeText(input, 'x');
    pressKeyAction('Tab');
    expect(log).toEqual(['blur', 'focusout']);
  });
});
