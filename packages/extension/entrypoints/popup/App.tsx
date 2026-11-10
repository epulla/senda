import { compareVersions } from '@senda/protocol';
import { approvalsItem, draftsItem, panicItem, serverVersionItem, settingsItem, statusItem } from '@/src/bg/state';
import { requestPanic } from '@/src/bg/approvals';
import { openSidePanel } from '@/src/ui/openSidePanel';
import { useText } from '@/src/ui/i18n';
import { STATUS_DOT } from '@/src/ui/status';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';
import { NameTaken, useBrowserName } from '@/src/ui/BrowserNameField';
import { useRef, useState } from 'react';

async function openAdapters() {
  await openSidePanel();
  window.close();
}

// Lucide pencil path (ISC).
const PENCIL = ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z', 'm15 5 4 4'];

function ConnectedAs() {
  const t = useText();
  const { name, save } = useBrowserName();
  const [draft, setDraft] = useState<string>();
  const cancelled = useRef(false);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <span className="shrink-0">{t.popup.connectedAs}</span>
      {draft === undefined ? (
        <button
          type="button"
          aria-label={`${t.browserName.rename}: ${name}`}
          title={t.browserName.rename}
          onClick={() => setDraft(name)}
          className="inline-flex min-w-0 items-center gap-1 font-semibold hover:underline"
        >
          <span className="truncate">{name}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted"
          >
            {PENCIL.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        </button>
      ) : (
        <input
          type="text"
          aria-label={t.browserName.label}
          autoFocus
          maxLength={30}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!cancelled.current && draft.trim() !== name) save(draft);
            cancelled.current = false;
            setDraft(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
          className="!mt-0 min-w-0 flex-1 !py-0.5"
        />
      )}
    </span>
  );
}

export default function App() {
  const t = useText();
  const [status] = useItem(statusItem);
  const [drafts] = useItem(draftsItem);
  const [approvals] = useItem(approvalsItem);
  const [panic] = useItem(panicItem);
  const [settings, setSettings] = useItem(settingsItem);
  const { name, taken } = useBrowserName();
  const [serverVersion] = useItem(serverVersionItem);
  const outdated = serverVersion !== '' && compareVersions(serverVersion, browser.runtime.getManifest().version) < 0;
  const pending =
    Object.values(drafts).filter((draft) => draft.pending).length +
    Object.values(approvals).filter((item) => !item.answer).length;
  return (
    <main className="w-72 space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-primary-text">Senda</h1>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        {status === 'connected' ? <ConnectedAs /> : t.status[status]}
      </p>
      {status === 'connected' && taken && <NameTaken name={name} />}
      {status === 'connected' && serverVersion && (
        <p className={outdated ? 'text-error-text' : 'text-xs text-muted'}>
          {outdated ? `${t.popup.serverOutdated} (${t.popup.serverVersion(serverVersion)})` : t.popup.serverVersion(serverVersion)}
        </p>
      )}
      {panic > 0 && <p className="font-medium text-error-text">{t.popup.stopped}</p>}
      {settings.askBefore === 'never' && (
        <p role="alert" className="card card-danger flex items-center justify-between gap-2 !p-2 text-xs font-semibold text-error-text">
          {t.popup.neverAsk}
          <button
            type="button"
            onClick={() => void setSettings({ ...settings, askBefore: 'destructive' })}
            className="btn btn-sm"
          >
            {t.common.turnOff}
          </button>
        </p>
      )}
      <button
        type="button"
        onClick={openAdapters}
        className="btn btn-primary w-full"
      >
        {pending ? t.popup.review(pending) : t.popup.openPanel}
      </button>
      {panic === 0 && (
        <button
          type="button"
          onClick={() => void requestPanic()}
          className="btn btn-danger-text w-full"
        >
          {t.common.stopEverything}
        </button>
      )}
      <a href="/onboarding.html" target="_blank">
        {status === 'invalid_token' ? t.popup.pasteCode : t.popup.setup}
      </a>
    </main>
  );
}
