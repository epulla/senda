import { useEffect, useState, type FormEvent } from 'react';
import { portItem, statusItem, tokenItem } from '@/src/bg/state';
import { useText } from '@/src/ui/i18n';
import { STATUS_DOT } from '@/src/ui/status';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

export default function App() {
  const text = useText();
  const t = text.onboarding;
  const [token, setToken, loaded] = useItem(tokenItem);
  const [port, setPort] = useItem(portItem);
  const [status] = useItem(statusItem);
  const [draft, setDraft] = useState('');
  const [portDraft, setPortDraft] = useState('');
  useEffect(() => setDraft(token), [token]);
  useEffect(() => setPortDraft(String(port)), [port]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const p = Number(portDraft);
    if (Number.isInteger(p) && p > 0 && p < 65536) await setPort(p);
    await setToken(draft.trim());
  }

  return (
    <main className="card mx-auto my-8 max-w-xl space-y-6 !p-8 text-base">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <p>{t.intro}</p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>{t.step1}</li>
        <li>
          {t.step2Before}
          <code>senda token</code>
          {t.step2After}
        </li>
        <li>{t.step3}</li>
      </ol>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="font-medium">{t.code}</span>
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
          <summary className="text-sm text-muted">{t.advanced}</summary>
          <label className="mt-2 block text-sm">
            <span>{t.port}</span>
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
          {t.save}
        </button>
      </form>
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        {text.status[status]}
      </p>
      <p className="text-sm text-muted">
        {t.privacy}
      </p>
    </main>
  );
}
