// What every ref lookup in injected code gets back; reResolved marks a replacement element the page rendered in place of the snapshotted one.
export type FoundRef = { el: HTMLElement | null; reResolved?: true };
// Runs via scripting.executeScript, so everything it uses must live inside the function.
// With scopeRef, only that element's subtree is printed; null means the ref is stale.
// Also installs globalThis.__sendaFindRef, the shared ref lookup for the other injected functions (same isolated world).
export function snapshotPage(scopeRef?: string): string | null {
  const scope =
    scopeRef === undefined
      ? document.body
      : (((globalThis as any).__sendaFindRef?.(scopeRef) ?? { el: document.querySelector(`[data-senda-ref="${CSS.escape(scopeRef)}"]`) }) as FoundRef).el;
  if (!scope) return null;
  document.querySelectorAll('[data-senda-ref]').forEach((el) => el.removeAttribute('data-senda-ref'));
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const esc = (s: string) => s.replace(/\s+/g, ' ').trim();
  const controlRoles = /^(button|link|checkbox|radio|switch|tab|menuitem|menuitemcheckbox|menuitemradio|option|textbox|searchbox|combobox|slider|spinbutton)$/;
  // Containers (lists, forms, focusable wrappers) only get a ref when it would mean something to the AI.
  const wantsRef = (el: Element) =>
    el.matches('a,button,input,select,textarea,summary,[contenteditable],[onclick],table,dialog,[role=dialog],[role=alertdialog]') ||
    (el.matches('label') && !!el.querySelector('input[type=checkbox],input[type=radio]') && !visible(el.querySelector('input[type=checkbox],input[type=radio]')!)) ||
    controlRoles.test(el.getAttribute('role') || '') ||
    (!el.matches('label') && el.getAttribute('tabindex') !== '-1' &&
      (['aria-label', 'aria-labelledby', 'title'].some((a) => el.getAttribute(a)?.trim()) ||
        [...el.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim())));
  let n = 0;
  const refs = new Map<Element, number>();
  const candidates = 'a,button,input,select,textarea,summary,label,[role],[contenteditable],[onclick],[tabindex],table,ul,ol,dl,form,dialog';
  document
    .querySelectorAll(candidates)
    .forEach((el) => {
      if (visible(el) && wantsRef(el)) {
        const ref = ++n;
        el.setAttribute('data-senda-ref', String(ref));
        refs.set(el, ref);
      }
    });
  const skip = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head', 'datalist']);
  const blocks = new Set(
    'address article aside blockquote caption dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header label legend li main nav ol p pre section summary ul'.split(' '),
  );
  const controlSelector = `a,button,input,select,textarea,summary,[contenteditable],${controlRoles.source.slice(2, -2).split('|').map((r) => `[role=${r}]`).join(',')}`;
  // An ARIA widget wrapping other controls (e.g. a combobox around an input) is a container, not one control.
  const isControl = (el: Element) =>
    ['a', 'button', 'input', 'select', 'textarea'].includes(el.localName) ||
    el.localName === 'summary' ||
    (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1' && !el.querySelector(controlSelector) && wantsRef(el)) ||
    (controlRoles.test(el.getAttribute('role') || '') && !el.querySelector(controlSelector));
  // Last-resort names for icon-only controls; the prefix tells the AI the name is guessed.
  const guessName = (el: Element) => {
    for (const node of [el, ...el.querySelectorAll('i,span,svg,em')]) {
      if (node !== el && esc(node.textContent || '')) continue;
      const classes = [...node.classList];
      // Icon fonts pair a base class with a name class: "fa fa-eye", "dw dw-more", "bi bi-gear".
      const pick = (prefix: (p: string) => boolean) =>
        classes
          .map((c) => /^([a-z]+)-([a-z][a-z0-9-]*)$/.exec(c))
          .find(
            (m) =>
              m &&
              prefix(m[1]!) &&
              !/^(btn|badge|text|bg|col|row|label|pull|float|d|m|p)$/.test(m[1]!) &&
              !/^(solid|regular|light|thin|duotone|brands|fw|lg|xs|sm|xl|spin|pulse|border|inverse|white|stack(-\dx)?|(pull|rotate|flip)-.*)$/.test(m[2]!),
          )?.[2];
      const icon = pick((p) => classes.includes(p)) || pick((p) => /^(fa|bi|glyphicon|mdi|ti|icon|ion|la)$/.test(p));
      if (icon) return `icon:${icon}`;
    }
    const href = el.localName === 'a' ? el.getAttribute('href') || '' : '';
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return '';
    try {
      const url = new URL(href, location.href);
      return `href:${(url.pathname + url.search).slice(0, 100)}`;
    } catch {
      return '';
    }
  };
  const roleOf = (el: Element) =>
    el.getAttribute('role') || (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? el.type : el.localName);
  const nameOf = (el: Element) => {
    const attr = (a: string) => el.getAttribute(a) || '';
    const labelledBy = attr('aria-labelledby')
      .split(/\s+/)
      .map((id) => (id && document.getElementById(id)?.textContent) || '')
      .join(' ');
    const isSelect = el instanceof HTMLSelectElement;
    const labelText = (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) || isSelect
      ? ((el.closest('label')?.textContent || '').replace(el.textContent || '', '') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) || '')
      : '';
    return (
      [
        attr('aria-label'),
        labelledBy,
        labelText,
        isSelect ? '' : el.textContent || '',
        attr('placeholder'),
        attr('title'),
        attr('data-original-title'),
        attr('data-bs-original-title'),
        el.querySelector('img[alt]')?.getAttribute('alt') || '',
      ]
        .map(esc)
        .find(Boolean) || guessName(el)
    );
  };
  // A ref lost to a re-render (React swapping nodes) resolves to the one unreferenced visible element with the same tag, role and name
  // as at snapshot time.
  const keyOf = (el: Element) => `${el.localName}|${roleOf(el)}|${nameOf(el)}`;
  const keys = new Map([...refs].map(([el, ref]) => [String(ref), keyOf(el)]));
  const moved = new Set<string>();
  (globalThis as any).__sendaFindRef = (ref: string): FoundRef => {
    const el = document.querySelector<HTMLElement>(`[data-senda-ref="${CSS.escape(ref)}"]`);
    if (el) return moved.has(ref) ? { el, reResolved: true } : { el };
    const key = keys.get(ref);
    const matches = key
      ? [...document.querySelectorAll<HTMLElement>(candidates)].filter(
          (c) => !c.hasAttribute('data-senda-ref') && visible(c) && wantsRef(c) && keyOf(c) === key,
        )
      : [];
    if (matches.length !== 1) return { el: null };
    matches[0]!.setAttribute('data-senda-ref', ref);
    moved.add(ref);
    return { el: matches[0]!, reResolved: true };
  };
  const control = (el: Element) => {
    const ref = refs.get(el);
    const role = roleOf(el);
    const name = nameOf(el);
    const attr = (a: string) => el.getAttribute(a) || '';
    // Dropdown toggles: list the (usually hidden) menu items so the AI knows what the button opens.
    let menu = '';
    if (/dropdown/.test(attr('data-toggle') + attr('data-bs-toggle')) || /^(true|menu)$/.test(attr('aria-haspopup'))) {
      const list = el.parentElement?.querySelector('.dropdown-menu, [role=menu]');
      const items = [...new Set([...(list?.querySelectorAll('a,button,[role=menuitem],.dropdown-item') ?? [])].map((i) => esc(i.textContent || '')))].filter(Boolean);
      menu = items.length ? ` (menu: ${items.join(', ').slice(0, 120)})` : ' (menu)';
    }
    let value = '';
    if (el instanceof HTMLSelectElement) {
      const label = (o: HTMLOptionElement) => esc(o.getAttribute('label') || o.text);
      const selected = [...el.selectedOptions].map(label).join(', ');
      const names = [...el.options].map(label).filter(Boolean);
      let list = '';
      let shown = 0;
      for (const n of names) {
        if (list.length + n.length > 300) break;
        list += `${shown++ ? ', ' : ''}${n}`;
      }
      const more = names.length - shown ? `${shown ? ', ' : ''}+${names.length - shown} more` : '';
      value = ` (options: ${list}${more})${selected ? ` selected=${JSON.stringify(selected)}` : ''}`;
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const hidden =
        el instanceof HTMLInputElement && (el.type === 'password' || /cc-number|cc-csc|cc-exp/i.test(el.autocomplete));
      value = hidden ? ' (hidden)' : el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? (el.checked ? ' (checked)' : '') : el.value ? ` value=${JSON.stringify(el.value)}` : '';
    }
    const state = el.localName === 'summary' ? ` (${el.closest('details')?.hasAttribute('open') ? 'open' : 'closed'})` : '';
    return `${ref ? `[${ref}] ` : ''}${role} "${name}"${state}${menu}${value}`;
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
    const ref = refs.get(t);
    lines.push(`${ref ? `[${ref}] ` : ''}table:${caption && visible(caption) ? ` ${esc(caption.textContent || '')}` : ''}`);
    for (const row of t.querySelectorAll('tr')) {
      if (row.closest('table') !== t || !visible(row)) continue;
      const cells = [...row.children]
        .filter((c) => (c.localName === 'td' || c.localName === 'th') && visible(c))
        .map((c) => {
          if (isControl(c)) return control(c);
          const saved = buf;
          buf = [];
          walk(c, () => '', true);
          const text = join(buf);
          buf = saved;
          const ref = refs.get(c);
          return ref ? `[${ref}] ${text}` : text;
        });
      const rowRef = refs.get(row);
      if (cells.some(Boolean)) lines.push(`${rowRef ? `[${rowRef}] ` : ''}row: ${cells.join(' | ')}`);
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
    if (skip.has(tag)) return;
    // display: contents boxes have no size but their children render normally.
    if (!visible(el)) return void (getComputedStyle(el).display === 'contents' && walk(el, label, inline));
    if (tag === 'label' && el.querySelector('input[type=checkbox],input[type=radio]')) {
      const input = el.querySelector('input[type=checkbox],input[type=radio]')!;
      buf.push({ text: control(visible(input) ? input : el), control: true });
      for (const action of el.querySelectorAll(controlSelector)) if (action !== input) visit(action, label, false);
      return;
    }
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
  if (scope === document.body) walk(scope, () => 'text', false);
  else visit(scope, () => 'text', false);
  flush(() => 'text');
  const out = lines.join('\n');
  return out.length > 50000 ? `${out.slice(0, 50000)}\n[truncated: snapshot over 50000 characters]` : out;
}
// Waits until the page finished loading at least 1 s ago and the DOM (incl. attributes) has not changed for 300 ms,
// at most 1 s in total (3 s within 5 s of load or of a Senda click/submit/key press, so SPAs can render or change routes),
// so content fetched on load (AJAX tables) is there. A page with no text or controls, or still busy after Senda's last action
// (see actionBusy), keeps waiting. Resolves true if still busy at the cap. Only those rechecks nest timers, so background throttling stays mild.
export function settleDom(): Promise<boolean> {
  return new Promise((resolve) => {
    const loaded = () =>
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.loadEventEnd || performance.now();
    const empty = () =>
      !document.body?.innerText.trim() &&
      ![...(document.body?.querySelectorAll('a,button,input,select,textarea,iframe,[role=button],[role=link],[role=textbox],[role=combobox]') ?? [])].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    const busy = (): boolean => !!(globalThis as any).__sendaInput?.actionBusy();
    const wait = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => (empty() || busy() ? (quiet = wait()) : done()), Math.max(300, loaded() + 1000 - performance.now()));
    let quiet = wait();
    const observer = new MutationObserver(() => {
      clearTimeout(quiet);
      quiet = wait();
    });
    const recent = (t: number) => performance.now() - t < 5000;
    const cap = setTimeout(done, recent(loaded()) || recent((globalThis as any).__sendaActed?.at ?? -Infinity) ? 3000 : 1000);
    function done() {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(cap);
      resolve(busy());
    }
    observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  });
}
