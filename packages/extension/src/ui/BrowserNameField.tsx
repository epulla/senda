import { useEffect, useState } from 'react';
import { browserNameItem, otherBrowsersItem } from '@/src/bg/state';
import { browserName, detectBrowserName } from '@/src/core/browser-name';
import { useText } from '@/src/ui/i18n';
import { useItem } from '@/src/ui/useItem';

export function useBrowserName() {
  const [saved, setSaved, loaded] = useItem(browserNameItem);
  const [others] = useItem(otherBrowsersItem);
  const detected = detectBrowserName(navigator as never, import.meta.env.BROWSER);
  const name = browserName(saved, detected);
  return {
    saved,
    name,
    detected,
    loaded,
    taken: others.some((other) => other.toLowerCase() === name.toLowerCase()),
    save: (value: string) => {
      if (value.trim() !== saved) void setSaved(value.trim().slice(0, 30));
    },
  };
}

export function NameTaken({ name }: { name: string }) {
  return <p className="text-sm text-error-text">{useText().browserName.taken(name)}</p>;
}

export function BrowserNameField() {
  const t = useText().browserName;
  const { saved, name, detected, loaded, taken, save } = useBrowserName();
  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(saved), [saved]);
  return (
    <div className="space-y-1">
      <label className="block">
        <span>{t.label}</span>
        <input
          type="text"
          maxLength={30}
          value={draft}
          disabled={!loaded}
          placeholder={t.placeholder(detected)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => save(draft)}
          onKeyDown={(e) => e.key === 'Enter' && save(draft)}
        />
      </label>
      {taken && <NameTaken name={name} />}
    </div>
  );
}
