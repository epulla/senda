import { useEffect, useState, type FormEvent } from 'react';
import { portItem, statusItem, tokenItem } from '@/src/bg/state';
import { useText } from '@/src/ui/i18n';
import { STATUS_DOT } from '@/src/ui/status';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

const RELEASE = 'https://github.com/epulla/senda/releases/latest/download';
const SERVER_PATH = '/path/to/senda-mcp.mjs';
const APPS = ['claudeCode', 'claude', 'cursor', 'patio', 'vscode', 'other'] as const;
type App = (typeof APPS)[number];

function Copy({ value }: { value: string }) {
  const t = useText().onboarding;
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-start gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-base-300 px-3 py-2 text-sm">
        <code className="!bg-transparent !p-0">{value}</code>
      </pre>
      <button
        type="button"
        className="btn"
        onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

export default function App() {
  const text = useText();
  const t = text.onboarding;
  const [token, setToken, loaded] = useItem(tokenItem);
  const [port, setPort] = useItem(portItem);
  const [status] = useItem(statusItem);
  const [draft, setDraft] = useState('');
  const [portDraft, setPortDraft] = useState('');
  const [app, setApp] = useState<App>();
  useEffect(() => setDraft(token), [token]);
  useEffect(() => setPortDraft(String(port)), [port]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const p = Number(portDraft);
    if (Number.isInteger(p) && p > 0 && p < 65536) await setPort(p);
    await setToken(draft.trim());
  }

  const config = JSON.stringify({ mcpServers: { senda: { command: 'node', args: [SERVER_PATH] } } }, null, 2);

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
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.chooseApp}</h2>
        <div role="radiogroup" aria-label={t.chooseApp} className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3">
          {APPS.map((id) => (
            <label
              key={id}
              className="btn cursor-pointer !whitespace-normal text-center has-checked:!border-primary has-checked:!bg-base-300 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
            >
              <input
                type="radio"
                name="app"
                className="sr-only"
                checked={app === id}
                onChange={() => setApp(id)}
              />
              {t.apps[id]}
            </label>
          ))}
        </div>
        {!app ? (
          <p className="text-muted">{t.pickApp}</p>
        ) : (
          <ol className="list-decimal space-y-3 pl-6">
            {app === 'claude' ? (
              <>
                <li>
                  <a className="btn btn-primary !no-underline" href={`${RELEASE}/senda.mcpb`}>
                    {t.claudeDownload}
                  </a>
                </li>
                <li>{t.claudeInstall}</li>
              </>
            ) : (
              <>
                <li>
                  <a href="https://nodejs.org" target="_blank" rel="noreferrer">
                    {t.installNode}
                  </a>
                </li>
                <li>
                  <a href={`${RELEASE}/senda-mcp.mjs`}>{t.downloadServer}</a>
                  {t.keepFile}
                </li>
                <li>
                  {t[app]}
                  {app === 'patio' ? (
                    <>
                      <div className="mt-2 text-sm font-medium">{t.command}</div>
                      <Copy value="node" />
                      <div className="mt-2 text-sm font-medium">{t.args}</div>
                      <Copy value={SERVER_PATH} />
                    </>
                  ) : (
                    <Copy
                      value={
                        app === 'claudeCode'
                          ? `claude mcp add senda -- node ${SERVER_PATH}`
                          : app === 'vscode'
                            ? `node ${SERVER_PATH}`
                            : config
                      }
                    />
                  )}
                  <p className="mt-1 text-sm text-muted">{t.replacePath}</p>
                </li>
              </>
            )}
            <li>
              {t.sayConnect}
              <Copy value={t.connectPrompt} />
            </li>
          </ol>
        )}
      </section>
      <form onSubmit={save} className="space-y-3">
        <h2 className="text-lg font-semibold">{t.pasteCode}</h2>
        <label className="block">
          <span>{t.pasteHint}</span>
          <input
            type="password"
            aria-label={t.code}
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
          <p className="mt-2 text-sm">
            {t.tokenCommand} <code>node senda-mcp.mjs token</code>
          </p>
        </details>
        <button type="submit" className="btn btn-primary">
          {t.save}
        </button>
      </form>
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        {status === 'disconnected' ? t.waiting : text.status[status]}
      </p>
      {status === 'connected' && (
        <div>
          {t.tryIt}
          <Copy value={t.tryPrompt} />
        </div>
      )}
      <p className="text-sm text-muted">{t.privacy}</p>
    </main>
  );
}
