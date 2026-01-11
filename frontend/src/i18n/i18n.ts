import en from './en.json';
import fr from './fr.json';
import ja from './ja.json';

export type Lang = 'en' | 'ja' | 'fr';
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
  return 'en';
}

export function getLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'ja' || saved === 'fr') return saved;
  return detectBrowserLang();
}

export function setLang(lang: Lang) {
  const current = getLang();
  if (lang === current) return; // prevents pointless rerenders
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn()); // tell the app to re-render
}

// const translations = {
//   en: {
//     'nav.home': 'Home',
//   },
//   fr: {
//     'nav.home': 'Accueil',
//   },
//   ja: {
//     'nav.home': 'ホーム',
//   },
// } as const;

// export function t(key: keyof (typeof translations)['en']): string {
//   const lang = getLang();
//   return translations[lang][key] ?? translations.en[key] ?? key;
// }

// ---- JSON dictionaries + t() ----
const dicts: Record<Lang, Record<string, string>> = { en, fr, ja };

export function t(key: string): string {
  const lang = getLang();
  return dicts[lang]?.[key] ?? dicts.en[key] ?? key;
}
