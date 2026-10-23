import { useEffect, useState, type FormEvent } from 'react';
import { portItem, statusItem, tokenItem } from '@/src/bg/state';
import { STATUS } from '@/src/ui/status';
import { useItem } from '@/src/ui/useItem';

export default function App() {
  const [token, setToken, loaded] = useItem(tokenItem);
  const [port, setPort] = useItem(portItem);
  const [status] = useItem(statusItem);
  const [draft, setDraft] = useState('');
  const [portDraft, setPortDraft] = useState('');
  useEffect(() => setDraft(token), [token]);
  useEffect(() => setPortDraft(String(port)), [port]);
  const { label, dot } = STATUS[status];

  async function save(e: FormEvent) {
    e.preventDefault();
    const p = Number(portDraft);
    if (Number.isInteger(p) && p > 0 && p < 65536) await setPort(p);
    await setToken(draft.trim());
  }

  return (
    <main className="card mx-auto my-8 max-w-xl space-y-6 !p-8 text-base">
      <h1 className="text-2xl font-semibold">Set up Senda</h1>
      <p>Senda lets your AI assistant read and use this browser. It only talks to the Senda app on this computer.</p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>Add Senda to your AI app (for example Claude Code).</li>
        <li>
          In a terminal, run <code>senda token</code> and copy the code it prints.
        </li>
        <li>Paste the code below and save.</li>
      </ol>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="font-medium">Code</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            disabled={!loaded}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono"
          />
        </label>
        <details>
          <summary className="text-sm text-muted">Advanced</summary>
          <label className="mt-2 block text-sm">
            <span>Port (change only if you set SENDA_PORT)</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={portDraft}
              onChange={(e) => setPortDraft(e.target.value)}
              className="!w-32"
            />
          </label>
        </details>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </form>
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dot}`} />
        {label}
      </p>
      <p className="text-sm text-muted">
        When your AI reads a page, email or chat, that content (including messages from other people) is sent to your
        AI provider.
      </p>
    </main>
  );
}
