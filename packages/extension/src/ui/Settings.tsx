import { useEffect, useState, type FormEvent } from 'react';
import { portItem, settingsItem, statusItem, tokenItem } from '@/src/bg/state';
import { BrowserNameField } from '@/src/ui/BrowserNameField';
import { useText } from '@/src/ui/i18n';
import { STATUS_DOT } from '@/src/ui/status';
import { useItem } from '@/src/ui/useItem';

const askOptions = ['destructive', 'changes', 'everything', 'never'] as const;

// The parent needs `relative` so the text spans its width.
export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        onBlur={() => setOpen(false)}
        className="cursor-help rounded font-normal normal-case text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-primary"
      >
        ⓘ
      </button>
      {open && (
        <span aria-hidden className="card absolute top-full right-0 left-0 z-10 mt-1 !p-2 text-xs font-normal tracking-normal normal-case text-content">
          {text}
        </span>
      )}
    </>
  );
}

function SiteList({
  title,
  hint,
  sites,
  onChange,
}: {
  title: string;
  hint: string;
  sites: string[];
  onChange: (sites: string[]) => void;
}) {
  const text = useText();
  return (
    <div className="space-y-1">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted">{hint}</p>
      {sites.map((site) => (
        <p key={site} className="flex items-center justify-between gap-2">
          <span>{site}</span>
          <button
            type="button"
            onClick={() => onChange(sites.filter((s) => s !== site))}
            className="btn btn-sm"
          >
            {text.common.remove}
          </button>
        </p>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem('site') as HTMLInputElement;
          const site = input.value
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .toLowerCase();
          if (site && !sites.includes(site)) onChange([...sites, site]);
          input.value = '';
        }}
        className="flex gap-2"
      >
        <input
          name="site"
          aria-label={text.sidepanel.addTo(title.toLowerCase())}
          placeholder="example.com"
          className="!mt-0 min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-sm">
          {text.sidepanel.add}
        </button>
      </form>
    </div>
  );
}

export function Settings() {
  const text = useText();
  const t = text.sidepanel;
  const o = text.onboarding;
  const [token, setToken] = useItem(tokenItem);
  const [port, setPort] = useItem(portItem);
  const [status] = useItem(statusItem);
  const [settings, setSettings] = useItem(settingsItem);
  const [draft, setDraft] = useState('');
  const [portDraft, setPortDraft] = useState('');
  useEffect(() => setDraft(token), [token]);
  useEffect(() => setPortDraft(String(port)), [port]);

  function saveCode(e: FormEvent) {
    e.preventDefault();
    void setToken(draft.trim());
  }

  function savePort() {
    const p = Number(portDraft);
    if (Number.isInteger(p) && p > 0 && p < 65536) void setPort(p);
    else setPortDraft(String(port));
  }

  return (
    <div className="space-y-4">
      <p role="status" className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
        {status === 'disconnected' ? o.waiting : text.status[status]}
      </p>
      <form onSubmit={saveCode} className="space-y-2">
        <label className="block">
          <span>{o.pasteHint}</span>
          <input
            type="password"
            aria-label={o.code}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono"
          />
        </label>
        <button type="submit" className="btn btn-primary">
          {o.save}
        </button>
      </form>
      <BrowserNameField />
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">{t.askBefore}</legend>
        {askOptions.map((value) => (
          <label key={value} className="flex items-start gap-2">
            <input
              type="radio"
              name="askBefore"
              checked={settings.askBefore === value}
              onChange={() => {
                if (value === 'never' && !confirm(`${t.neverWarning}\n\n${t.stopAsking}`)) return;
                void setSettings({ ...settings, askBefore: value });
              }}
              className="mt-0.5"
            />
            <span>
              {t.ask[value]}
              {value === 'destructive' && (
                <span className="ml-1.5 rounded-full border border-primary-text/40 px-1.5 text-xs font-medium text-primary-text">
                  {t.recommended}
                </span>
              )}
              {value === 'destructive' && <span className="block text-xs text-muted">{t.destructiveHint}</span>}
              {value === 'never' && (
                <span className="relative flex items-center gap-1 text-xs text-error-text">
                  {t.neverHint} <Info text={t.neverWarning} />
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <SiteList
        title={t.trusted}
        hint={t.trustedHint}
        sites={settings.allowedDomains}
        onChange={(allowedDomains) => void setSettings({ ...settings, allowedDomains })}
      />
      <SiteList
        title={t.blocked}
        hint={t.blockedHint}
        sites={settings.blockedDomains}
        onChange={(blockedDomains) => void setSettings({ ...settings, blockedDomains })}
      />
      {settings.alwaysSites.length > 0 && (
        <SiteList
          title={t.always}
          hint={t.alwaysHint}
          sites={settings.alwaysSites}
          onChange={(alwaysSites) => void setSettings({ ...settings, alwaysSites })}
        />
      )}
      <details>
        <summary className="text-muted">{o.advanced}</summary>
        <label className="mt-2 block">
          <span>{o.port}</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={portDraft}
            onChange={(e) => setPortDraft(e.target.value)}
            onBlur={savePort}
            onKeyDown={(e) => e.key === 'Enter' && savePort()}
            className="!w-32"
          />
        </label>
        <p className="mt-2">
          {o.tokenCommand} <code>node senda-mcp.mjs token</code>
        </p>
      </details>
    </div>
  );
}
