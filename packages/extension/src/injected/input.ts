// Signs that an element is waiting on its own action; a plain label change ("Show more" → "Show less") isn't one.
const busyFlags = (el: Element) => [
  !!(el as HTMLButtonElement).disabled,
  el.getAttribute('aria-disabled') === 'true',
  el.getAttribute('aria-busy') === 'true',
  !el.textContent?.trim(),
];
// Remembers what Senda just acted on, so a snapshot can wait while the page reacts (e.g. a sign-in button turning into a spinner).
export function markAction(el: Element): void {
  (globalThis as any).__sendaActed = { at: performance.now(), el, url: location.href, flags: busyFlags(el) };
}
// True while an action from the last 5 s still looks in progress: on the same URL its element became disabled, busy or blank,
// or something visible is aria-busy or a progressbar.
export function actionBusy(): boolean {
  const acted = (globalThis as any).__sendaActed;
  if (!acted || performance.now() - acted.at >= 5000) return false;
  if (acted.el.isConnected && location.href === acted.url && busyFlags(acted.el).some((on, i) => on && !acted.flags[i])) return true;
  return [...document.querySelectorAll('[aria-busy=true],[role=progressbar]')].some((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}

export function moveFocus(el: HTMLElement | null): void {
  const prev = document.activeElement;
  let native = false;
  const markNative = () => { native = true; };
  window.addEventListener('focusin', markNative, true);
  window.addEventListener('focusout', markNative, true);
  if (el) el.focus();
  else if (prev instanceof HTMLElement && prev !== document.body) prev.blur();
  window.removeEventListener('focusin', markNative, true);
  window.removeEventListener('focusout', markNative, true);
  const active = document.activeElement;
  if (native || active === prev) return;
  // Background windows can update activeElement without dispatching native focus events.
  if (prev instanceof HTMLElement && prev !== document.body) {
    prev.dispatchEvent(new FocusEvent('blur', { relatedTarget: active }));
    prev.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: active }));
  }
  if (active instanceof HTMLElement && active !== document.body) {
    active.dispatchEvent(new FocusEvent('focus', { relatedTarget: prev }));
    active.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true, relatedTarget: prev }));
  }
}

// Untrusted events can't pass isTrusted checks, but many apps (WhatsApp Web included) only need the
// full pointer sequence with coordinates on the element actually under the cursor.
export function realClick(el: HTMLElement): void {
  el.scrollIntoView({ block: 'center' });
  const rect = el.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const hit = document.elementFromPoint(clientX, clientY);
  const target = hit instanceof HTMLElement && el.contains(hit) ? hit : el;
  const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY, button: 0 };
  const pointer = { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  for (const type of ['pointerover', 'pointerenter']) target.dispatchEvent(new PointerEvent(type, pointer));
  for (const type of ['mouseover', 'mouseenter']) target.dispatchEvent(new MouseEvent(type, init));
  target.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, buttons: 1 }));
  if (target.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 })))
    moveFocus(target.closest<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]:not([contenteditable=false])'));
  target.dispatchEvent(new PointerEvent('pointerup', pointer));
  target.dispatchEvent(new MouseEvent('mouseup', init));
  target.dispatchEvent(new MouseEvent('click', { ...init, detail: 1 }));
}

export function typeText(el: HTMLElement, text: string): void {
  moveFocus(el);
  if (el.isContentEditable) {
    // Rich editors (Lexical, Draft, ProseMirror) listen to beforeinput/paste, not textContent changes.
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    // Editors that manage their own selection (WhatsApp's) only honor the browser's select-all command.
    document.execCommand('selectAll');
    if (!document.execCommand('insertText', false, text)) {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
    }
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
    const chars = [...text];
    if (!chars.length) {
      setter.call(el, '');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }));
    }
    let typed = '';
    for (const ch of chars) {
      const key = ch === '\n' ? 'Enter' : ch;
      const upper = ch.toUpperCase();
      const code = /^[a-z]$/i.test(ch) ? `Key${upper}` : /^\d$/.test(ch) ? `Digit${ch}` : ch === ' ' ? 'Space' : ch === '\n' ? 'Enter' : '';
      const n = /^[a-z\d]$/i.test(ch) ? upper.charCodeAt(0) : ch === ' ' ? 32 : ch === '\n' ? 13 : 0;
      const init = { key, code, keyCode: n, which: n, bubbles: true, cancelable: true, composed: true };
      const accepted =
        el.dispatchEvent(new KeyboardEvent('keydown', init)) &&
        el.dispatchEvent(new KeyboardEvent('keypress', { ...init, charCode: ch.charCodeAt(0) })) &&
        el.dispatchEvent(new InputEvent('beforeinput', { ...init, inputType: 'insertText', data: ch }));
      if (accepted) {
        typed += ch;
        setter.call(el, typed);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: ch }));
      }
      el.dispatchEvent(new KeyboardEvent('keyup', init));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Picks options by value, then by visible label (trimmed, case-insensitive); returns the chosen labels.
