import { approvalsItem, draftsItem, panicItem, settingsItem, statusItem } from '@/src/bg/state';
import { requestPanic } from '@/src/bg/approvals';
import { detectBrowserName } from '@/src/core/browser-name';
import { detectCapabilities } from '@/src/core/capabilities';
import { useText } from '@/src/ui/i18n';
import { STATUS_DOT } from '@/src/ui/status';
import { LanguageToggle } from '@/src/ui/LanguageToggle';
import { ThemeToggle } from '@/src/ui/ThemeToggle';
import { useItem } from '@/src/ui/useItem';

async function openAdapters() {
  if (detectCapabilities(browser).includes('sidePanel')) {
    const win = await browser.windows.getCurrent();
    await browser.sidePanel.open({ windowId: win.id! });
  } else await browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html' as never) });
  window.close();
}

export default function App() {
  const t = useText();
  const [status] = useItem(statusItem);
  const [drafts] = useItem(draftsItem);
  const [approvals] = useItem(approvalsItem);
  const [panic] = useItem(panicItem);
  const [settings, setSettings] = useItem(settingsItem);
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
        {status === 'connected'
          ? t.popup.connectedAs(detectBrowserName(navigator as never, import.meta.env.BROWSER))
          : t.status[status]}
      </p>
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
