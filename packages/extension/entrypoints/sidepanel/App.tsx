import { activityItem, adaptersItem, approvalsItem, draftsItem, panicItem, settingsItem } from '@/src/bg/state';
import { answerApproval, requestPanic } from '@/src/bg/approvals';
import { resumeAfterPanic } from '@/src/bg/connection';
import { useRef, useState, type ReactNode } from 'react';
import { approveDraft, installTemplate, rejectDraft } from '@/src/bg/adapters/store';
import { bundledTemplates, fetchTemplate } from '@/src/bg/adapters/templates';
import { describeChanges } from '@/src/core/adapters/diff';
import { permissionIncrease } from '@/src/core/adapters/permissions';
import { ModeBadge, siteNames } from '@/src/ui/adapterLabels';
import { useText } from '@/src/ui/i18n';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

const askOptions = ['destructive', 'changes', 'everything', 'never'] as const;

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
  const text = useText();
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
            {text.common.remove}
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
          aria-label={text.sidepanel.addTo(title.toLowerCase())}
          placeholder="example.com"
          className="!mt-0 min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-sm">
          {text.sidepanel.add}
        </button>
      </form>
    </div>
  );
}

const labelFor = (site: string) =>
  new URL(site).hostname.split('.')[0]!.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
const errorText = (e: unknown) => {
  const data = (e as { data?: unknown }).data;
  return [(e as Error).message, ...(Array.isArray(data) ? data : [])].join(' ');
};
type Source = { template: string } | { recipe: unknown } | { url: string };

function SiteFields({ hint, example }: { hint?: string; example?: string }) {
  const t = useText().sidepanel;
  return (
    <>
      <label className="block">
        <span className="font-medium">{t.siteAddress}</span>
        {hint && <span className="block text-muted">{hint}</span>}
        <input name="site" required type="url" placeholder={example ?? 'https://example.com'} />
      </label>
      <details>
        <summary className="text-muted">{t.moreOptions}</summary>
        <label className="mt-2 block">
          <span className="font-medium">{t.shortName}</span>
          <span className="block text-muted">{t.shortNameHint}</span>
          <input name="label" pattern="[a-z0-9_]{1,20}" placeholder={t.shortNameExample} />
        </label>
      </details>
    </>
  );
}

