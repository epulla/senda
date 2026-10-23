import { activityItem, adaptersItem, approvalsItem, draftsItem, panicItem, settingsItem } from '@/src/bg/state';
import { answerApproval, requestPanic } from '@/src/bg/approvals';
import { resumeAfterPanic } from '@/src/bg/connection';
import { useState } from 'react';
import { approveDraft, installTemplate, rejectDraft } from '@/src/bg/adapters/store';
import { bundledTemplates } from '@/src/bg/adapters/templates';
import { describeChanges } from '@/src/core/adapters/diff';
import { permissionIncrease } from '@/src/core/adapters/permissions';
import { ModeBadge, modeLabel, siteNames } from '@/src/ui/adapterLabels';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

const askOptions = [
  ['destructive', 'Sending, paying or deleting things, or sharing data with a new site (recommended)'],
  ['changes', 'Any click or typing'],
  ['everything', 'Everything, including opening and reading pages'],
  ['never', 'Never ask (not recommended)'],
] as const;
const neverWarning =
  'Your AI will send, delete, pay, change things and share data with other sites without asking you. Senda only asks again after your AI reads pages or messages that could contain hidden instructions.';

function SiteList({
  title,
  hint,
  sites,
  onChange,
}: {
  title: string;
  hint: string;
  sites: string[];
  onChange: (sites: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted">{hint}</p>
      {sites.map((site) => (
        <p key={site} className="flex items-center justify-between gap-2">
          <span>{site}</span>
          <button
            type="button"
            onClick={() => onChange(sites.filter((s) => s !== site))}
            className="btn btn-sm"
          >
            Remove
          </button>
        </p>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem('site') as HTMLInputElement;
          const site = input.value
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .toLowerCase();
          if (site && !sites.includes(site)) onChange([...sites, site]);
          input.value = '';
        }}
        className="flex gap-2"
      >
        <input
          name="site"
          aria-label={`Add to ${title.toLowerCase()}`}
          placeholder="example.com"
          className="!mt-0 min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-sm">
          Add
        </button>
      </form>
    </div>
  );
}

function AddSite() {
  const templates = Object.values(bundledTemplates());
  const [choice, setChoice] = useState(templates[0]?.id ?? 'import');
  const [error, setError] = useState('');
  const example = templates.find((t) => t.id === choice)?.template?.site;
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? '';
        const site = value('site');
        let label = value('label');
        try {
          if (!label && site) label = new URL(site).hostname.split('.')[0]!.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
          const source =
            choice !== 'import'
              ? { template: choice }
              : /^https?:\/\//.test(value('import'))
                ? { url: value('import') }
                : { recipe: JSON.parse(value('import')) };
          await installTemplate({ ...source, site, label });
          setError('');
          form.reset();
        } catch (e) {
          const data = (e as { data?: unknown }).data;
          setError([(e as Error).message, ...(Array.isArray(data) ? data : [])].join(' '));
        }
      }}
    >
      <label className="block">
        <span className="font-medium">Kind of site</span>
        <select
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="import">Import an exported file, link or recipe</option>
        </select>
      </label>
      {choice === 'import' && (
        <label className="block">
          <span className="font-medium">Exported file</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              const box = event.currentTarget.form?.elements.namedItem('import') as HTMLTextAreaElement | null;
              if (file && box) box.value = await file.text();
            }}
          />
        </label>
      )}
      {choice === 'import' && (
        <label className="block">
          <span className="font-medium">Or paste the recipe or its link</span>
          <textarea
            name="import"
            required
            rows={3}
            placeholder="https://… or paste the recipe"
            className="font-mono text-xs"
          />
        </label>
      )}
      <label className="block">
        <span className="font-medium">Site address{choice === 'import' && ' (only if the recipe asks for one)'}</span>
        {example && <span className="block text-muted">{example.description}</span>}
        <input
          name="site"
          required={choice !== 'import'}
          type="url"
          placeholder={example?.example ?? 'https://example.com'}
        />
      </label>
      <label className="block">
        <span className="font-medium">Short name (optional)</span>
        <span className="block text-muted">Lowercase letters, numbers or _. Your AI sees it in tool names.</span>
        <input
          name="label"
          pattern="[a-z0-9_]{1,20}"
          placeholder="school"
        />
      </label>
      {error && (
        <p role="alert" className="text-error-text">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Add site
      </button>
      <p className="text-muted">You'll review it above before it can be used.</p>
    </form>
  );
}

