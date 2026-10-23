import type { Adapter } from '@senda/adapter-schema';
import { adaptersItem, draftsItem } from '@/src/bg/state';
import { approveDraft, rejectDraft, removeAdapter, setStatus } from '@/src/bg/adapters/store';
import { describeChanges } from '@/src/core/adapters/diff';
import { permissionIncrease } from '@/src/core/adapters/permissions';
import { useItem } from '@/src/ui/useItem';

const siteNames = (adapter: Adapter) =>
  adapter.sites.map((site) => site.replace(/^https?:\/\//, '').replace(/\/\*$/, '')).join(', ');
const modeLabel = (adapter: Adapter) => (adapter.mode === 'read' ? 'read only' : 'can make changes');

export default function App() {
  const [installed] = useItem(adaptersItem);
  const [drafts] = useItem(draftsItem);
  const pending = Object.values(drafts).filter((draft) => draft.pending);
  const unsent = Object.values(drafts).filter((draft) => !draft.pending);
  const adapters = Object.values(installed);

  return (
    <main className="space-y-6 p-4 text-sm">
      <h1 className="text-lg font-semibold">Senda adapters</h1>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Waiting for your approval</h2>
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
        <h2 className="font-semibold">Installed</h2>
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
    </main>
  );
}