function AddPanel({
  title,
  intro,
  source,
  needsSite,
  hint,
  example,
  onClose,
  children,
}: {
  title: string;
  intro?: string;
  source?: Source;
  needsSite: boolean;
  hint?: string;
  example?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const text = useText();
  const [error, setError] = useState('');
  return (
    <form
      className="card space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? '';
        try {
          let chosen = source;
          if (!chosen) {
            const text = value('import');
            chosen = /^https?:\/\//.test(text) ? { url: text } : { recipe: JSON.parse(text) };
          }
          const site = value('site');
          await installTemplate({ ...chosen, ...(site ? { site, label: value('label') || labelFor(site) } : {}) });
          onClose();
        } catch (e) {
          setError(errorText(e));
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label={text.common.close}>
          ✕
        </button>
      </div>
      {intro && <p className="text-muted">{intro}</p>}
      {children}
      {needsSite && <SiteFields hint={hint} example={example} />}
      {error && (
        <p role="alert" className="card card-danger !p-2 text-error-text">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary">
          {text.sidepanel.continue}
        </button>
        <span className="text-muted">{text.sidepanel.reviewFirst}</span>
      </div>
    </form>
  );
}

function AddSite({ onClose }: { onClose: () => void }) {
  const templates = Object.values(bundledTemplates());
  const [choice, setChoice] = useState(templates[0]?.id ?? '');
  const site = templates.find((t) => t.id === choice)?.template?.site;
  const text = useText();
  return (
    <AddPanel
      title={text.sidepanel.addSite}
      source={{ template: choice }}
      needsSite
      hint={site?.description}
      example={site?.example}
      onClose={onClose}
    >
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 font-medium">{text.sidepanel.siteKind}</legend>
        {templates.map((t) => (
          <label
            key={t.id}
            className={`card cursor-pointer !p-2 ${choice === t.id ? 'outline-2 outline-primary' : ''}`}
          >
            <input type="radio" name="kind" className="sr-only" checked={choice === t.id} onChange={() => setChoice(t.id)} />
            <span className="block font-semibold">{t.name}</span>
            <span className="block text-xs text-muted">{t.description}</span>
          </label>
        ))}
      </fieldset>
    </AddPanel>
  );
}

function ImportAdapter({ initial, onClose }: { initial: any; onClose: () => void }) {
  const text = useText();
  const t = text.sidepanel;
  const [recipe, setRecipe] = useState<any>(initial);
  const [error, setError] = useState('');
  if (recipe)
    return (
      <AddPanel
        title={t.importNamed(recipe.name ?? t.adapter)}
        intro={recipe.template ? t.whichSite : undefined}
        source={{ recipe }}
        needsSite={!!recipe.template}
        hint={recipe.template?.site?.description}
        example={recipe.template?.site?.example}
        onClose={onClose}
      />
    );
  return (
    <form
      className="card space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const text = (event.currentTarget.elements.namedItem('import') as HTMLTextAreaElement).value.trim();
        try {
          setRecipe(/^https?:\/\//.test(text) ? await fetchTemplate(text) : JSON.parse(text));
        } catch (e) {
          setError(e instanceof SyntaxError ? t.notRecipe : errorText(e));
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t.importLink}</h3>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label={text.common.close}>
          ✕
        </button>
      </div>
      <textarea name="import" required rows={4} aria-label={t.linkOrRecipe} placeholder={t.linkPlaceholder} className="font-mono text-xs" />
      {error && (
        <p role="alert" className="card card-danger !p-2 text-error-text">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        {t.continue}
      </button>
    </form>
  );
}

export default function App() {
  const text = useText();
  const t = text.sidepanel;
  const [installed] = useItem(adaptersItem);
  const [drafts] = useItem(draftsItem);
  const [approvals] = useItem(approvalsItem);
  const [settings, setSettings] = useItem(settingsItem);
  const [activity] = useItem(activityItem);
  const [panic] = useItem(panicItem);
  const [adding, setAdding] = useState<null | 'site' | 'paste' | { recipe: unknown }>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const waiting = Object.values(approvals).filter((item) => !item.answer);
  const pending = Object.values(drafts).filter((draft) => draft.pending);
  const unsent = Object.values(drafts).filter((draft) => !draft.pending);
  const adapters = Object.values(installed);

  return (
    <main className="space-y-5 p-4 text-sm leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h1 className="text-lg font-bold tracking-tight text-primary-text">Senda</h1>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          {panic === 0 && (
            <button type="button" onClick={() => void requestPanic()} className="btn btn-danger">
              {text.common.stopEverything}
            </button>
          )}
        </div>
      </div>

      {panic > 0 && (
        <section className="card card-danger space-y-2">
          <p className="font-semibold text-error-text">
            {t.stopped}
          </p>
          <button
            type="button"
            onClick={() => void resumeAfterPanic()}
            className="btn"
          >
            {t.reconnect}
          </button>
        </section>
      )}

      {settings.askBefore === 'never' && (
        <section role="alert" className="card card-danger space-y-2">
          <p className="font-semibold text-error-text">{t.neverAsk}</p>
          <button
            type="button"
            onClick={() => void setSettings({ ...settings, askBefore: 'destructive' })}
            className="btn"
          >
            {text.common.turnOff}
          </button>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.waiting}</h2>
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
                  {t.readFrom(card.source)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void answerApproval(card.id, 'allow')}
                  className="btn btn-primary"
                >
                  {t.allow}
                </button>
                <button
                  type="button"
                  onClick={() => void answerApproval(card.id, 'deny')}
                  className="btn"
                >
                  {t.deny}
                </button>
                {card.allowAlways && !card.source && (
                  <button
                    type="button"
                    onClick={() => void answerApproval(card.id, 'always')}
                    className="btn"
                  >
                    {t.alwaysOn(card.host)}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.adaptersWaiting}</h2>
          {pending.map(({ adapter, test, source }) => {
            const previous = installed[adapter.id]?.adapter;
            const more = previous ? permissionIncrease(previous, adapter, text.permissions) : [];
            return (
              <article key={adapter.id} className="card card-warn space-y-2">
                <p>
                  {previous ? t.requestChange : t.requestAdd} <strong>{adapter.name}</strong> ({text.labels.mode[adapter.mode]}).{' '}
                  {t.onlyOn(siteNames(adapter))}
                </p>
                {source === 'community' && (
                  <p className="font-medium text-error-text">
                    {t.notVerified}
                  </p>
                )}
                <ul className="list-disc space-y-1 pl-5">
                  {describeChanges(previous, adapter, text.diff).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {more.length > 0 && (
                  <p className="font-medium text-error-text">{t.moreAccess} {more.join(' ')}</p>
                )}
                <details>
                  <summary className="text-muted">
                    {test ? t.lastTest : t.notTested}
                  </summary>
                  {test && <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-base-200 p-2 text-xs">{test}</pre>}
                </details>
                <details>
                  <summary className="text-muted">{text.common.fullRecipe}</summary>
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
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectDraft(adapter.id)}
                    className="btn"
                  >
                    {t.reject}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.installed}</h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => setAdding('site')} className="btn btn-sm">
              {t.addSiteButton}
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-sm">
              {t.import}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                try {
                  setAdding({ recipe: JSON.parse(await file.text()) });
                } catch {
                  alert(t.notAdapter);
                }
              }}
            />
          </div>
        </div>
        {adding === 'site' && <AddSite onClose={() => setAdding(null)} />}
        {adding !== null && adding !== 'site' && (
          <ImportAdapter
            key={adding === 'paste' ? 'paste' : 'file'}
            initial={adding === 'paste' ? null : adding.recipe}
            onClose={() => setAdding(null)}
          />
        )}
        {adapters.length === 0 && adding === null && (
          <p className="text-muted">{t.empty}</p>
        )}
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
                      {status === 'paused' ? `${text.common.paused} · ` : ''}
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
        {adding === null && (
          <button type="button" onClick={() => setAdding('paste')} className="text-xs text-primary-text underline">
            {t.paste}
          </button>
        )}
      </section>


      {unsent.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.drafts}</h2>
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
                {t.delete}
              </button>
            </p>
          ))}
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.settings}</h2>
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">{t.askBefore}</legend>
          {askOptions.map((value) => (
            <label key={value} className="flex items-start gap-2">
              <input
                type="radio"
                name="askBefore"
                checked={settings.askBefore === value}
                onChange={() => {
                  if (value === 'never' && !confirm(`${t.neverWarning}\n\n${t.stopAsking}`)) return;
                  void setSettings({ ...settings, askBefore: value });
                }}
                className="mt-0.5"
              />
              <span>
                {t.ask[value]}
                {value === 'never' && <span className="block text-error-text">{t.neverWarning}</span>}
              </span>
            </label>
          ))}
        </fieldset>
        <SiteList
          title={t.trusted}
          hint={t.trustedHint}
          sites={settings.allowedDomains}
          onChange={(allowedDomains) => void setSettings({ ...settings, allowedDomains })}
        />
        <SiteList
          title={t.blocked}
          hint={t.blockedHint}
          sites={settings.blockedDomains}
          onChange={(blockedDomains) => void setSettings({ ...settings, blockedDomains })}
        />
        {settings.alwaysSites.length > 0 && (
          <SiteList
            title={t.always}
            hint={t.alwaysHint}
            sites={settings.alwaysSites}
            onChange={(alwaysSites) => void setSettings({ ...settings, alwaysSites })}
          />
        )}
      </section>

      <section className="card">
        <details>
          <summary className="font-semibold">{t.activity(activity.length)}</summary>
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
