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
  target.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }));
  target.focus?.();
  target.dispatchEvent(new PointerEvent('pointerup', pointer));
  target.dispatchEvent(new MouseEvent('mouseup', init));
  target.dispatchEvent(new MouseEvent('click', { ...init, detail: 1 }));
}

export function typeText(el: HTMLElement, text: string): void {
  el.focus();
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
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
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
  const textInputSelector = 'input:not([type]),input[type=text],input[type=search],input[type=email],input[type=url],input[type=tel],input[type=password]';
  const form = active instanceof HTMLInputElement && active.matches(textInputSelector) ? active.form : null;
  const field = !!form;
  const prevented = !active.dispatchEvent(new KeyboardEvent('keydown', init));
  if (code === 'Enter' || code === ' ') active.dispatchEvent(new KeyboardEvent('keypress', init));
  active.dispatchEvent(new KeyboardEvent('keyup', init));
  if (!prevented) {
    if (code === 'Tab') {
      const modal = [...document.querySelectorAll('dialog')].reverse().find((d) => d.matches(':modal'));
      const scope: ParentNode = modal || document;
      const els = [...scope.querySelectorAll<HTMLElement>('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[contenteditable]')]
        .filter((e) => !e.matches(':disabled') && e.tabIndex >= 0 && !e.closest('[inert]') && e.getClientRects().length)
        .sort((a, b) =>
          a.tabIndex > 0 && b.tabIndex > 0
            ? a.tabIndex - b.tabIndex
            : a.tabIndex > 0
              ? -1
              : b.tabIndex > 0
                ? 1
                : 0,
        );
      const i = els.indexOf(active as HTMLElement);
      const step = key === 'Shift+Tab' ? -1 : 1;
      const next = els.length
        ? els[i < 0 ? (step > 0 ? 0 : els.length - 1) : (i + step + els.length) % els.length]
        : undefined;
      next?.focus();
    } else if (code === 'Escape') {
      const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')].pop();
      if (dialog) {
        const event = new Event('cancel', { cancelable: true });
        if (dialog.dispatchEvent(event)) dialog.close();
      } else {
        [...document.querySelectorAll<HTMLElement>('[popover]:popover-open')].pop()?.hidePopover();
      }
    } else if (
      (code === 'Enter' && (active.matches('a,button,summary,input[type=submit],input[type=button]') || field)) ||
      (code === ' ' && active.matches('button,summary,input[type=checkbox],input[type=radio],[role=button]'))
    ) {
      if (code === 'Enter' && field) form!.requestSubmit();
      else (active as HTMLElement).click();
    }
  }
  const el = document.activeElement as HTMLElement || document.body;
  const ref = el.getAttribute('data-senda-ref');
  const role =
    el.getAttribute('role') ||
    (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? el.type : el.localName);
  const name =
    el.getAttribute('aria-label') ||
    el.textContent?.trim().slice(0, 80) ||
    el.getAttribute('placeholder') ||
    el.title ||
    (el instanceof HTMLInputElement && ['button', 'submit'].includes(el.type) ? el.value : '');
  return `${ref ? `[${ref}] ` : ''}${role}${name ? ` "${name}"` : ''}`;
}
