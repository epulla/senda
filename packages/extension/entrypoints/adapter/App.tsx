import { useState } from 'react';
import { adaptersItem } from '@/src/bg/state';
import { removeAdapter, resetToTemplate, setStatus } from '@/src/bg/adapters/store';
import { bundledTemplates } from '@/src/bg/adapters/templates';
import { exportRecipe } from '@/src/core/adapters/export';
import { localize, ModeBadge, siteNames } from '@/src/ui/adapterLabels';
import { lang, useText } from '@/src/ui/i18n';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

const id = new URLSearchParams(location.search).get('id') ?? '';

export default function App() {
  const text = useText();
  const t = text.adapter;
  const [installed, , loaded] = useItem(adaptersItem);
  const [copied, setCopied] = useState(false);
  const entry = installed[id];

  if (!entry)
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6 text-sm">
        <p>{loaded ? t.missing : t.loading}</p>
      </main>
    );

  const { adapter, status, from, override } = entry;
  const fixed = Object.keys(override ?? {});
  const l = localize(adapter, lang());
  const recipe = JSON.stringify(adapter, null, 2);

  const download = () => {
    const template = from ? (from.recipe ?? bundledTemplates()[from.template]) : undefined;
    const data = exportRecipe(entry, template) as { id: string };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6 text-sm leading-relaxed">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{adapter.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted">
            <ModeBadge mode={adapter.mode} />
            {status === 'paused' && <span className="font-medium">{text.common.paused}</span>}
            <span>{t.worksOn(siteNames(adapter))}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <section className="card space-y-3">
        <p>{l.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">{t.version}</dt>
          <dd>{adapter.version}</dd>
          <dt className="text-muted">{t.origin}</dt>
          <dd>{text.labels.source[adapter.source]}</dd>
          {from && (
            <>
              <dt className="text-muted">{t.basedOn}</dt>
              <dd>
                {t.templateFor(bundledTemplates()[from.template]?.name ?? from.template, from.site)}
              </dd>
            </>
          )}
          {fixed.length > 0 && (
            <>
              <dt className="text-muted">{t.fixed}</dt>
              <dd>{fixed.join(', ')}</dd>
            </>
          )}
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setStatus(adapter.id, status === 'active' ? 'paused' : 'active')}
            className="btn"
          >
            {status === 'active' ? t.pause : t.resume}
          </button>
          {fixed.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(t.confirmReset(adapter.name)))
                  void resetToTemplate(adapter.id);
              }}
              className="btn"
            >
              {t.reset}
            </button>
          )}
          <button type="button" onClick={download} className="btn">
            {t.export}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm(t.confirmRemove(adapter.name))) return;
              await removeAdapter(adapter.id);
              window.close();
            }}
            className="btn btn-danger-text"
          >
            {text.common.remove}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t.tools(Object.keys(adapter.tools).length)}
        </h2>
        {Object.entries(adapter.tools).map(([name, tool]) => {
          const inputs = Object.entries(tool.params);
          return (
            <article key={name} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{l.tool(name)}</p>
                <ModeBadge mode={tool.effect} />
              </div>
              <p className="text-xs text-muted">
                {t.calls} <code>{name}</code>
                {fixed.includes(name) && t.fixedTool}
              </p>
              {inputs.length > 0 && (
                <div>
                  <p className="text-muted">{t.needs}</p>
                  <ul className="list-disc pl-5">
                    {inputs.map(([param, info]) => (
                      <li key={param}>
                        <strong>{param}</strong>
                        {info.description && `: ${info.description}`}
                        {!info.required && <span className="text-muted">{t.optional}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tool.effect === 'write' && (
                <p>
                  <span className="text-muted">{t.asked}</span>
                  {tool.confirm?.replace(/\{\{\s*(?:args|vars)\.(\w+)\s*\}\}/g, '[$1]') ??
                    text.approval.useTool(name, adapter.name)}
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="card">
        <details>
          <summary className="font-semibold">{text.common.fullRecipe}</summary>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(recipe);
                setCopied(true);
              }}
              className="btn btn-sm"
            >
              {copied ? t.copied : t.copy}
            </button>
            <pre className="max-h-[32rem] overflow-auto rounded-lg bg-base-200 p-3 text-xs">{recipe}</pre>
          </div>
        </details>
      </section>
    </main>
  );
}