export function chooseOption(el: HTMLSelectElement, value: string | string[]): string[] {
  const wanted = Array.isArray(value) ? value : [value];
  const options = [...el.options];
  // <option label> wins over its text, as in the rendered dropdown; a disabled optgroup disables its options.
  const label = (o: HTMLOptionElement) => (o.getAttribute('label') || o.text).trim();
  const off = (o: HTMLOptionElement) => o.disabled || !!o.closest('optgroup[disabled]');
  const list = () => options.filter((o) => !off(o)).map((o) => (!o.value || o.value === label(o) ? label(o) : `${label(o)} (${o.value})`)).join(', ');
  if (wanted.length !== 1 && !el.multiple) throw Error(`This dropdown takes one option. Options: ${list()}`);
  const picked = wanted.map((w) => {
    const o =
      options.find((o) => o.value === w) ?? options.find((o) => label(o).toLowerCase() === w.trim().toLowerCase());
    if (!o || off(o)) throw Error(`${o ? 'Option is disabled' : 'No option matches'}: "${w}". Options: ${list()}`);
    return o;
  });
  for (const o of options) o.selected = picked.includes(o);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return picked.map(label);
}

export function pressKey(el: Element, key: string): void {
  const init = { key, code: key, bubbles: true, cancelable: true, ...(key === 'Enter' ? { keyCode: 13, which: 13 } : {}) };
  for (const type of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, init));
}

