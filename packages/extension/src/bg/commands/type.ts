import { ErrorCode } from '@senda/protocol';
import { typeRef } from '../../injected/actions';
import { CommandError, target } from './shared';
export default async function type(p: { ref: string; text: string; submit?: boolean; tabId?: number }) { const tabId = await target(p.tabId); const [{ result } = {}] = await browser.scripting.executeScript({ target: { tabId }, func: typeRef, args: [p.ref, p.text, p.submit] }); if (!result) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`); return { tabId }; }
