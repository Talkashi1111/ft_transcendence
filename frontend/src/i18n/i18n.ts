import en from './en.json';
import fr from './fr.json';
import ja from './ja.json';
import de from './de.json';

export type Lang = 'en' | 'ja' | 'fr' | 'de';
const STORAGE_KEY = 'lang';

const listeners = new Set<() => void>();

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function detectBrowserLang(): Lang {
  const navLang = navigator.languages?.[0] || navigator.language || 'en';
  const prefix = navLang.toLowerCase().split('-')[0];

  if (prefix === 'ja') return 'ja';
  if (prefix === 'fr') return 'fr';
  if (prefix === 'de') return 'de';
  return 'en';
}

export function getLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'ja' || saved === 'fr' || saved === 'de') return saved;
  return detectBrowserLang();
}

export function setLang(lang: Lang) {
  const current = getLang();
  if (lang === current) return; // prevents pointless rerenders
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn()); // tell the app to re-render
}

// ---- JSON dictionaries + t() ----
const dicts: Record<Lang, Record<string, string>> = { en, fr, ja, de };

type TParams = Record<string, string | number>;

export function t(key: string, params?: TParams): string {
  const lang = getLang();
  const template = dicts[lang]?.[key] ?? dicts.en[key] ?? key;

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_match, p1: string) => {
    const value = params[p1];
    return value === undefined || value === null ? `{${p1}}` : String(value);
  });
}
