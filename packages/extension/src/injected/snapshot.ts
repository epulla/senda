export function snapshotPage(): string {
  document.querySelectorAll('[data-senda-ref]').forEach(el => el.removeAttribute('data-senda-ref'));
  const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const esc = (s: string) => s.replace(/\s+/g, ' ').trim();
  let n = 0;
  const refs = new Map<Element, number>();
  document.querySelectorAll('a,button,input,select,textarea,[role],[contenteditable],[onclick],[tabindex]').forEach(el => {
    if (visible(el)) { const ref = ++n; el.setAttribute('data-senda-ref', String(ref)); refs.set(el, ref); }
  });
  const lines: string[] = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,button,a,input,select,textarea,[role]').forEach(el => {
    if (!visible(el)) return;
    const ref = refs.get(el);
    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    const name = esc(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '');
    if (ref) {
      let detail = name;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const hidden = el instanceof HTMLInputElement && (el.type === 'password' || /cc-number|cc-csc|cc-exp/i.test(el.autocomplete));
        detail = `${name}${detail ? ' ' : ''}${hidden ? '(hidden)' : JSON.stringify(el.value)}`;
      }
      lines.push(`[${ref}] ${role} "${detail}"`);
    } else if (name) lines.push(`${role}: ${name}`);
  });
  return lines.join('\n').slice(0, 50000);
}
