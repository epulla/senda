import { resolveLang, text, type Text } from '../core/i18n';
import { settingsItem } from './state';

export async function bgText(): Promise<Text> {
  const settings = await settingsItem.getValue();
  return text[resolveLang(settings.language, navigator.language)];
}
