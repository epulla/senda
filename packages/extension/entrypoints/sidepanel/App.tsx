import { activityItem, adaptersItem, approvalsItem, draftsItem, panicItem, settingsItem } from '@/src/bg/state';
import { answerApproval, requestPanic } from '@/src/bg/approvals';
import { resumeAfterPanic } from '@/src/bg/connection';
import { useRef, useState } from 'react';
import { approveDraft, installRecipe, rejectDraft } from '@/src/bg/adapters/store';
import { fetchRecipe } from '@/src/bg/adapters/fetch';
import { describeChanges } from '@/src/core/adapters/diff';
import { permissionIncrease } from '@/src/core/adapters/permissions';
import { ModeBadge, siteNames } from '@/src/ui/adapterLabels';
import { useText } from '@/src/ui/i18n';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';
import { Info, Settings } from '@/src/ui/Settings';

const errorText = (e: unknown) => {
  const data = (e as { data?: unknown }).data;
  return [(e as Error).message, ...(Array.isArray(data) ? data : [])].join(' ');
};
type Source = { recipe: unknown } | { url: string };

function AddPanel({ title, source, onClose }: { title: string; source: Source; onClose: () => void }) {
  const text = useText();
  const [error, setError] = useState('');
  return (
    <form
      className="card space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await installRecipe(source);
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

function CardHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const text = useText();
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold">{title}</h3>
      <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label={text.common.close}>
        ✕
      </button>
    </div>
  );
}

function ChooseHow({ onPick, onClose }: { onPick: (how: 'ai' | 'import') => void; onClose: () => void }) {
  const t = useText().sidepanel;
  const choices = [
    ['ai', t.askAi, t.askAiHint],
    ['import', t.importLink, t.sharedHint],
  ] as const;
  return (
    <section className="card space-y-2">
      <CardHeader title={t.howAdd} onClose={onClose} />
      {choices.map(([how, title, hint]) => (
        <button key={how} type="button" onClick={() => onPick(how)} className="card block w-full !p-3 text-left hover:bg-base-200">
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-muted">{hint}</span>
        </button>
      ))}
    </section>
  );
}

function AskAi({ onClose }: { onClose: () => void }) {
  const text = useText();
  const t = text.sidepanel;
  const [copied, setCopied] = useState(false);
  return (
    <section className="card space-y-3">
      <CardHeader title={t.askAi} onClose={onClose} />
      <p className="text-muted">{t.askAiIntro}</p>
      <p className="card !p-2 font-mono text-xs">{t.askAiPrompt}</p>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(t.askAiPrompt).then(() => setCopied(true))}
        className="btn btn-primary"
      >
        {copied ? text.adapter.copied : text.adapter.copy}
      </button>
      <p className="text-xs text-muted">{t.askAiHint}</p>
    </section>
  );
}

function ImportAdapter({ onClose }: { onClose: () => void }) {
  const text = useText();
  const t = text.sidepanel;
  const [recipe, setRecipe] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  if (recipe)
    return (
      <AddPanel title={t.importNamed(recipe.name ?? t.adapter)} source={{ recipe }} onClose={onClose} />
    );
  return (
    <form
      className="card space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const text = (event.currentTarget.elements.namedItem('import') as HTMLTextAreaElement).value.trim();
        try {
          setRecipe(/^https?:\/\//.test(text) ? await fetchRecipe(text) : JSON.parse(text));
        } catch (e) {
          setError(e instanceof SyntaxError ? t.notRecipe : errorText(e));
        }
      }}
    >
      <CardHeader title={t.importLink} onClose={onClose} />
      <button type="button" onClick={() => fileInput.current?.click()} className="btn w-full">
        {t.chooseFile}
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
            setRecipe(JSON.parse(await file.text()));
          } catch {
            setError(t.notAdapter);
          }
        }}
      />
      <p className="text-muted">{t.orPaste}</p>
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
  const [adding, setAdding] = useState<null | 'choose' | 'ai' | 'import'>(null);
  const waiting = Object.values(approvals).filter((item) => !item.answer);
  const pending = Object.values(drafts).filter((draft) => draft.pending);
  const unsent = Object.values(drafts).filter((draft) => !draft.pending);
  const adapters = Object.values(installed);

  return (
    <main className="space-y-5 p-4 text-sm leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-primary-text"><img src="/icon/48.png" alt="" className="size-6" />Senda</h1>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          {panic === 0 && (
            <button type="button" onClick={() => void requestPanic()} className="btn btn-danger-text">
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
        <div className="relative flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {t.installed} <Info text={t.installedHint} />
          </h2>
          <button type="button" onClick={() => setAdding('choose')} className="btn btn-sm">
            {t.addShortcut}
          </button>
        </div>
        {adding === 'choose' && <ChooseHow onPick={setAdding} onClose={() => setAdding(null)} />}
        {adding === 'ai' && <AskAi onClose={() => setAdding(null)} />}
        {adding === 'import' && <ImportAdapter onClose={() => setAdding(null)} />}
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

      <details className="card">
        <summary className="cursor-pointer font-semibold">{t.settings}</summary>
        <div className="mt-3">
          <Settings />
        </div>
      </details>

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
