// These run via scripting.executeScript, so each must be self-contained.

// Hides passwords, card numbers, one-time codes and similar fields before a capture; on=false undoes it.
// Walks shadow roots too (closed ones through the extension-only openOrClosedShadowRoot).
export async function maskSensitive(on: boolean): Promise<void> {
  const shadowOf = (el: Element): ShadowRoot | null => {
    try {
      return (globalThis as any).chrome?.dom?.openOrClosedShadowRoot?.(el) ?? (el as any).openOrClosedShadowRoot ?? el.shadowRoot;
    } catch {
      return el.shadowRoot;
    }
  };
  const roots: (Document | ShadowRoot)[] = [];
  const collect = (root: Document | ShadowRoot) => {
    roots.push(root);
    for (const el of root.querySelectorAll('*')) {
      const shadow = shadowOf(el);
      if (shadow) collect(shadow);
    }
  };
  collect(document);
  const sensitive = /cc-|one-time-code|otp|\bpin\b|cvv|cvc|csc|card|tarjeta|ssn|token|secret|passw|clave|contrase/i;
  for (const root of roots) {
    root.querySelectorAll('style[data-senda-mask-style]').forEach((el) => el.remove());
    root.querySelectorAll('[data-senda-mask]').forEach((el) => el.removeAttribute('data-senda-mask'));
    if (!on) continue;
    let found = false;
    for (const el of root.querySelectorAll('input')) {
      const hints = [el.autocomplete, el.name, el.id, el.getAttribute('aria-label'), el.placeholder].join(' ');
      if (el.type !== 'password' && !sensitive.test(hints)) continue;
      el.setAttribute('data-senda-mask', '');
      found = true;
    }
    if (!found) continue;
    const style = document.createElement('style');
    style.setAttribute('data-senda-mask-style', '');
    style.textContent =
      '[data-senda-mask]{filter:blur(8px)!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';
    (root.nodeType === Node.DOCUMENT_NODE ? (root as Document).documentElement : root).append(style);
  }
  // Let the blur paint before the capture.
  if (on) await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
    setTimeout(resolve, 200);
  });
}

export function refRect(ref: string) {
  const el = document.querySelector(`[data-senda-ref="${CSS.escape(ref)}"]`);
  if (!el) return null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

// Scrolls to y when given; returns where the page is now.
export function pageMetrics(y?: number) {
  if (y !== undefined) window.scrollTo(0, y);
  return { scrollY: window.scrollY, innerWidth: window.innerWidth, innerHeight: window.innerHeight, scrollHeight: document.documentElement.scrollHeight };
}
