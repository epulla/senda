import { settingsItem } from '@/src/bg/state';
import { resolveLang } from '@/src/core/i18n';
import { lang, useText } from '@/src/ui/i18n';
import { useItem } from '@/src/ui/useItem';

export function LanguageToggle() {
  const t = useText().language;
  const [settings, setSettings] = useItem(settingsItem);
  const next = lang() === 'es' ? 'en' : 'es';
  return (
    <button
      type="button"
      aria-label={t.switch}
      title={t.switch}
      // Picking the browser's language goes back to following it.
      onClick={() => void setSettings({ ...settings, language: next === resolveLang('system', navigator.language) ? 'system' : next })}
      className="btn btn-ghost size-8 !p-0 text-xs font-semibold"
    >
      {t.other}
    </button>
  );
}
