import en from './en.json';
import fr from './fr.json';
import ja from './ja.json';
import de from './de.json';
import { getCurrentUser } from '../utils/auth';

export type Lang = 'en' | 'ja' | 'fr' | 'de';
const STORAGE_KEY = 'lang';

const listeners = new Set<() => void>();

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let accountLang: Lang | null = null; // DB preference (default for new devices)

function isLang(x: unknown): x is Lang {
  return x === 'en' || x === 'fr' || x === 'de' || x === 'ja';
}

function detectBrowserLang(): Lang {
  const navLang = navigator.languages?.[0] || navigator.language || 'en';
  const prefix = navLang.toLowerCase().split('-')[0];

  if (prefix === 'ja') return 'ja';
  if (prefix === 'fr') return 'fr';
  if (prefix === 'de') return 'de';
  return 'en';
}

/**
 * Sync account language from backend.
 * Rule: Only seed localStorage from account if localStorage has no valid lang yet.
 */
export async function syncLangFromAccount(): Promise<void> {
  const user = await getCurrentUser();
  accountLang = isLang(user?.preferredLanguage) ? user!.preferredLanguage : null;

  const saved = localStorage.getItem(STORAGE_KEY);
  const hasSaved = isLang(saved);

  // Seed device lang from account only if device has no preference yet
  if (!hasSaved && accountLang) {
    localStorage.setItem(STORAGE_KEY, accountLang);
  }

  listeners.forEach((fn) => fn());
}

/**
 * Priority:
 * 1) localStorage (device choice)
 * 2) accountLang (DB default, if already synced)
 * 3) browser language
 */
export function getLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (isLang(saved)) return saved;

  if (accountLang) return accountLang;

  return detectBrowserLang();
}

/**
 * Device-only language change (navbar).
 * Does NOT touch accountLang (DB).
 */
export function setLang(lang: Lang) {
  const current = getLang();
  if (lang === current) return;

  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn());
}

/**
 * Use this ONLY after the user saves language in Settings (Option B):
 * - DB is updated server-side
 * - apply immediately on this device
 * - also update accountLang in memory so it matches DB
 */
export function applyAccountLang(lang: Lang) {
  accountLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn());
}

/**
 * Call on logout so we don’t keep stale DB state in memory.
 * (localStorage remains, as we agreed.)
 */
export function clearAccountLang(): void {
  accountLang = null;
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
