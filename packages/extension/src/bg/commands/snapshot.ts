import { snapshotPage } from '../../injected/snapshot';
import { wrapExternal } from '../../core/snapshot-format';
import { ErrorCode } from '@senda/protocol';
import { CommandError, target } from './shared';
import { noteExternal } from '../approvals';
export default async function snapshot(p: { ref?: string; tabId?: number }) {
  const tabId = await target(p.tabId);
  const tab = await browser.tabs.get(tabId);
  const [{ result = '' } = {}] = await browser.scripting.executeScript({
    target: { tabId },
    func: snapshotPage,
    args: p.ref === undefined ? [] : [p.ref],
  });
  if (result === null) throw new CommandError(ErrorCode.REF_NOT_FOUND, `Ref ${p.ref} not found; take a new snapshot.`);
  let origin = 'unknown';
  try {
    origin = new URL(tab.url || '').host || 'unknown';
  } catch {}
  await noteExternal(origin, result);
  return { tabId, url: tab.url, title: tab.title, snapshot: wrapExternal(origin, result) };
}