export function pressKeyAction(key: string): string {
  const codes: Record<string, number> = {
    Tab: 9,
    Enter: 13,
    Escape: 27,
    ' ': 32,
    End: 35,
    Home: 36,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
  };
  const code = key === 'Space' ? ' ' : key.replace(/^Shift\+/, '');
  const n = codes[code] ?? 0;
  const active = document.activeElement || document.body;
  const init = {
    key: code,
    code: code === ' ' ? 'Space' : code,
    keyCode: n,
    which: n,
    bubbles: true,
    cancelable: true,
    shiftKey: key === 'Shift+Tab',
  };
  const textInputSelector =
    'input:not([type]),input[type=text],input[type=search],input[type=url],input[type=tel],input[type=email],input[type=password],input[type=date],input[type=month],input[type=week],input[type=time],input[type=datetime-local],input[type=number]';
  const form = active instanceof HTMLInputElement && active.matches(textInputSelector) ? active.form : null;
  const field = !!form;
  const deepestContaining = <T extends Element>(elements: T[]) => {
    const containing = elements.filter((element) => element.contains(document.activeElement));
    return containing.find((element) => !containing.some((other) => other !== element && element.contains(other)));
  };
  const keydownPrevented = !active.dispatchEvent(new KeyboardEvent('keydown', init));
  let keypressPrevented = false;
  if (!keydownPrevented && (code === 'Enter' || code === ' '))
    keypressPrevented = !active.dispatchEvent(new KeyboardEvent('keypress', init));
  const runDefault = !keydownPrevented && !keypressPrevented;
  if (runDefault) {
    if (code === 'Tab') {
      const modals = [...document.querySelectorAll<HTMLDialogElement>('dialog')].filter((dialog) => dialog.matches(':modal'));
      const modal = deepestContaining(modals) || modals.at(-1);
      const scope: ParentNode = modal || document;
      const els = [...scope.querySelectorAll<HTMLElement>('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[contenteditable]')]
        .filter((e) => {
          if (e.matches(':disabled') || e.tabIndex < 0 || e.closest('[inert]')) return false;
          const visible = typeof e.checkVisibility === 'function'
            ? e.checkVisibility({ visibilityProperty: true })
            : !['hidden', 'collapse'].includes(getComputedStyle(e).visibility) && e.getClientRects().length > 0;
          if (!visible) return false;
          if (e instanceof HTMLInputElement && ['radio'].includes(e.type) && e.name) {
            const radios = [...(e.form?.elements || document.querySelectorAll('input[type=radio]'))]
              .filter((item): item is HTMLInputElement => item instanceof HTMLInputElement && item.type === 'radio' && item.name === e.name && item.form === e.form);
            return radios.find((radio) => radio.checked) === e || (!radios.some((radio) => radio.checked) && radios[0] === e);
          }
          return true;
        })
        .sort((a, b) =>
          a.tabIndex > 0 && b.tabIndex > 0
            ? a.tabIndex - b.tabIndex
            : a.tabIndex > 0
              ? -1
              : b.tabIndex > 0
                ? 1
                : 0,
        );
      let i = els.indexOf(active as HTMLElement);
      if (i < 0 && active instanceof HTMLInputElement && active.type === 'radio' && active.name) {
        const groupRadio = els.findIndex((candidate) =>
          candidate instanceof HTMLInputElement && candidate.type === 'radio' && candidate.name === active.name && candidate.form === active.form,
        );
        i = groupRadio;
      }
      const step = key === 'Shift+Tab' ? -1 : 1;
      const next = els.length
        ? els[i < 0 ? (step > 0 ? 0 : els.length - 1) : (i + step + els.length) % els.length]
        : undefined;
      if (next) moveFocus(next);
    } else if (code === 'Escape') {
      const popovers = [...document.querySelectorAll<HTMLElement>('[popover]:popover-open')];
      const popover = deepestContaining(popovers) || popovers.find((item) => !popovers.some((other) => other !== item && item.contains(other))) || popovers.at(-1);
      if (popover) {
        popover.hidePopover();
      } else {
        const modals = [...document.querySelectorAll<HTMLDialogElement>('dialog')].filter((item) => item.matches(':modal'));
        const dialog = deepestContaining(modals) || modals.at(-1);
        if (dialog) {
        const event = new Event('cancel', { cancelable: true });
        if (dialog.dispatchEvent(event)) dialog.close();
        }
      }
    } else if (code === 'Enter' && (active.matches('a,button,summary,input[type=submit],input[type=button]') || field)) {
      if (field) {
        const submitter = [...form!.elements].find((item) => {
          if (!(item instanceof HTMLButtonElement || item instanceof HTMLInputElement)) return false;
          const type = item.type.toLowerCase();
          return item instanceof HTMLButtonElement ? type === 'submit' : type === 'submit' || type === 'image';
        }) as HTMLButtonElement | HTMLInputElement | undefined;
        if (submitter?.disabled) {
          // Disabled default submitter prevents implicit submission.
        } else if (submitter) {
          submitter.click();
        } else {
          const blockingFields = [...form!.elements].filter(
            (item) => item instanceof HTMLInputElement && item.matches(textInputSelector),
          );
          if (blockingFields.length === 1) form!.requestSubmit();
        }
      }
      else (active as HTMLElement).click();
    }
  }
  const keyupTarget = document.activeElement || document.body;
  const keyupPrevented = !keyupTarget.dispatchEvent(new KeyboardEvent('keyup', init));
  if (code === ' ' && runDefault && !keyupPrevented && active.matches('button,summary,input[type=checkbox],input[type=radio],[role=button]'))
    (active as HTMLElement).click();
  const el = document.activeElement as HTMLElement || document.body;
  const ref = el.getAttribute('data-senda-ref');
  const role =
    el.getAttribute('role') ||
    (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? el.type : el.localName);
  const labelledBy = el.getAttribute('aria-labelledby')
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  const inputLabel = el instanceof HTMLInputElement ? [...(el.labels || [])].map((label) => label.textContent?.trim()).filter(Boolean).join(' ') : '';
  const name = el.getAttribute('aria-label') || labelledBy || inputLabel ||
    (el instanceof HTMLInputElement
      ? el.getAttribute('placeholder') || el.title
      : el.textContent?.trim().slice(0, 80));
  return `${ref ? `[${ref}] ` : ''}${role}${name ? ` "${name}"` : ''}`;
}
