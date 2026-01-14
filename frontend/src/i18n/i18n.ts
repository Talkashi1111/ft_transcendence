import en from './en.json';
import fr from './fr.json';
import ja from './ja.json';
import de from './de.json';
import { getCurrentUser } from '../utils/auth'; // adjust path if needed

export type Lang = 'en' | 'ja' | 'fr' | 'de';
const STORAGE_KEY = 'lang';

const listeners = new Set<() => void>();

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let accountLang: Lang | null = null;

export async function syncLangFromAccount(): Promise<void> {
  const user = await getCurrentUser();

  // if logged in and user has a preference -> override
  if (user?.preferredLanguage) {
    accountLang = user.preferredLanguage;
    // also keep localStorage in sync (optional but nice)
    localStorage.setItem(STORAGE_KEY, accountLang);
  } else {
    accountLang = null;
  }

  // trigger rerender so UI updates if needed
  listeners.forEach((fn) => fn());
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
  // 1) account preference (highest priority)
  if (accountLang) return accountLang;

  // 2) saved preference (localStorage)
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'ja' || saved === 'fr' || saved === 'de') return saved;

  // 3) browser fallback
  return detectBrowserLang();
}

export function setLang(lang: Lang) {
  const current = getLang();
  if (lang === current) return;

  // set override + storage
  accountLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);

  listeners.forEach((fn) => fn());
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
