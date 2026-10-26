// Untrusted events can't pass isTrusted checks, but many apps only need the full pointer sequence
// with coordinates on the element actually under the cursor.
export function clickRef(ref: string): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
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
  return true;
}
export function typeRef(ref: string, text: string, submit = false): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
  el.focus();
  if (el.isContentEditable) {
    // Rich editors (Lexical, Draft, ProseMirror) listen to beforeinput/paste, not textContent changes.
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
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
  if (submit) {
    const form = el.closest('form');
    if (form) form.requestSubmit();
    else {
      const key = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', key));
      el.dispatchEvent(new KeyboardEvent('keypress', key));
      el.dispatchEvent(new KeyboardEvent('keyup', key));
    }
  }
  return true;
}
export function scrollPage(dx = 0, dy = 600, ref?: string): boolean {
  if (ref !== undefined) {
    const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
  } else window.scrollBy(dx, dy);
  return true;
}
