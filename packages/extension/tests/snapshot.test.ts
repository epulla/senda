// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { snapshotPage } from '../src/injected/snapshot';
import { clickRef, typeRef } from '../src/injected/actions';
import { actionBusy, chooseOption, markAction, moveFocus, pressKey, realClick, typeText } from '../src/injected/input';
(globalThis as any).__sendaInput = { realClick, typeText, pressKey, moveFocus, chooseOption, markAction };
import { looksLikeInjection } from '../src/core/injection';
import { maskIntact, maskSensitive } from '../src/injected/screenshot';
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');
beforeEach(() => {
  document.body.innerHTML = fixture('login-form.html');
  Element.prototype.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
});
describe('snapshot refs and actions', () => {
  it('assigns sequential refs and describes controls', () => {
    const text = snapshotPage()!;
    expect(text).toContain('[1] input');
    expect(text).toContain('[4] a');
    expect(text).toContain('[5] button');
  });
  it('prints input values once and omits empty ones', () => {
    document.body.innerHTML = '<input placeholder="Buscar modulo"><input aria-label="Filtro" value="a&quot;b">';
    expect(snapshotPage()!).toBe('[1] input "Buscar modulo"\n[2] input "Filtro" value="a\\"b"');
  });
  it('refs summary and reports details state', () => {
    document.body.innerHTML = '<details><summary>Menu</summary><a href="/x">Item</a></details>';
    document.querySelector('a')!.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    expect(snapshotPage()!).toBe('[1] summary "Menu" (closed)');
    document.querySelector('details')!.setAttribute('open', '');
    document.querySelector('a')!.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
    expect(snapshotPage()!).toBe('[1] summary "Menu" (open)\n[2] a "Item"');
  });
  it('refs named tabindex widgets and labels checkbox inputs', () => {
    document.body.innerHTML = '<div tabindex="0" aria-label="Widget"></div><label><input type="checkbox"> Accept terms</label>';
    expect(snapshotPage()!).toBe('[1] div "Widget"\n[2] checkbox "Accept terms"');
  });
  it('refs label for invisible checkbox', () => {
    document.body.innerHTML = '<label><input type="checkbox"> Accept terms</label>';
    document.querySelector('input')!.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    expect(snapshotPage()!).toBe('[1] label "Accept terms"');
  });
  it('keeps summary ref inside focusable wrapper', () => {
    document.body.innerHTML = '<div tabindex="0" aria-label="Wrapper"><details><summary>Menu</summary></details></div>';
    expect(snapshotPage()!).toBe('[1] div "Wrapper"\n[2] summary "Menu" (closed)');
  });
  it('keeps actionable descendants of checkbox labels', () => {
    document.body.innerHTML = '<label><input type="checkbox"> I accept the <a href="/terms">Terms</a></label>';
    expect(snapshotPage()!).toBe('[1] checkbox "I accept the Terms"\n[2] a "Terms"');
  });
  it('never exposes password or card values', () => {
    const text = snapshotPage()!;
    expect(text).not.toContain('secret');
    expect(text).not.toContain('4111111111111111');
    expect(text).toContain('(hidden)');
  });
  it('renumbers and actions target current refs', async () => {
    snapshotPage()!;
    expect(await typeRef('1', 'new value')).toEqual({ ok: true, value: 'new value' });
    expect(document.querySelector('input[type=text]')?.getAttribute('value')).toBe('old');
    expect((document.querySelector('input[type=text]') as HTMLInputElement).value).toBe('new value');
    let clicked = false;
    document.querySelector('button')!.addEventListener('click', () => {
      clicked = true;
    });
    snapshotPage()!;
    expect(clickRef('5')).toEqual({});
    expect(clicked).toBe(true);
  });
  it('flags injection in snapshot-formatted text', () => {
    expect(looksLikeInjection(snapshotPage()!)).toBe(false);
    document.body.innerHTML = fixture('site/injection.html');
    expect(looksLikeInjection(snapshotPage()!)).toBe(true);
  });
  it('falls back to tooltips, icon classes and link paths for icon-only controls', () => {
    document.body.innerHTML =
      '<button title="Ver"><i class="fa fa-eye"></i></button><button data-original-title="Editar"></button><button><i class="glyphicon glyphicon-trash"></i></button><a href="/x?id=2"> </a>';
    expect(snapshotPage()!).toBe('[1] button "Ver"\n[2] button "Editar"\n[3] button "icon:trash"\n[4] a "href:/x?id=2"');
  });
  it('names dropdown toggles and icon fonts and skips unnamed containers', () => {
    document.body.innerHTML =
      '<div tabindex="0"><ul id="menu"><li><a href="/x">Home</a></li></ul></div><ol class="breadcrumb"><li>Inicio</li></ol>' +
      '<div class="dropdown"><a href="#" role="button" data-toggle="dropdown" class="btn btn-link dropdown-toggle"><i class="dw dw-more"></i></a>' +
      '<div class="dropdown-menu"><a class="dropdown-item" onclick="go()"><i class="dw dw-computer-1"></i> Ingresar Gestión</a></div></div>';
    document.querySelector<HTMLElement>('.dropdown-menu')!.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    expect(snapshotPage()!).toBe('[1] a "Home"\nli: Inicio\n[2] button "icon:more" (menu: Ingresar Gestión)');
  });
  it('lists table rows with header first and refs in cells', () => {
    document.body.innerHTML =
      '<table><thead><tr><th>Id</th><th>Name</th><th></th></tr></thead><tbody><tr><td>1</td><td>Ana <b>Ruiz</b></td><td><button>Open</button></td></tr><tr><td>2</td><td>Luis</td><td></td></tr></tbody></table>';
    expect(snapshotPage()!).toBe('[1] table:\nrow: Id | Name | \nrow: 1 | Ana Ruiz | [2] button "Open"\nrow: 2 | Luis | ');
  });
  it('prints plain div, span, label and dl text once', () => {
    document.body.innerHTML =
      '<div class="card"><div><span>Request 42</span> <span>Pending</span></div><label>Owner</label><dl><dt>Due</dt><dd>Friday</dd></dl></div>';
    const text = snapshotPage()!;
    expect(text).toBe('div: Request 42 Pending\nlabel: Owner\ndt: Due\ndd: Friday');
  });
  it('caps long snapshots with a marker', () => {
    document.body.innerHTML = `<p>${'x '.repeat(30000)}</p>`;
    const text = snapshotPage()!;
    expect(text.length).toBeLessThan(50100);
    expect(text).toMatch(/\[truncated: snapshot over 50000 characters\]$/);
  });
  it('prints only the subtree of a ref and returns null for stale refs', () => {
    document.body.innerHTML = '<nav><a href="/a">Menu</a></nav><ul aria-label="Tasks"><li>One</li><li>Two <button>Edit</button></li></ul>';
    expect(snapshotPage()!).toContain('[2] ul');
    expect(snapshotPage('2')).toBe('[2] ul "Tasks"\nli: One\nli: Two [3] button "Edit"');
    expect(snapshotPage('99')).toBeNull();
  });
  it('masks sensitive fields for screenshots and restores them', async () => {
    document.body.innerHTML =
      '<input type="password"><input autocomplete="cc-number"><input autocomplete="one-time-code"><input name="otp_code"><input name="q">';
    await maskSensitive(true, 't1');
    expect(maskIntact('t1')).toBe(true);
    expect(maskIntact('t2')).toBe(false);
    expect([...document.querySelectorAll('input')].map((el) => el.hasAttribute('data-senda-mask'))).toEqual([true, true, true, true, false]);
    expect(document.querySelector('style[data-senda-mask-style]')).toBeTruthy();
    await maskSensitive(false);
    expect(document.querySelectorAll('[data-senda-mask], style[data-senda-mask-style]')).toHaveLength(0);
    expect(maskIntact('t1')).toBe(false);
  });
  it('masks sensitive fields inside shadow roots', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const shadow = document.getElementById('host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input autocomplete="cc-number" value="4111111111111111"><input name="q">';
    await maskSensitive(true);
    expect([...shadow.querySelectorAll('input')].map((el) => el.hasAttribute('data-senda-mask'))).toEqual([true, false]);
    expect(shadow.querySelector('style[data-senda-mask-style]')).toBeTruthy();
    await maskSensitive(false);
    expect(shadow.querySelectorAll('[data-senda-mask], style[data-senda-mask-style]')).toHaveLength(0);
  });
  it('walks display: contents wrappers, combobox children and button cells', () => {
    document.body.innerHTML =
      '<form style="display: contents"><p>Inside form</p></form>' +
      '<div role="combobox" aria-label="City"><input aria-label="City search"><button>Open</button></div>' +
      '<table><tr><td role="button" aria-label="Edit row">✎</td><td>Ana</td></tr></table>';
    const form = document.querySelector('form')!;
    form.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    expect(snapshotPage()!).toBe(
      'p: Inside form\n[1] combobox "City"\n[2] input "City search"\n[3] button "Open"\n[4] table:\nrow: [5] button "Edit row" | Ana',
    );
  });
  it('keeps refs of ARIA-only children and of clickable or focusable cells', () => {
    document.body.innerHTML =
      '<div role="combobox" aria-label="Country"><div role="textbox" aria-label="Country search"></div><div role="option">Peru</div></div>' +
      '<table><tr><td onclick="go()">Open Ana</td><td tabindex="0">Focus Luis</td><td>Plain</td></tr></table>';
    expect(snapshotPage()!).toBe(
      '[1] combobox "Country"\n[2] textbox "Country search"\n[3] option "Peru"\n[4] table:\nrow: [5] Open Ana | [6] td "Focus Luis" | Plain',
    );
  });
  it('lists select options and picks them by value or label', async () => {
    document.body.innerHTML =
      '<label>Rol <select><option value="">Elegir</option><option value="m">Gerente</option><option disabled>Otro</option></select></label><input aria-label="Name">';
    expect(snapshotPage()!).toBe('label: Rol [1] select "Rol" (options: Elegir, Gerente, Otro) selected="Elegir"\n[2] input "Name"');
    expect(await typeRef('1', 'gerente')).toEqual({ ok: true, selected: ['Gerente'] });
    expect(snapshotPage()!).toContain('selected="Gerente"');
    expect(await typeRef('1', 'Otro')).toEqual({ ok: true, error: 'Option is disabled: "Otro". Options: Elegir, Gerente (m)' });
    expect(await typeRef('2', 'x', false, true)).toEqual({ ok: true, error: 'Ref 2 is not a dropdown; use browser_type or browser_click.' });
  });
  it('uses option label attributes and skips disabled optgroups', async () => {
    document.body.innerHTML =
      '<select aria-label="Pick"><option value="id" label="Visible">Internal text</option><optgroup disabled><option value="blocked">Blocked</option></optgroup></select>';
    expect(snapshotPage()!).toBe('[1] select "Pick" (options: Visible, Blocked) selected="Visible"');
    let changes = 0;
    document.querySelector('select')!.addEventListener('change', () => changes++);
    expect(await typeRef('1', 'blocked')).toEqual({ ok: true, error: 'Option is disabled: "blocked". Options: Visible (id)' });
    expect(changes).toBe(0);
    expect(await typeRef('1', 'visible')).toEqual({ ok: true, selected: ['Visible'] });
  });
  it('cuts long option lists at whole options', () => {
    const years = Array.from({ length: 200 }, (_, i) => `<option>${1900 + i}</option>`).join('');
    document.body.innerHTML = `<select aria-label="Año">${years}</select>`;
    expect(snapshotPage()!).toBe(`[1] select "Año" (options: ${Array.from({ length: 50 }, (_, i) => 1900 + i).join(', ')}, +150 more) selected="1900"`);
  });
  it('reports missing refs', async () => {
    expect(clickRef('999')).toBeNull();
    expect(await typeRef('999', 'x')).toEqual({ ok: false });
  });
  it('re-resolves refs whose elements the page replaced with equivalent ones', async () => {
    const form = '<form><input type="email" placeholder="Email"><button type="button">Sign in</button></form>';
    document.body.innerHTML = form;
    expect(snapshotPage()!).toBe('[1] input "Email"\n[2] button "Sign in"');
    document.body.innerHTML = form;
    let clicked = false;
    document.querySelector('button')!.addEventListener('click', () => (clicked = true));
    expect(await typeRef('1', 'ana@example.test')).toEqual({ ok: true, value: 'ana@example.test', reResolved: true });
    expect(document.querySelector('input')!.value).toBe('ana@example.test');
    expect(clickRef('2')).toEqual({ reResolved: true });
    expect(clicked).toBe(true);
    expect(clickRef('2')).toEqual({ reResolved: true });
  });
  it('flags fields the page replaces right after typing', async () => {
    document.body.innerHTML = '<input aria-label="Email">';
    snapshotPage()!;
    document.querySelector('input')!.addEventListener('blur', () => (document.body.innerHTML = '<input aria-label="Email">'));
    expect(await typeRef('1', 'x')).toEqual({ ok: true, detached: true });
  });
  it('rejects replaced refs without a single equivalent element', async () => {
    document.body.innerHTML = '<button>Delete</button>';
    snapshotPage()!;
    document.body.innerHTML = '<button>Delete</button><button>Delete</button>';
    expect(clickRef('1')).toBeNull();
    document.body.innerHTML = '<button>Remove</button>';
    expect(clickRef('1')).toBeNull();
    expect(document.querySelector('[data-senda-ref]')).toBeNull();
  });
  it('matches replaced refs by the name they had at snapshot time', () => {
    document.body.innerHTML = '<label id="l">Save</label><button aria-labelledby="l"></button>';
    snapshotPage()!;
    document.getElementById('l')!.textContent = 'Delete';
    document.querySelector('button')!.replaceWith(document.createElement('button'));
    document.querySelector('button')!.setAttribute('aria-labelledby', 'l');
    expect(clickRef('1')).toBeNull();
    document.body.innerHTML = '<label><input type="checkbox"> Accept terms</label>';
    expect(snapshotPage()!).toBe('[1] checkbox "Accept terms"');
    const box = document.createElement('input');
    box.type = 'checkbox';
    document.querySelector('input')!.replaceWith(box);
    expect(clickRef('1')).toEqual({ reResolved: true });
    expect(box.checked).toBe(true);
  });
});
describe('actionBusy', () => {
  it('treats a disabled or blank acted-on button as busy, but not a plain label change', () => {
    document.body.innerHTML = '<button>Show more</button>';
    const button = document.querySelector('button')!;
    markAction(button);
    button.textContent = 'Show less';
    expect(actionBusy()).toBe(false);
    button.textContent = '';
    expect(actionBusy()).toBe(true);
    button.textContent = 'Show less';
    button.disabled = true;
    expect(actionBusy()).toBe(true);
  });
  it('counts visible loaders only', () => {
    document.body.innerHTML = '<button>Go</button><div style="visibility: hidden"><div role="progressbar"></div></div>';
    markAction(document.querySelector('button')!);
    expect(actionBusy()).toBe(false);
    document.querySelector('div')!.removeAttribute('style');
    expect(actionBusy()).toBe(true);
  });
  it('watches the submit button when a dropdown submits its form', async () => {
    document.body.innerHTML = '<form><select><option>A</option><option>B</option></select><button>Save</button></form>';
    document.querySelector('form')!.addEventListener('submit', (event) => event.preventDefault());
    snapshotPage();
    await typeRef('1', 'B', true);
    expect((globalThis as any).__sendaActed.el).toBe(document.querySelector('button'));
  });
});
