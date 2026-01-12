/* Command to run with own config
 * pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 */

// test/i18n.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Dict = Record<string, unknown>;

const LOCALES = ['en', 'de', 'fr', 'ja'] as const;

const PLACEHOLDER_VALUES = new Set(['YET TO DEFINE', 'YET_TO_DEFINE', 'TODO', 'TBD']);

function i18nDir() {
  return path.resolve(process.cwd(), 'src', 'i18n');
}

function srcDir() {
  return path.resolve(process.cwd(), 'src');
}

function readRaw(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function loadJson(filePath: string): Dict {
  return JSON.parse(readRaw(filePath)) as Dict;
}

function countPlaceholderValues(dict: Dict): number {
  let count = 0;
  for (const v of Object.values(dict)) {
    if (typeof v === 'string' && PLACEHOLDER_VALUES.has(v.trim())) count++;
  }
  return count;
}

function assertAllValuesAreNonEmptyStrings(dict: Dict, locale: string) {
  for (const [key, value] of Object.entries(dict)) {
    expect(value, `${locale}: "${key}" is null/undefined`).not.toBeNull();
    expect(typeof value, `${locale}: "${key}" must be a string`).toBe('string');
    expect((value as string).trim(), `${locale}: "${key}" is empty`).not.toBe('');
  }
}

/**
 * Detect duplicate keys at the top-level object.
 * Assumes i18n JSON is a flat object: { "a": "…", "b": "…" }
 */
function findDuplicateTopLevelKeys(raw: string): string[] {
  // Remove whitespace to simplify scanning a bit
  const s = raw;

  // Very lightweight top-level scan:
  // - find occurrences of: "KEY" :
  // - only when we are at top-level depth 1 (inside the root object)
  const dups: string[] = [];
  const seen = new Set<string>();

  let i = 0;
  let depth = 0;
  let inString = false;
  let escape = false;

  const readString = (): string => {
    // assumes s[i] === '"'
    i++; // skip opening "
    let out = '';
    while (i < s.length) {
      const ch = s[i++];
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') break;
      out += ch;
    }
    return out;
  };

  while (i < s.length) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      // Potential key only when inside root object (depth === 1)
      if (depth === 1) {
        const saveI = i;
        const key = readString();

        // Skip whitespace
        while (i < s.length && /\s/.test(s[i])) i++;

        // Must be followed by :
        if (s[i] === ':') {
          if (seen.has(key)) dups.push(key);
          else seen.add(key);
          i++; // consume :
        } else {
          // Not a key, revert and just treat it as a string
          i = saveI;
          inString = true;
          i++;
        }
        continue;
      } else {
        inString = true;
        i++;
        continue;
      }
    }

    if (ch === '{') depth++;
    else if (ch === '}') depth--;

    i++;
  }

  // report each duplicated key once
  return Array.from(new Set(dups));
}

function walkFiles(dir: string, exts = new Set(['.ts', '.tsx', '.js', '.jsx'])): string[] {
  const out: string[] = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop()!;
    if (!fs.existsSync(current)) continue;

    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name);

      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'build') continue;
        stack.push(full);
        continue;
      }

      if (ent.isFile()) {
        const ext = path.extname(ent.name);
        if (exts.has(ext)) out.push(full);
      }
    }
  }

  return out;
}

function collectUsedTranslationKeys(): Set<string> {
  const files = walkFiles(srcDir());
  const used = new Set<string>();

  // Matches t('key') / t("key") / t(`key`)
  const tCall = /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = tCall.exec(code))) {
      used.add(m[1]);
    }
  }

  return used;
}

describe('i18n JSON integrity (frontend/src/i18n)', () => {
  it('has no duplicate keys in any locale file (top-level)', () => {
    const dir = i18nDir();

    for (const loc of LOCALES) {
      const file = path.join(dir, `${loc}.json`);
      const raw = readRaw(file);
      const dups = findDuplicateTopLevelKeys(raw);

      expect(dups, `${loc}.json has duplicate keys: ${dups.join(', ')}`).toEqual([]);
    }
  });

  it('all locales have exactly the same keys as en.json', () => {
    const dir = i18nDir();

    const en = loadJson(path.join(dir, 'en.json'));
    const baseKeys = Object.keys(en).sort();

    for (const loc of LOCALES) {
      const dict = loadJson(path.join(dir, `${loc}.json`));
      const keys = Object.keys(dict).sort();
      expect(keys, `${loc}.json keys differ from en.json`).toEqual(baseKeys);
    }
  });

  it('every key has a non-empty string translation in every locale', () => {
    const dir = i18nDir();

    for (const loc of LOCALES) {
      const dict = loadJson(path.join(dir, `${loc}.json`));
      assertAllValuesAreNonEmptyStrings(dict, loc);
    }
  });

  it('reports how many placeholder (YET TO DEFINE/TODO/TBD) values each locale contains', () => {
    const dir = i18nDir();

    const counts: Record<string, number> = {};
    for (const loc of LOCALES) {
      const dict = loadJson(path.join(dir, `${loc}.json`));
      counts[loc] = countPlaceholderValues(dict);
    }

    console.log('i18n placeholders:', counts);
    expect(typeof counts.en).toBe('number');
  });

  it('reports unused keys (present in JSON but never referenced via t("...") in src/)', () => {
    const dir = i18nDir();
    const en = loadJson(path.join(dir, 'en.json'));
    const jsonKeys = new Set(Object.keys(en));

    const used = collectUsedTranslationKeys();
    const IGNORED_PREFIXES = ['_meta', 'auth'];

    const unused = Array.from(jsonKeys)
      .filter((k) => !IGNORED_PREFIXES.some((p) => k.startsWith(p)))
      .filter((k) => !used.has(k))
      .sort();

    // Pure report (does not fail). Turn into an assertion later if you want.
    console.log(`i18n unused keys (${unused.length}):`, unused.slice(0, 50));
    if (unused.length > 50) console.log(`…and ${unused.length - 50} more`);

    expect(unused, `Unused i18n keys (${unused.length}):\n${unused.join('\n')}`).toEqual([]);
  });
});
