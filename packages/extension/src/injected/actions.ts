export function clickRef(ref: string): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup'])
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  el.click();
  return true;
}
export function typeRef(ref: string, text: string, submit = false): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
  el.focus();
  if (el.isContentEditable) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (submit) {
    const form = el.closest('form');
    if (form) form.requestSubmit();
    else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
