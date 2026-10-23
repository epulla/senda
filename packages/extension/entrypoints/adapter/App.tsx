import { useState } from 'react';
import { adaptersItem } from '@/src/bg/state';
import { removeAdapter, resetToTemplate, setStatus } from '@/src/bg/adapters/store';
import { bundledTemplates } from '@/src/bg/adapters/templates';
import { exportRecipe } from '@/src/core/adapters/export';
import { ModeBadge, siteNames, sourceLabel } from '@/src/ui/adapterLabels';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

const id = new URLSearchParams(location.search).get('id') ?? '';

export default function App() {
  const [installed, , loaded] = useItem(adaptersItem);
  const [copied, setCopied] = useState(false);
  const entry = installed[id];

  if (!entry)
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6 text-sm">
        <p>{loaded ? 'This adapter was removed or doesn’t exist.' : 'Loading…'}</p>
      </main>
    );

  const { adapter, status, from, override } = entry;
  const fixed = Object.keys(override ?? {});
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
            {status === 'paused' && <span className="font-medium">Paused</span>}
            <span>Works on {siteNames(adapter)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <section className="card space-y-3">
        <p>{adapter.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Version</dt>
          <dd>{adapter.version}</dd>
          <dt className="text-muted">Where it came from</dt>
          <dd>{sourceLabel[adapter.source]}</dd>
          {from && (
            <>
              <dt className="text-muted">Based on</dt>
              <dd>
                {bundledTemplates()[from.template]?.name ?? from.template} for {from.site}
              </dd>
            </>
          )}
          {fixed.length > 0 && (
            <>
              <dt className="text-muted">Fixed for this site</dt>
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
            {status === 'active' ? 'Pause' : 'Resume'}
          </button>
          {fixed.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Undo the fixes made for this site and use the standard ${adapter.name} again?`))
                  void resetToTemplate(adapter.id);
              }}
              className="btn"
            >
              Reset to standard
            </button>
          )}
          <button type="button" onClick={download} className="btn">
            Export
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Remove ${adapter.name}? Your AI will no longer be able to use it.`)) return;
              await removeAdapter(adapter.id);
              window.close();
            }}
            className="btn btn-danger-text"
          >
            Remove
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          What your AI can do ({Object.keys(adapter.tools).length})
        </h2>
        {Object.entries(adapter.tools).map(([name, tool]) => {
          const inputs = Object.entries(tool.params);
          return (
            <article key={name} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{tool.description}</p>
                <ModeBadge mode={tool.effect} />
              </div>
              <p className="text-xs text-muted">
                Your AI calls it <code>{name}</code>
                {fixed.includes(name) && ' · fixed for this site'}
              </p>
              {inputs.length > 0 && (
                <div>
                  <p className="text-muted">Needs</p>
                  <ul className="list-disc pl-5">
                    {inputs.map(([param, info]) => (
                      <li key={param}>
                        <strong>{param}</strong>
                        {info.description && `: ${info.description}`}
                        {!info.required && <span className="text-muted"> (optional)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tool.effect === 'write' && (
                <p>
                  <span className="text-muted">You'll be asked: </span>
                  {tool.confirm?.replace(/\{\{\s*(?:args|vars)\.(\w+)\s*\}\}/g, '[$1]') ??
                    `Your AI wants to use ${name} on ${adapter.name}.`}
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section className="card">
        <details>
          <summary className="font-semibold">Full recipe</summary>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(recipe);
                setCopied(true);
              }}
              className="btn btn-sm"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre className="max-h-[32rem] overflow-auto rounded-lg bg-base-200 p-3 text-xs">{recipe}</pre>
          </div>
        </details>
      </section>
    </main>
  );
}
