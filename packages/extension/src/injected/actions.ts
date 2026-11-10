// clickRef/typeRef run via scripting.executeScript, so they can't import: they use the input helpers
// the background injects first with /runner.js (see entrypoints/runner.ts).
export function clickRef(ref: string): boolean {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) as HTMLElement | null;
  if (!el) return false;
  (globalThis as any).__sendaInput.realClick(el);
  return true;
}
export function probeKeyTarget(marker: string, ref?: string) {
  const referenced = ref
    ? document.querySelector<HTMLElement>(`[data-senda-ref="${CSS.escape(ref)}"]`)
    : undefined;
  if (ref && !referenced) return { missing: true, focusFailed: false, label: '', formField: false };
  referenced?.focus();
  const active = document.activeElement as HTMLElement;
  if (ref && active !== referenced) return { missing: false, focusFailed: true, label: '', formField: false };
  active.setAttribute('data-senda-key-target', marker);
  const pageRoot = active === document.body || active === document.documentElement;
  const textInput = active.matches('input:not([type]),input[type=text],input[type=search],input[type=email],input[type=url],input[type=tel],input[type=password]');
  const labelledBy = active
    .getAttribute('aria-labelledby')
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  const labels = active instanceof HTMLInputElement
    ? [...(active.labels || [])].map((label) => label.textContent?.trim()).filter(Boolean).join(' ')
    : '';
  return {
    missing: false,
    focusFailed: false,
    label: pageRoot
      ? ''
      : active.getAttribute('aria-label') ||
        labelledBy ||
        labels ||
        active.textContent?.trim() ||
        (active as HTMLInputElement).value ||
        active.getAttribute('title') ||
        '',
    formField: !!textInput && !!(active as HTMLInputElement).form,
  };
}
export function pressKeyRef(key: string, marker: string): string {
  const marked = document.querySelector<HTMLElement>(`[data-senda-key-target="${CSS.escape(marker)}"]`);
  if (!marked?.isConnected) return 'FOCUS_MOVED';
  const active = document.activeElement;
  const approvalFocused =
    active instanceof HTMLElement &&
    (active.matches('senda-approval') || !!active.closest('senda-approval'));
  if (active !== marked) {
    if (active !== document.body && active !== document.documentElement && !approvalFocused) {
      marked.removeAttribute('data-senda-key-target');
      return 'FOCUS_MOVED';
    }
    marked.focus();
    if (document.activeElement !== marked) {
      marked.removeAttribute('data-senda-key-target');
      return 'FOCUS_MOVED';
    }
  }
  if (document.activeElement !== marked) {
    marked.removeAttribute('data-senda-key-target');
    return 'FOCUS_MOVED';
  }
  marked.removeAttribute('data-senda-key-target');
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
