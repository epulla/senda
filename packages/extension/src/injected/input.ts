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
