import type { Adapter } from '@senda/adapter-schema';
import { adaptersItem, draftsItem } from '../state';
import { validateAdapter } from '../../core/adapters/validate';
import { describeChanges } from '../../core/adapters/diff';

export async function summaries() {
  return Object.values(await adaptersItem.getValue()).map(({ adapter, status }) => ({
    id: adapter.id,
    name: adapter.name,
    version: adapter.version,
    source: adapter.source,
    mode: adapter.mode,
    sites: adapter.sites,
    status,
    tools: Object.entries(adapter.tools).map(([name, tool]) => ({ name, ...tool })),
  }));
}
export async function saveDraft(recipe: unknown) {
  const parsed = validateAdapter(recipe);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  const adapter = { ...parsed.adapter, source: 'local' as const };
  const installed = (await adaptersItem.getValue())[adapter.id]?.adapter;
  const drafts = await draftsItem.getValue();
  drafts[adapter.id] = { adapter, updated_at: new Date().toISOString(), pending: false };
  await draftsItem.setValue(drafts);
  return { ok: true as const, changes: describeChanges(installed, adapter) };
}
export async function draft(p: { recipe: unknown }) {
  return saveDraft(p.recipe);
}
export async function submitDraft(p: { id: string }) {
  const drafts = await draftsItem.getValue();
  const item = drafts[p.id];
  if (item) {
    drafts[p.id] = { ...item, pending: true };
    await draftsItem.setValue(drafts);
  }
  return { status: 'pending', message: `Open the Senda side panel to approve ${item?.adapter.name ?? p.id}.` };
}
export async function submit(p: { id: string }) {
  return submitDraft(p);
}
export async function approveDraft(id: string) {
  const drafts = await draftsItem.getValue();
  const item = drafts[id];
  if (!item) return false;
  const parsed = validateAdapter(item.adapter);
  if (!parsed.ok) return false;
  const installed = await adaptersItem.getValue();
  installed[id] = {
    adapter: { ...parsed.adapter, source: 'local' },
    status: 'active',
    installed_at: new Date().toISOString(),
  };
  delete drafts[id];
  await Promise.all([adaptersItem.setValue(installed), draftsItem.setValue(drafts)]);
  return true;
}
export async function rejectDraft(id: string) {
  const drafts = await draftsItem.getValue();
  delete drafts[id];
  await draftsItem.setValue(drafts);
}
export async function setStatus(id: string, status: 'active' | 'paused') {
  const installed = await adaptersItem.getValue();
  if (installed[id]) installed[id] = { ...installed[id]!, status };
  await adaptersItem.setValue(installed);
  return { ok: true };
}
export async function removeAdapter(id: string) {
  const installed = await adaptersItem.getValue();
  delete installed[id];
  await adaptersItem.setValue(installed);
  return { ok: true };
}
export async function remove(p: { id: string }) {
  return removeAdapter(p.id);
}
export async function list() {
  const drafts = await draftsItem.getValue();
  return {
    installed: await summaries(),
    drafts: Object.entries(drafts).map(([id, item]) => ({
      id,
      version: item.adapter.version,
      pending: item.pending,
      updated_at: item.updated_at,
    })),
  };
}
export async function getAdapter(id: string, useDraft = false): Promise<Adapter | undefined> {
  const installed = await adaptersItem.getValue();
  if (useDraft) return (await draftsItem.getValue())[id]?.adapter ?? installed[id]?.adapter;
  return installed[id]?.status === 'active' ? installed[id].adapter : undefined;
}
