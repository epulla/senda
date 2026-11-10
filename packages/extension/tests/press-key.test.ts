// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { pressKeyRef, probeKeyTarget } from '../src/injected/actions';
import { pressKeyAction, pressKey, realClick, typeText } from '../src/injected/input';
import { needsApproval } from '../src/core/approvals';

(globalThis as any).__sendaInput = { pressKeyAction, pressKey, realClick, typeText };

beforeEach(() => {
  document.body.innerHTML = '<button>A</button><button>B</button><button>C</button>';
  Element.prototype.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
  Element.prototype.getClientRects = () => [{ width: 10, height: 10 }] as unknown as DOMRectList;
});

describe('press key', () => {
  it('moves and wraps focus in both directions', () => {
    document.querySelector('button')!.focus();
    pressKeyAction('Tab');
    expect(document.activeElement?.textContent).toBe('B');
    document.querySelectorAll('button')[2]!.focus();
    pressKeyAction('Tab');
    expect(document.activeElement?.textContent).toBe('A');
    document.querySelector('button')!.focus();
    pressKeyAction('Shift+Tab');
    expect(document.activeElement?.textContent).toBe('C');
  });

  it('skips default when keydown is prevented and returns focused description', () => {
    const a = document.querySelector('button')!;
    a.dataset.sendaRef = '7';
    a.setAttribute('aria-label', 'First');
    a.focus();
    let keypress = false;
    a.addEventListener('keydown', (event) => event.preventDefault());
    a.addEventListener('keypress', () => (keypress = true));
    expect(pressKeyAction('Tab')).toBe('[7] button "First"');
    expect(document.activeElement).toBe(a);
    document.body.append(' ');
    expect(keypress).toBe(false);
  });

  it('does not run default when keypress is prevented', () => {
    document.body.innerHTML = '<details><summary>Menu</summary><a href="#">Link</a></details>';
    const summary = document.querySelector('summary')!;
    summary.focus();
    summary.addEventListener('keypress', (event) => event.preventDefault());
    pressKeyAction('Enter');
    expect(document.querySelector('details')!.open).toBe(false);
  });

  it('sends Tab keyup to newly focused element', () => {
    const buttons = [...document.querySelectorAll('button')];
    buttons[0]!.focus();
    let target: EventTarget | null = null;
    document.addEventListener('keyup', (event) => (target = event.target));
    pressKeyAction('Tab');
    expect(target).toBe(buttons[1]);
  });

  it('uses form default submitter for Enter in text field', () => {
    document.body.innerHTML = '<form><input name="q"><button name="save" value="yes">Save</button></form>';
    const input = document.querySelector('input')!;
    const form = document.querySelector('form')!;
    let submitter: HTMLElement | null = null;
    let submitterName = '';
    let submitterValue = '';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitter = (event as SubmitEvent).submitter as HTMLElement;
      submitterName = (event as SubmitEvent).submitter?.getAttribute('name') || '';
      submitterValue = (event as SubmitEvent).submitter?.getAttribute('value') || '';
    });
    input.focus();
    pressKeyAction('Enter');
    expect(submitter).toBe(form.querySelector('button'));
    expect(submitterName).toBe('save');
    expect(submitterValue).toBe('yes');
  });

  it('activates Space on keyup unless canceled', () => {
    const button = document.querySelector('button')!;
    let clicks = 0;
    button.addEventListener('click', () => clicks++);
    button.focus();
    pressKeyAction('Space');
    expect(clicks).toBe(1);
    button.addEventListener('keyup', (event) => event.preventDefault());
    pressKeyAction('Space');
    expect(clicks).toBe(1);
  });

  it('orders positive tabindex first and excludes hidden, disabled and inert elements', () => {
    document.body.innerHTML = '<button tabindex="2">Two</button><button tabindex="1">One</button><button style="visibility:hidden">Hidden</button><button disabled>Disabled</button><div inert><button>Inert</button></div><button>Normal</button>';
    const one = document.querySelector<HTMLButtonElement>('button[tabindex="1"]')!;
    one.focus();
    pressKeyAction('Tab');
    expect(document.activeElement?.textContent).toBe('Two');
    pressKeyAction('Tab');
    expect(document.activeElement?.textContent).toBe('Normal');
  });

  it('treats a named radio group as one tab stop', () => {
    document.body.innerHTML = '<button>Before</button><input type="radio" name="g"><input type="radio" name="g" checked><button>Next</button>';
    document.querySelector<HTMLButtonElement>('button')!.focus();
    pressKeyAction('Tab');
    expect(document.activeElement).toBe(document.querySelectorAll('input')[1]);
    pressKeyAction('Tab');
    expect(document.activeElement?.textContent).toBe('Next');
  });

  it('scopes Tab to dialog containing focus', () => {
    document.body.innerHTML = '<dialog open><button>First</button><button>Last</button></dialog><button>Outside</button>';
    const dialog = document.querySelector('dialog')!;
    const nativeMatches = dialog.matches.bind(dialog);
    dialog.matches = (selector: string) => selector === ':modal' || nativeMatches(selector);
    dialog.querySelector<HTMLButtonElement>('button:last-child')!.focus();
    pressKeyAction('Tab');
    expect(document.activeElement?.textContent).toBe('First');
  });

  it('keeps a dialog open when cancel event is prevented', () => {
    document.body.innerHTML = '<dialog open><button>Inside</button></dialog>';
    const dialog = document.querySelector('dialog')!;
    const nativeMatches = dialog.matches.bind(dialog);
    dialog.matches = (selector: string) => selector === ':modal' || nativeMatches(selector);
    dialog.close = () => dialog.removeAttribute('open');
    dialog.addEventListener('cancel', (event) => event.preventDefault());
    dialog.querySelector('button')!.focus();
    pressKeyAction('Escape');
    expect(dialog.open).toBe(true);
  });

  it('activates summary with Enter', () => {
    document.body.innerHTML = '<details><summary>Menu</summary><a href="#">Link</a></details>';
    const summary = document.querySelector('summary')!;
    summary.focus();
    pressKeyAction('Enter');
    expect(document.querySelector('details')!.open).toBe(true);
  });

  it('returns null for missing ref', () => {
    expect(probeKeyTarget('nonce', 'missing').missing).toBe(true);
  });

  it('rejects refs that cannot take focus and describes labelled input', () => {
    document.body.innerHTML = '<div data-senda-ref="1">No focus</div><label for="q">Query</label><input id="q"><button>Other</button>';
    document.querySelector<HTMLElement>('div')!.focus = () => {};
    const result = probeKeyTarget('token', '1');
    expect(result.focusFailed).toBe(true);
    const input = document.querySelector('input')!;
    input.focus();
    const probe = probeKeyTarget('token');
    expect(probe.label).toBe('Query');
    expect(pressKeyAction('ArrowUp')).toContain('input "Query"');
    document.querySelector<HTMLButtonElement>('button')!.focus();
    expect(pressKeyRef('Tab', 'token')).toBe('FOCUS_MOVED');
    expect(document.querySelector('[data-senda-key-target]')).toBeNull();
  });

  it('uses associated checkbox label for sensitive-click approval', () => {
    document.body.innerHTML = '<label><input type="checkbox">Delete everything</label>';
    const checkbox = document.querySelector<HTMLInputElement>('input')!;
    checkbox.focus();
    const probe = probeKeyTarget('label-check');
    const reason = needsApproval({
      action: 'click',
      label: probe.label,
      url: 'https://example.com/',
      visitedHosts: [],
      allowedDomains: [],
      alwaysSites: [],
      askBefore: 'destructive',
      tainted: false,
    });
    expect(probe.label).toContain('Delete everything');
    expect(reason).toBeTruthy();
  });
});
