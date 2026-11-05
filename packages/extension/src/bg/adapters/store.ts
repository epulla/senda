import type { Adapter } from '@senda/adapter-schema';
import { ErrorCode } from '@senda/protocol';
import { CommandError } from '../commands/shared';
import { adaptersItem, draftsItem, settingsItem } from '../state';
import { validateAdapter } from '../../core/adapters/validate';
import { describeChanges } from '../../core/adapters/diff';
import { fetchRecipe } from './fetch';

export async function installRecipe(p: { recipe?: unknown; url?: string }) {
  if ((p.recipe === undefined) === (p.url === undefined))
    throw new CommandError(ErrorCode.INVALID_PARAMS, 'Provide exactly one recipe or URL.');
  const recipe = p.url ? await fetchRecipe(p.url) : p.recipe;
  const blockedDomains = (await settingsItem.getValue()).blockedDomains;
  const parsed = validateAdapter(recipe, { blockedDomains });
  if (!parsed.ok) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter validation failed.', parsed.errors);
  const drafts = await draftsItem.getValue();
  drafts[parsed.adapter.id] = { adapter: { ...parsed.adapter, source: 'community' }, updated_at: new Date().toISOString(), pending: true, source: 'community' };
  await draftsItem.setValue(drafts);
  return { status: 'pending', id: parsed.adapter.id, message: `Open the Senda side panel to approve ${parsed.adapter.name}.` };
}

export async function summaries() {
  return Object.values(await adaptersItem.getValue()).map(({ adapter, status }) => ({
    id: adapter.id,
    name: adapter.name,
    version: adapter.version,
    source: adapter.source,
    mode: adapter.mode,
    sites: adapter.sites,
    status,
    tools: Object.entries(adapter.tools).map(([name, { description, effect, params }]) => ({
      name,
      description,
      effect,
      params,
    })),
  }));
}
export async function saveTestResult(id: string, text: string) {
  const drafts = await draftsItem.getValue();
  if (!drafts[id]) return;
  drafts[id] = { ...drafts[id], test: text };
  await draftsItem.setValue(drafts);
}
export async function saveDraft(recipe: unknown) {
  const parsed = validateAdapter(recipe, { blockedDomains: (await settingsItem.getValue()).blockedDomains });
  if (!parsed.ok) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter validation failed.', parsed.errors);
  const adapter = { ...parsed.adapter, source: 'local' as const };
  const installed = (await adaptersItem.getValue())[adapter.id]?.adapter;
  const drafts = await draftsItem.getValue();
  drafts[adapter.id] = { adapter, updated_at: new Date().toISOString(), pending: false };
  await draftsItem.setValue(drafts);
  return { ok: true as const, changes: describeChanges(installed, adapter) };
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
export async function approveDraft(id: string) {
  const drafts = await draftsItem.getValue();
  const item = drafts[id];
  if (!item) return false;
  const parsed = validateAdapter(item.adapter, { blockedDomains: (await settingsItem.getValue()).blockedDomains });
  if (!parsed.ok) return false;
  const installed = await adaptersItem.getValue();
  const source = item.source ?? item.adapter.source ?? 'local';
  installed[id] = {
    adapter: { ...parsed.adapter, source },
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
  const drafts = await draftsItem.getValue();
  if (!installed[id] && !drafts[id]) throw new CommandError(ErrorCode.ADAPTER_NOT_FOUND, 'Adapter not found.');
  delete installed[id];
  delete drafts[id];
  await adaptersItem.setValue(installed);
  await draftsItem.setValue(drafts);
  return { ok: true };
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
