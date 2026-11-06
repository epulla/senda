// Runs via scripting.executeScript, so everything it uses must live inside the function.
export function snapshotPage(): string {
  document.querySelectorAll('[data-senda-ref]').forEach((el) => el.removeAttribute('data-senda-ref'));
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const esc = (s: string) => s.replace(/\s+/g, ' ').trim();
  let n = 0;
  const refs = new Map<Element, number>();
  document
    .querySelectorAll('a,button,input,select,textarea,[role],[contenteditable],[onclick],[tabindex]')
    .forEach((el) => {
      if (visible(el)) {
        const ref = ++n;
        el.setAttribute('data-senda-ref', String(ref));
        refs.set(el, ref);
      }
    });
  const skip = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head', 'datalist']);
  const blocks = new Set(
    'address article aside blockquote caption dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header label legend li main nav ol p pre section summary ul'.split(' '),
  );
  const controlRoles = /^(button|link|checkbox|radio|switch|tab|menuitem|menuitemcheckbox|menuitemradio|option|textbox|searchbox|combobox|slider|spinbutton)$/;
  const isControl = (el: Element) =>
    ['a', 'button', 'input', 'select', 'textarea'].includes(el.localName) || controlRoles.test(el.getAttribute('role') || '');
  const control = (el: Element) => {
    const ref = refs.get(el);
    const role = el.getAttribute('role') || el.localName;
    const name = esc(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '');
    let detail = name;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      const hidden =
        el instanceof HTMLInputElement && (el.type === 'password' || /cc-number|cc-csc|cc-exp/i.test(el.autocomplete));
      detail = `${name}${detail ? ' ' : ''}${hidden ? '(hidden)' : JSON.stringify(el.value)}`;
    }
    return `${ref ? `[${ref}] ` : ''}${role} "${detail}"`;
  };
  type Part = { text: string; control?: boolean };
  const lines: string[] = [];
  let buf: Part[] = [];
  const join = (parts: Part[]) => esc(parts.map((p) => (p.control ? ` ${p.text} ` : p.text)).join(''));
  // Emits the text gathered since the last block boundary; lone controls get their own lines.
  const flush = (label: () => string) => {
    const parts = buf;
    buf = [];
    if (parts.every((p) => p.control || !esc(p.text))) {
      for (const p of parts) if (p.control) lines.push(p.text);
    } else lines.push(`${label()}: ${join(parts)}`);
  };
  const walk = (el: Element | Document['body'], label: () => string, inline: boolean) => {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) buf.push({ text: node.textContent || '' });
      else if (node.nodeType === Node.ELEMENT_NODE) visit(node as Element, label, inline);
    }
  };
  const table = (t: Element) => {
    const caption = t.querySelector(':scope > caption');
    lines.push(`table:${caption && visible(caption) ? ` ${esc(caption.textContent || '')}` : ''}`);
    for (const row of t.querySelectorAll('tr')) {
      if (row.closest('table') !== t || !visible(row)) continue;
      const cells = [...row.children]
        .filter((c) => (c.localName === 'td' || c.localName === 'th') && visible(c))
        .map((c) => {
          const saved = buf;
          buf = [];
          walk(c, () => '', true);
          const text = join(buf);
          buf = saved;
          return text;
        });
      const ref = refs.get(row);
      if (cells.some(Boolean)) lines.push(`${ref ? `[${ref}] ` : ''}row: ${cells.join(' | ')}`);
    }
  };
  const frame = (el: Element, label: () => string, inline: boolean) => {
    let body: HTMLElement | null | undefined;
    try {
      body = (el as HTMLIFrameElement).contentDocument?.body;
    } catch {}
    if (!body) return;
    if (inline) return walk(body, label, true);
    flush(label);
    lines.push(`frame "${esc(el.getAttribute('title') || el.getAttribute('src') || '')}":`);
    const at = lines.length;
    walk(body, () => 'text', false);
    flush(() => 'text');
    for (let i = at; i < lines.length; i++) lines[i] = `  ${lines[i]}`;
  };
  function visit(el: Element, label: () => string, inline: boolean) {
    const tag = el.localName;
    if (skip.has(tag) || !visible(el)) return;
    if (isControl(el)) return void buf.push({ text: control(el), control: true });
    if (tag === 'iframe' || tag === 'frame') return frame(el, label, inline);
    if (inline) {
      buf.push({ text: ' ' });
      walk(el, label, true);
      return void buf.push({ text: ' ' });
    }
    if (tag === 'table') {
      flush(label);
      return table(el);
    }
    const ref = refs.get(el);
    const role = el.getAttribute('role');
    if (!blocks.has(tag) && !role && !ref) return walk(el, label, false);
    flush(label);
    const name = role && !/^(presentation|none|generic)$/.test(role) ? role : tag;
    let used = false;
    const own = () => {
      if (!ref || used) return name;
      used = true;
      return `[${ref}] ${name}`;
    };
    const at = lines.length;
    walk(el, own, false);
    flush(own);
    if (ref && !used) {
      const aria = esc(el.getAttribute('aria-label') || '');
      lines.splice(at, 0, `[${ref}] ${name}${aria ? ` "${aria}"` : ''}`);
    }
  }
  walk(document.body, () => 'text', false);
  flush(() => 'text');
  const out = lines.join('\n');
  return out.length > 50000 ? `${out.slice(0, 50000)}\n[truncated: snapshot over 50000 characters]` : out;
}
