import { ErrorCode } from '@senda/protocol';
import { clickRef } from '../../injected/actions';
import { CommandError, target } from './shared';
export default async function click(p: { ref: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const [{ result } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: clickRef, args: [p.ref] });
  if (!result) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  return { tabId };
}
