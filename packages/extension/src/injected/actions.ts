// clickRef/typeRef run via scripting.executeScript, so they can't import: they use the input helpers
// the background injects first with /runner.js (see entrypoints/runner.ts).
export function clickRef(ref: string): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
  (globalThis as any).__sendaInput.realClick(el);
  return true;
}
export function pressKeyRef(key: string, ref?: string): string | null {
  const el = ref ? document.querySelector<HTMLElement>(`[data-senda-ref="${CSS.escape(ref)}"]`) : null;
  if (ref && !el) return null;
  el?.focus();
  return (globalThis as any).__sendaInput.pressKeyAction(key);
}
export function typeRef(ref: string, text: string, submit = false): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
  const input = (globalThis as any).__sendaInput;
  input.typeText(el, text);
  if (submit) {
    const form = el.closest('form');
    if (form) form.requestSubmit();
    else input.pressKey(el, 'Enter');
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
