import type { Adapter } from '@senda/adapter-schema';
import { ErrorCode } from '@senda/protocol';
import { CommandError } from '../commands/shared';
import { adaptersItem, draftsItem, settingsItem } from '../state';
import { validateAdapter } from '../../core/adapters/validate';
import { describeChanges } from '../../core/adapters/diff';
import { materialize, applyOverride, computeOverride } from '../../core/adapters/materialize';
import { bundledTemplates, fetchTemplate } from './templates';
import { permissionIncrease } from '../../core/adapters/permissions';

export async function installTemplate(p: { template?: string; recipe?: unknown; url?: string; site?: string; label?: string }) {
  if ([p.template, p.recipe, p.url].filter((x) => x !== undefined).length !== 1)
    throw new CommandError(ErrorCode.INVALID_PARAMS, 'Provide exactly one template, recipe, or URL.');
  let recipe: unknown = p.recipe, source: 'official' | 'community' = 'community', templateId: string;
  if (p.template) { recipe = bundledTemplates()[p.template]; source = 'official'; templateId = p.template; }
  else if (p.url) { recipe = await fetchTemplate(p.url); templateId = (recipe as any)?.id; }
  else templateId = (recipe as any)?.id;
  const blockedDomains = (await settingsItem.getValue()).blockedDomains;
  const parsed = (recipe as any)?.template
    ? materialize(recipe, p.site ?? '', p.label ?? '', { blockedDomains })
    : validateAdapter(recipe, { blockedDomains });
  if (!parsed.ok) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter validation failed.', parsed.errors);
  const from = (recipe as any)?.template ? { template: templateId!, version: (recipe as any)?.version ?? '', site: p.site!, label: p.label!, source, ...(source === 'community' ? { recipe } : {}) } : undefined;
  const drafts = await draftsItem.getValue();
  drafts[parsed.adapter.id] = { adapter: { ...parsed.adapter, source }, updated_at: new Date().toISOString(), pending: true, source, ...(from ? { from } : {}) };
  await draftsItem.setValue(drafts);
  return { status: 'pending', id: parsed.adapter.id, message: `Open the Senda side panel to approve ${parsed.adapter.name}.` };
}

function templateFor(from: NonNullable<Awaited<ReturnType<typeof adaptersItem.getValue>>[string]['from']>) {
  return from.recipe ?? bundledTemplates()[from.template];
}
export async function materializeFrom(from: NonNullable<Awaited<ReturnType<typeof adaptersItem.getValue>>[string]['from']>) {
  const result = materialize(templateFor(from), from.site, from.label, { blockedDomains: (await settingsItem.getValue()).blockedDomains });
  return result.ok ? { ...result, adapter: { ...result.adapter, source: from.source } } : result;
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
  const prior = installed[id];
  let from = item.from, override: Record<string, Adapter['tools'][string]> | undefined;
  let source = item.source ?? item.adapter.source ?? 'local';
  if (!from && prior?.from) {
    const base = await materializeFrom(prior.from);
    const diff = base.ok ? computeOverride(base.adapter, { ...parsed.adapter, source: prior.from.source }) : null;
    if (diff) { from = prior.from; override = diff.override as typeof override; source = prior.from.source; }
    else source = 'local';
  } else if (from && prior?.from && prior.override) {
    override = prior.override;
  }
  installed[id] = {
    adapter: { ...parsed.adapter, source },
    status: 'active',
    installed_at: new Date().toISOString(),
    ...(from ? { from } : {}), ...(override ? { override } : {}),
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
  const stored = await adaptersItem.getValue();
  return {
    templates: Object.values(bundledTemplates()).map((t: any) => ({ id: t.id, name: t.name, version: t.version, description: t.description, site: t.template?.site })),
    installed: (await summaries()).map((item) => ({ ...item, ...(stored[item.id]?.from ? { template: stored[item.id]!.from!.template, site: stored[item.id]!.from!.site, overridden_tools: Object.keys(stored[item.id]!.override ?? {}) } : {}) })),
    drafts: Object.entries(drafts).map(([id, item]) => ({
      id,
      version: item.adapter.version,
      pending: item.pending,
      updated_at: item.updated_at,
    })),
  };
}
export async function resetToTemplate(id: string) {
  const installed = await adaptersItem.getValue(), item = installed[id];
  if (!item?.from) throw new CommandError(ErrorCode.ADAPTER_NOT_FOUND, 'Template instance not found.');
  const result = await materializeFrom(item.from);
  if (!result.ok) throw new CommandError(ErrorCode.ADAPTER_BROKEN, 'Adapter validation failed.', result.errors);
  installed[id] = { ...item, adapter: { ...result.adapter, source: item.from.source }, override: undefined, status: 'active' };
  await adaptersItem.setValue(installed);
  return { ok: true };
}
export async function syncBundledTemplates() {
  const installed = await adaptersItem.getValue(), drafts = await draftsItem.getValue(), templates = bundledTemplates();
  for (const [id, item] of Object.entries(installed)) {
    const from = item.from;
    if (!from || from.source !== 'official' || !templates[from.template] || templates[from.template].version === from.version) continue;
    const nextFrom = { ...from, version: templates[from.template].version };
    const base = await materializeFrom(nextFrom);
    if (!base.ok) continue;
    const next = applyOverride(base.adapter, item.override);
    if (permissionIncrease(item.adapter, next).length) drafts[id] = { adapter: { ...next, source: from.source }, updated_at: new Date().toISOString(), pending: true, source: from.source, from: nextFrom };
    else installed[id] = { ...item, adapter: { ...next, source: from.source }, from: nextFrom };
  }
  await Promise.all([adaptersItem.setValue(installed), draftsItem.setValue(drafts)]);
}
export async function getAdapter(id: string, useDraft = false): Promise<Adapter | undefined> {
  const installed = await adaptersItem.getValue();
  if (useDraft) return (await draftsItem.getValue())[id]?.adapter ?? installed[id]?.adapter;
  return installed[id]?.status === 'active' ? installed[id].adapter : undefined;
}
