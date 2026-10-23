import { settingsItem } from '@/src/bg/state';

const media = matchMedia('(prefers-color-scheme: dark)');
async function apply() {
  const theme = (await settingsItem.getValue()).theme ?? 'system';
  document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
}
void apply();
settingsItem.watch(() => void apply());
media.addEventListener('change', () => void apply());
