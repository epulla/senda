import { useEffect, useState } from 'react';
import { browserNameItem } from '@/src/bg/state';
import { detectBrowserName } from '@/src/core/browser-name';
import { useText } from '@/src/ui/i18n';
import { useItem } from '@/src/ui/useItem';

export function BrowserNameField() {
  const t = useText().browserName;
  const [name, setName, loaded] = useItem(browserNameItem);
  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(name), [name]);
  const save = () => {
    if (draft.trim() !== name) void setName(draft.trim());
  };
  return (
    <label className="block">
      <span>{t.label}</span>
      <input
        type="text"
        maxLength={30}
        value={draft}
        disabled={!loaded}
        placeholder={t.placeholder(detectBrowserName(navigator as never, import.meta.env.BROWSER))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
    </label>
  );
}
