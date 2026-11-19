import { scrollPage } from '../../injected/actions';
import { refNotFound, target } from './shared';
export default async function scroll(p: { dx?: number; dy?: number; ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const [{ result } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: scrollPage,
    args: p.ref === undefined ? [p.dx ?? 0, p.dy ?? 600] : [p.dx ?? 0, p.dy ?? 600, p.ref],
  });
  if (!result) throw refNotFound(p.ref!);
  return { tabId, ...result };
}
