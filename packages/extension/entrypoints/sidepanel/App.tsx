import type { Adapter } from '@senda/adapter-schema';
import { activityItem, adaptersItem, approvalsItem, draftsItem, panicItem, settingsItem } from '@/src/bg/state';
import { answerApproval, requestPanic } from '@/src/bg/approvals';
import { resumeAfterPanic } from '@/src/bg/connection';
import { approveDraft, rejectDraft, removeAdapter, setStatus } from '@/src/bg/adapters/store';
import { describeChanges } from '@/src/core/adapters/diff';
import { permissionIncrease } from '@/src/core/adapters/permissions';
import { useItem } from '@/src/ui/useItem';

const siteNames = (adapter: Adapter) =>
  adapter.sites.map((site) => site.replace(/^https?:\/\//, '').replace(/\/\*$/, '')).join(', ');
const modeLabel = (adapter: Adapter) => (adapter.mode === 'read' ? 'read only' : 'can make changes');
const askOptions = [
  ['destructive', 'Sending, paying or deleting things, or sharing data with a new site (recommended)'],
  ['changes', 'Any click or typing'],
  ['everything', 'Everything, including opening and reading pages'],
] as const;

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
      <h3 className="font-medium">{title}</h3>
      <p className="text-gray-600">{hint}</p>
      {sites.map((site) => (
        <p key={site} className="flex items-center justify-between gap-2">
          <span>{site}</span>
          <button
            type="button"
            onClick={() => onChange(sites.filter((s) => s !== site))}
            className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100"
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
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-0.5"
        />
        <button type="submit" className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100">
          Add
        </button>
      </form>
    </div>
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
    <main className="space-y-6 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Senda</h1>
        {panic === 0 && (
          <button
            type="button"
            onClick={() => void requestPanic()}
            className="rounded bg-red-700 px-3 py-1 font-medium text-white hover:bg-red-800"
          >
            Stop everything
          </button>
        )}
      </div>

      {panic > 0 && (
        <section className="space-y-2 rounded border border-red-300 bg-red-50 p-3">
          <p className="font-medium text-red-800">
            Senda is stopped. Your AI can't use the browser, its tabs were closed and all adapters are paused.
          </p>
          <button
            type="button"
            onClick={() => void resumeAfterPanic()}
            className="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100"
          >
            Reconnect
          </button>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Your AI is waiting for you</h2>
          {waiting.map((card) => (
            <article key={card.id} className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3">
              <p className="font-medium">{card.summary}</p>
              {card.url && <p className="break-all text-gray-600">{card.url}</p>}
              {card.details && card.details.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {card.details.map(([name, value]) => (
                    <div key={name} className="contents">
                      <dt className="text-gray-600">{name}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {card.source && (
                <p className="text-red-700">
                  Your AI read content from {card.source} before asking. Websites can contain hidden instructions, so
                  check this is something you asked for.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void answerApproval(card.id, 'allow')}
                  className="rounded bg-blue-700 px-3 py-1 font-medium text-white hover:bg-blue-800"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => void answerApproval(card.id, 'deny')}
                  className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
                >
                  Deny
                </button>
                {card.allowAlways && !card.source && (
                  <button
                    type="button"
                    onClick={() => void answerApproval(card.id, 'always')}
                    className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
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
          <h2 className="font-semibold">Adapters waiting for your approval</h2>
          {pending.map(({ adapter, test }) => {
            const previous = installed[adapter.id]?.adapter;
            const more = previous ? permissionIncrease(previous, adapter) : [];
            return (
              <article key={adapter.id} className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3">
                <p>
                  Your AI wants to {previous ? 'change' : 'add'} <strong>{adapter.name}</strong> ({modeLabel(adapter)}).
                  It will only work on {siteNames(adapter)}.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {describeChanges(previous, adapter).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {more.length > 0 && (
                  <p className="font-medium text-red-700">This asks for more access: {more.join(' ')}</p>
                )}
                <details>
                  <summary className="cursor-pointer text-gray-700">
                    {test ? 'Last test result' : 'Not tested yet'}
                  </summary>
                  {test && <pre className="mt-1 max-h-48 overflow-auto rounded bg-white p-2 text-xs">{test}</pre>}
                </details>
                <details>
                  <summary className="cursor-pointer text-gray-700">Full recipe</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                    {JSON.stringify(adapter, null, 2)}
                  </pre>
                </details>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveDraft(adapter.id)}
                    className="rounded bg-blue-700 px-3 py-1 font-medium text-white hover:bg-blue-800"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectDraft(adapter.id)}
                    className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
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
        <h2 className="font-semibold">Installed adapters</h2>
        {adapters.length === 0 && <p className="text-gray-600">No adapters yet. Ask your AI to make one for a site.</p>}
        {adapters.map(({ adapter, status }) => (
          <article key={adapter.id} className="space-y-1 rounded border border-gray-200 p-3">
            <p>
              <strong>{adapter.name}</strong> · {modeLabel(adapter)} · {siteNames(adapter)}
              {status === 'paused' && <span className="ml-1 text-amber-700">(paused)</span>}
            </p>
            <p className="text-gray-600">Can: {Object.keys(adapter.tools).join(', ')}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStatus(adapter.id, status === 'active' ? 'paused' : 'active')}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
              >
                {status === 'active' ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove ${adapter.name}? Your AI will no longer be able to use it.`))
                    void removeAdapter(adapter.id);
                }}
                className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>

      {unsent.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Drafts your AI is still working on</h2>
          {unsent.map(({ adapter }) => (
            <p key={adapter.id} className="flex items-center justify-between gap-2">
              <span>
                {adapter.name} ({siteNames(adapter)})
              </span>
              <button
                type="button"
                onClick={() => rejectDraft(adapter.id)}
                className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100"
              >
                Delete
              </button>
            </p>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Settings</h2>
        <fieldset className="space-y-1">
          <legend className="font-medium">Ask me before</legend>
          {askOptions.map(([value, label]) => (
            <label key={value} className="flex items-start gap-2">
              <input
                type="radio"
                name="askBefore"
                checked={settings.askBefore === value}
                onChange={() => void setSettings({ ...settings, askBefore: value })}
                className="mt-0.5"
              />
              {label}
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

      <section className="space-y-2">
        <details>
          <summary className="cursor-pointer font-semibold">Activity ({activity.length})</summary>
          <ul className="mt-2 space-y-1">
            {activity
              .slice(-50)
              .reverse()
              .map((row) => (
                <li key={`${row.at}${row.text}`} className={row.kind === 'injection' ? 'text-red-700' : undefined}>
                  <span className="text-gray-500">{new Date(row.at).toLocaleTimeString()}</span> {row.text}
                </li>
              ))}
          </ul>
        </details>
      </section>
    </main>
  );
}
