// These run via scripting.executeScript, so each must be self-contained.

// Hides passwords, card numbers, one-time codes and similar fields before a capture; on=false undoes it.
export function maskSensitive(on: boolean): void {
  document.getElementById('senda-mask-style')?.remove();
  document.querySelectorAll('[data-senda-mask]').forEach((el) => el.removeAttribute('data-senda-mask'));
  if (!on) return;
  const sensitive = /cc-|one-time-code|otp|\bpin\b|cvv|cvc|csc|card|tarjeta|ssn|token|secret|passw|clave|contrase/i;
  for (const el of document.querySelectorAll('input')) {
    const hints = [el.autocomplete, el.name, el.id, el.getAttribute('aria-label'), el.placeholder].join(' ');
    if (el.type === 'password' || sensitive.test(hints)) el.setAttribute('data-senda-mask', '');
  }
  const style = document.createElement('style');
  style.id = 'senda-mask-style';
  style.textContent =
    '[data-senda-mask]{filter:blur(8px)!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';
  document.documentElement.append(style);
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
