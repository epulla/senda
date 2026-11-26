import type { FoundRef } from './snapshot';
// clickRef/typeRef run via scripting.executeScript, so they can't import: they use the input helpers
// the background injects first with /runner.js (see entrypoints/runner.ts), and refs through snapshotPage's __sendaFindRef.
export function clickRef(ref: string): { reResolved?: true } | null {
  const { el, reResolved } = ((globalThis as any).__sendaFindRef?.(ref) ?? { el: document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) }) as FoundRef;
  if (!el) return null;
  (globalThis as any).__sendaInput.markAction(el);
  (globalThis as any).__sendaInput.realClick(el);
  return reResolved ? { reResolved } : {};
}
export function probeKeyTarget(marker: string, ref?: string) {
  const { el: referenced, reResolved } = ref ? ((globalThis as any).__sendaFindRef?.(ref) ?? { el: document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) }) as FoundRef : { el: undefined, reResolved: undefined };
  if (ref && !referenced) return { missing: true, focusFailed: false, label: '', formField: false };
  referenced?.focus();
  const active = document.activeElement as HTMLElement;
  if (ref && active !== referenced) return { missing: false, focusFailed: true, label: '', formField: false };
  active.setAttribute('data-senda-key-target', marker);
  const pageRoot = active === document.body || active === document.documentElement;
  const textInput = active.matches(
    'input:not([type]),input[type=text],input[type=search],input[type=url],input[type=tel],input[type=email],input[type=password],input[type=date],input[type=month],input[type=week],input[type=time],input[type=datetime-local],input[type=number]',
  );
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
    reResolved,
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
  (globalThis as any).__sendaInput.markAction(marked);
  return (globalThis as any).__sendaInput.pressKeyAction(key);
}
export async function typeRef(
  ref: string,
  text: string | string[],
  submit = false,
  selectOnly = false,
): Promise<{ ok: boolean; value?: string; selected?: string[]; error?: string; detached?: true; reResolved?: true }> {
  const { el, reResolved } = ((globalThis as any).__sendaFindRef?.(ref) ?? { el: document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) }) as FoundRef;
  if (!el) return { ok: false };
  const input = (globalThis as any).__sendaInput;
  if (el instanceof HTMLSelectElement) {
    let selected: string[];
    try {
      selected = input.chooseOption(el, text);
    } catch (error) {
      return { ok: true, error: (error as Error).message };
    }
    if (submit) {
      input.markAction(el);
      el.form?.requestSubmit();
    }
    return { ok: true, selected, reResolved };
  }
  if (selectOnly) return { ok: true, error: `Ref ${ref} is not a dropdown; use browser_type or browser_click.` };
  input.typeText(el, text);
  if (submit) {
    const form = el.closest('form');
    input.markAction(form?.querySelector('button:not([type=button]):not([type=reset]),input[type=submit]') ?? el);
    if (form) form.requestSubmit();
    else input.pressKey(el, 'Enter');
    return { ok: true, reResolved };
  }
  // Blur so save-on-blur pages commit, then re-read to catch pages that revert the value.
  input.moveFocus(null);
  await new Promise((resolve) => setTimeout(resolve));
  if (!el.isConnected) return { ok: true, detached: true, reResolved };
  const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : el.textContent ?? '';
  input.moveFocus(el);
  return { ok: true, value, reResolved };
}
export function scrollPage(dx = 0, dy = 600, ref?: string): { reResolved?: true } | null {
  if (ref === undefined) {
    window.scrollBy(dx, dy);
    return {};
  }
  const { el, reResolved } = ((globalThis as any).__sendaFindRef?.(ref) ?? { el: document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`) }) as FoundRef;
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  return reResolved ? { reResolved } : {};
}
