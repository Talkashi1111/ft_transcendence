export const LANGS = ['en', 'de', 'fr', 'ja'] as const;

export type Lang = (typeof LANGS)[number];

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}
