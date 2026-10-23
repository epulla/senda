import { en } from './text/en';
import { es } from './text/es';

export type Lang = 'en' | 'es';
export type Language = 'system' | Lang;
export type Text = typeof en;

export const text: Record<Lang, Text> = { en, es };

export const resolveLang = (language: Language | undefined, browserLanguage: string): Lang =>
  !language || language === 'system' ? (browserLanguage.toLowerCase().startsWith('es') ? 'es' : 'en') : language;