export default function App() {
  const [installed] = useItem(adaptersItem);
  const [drafts] = useItem(draftsItem);
  const [approvals] = useItem(approvalsItem);
  const [settings, setSettings] = useItem(settingsItem);
  const [activity] = useItem(activityItem);
  const [panic] = useItem(panicItem);
  const waiting = Object.values(approvals).filter((item) => !item.answer);
  const pending = Object.values(drafts).filter((draft) => draft.pending);
  const unsent = Object.values(drafts).filter((draft) => !draft.pending);
  const adapters = Object.values(installed);

  return (
    <main className="space-y-5 p-4 text-sm leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h1 className="text-lg font-bold tracking-tight text-primary-text">Senda</h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {panic === 0 && (
            <button type="button" onClick={() => void requestPanic()} className="btn btn-danger">
              Stop everything
            </button>
          )}
        </div>
      </div>

      {panic > 0 && (
        <section className="card card-danger space-y-2">
          <p className="font-semibold text-error-text">
            Senda is stopped. Your AI can't use the browser, its tabs were closed and all adapters are paused.
          </p>
          <button
            type="button"
            onClick={() => void resumeAfterPanic()}
            className="btn"
          >
            Reconnect
          </button>
        </section>
      )}

      {settings.askBefore === 'never' && (
        <section role="alert" className="card card-danger space-y-2">
          <p className="font-semibold text-error-text">Senda won't ask before your AI acts.</p>
          <button
            type="button"
            onClick={() => void setSettings({ ...settings, askBefore: 'destructive' })}
            className="btn"
          >
            Turn off
          </button>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Your AI is waiting for you</h2>
          {waiting.map((card) => (
            <article key={card.id} className="card card-warn space-y-2">
              <p className="font-medium">{card.summary}</p>
              {card.url && <p className="break-all text-muted">{card.url}</p>}
              {card.details && card.details.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {card.details.map(([name, value]) => (
                    <div key={name} className="contents">
                      <dt className="text-muted">{name}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {card.source && (
                <p className="text-error-text">
                  Your AI read content from {card.source} before asking. Websites can contain hidden instructions, so
                  check this is something you asked for.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void answerApproval(card.id, 'allow')}
                  className="btn btn-primary"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => void answerApproval(card.id, 'deny')}
                  className="btn"
                >
                  Deny
                </button>
                {card.allowAlways && !card.source && (
                  <button
                    type="button"
                    onClick={() => void answerApproval(card.id, 'always')}
                    className="btn"
                  >
                    Always on {card.host}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Adapters waiting for your approval</h2>
          {pending.map(({ adapter, test, source }) => {
            const previous = installed[adapter.id]?.adapter;
            const more = previous ? permissionIncrease(previous, adapter) : [];
            return (
              <article key={adapter.id} className="card card-warn space-y-2">
                <p>
                  Request to {previous ? 'change' : 'add'} <strong>{adapter.name}</strong> ({modeLabel(adapter)}). It
                  will only work on {siteNames(adapter)}.
                </p>
                {source === 'community' && (
                  <p className="font-medium text-error-text">
                    Not verified: this comes from outside Senda. Only approve it if you trust where it came from, and
                    check the full recipe below.
                  </p>
                )}
                <ul className="list-disc space-y-1 pl-5">
                  {describeChanges(previous, adapter).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {more.length > 0 && (
                  <p className="font-medium text-error-text">This asks for more access: {more.join(' ')}</p>
                )}
                <details>
                  <summary className="text-muted">
                    {test ? 'Last test result' : 'Not tested yet'}
                  </summary>
                  {test && <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-base-200 p-2 text-xs">{test}</pre>}
                </details>
                <details>
                  <summary className="text-muted">Full recipe</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-base-200 p-2 text-xs">
                    {JSON.stringify(adapter, null, 2)}
                  </pre>
                </details>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveDraft(adapter.id)}
                    className="btn btn-primary"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectDraft(adapter.id)}
                    className="btn"
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Installed adapters</h2>
        {adapters.length === 0 && <p className="text-muted">No adapters yet. Ask your AI to make one for a site.</p>}
        {adapters.length > 0 && (
          <ul className="card divide-y divide-line overflow-hidden !p-0">
            {adapters.map(({ adapter, status }) => (
              <li key={adapter.id}>
                <button
                  type="button"
                  onClick={() => void browser.tabs.create({ url: browser.runtime.getURL(`/adapter.html?id=${adapter.id}`) })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-base-200"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{adapter.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {status === 'paused' ? 'Paused · ' : ''}
                      {siteNames(adapter)}
                    </span>
                  </span>
                  <ModeBadge mode={adapter.mode} />
                  <span aria-hidden className="text-muted">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <details>
          <summary className="font-semibold">Add a site or import an adapter</summary>
          <div className="mt-3">
            <AddSite />
          </div>
        </details>
      </section>

      {unsent.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Drafts your AI is still working on</h2>
          {unsent.map(({ adapter }) => (
            <p key={adapter.id} className="flex items-center justify-between gap-2">
              <span>
                {adapter.name} ({siteNames(adapter)})
              </span>
              <button
                type="button"
                onClick={() => rejectDraft(adapter.id)}
                className="btn btn-sm"
              >
                Delete
              </button>
            </p>
          ))}
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Settings</h2>
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">Ask me before</legend>
          {askOptions.map(([value, label]) => (
            <label key={value} className="flex items-start gap-2">
              <input
                type="radio"
                name="askBefore"
                checked={settings.askBefore === value}
                onChange={() => {
                  if (value === 'never' && !confirm(`${neverWarning}\n\nStop asking?`)) return;
                  void setSettings({ ...settings, askBefore: value });
                }}
                className="mt-0.5"
              />
              <span>
                {label}
                {value === 'never' && <span className="block text-error-text">{neverWarning}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <SiteList
          title="Trusted sites"
          hint="Your AI can open these sites with data in the address without asking."
          sites={settings.allowedDomains}
          onChange={(allowedDomains) => void setSettings({ ...settings, allowedDomains })}
        />
        <SiteList
          title="Blocked sites"
          hint="Your AI can never open these sites, and no adapter can use them."
          sites={settings.blockedDomains}
          onChange={(blockedDomains) => void setSettings({ ...settings, blockedDomains })}
        />
        {settings.alwaysSites.length > 0 && (
          <SiteList
            title="Always allowed"
            hint="You chose “Always” for these sites. Remove one to be asked again."
            sites={settings.alwaysSites}
            onChange={(alwaysSites) => void setSettings({ ...settings, alwaysSites })}
          />
        )}
      </section>

      <section className="card">
        <details>
          <summary className="font-semibold">Activity ({activity.length})</summary>
          <ul className="mt-2 space-y-1">
            {activity
              .slice(-50)
              .reverse()
              .map((row) => (
                <li key={`${row.at}${row.text}`} className={row.kind === 'injection' ? 'text-error-text' : undefined}>
                  <span className="text-muted">{new Date(row.at).toLocaleTimeString()}</span> {row.text}
                </li>
              ))}
          </ul>
        </details>
      </section>
    </main>
  );
}
