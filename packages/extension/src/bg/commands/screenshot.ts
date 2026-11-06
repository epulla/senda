import { ErrorCode } from '@senda/protocol';
import { maskSensitive, pageMetrics, refRect } from '../../injected/screenshot';
import { settingsItem } from '../state';
import { CommandError, target } from './shared';

const MAX_SCREENS = 10;
// Most AI clients reject images over 8000px on a side.
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 8000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
// captureVisibleTab allows two calls per second across the whole extension.
let lastCapture = 0;
const capture = async (windowId: number) => {
  const wait = lastCapture + 550 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCapture = Date.now();
  return browser.tabs.captureVisibleTab(windowId, { format: 'png' });
};
const bitmap = async (dataUrl: string) => createImageBitmap(await (await fetch(dataUrl)).blob());

export default async function screenshot(p: { ref?: string; fullPage?: boolean; tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  let host = '';
  try {
    host = new URL(tab.url || '').host;
  } catch {}
  if ((await settingsItem.getValue()).blockedDomains.some((d) => host === d || host.endsWith(`.${d}`)))
    throw new CommandError(ErrorCode.DOMAIN_BLOCKED, `Domain ${host} is blocked.`);
  const run = async <T>(func: (...args: any[]) => T, args: unknown[] = []) =>
    (await browser.scripting.executeScript({ target: { tabId }, func, args: args as any }))[0]?.result as T;
  const rect = p.ref === undefined ? null : await run(refRect, [p.ref]);
  if (p.ref !== undefined && !rect) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  // captureVisibleTab only sees the active tab, so show the agent tab briefly and switch back after.
  const [previous] = tab.active ? [] : await browser.tabs.query({ active: true, windowId: tab.windowId });
  if (previous) {
    await browser.tabs.update(tabId, { active: true });
    await sleep(150);
  }
  const masked = { target: { tabId, allFrames: true } };
  await browser.scripting.executeScript({ ...masked, func: maskSensitive, args: [true] });
  let canvas: OffscreenCanvas;
  try {
    const start = await run(pageMetrics);
    if (p.fullPage && !rect) {
      const shots: { image: ImageBitmap; y: number }[] = [];
      for (let i = 0; i < MAX_SCREENS; i++) {
        const at = await run(pageMetrics, [i * start.innerHeight]);
        await sleep(100);
        shots.push({ image: await bitmap(await capture(tab.windowId)), y: at.scrollY });
        if (at.scrollY + at.innerHeight >= at.scrollHeight) break;
      }
      await run(pageMetrics, [start.scrollY]);
      const scale = shots[0]!.image.width / start.innerWidth;
      const last = shots.at(-1)!;
      const height = Math.round((last.y + start.innerHeight) * scale);
      const out = Math.min(1, MAX_WIDTH / shots[0]!.image.width, MAX_HEIGHT / height);
      canvas = new OffscreenCanvas(Math.round(shots[0]!.image.width * out), Math.round(height * out));
      const ctx = canvas.getContext('2d')!;
      for (const shot of shots) ctx.drawImage(shot.image, 0, Math.round(shot.y * scale * out), shot.image.width * out, shot.image.height * out);
    } else {
      const image = await bitmap(await capture(tab.windowId));
      const scale = image.width / start.innerWidth;
      const x = Math.max(0, (rect?.x ?? 0) * scale);
      const y = Math.max(0, (rect?.y ?? 0) * scale);
      const w = Math.min(image.width - x, rect ? rect.width * scale : image.width);
      const h = Math.min(image.height - y, rect ? rect.height * scale : image.height);
      if (w < 1 || h < 1) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} is not visible; take a new snapshot.`);
      const out = Math.min(1, MAX_WIDTH / w, MAX_HEIGHT / h);
      canvas = new OffscreenCanvas(Math.round(w * out), Math.round(h * out));
      canvas.getContext('2d')!.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
    }
  } finally {
    await browser.scripting.executeScript({ ...masked, func: maskSensitive, args: [false] }).catch(() => {});
    if (previous?.id !== undefined) await browser.tabs.update(previous.id, { active: true }).catch(() => {});
  }
  const data = await toBase64(await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 }));
  return { tabId, url: tab.url, title: tab.title, width: canvas.width, height: canvas.height, mimeType: 'image/jpeg', data };
}
