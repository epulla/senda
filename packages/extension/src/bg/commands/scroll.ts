import { ErrorCode } from '@senda/protocol';
import { scrollPage } from '../../injected/actions';
import { CommandError, target } from './shared';
export default async function scroll(p: { dx?: number; dy?: number; ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const [{ result } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: scrollPage,
    args: [p.dx ?? 0, p.dy ?? 600, p.ref],
  });
  if (!result) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  return { tabId };
}
