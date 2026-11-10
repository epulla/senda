// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { snapshotPage } from '../src/injected/snapshot';
import { clickRef, typeRef } from '../src/injected/actions';
import { pressKey, realClick, typeText } from '../src/injected/input';
(globalThis as any).__sendaInput = { realClick, typeText, pressKey };
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
  it('renumbers and actions target current refs', () => {
    snapshotPage()!;
    expect(typeRef('1', 'new value')).toBe(true);
    expect(document.querySelector('input[type=text]')?.getAttribute('value')).toBe('old');
    expect((document.querySelector('input[type=text]') as HTMLInputElement).value).toBe('new value');
    let clicked = false;
    document.querySelector('button')!.addEventListener('click', () => {
      clicked = true;
    });
    snapshotPage()!;
    expect(clickRef('5')).toBe(true);
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
  it('reports missing refs', () => {
    expect(clickRef('999')).toBe(false);
    expect(typeRef('999', 'x')).toBe(false);
  });
});
