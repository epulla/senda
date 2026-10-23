import { draftsItem, statusItem } from '@/src/bg/state';
import { detectBrowserName } from '@/src/core/browser-name';
import { detectCapabilities } from '@/src/core/capabilities';
import { STATUS } from '@/src/ui/status';
import { useItem } from '@/src/ui/useItem';

async function openAdapters() {
  if (detectCapabilities(browser).includes('sidePanel')) {
    const win = await browser.windows.getCurrent();
    await browser.sidePanel.open({ windowId: win.id! });
  } else await browser.tabs.create({ url: browser.runtime.getURL('/sidepanel.html' as never) });
  window.close();
}

export default function App() {
  const [status] = useItem(statusItem);
  const [drafts] = useItem(draftsItem);
  const pending = Object.values(drafts).filter((draft) => draft.pending).length;
  const { label, dot } = STATUS[status];
  return (
    <main className="w-72 space-y-3 p-4 text-sm">
      <h1 className="text-lg font-semibold">Senda</h1>
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dot}`} />
        {status === 'connected'
          ? `Connected as ${detectBrowserName(navigator as never, import.meta.env.BROWSER)}`
          : label}
      </p>
      <button
        type="button"
        onClick={openAdapters}
        className="block w-full rounded bg-blue-700 px-3 py-1.5 font-medium text-white hover:bg-blue-800"
      >
        {pending ? `Review ${pending} waiting for approval` : 'Adapters'}
      </button>
      <a href="/onboarding.html" target="_blank" className="text-blue-700 underline">
        {status === 'invalid_token' ? 'Paste the code' : 'Setup'}
      </a>
    </main>
  );
}
