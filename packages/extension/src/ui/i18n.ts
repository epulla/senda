import { useSyncExternalStore } from 'react';
import { settingsItem } from '@/src/bg/state';
import { resolveLang, text, type Language, type Text } from '@/src/core/i18n';

const listeners = new Set<() => void>();
let language: Language = 'system';

export const lang = () => resolveLang(language, navigator.language);

function setLanguage(next: Language | undefined) {
  language = next ?? 'system';
  document.documentElement.lang = lang();
  listeners.forEach((listener) => listener());
}
setLanguage('system');
void settingsItem.getValue().then((settings) => setLanguage(settings.language));
settingsItem.watch((settings) => setLanguage(settings.language));

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useText(): Text {
  useSyncExternalStore(subscribe, () => language);
  return text[lang()];
}
