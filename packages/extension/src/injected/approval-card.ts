// Both functions run in the page through scripting.executeScript, so they must stay self-contained.
export type PageCard = {
  id: string;
  summary: string;
  url?: string;
  details?: [string, string][];
  source?: string;
  ref?: string;
  always?: string;
};
export type PageCardText = { title: string; allow: string; deny: string; openPanel: string; readFrom?: string };

export function showApprovalCard(card: PageCard, t: PageCardText): void {
  document.querySelectorAll(`senda-approval[data-id="${CSS.escape(card.id)}"]`).forEach((el) => el.remove());
  const host = document.createElement('senda-approval');
  host.dataset.id = card.id;
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const style = document.createElement('style');
  style.textContent = `
    :host { --bg: #fcfdfc; --fg: #1f2b25; --muted: #5d6762; --line: #dde3df; --primary: #2f8a5f; --primary-text: #1f6f4a; --warn: #e0a526; --error: #b4372f; }
    @media (prefers-color-scheme: dark) { :host { --bg: #1d2421; --fg: #eef3f0; --muted: #a5aea9; --line: #3a423e; --primary: #66c79a; --primary-text: #66c79a; --warn: #e6b74a; --error: #ef8a7f; } }
    .hl { position: fixed; border: 3px solid var(--warn); border-radius: 6px; box-shadow: 0 0 0 4px rgb(224 165 38 / 0.25); transition: all 80ms; }
    .card { pointer-events: auto; position: fixed; right: 16px; bottom: 16px; width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box;
      padding: 14px; border-radius: 12px; border: 1px solid var(--line); border-left: 4px solid var(--warn); background: var(--bg); color: var(--fg);
      font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); }
    .title { margin: 0 0 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    .summary { margin: 0 0 6px; font-weight: 600; }
    .muted { margin: 0 0 6px; color: var(--muted); word-break: break-all; }
    .error { margin: 0 0 6px; color: var(--error); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0 0 8px; }
    dt { color: var(--muted); } dd { margin: 0; word-break: break-word; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    button { font: inherit; cursor: pointer; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--fg); }
    button.primary { border: 2px solid var(--primary); padding: 5px 11px; color: var(--primary-text); font-weight: 600; }
    button.primary:hover { background: color-mix(in srgb, var(--primary) 12%, transparent); }
    button.link { border: 0; padding: 6px 0; color: var(--muted); text-decoration: underline; }
  `;
  const box = el('section', 'card');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', t.title);
  box.append(el('p', 'title', t.title), el('p', 'summary', card.summary));
  if (card.url) box.append(el('p', 'muted', card.url));
  if (card.details?.length) {
    const list = el('dl', '');
    for (const [name, value] of card.details) list.append(el('dt', '', name), el('dd', '', value));
    box.append(list);
  }
  if (t.readFrom) box.append(el('p', 'error', t.readFrom));
  const api = (globalThis as any).chrome ?? (globalThis as any).browser;
  const button = (label: string, className: string, message: Record<string, string>) => {
    const node = el('button', className, label);
    node.type = 'button';
    // Only real clicks count: page scripts can reach this open shadow root but can't fake a trusted event.
    node.addEventListener('click', (event) => {
      if (event.isTrusted) void api.runtime.sendMessage({ ...message, id: card.id });
    });
    return node;
  };
  const row = el('div', 'row');
  row.append(button(t.allow, 'primary', { type: 'senda:answer', answer: 'allow' }), button(t.deny, '', { type: 'senda:answer', answer: 'deny' }));
  if (card.always) row.append(button(card.always, '', { type: 'senda:answer', answer: 'always' }));
  box.append(row, button(t.openPanel, 'link', { type: 'senda:open-panel' }));
  root.append(style);
  const target = card.ref ? document.querySelector<HTMLElement>(`[data-senda-ref="${CSS.escape(card.ref)}"]`) : null;
  const hl = el('div', 'hl');
  if (target) root.append(hl);
  root.append(box);
  document.documentElement.append(host);
  if (!target) return;
  target.scrollIntoView({ block: 'center' });
  const place = () => {
    if (!host.isConnected) return;
    const r = target.getBoundingClientRect();
    Object.assign(hl.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 2}px`, height: `${r.height + 2}px` });
    requestAnimationFrame(place);
  };
  place();
}

export function hideApprovalCard(id: string): void {
  document.querySelectorAll(`senda-approval[data-id="${CSS.escape(id)}"]`).forEach((el) => el.remove());
}
