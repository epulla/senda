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
    const text = snapshotPage()!;
    expect(text).toContain('[2] input');
    expect(text).toContain('[5] a');
    expect(text).toContain('[6] button');
  });
  it('prints input values once and omits empty ones', () => {
    document.body.innerHTML = '<input placeholder="Buscar modulo"><input aria-label="Filtro" value="a&quot;b">';
    expect(snapshotPage()!).toBe('[1] input "Buscar modulo"\n[2] input "Filtro" value="a\\"b"');
  });
  it('never exposes password or card values', () => {
    const text = snapshotPage()!;
    expect(text).not.toContain('secret');
    expect(text).not.toContain('4111111111111111');
    expect(text).toContain('(hidden)');
  });
  it('renumbers and actions target current refs', () => {
    snapshotPage()!;
    expect(typeRef('2', 'new value')).toBe(true);
    expect(document.querySelector('input[type=text]')?.getAttribute('value')).toBe('old');
    expect((document.querySelector('input[type=text]') as HTMLInputElement).value).toBe('new value');
    let clicked = false;
    document.querySelector('button')!.addEventListener('click', () => {
      clicked = true;
    });
    snapshotPage()!;
    expect(clickRef('6')).toBe(true);
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
  it('lists table rows with header first and refs in cells', () => {
    document.body.innerHTML =
      '<table><thead><tr><th>Id</th><th>Name</th><th></th></tr></thead><tbody><tr><td>1</td><td>Ana <b>Ruiz</b></td><td><button>Open</button></td></tr><tr><td>2</td><td>Luis</td><td></td></tr></tbody></table>';
    expect(snapshotPage()!).toBe('[1] table:\nrow: Id | Name | \nrow: 1 | Ana Ruiz | [2] button "Open"\nrow: 2 | Luis | ');
  });
  it('prints plain div, span, label and dl text once', () => {
    document.body.innerHTML =
      '<div class="card"><div><span>Request 42</span> <span>Pending</span></div><label>Owner</label><dl><dt>Due</dt><dd>Friday</dd></dl></div>';
    const text = snapshotPage()!;
    expect(text).toBe('div: Request 42 Pending\nlabel: Owner\n[1] dl\ndt: Due\ndd: Friday');
  });
  it('caps long snapshots with a marker', () => {
    document.body.innerHTML = `<p>${'x '.repeat(30000)}</p>`;
    const text = snapshotPage()!;
    expect(text.length).toBeLessThan(50100);
    expect(text).toMatch(/\[truncated: snapshot over 50000 characters\]$/);
  });
  it('prints only the subtree of a ref and returns null for stale refs', () => {
    document.body.innerHTML = '<nav><a href="/a">Menu</a></nav><ul><li>One</li><li>Two <button>Edit</button></li></ul>';
    expect(snapshotPage()!).toContain('[2] ul');
    expect(snapshotPage('2')).toBe('[2] ul\nli: One\nli: Two [3] button "Edit"');
    expect(snapshotPage('99')).toBeNull();
  });
  it('reports missing refs', () => {
    expect(clickRef('999')).toBe(false);
    expect(typeRef('999', 'x')).toBe(false);
  });
});
