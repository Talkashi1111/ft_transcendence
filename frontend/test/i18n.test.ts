/* i18n usage enforcement via source scanning
 *
 * Run (all rules enabled by default):
 *   pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 *
 * Disable by rule IDs:
 *   I18N_DISABLE=label,aria-label pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 *
 * Disable by groups:
 *   I18N_DISABLE_GROUPS=attrs,calls pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 *
 * Enable ONLY some rule IDs (everything else disabled):
 *   I18N_ONLY=button,attrs-placeholder pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 *
 * Enable ONLY some groups:
 *   I18N_ONLY_GROUPS=tags pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 *
 * List rule IDs and groups:
 *   I18N_LIST_RULES=true pnpm --filter frontend exec vitest run --config vitest.i18n.config.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Violation = {
  file: string;
  line: number;
  ruleId: string;
  ruleName: string;
  snippet: string;
};

type Hit = { index: number; snippet: string };

type RuleTagInner = {
  id: string;
  name: string;
  groups: string[];
  kind: 'tagInner';
  tag: 'button' | 'label';
  ignoreIfNoText: boolean;
};

type RuleJsxAttr = {
  id: string;
  name: string;
  groups: string[];
  kind: 'jsxAttr';
  attr: 'aria-label' | 'placeholder' | 'alt';
};

type RuleCallArg = {
  id: string;
  name: string;
  groups: string[];
  kind: 'callArg';
  call: 'showMessage' | 'showInlineError' | 'toast.error' | 'toast.success';
};

type RuleAssignment = {
  id: string;
  name: string;
  groups: string[];
  kind: 'assignment';
  left: 'setupBtn.textContent' | 'disableBtn.textContent' | 'err.message';
};

type Rule = RuleTagInner | RuleJsxAttr | RuleCallArg | RuleAssignment;

const SRC_ROOT = path.resolve(process.cwd(), 'src');

// Escape hatch: allow intentional raw strings
// Use either: data-i18n-ignore in JSX/HTML or comment: i18n-ignore
const IGNORE_MARKERS = ['data-i18n-ignore', 'i18n-ignore'];

function compact(snippet: string, max = 220) {
  const oneLine = snippet.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

function lineNumberFromIndex(source: string, index: number): number {
  return source.slice(0, index).split(/\r?\n/).length;
}

function isIgnored(s: string) {
  return IGNORE_MARKERS.some((m) => s.includes(m));
}

function hasTCall(s: string): boolean {
  // matches t('key') / t("key") / t(`key`)
  return /\bt\s*\(\s*['"`][^'"`]+['"`]/.test(s);
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
        if (['node_modules', 'dist', 'build', 'coverage'].includes(ent.name)) continue;
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

// -----------------------
// Rule registry (ALL ON by default)
// -----------------------
const RULES: Rule[] = [
  // --- TAGS group (inner text) ---
  {
    id: 'button',
    name: '<button> inner text must use t()',
    groups: ['tags'],
    kind: 'tagInner',
    tag: 'button',
    ignoreIfNoText: true,
  },
  {
    id: 'label',
    name: '<label> inner text must use t()',
    groups: ['tags'],
    kind: 'tagInner',
    tag: 'label',
    ignoreIfNoText: true,
  },

  // --- ATTRS group (JSX attributes) ---
  {
    id: 'attrs-aria-label',
    name: 'aria-label must use {t(...)} (no plain string)',
    groups: ['attrs'],
    kind: 'jsxAttr',
    attr: 'aria-label',
  },
  {
    id: 'attrs-placeholder',
    name: 'placeholder must use {t(...)} (no plain string)',
    groups: ['attrs'],
    kind: 'jsxAttr',
    attr: 'placeholder',
  },
  {
    id: 'attrs-alt',
    name: 'alt must use {t(...)} (no plain string)',
    groups: ['attrs'],
    kind: 'jsxAttr',
    attr: 'alt',
  },

  // --- CALLS group (function calls) ---
  {
    id: 'calls-showMessage',
    name: 'showMessage(firstArg) must use t(...) (no plain string)',
    groups: ['calls'],
    kind: 'callArg',
    call: 'showMessage',
  },
  {
    id: 'calls-showInlineError',
    name: 'showInlineError(firstArg) must use t(...) (no plain string)',
    groups: ['calls'],
    kind: 'callArg',
    call: 'showInlineError',
  },
  {
    id: 'calls-toast-error',
    name: 'toast.error(firstArg) must use t(...) (no plain string)',
    groups: ['calls'],
    kind: 'callArg',
    call: 'toast.error',
  },
  {
    id: 'calls-toast-success',
    name: 'toast.success(firstArg) must use t(...) (no plain string)',
    groups: ['calls'],
    kind: 'callArg',
    call: 'toast.success',
  },

  // --- ASSIGNMENTS group (DOM text, errors) ---
  {
    id: 'assign-setupBtn-textContent',
    name: 'setupBtn.textContent must use t(...)',
    groups: ['assignments'],
    kind: 'assignment',
    left: 'setupBtn.textContent',
  },
  {
    id: 'assign-disableBtn-textContent',
    name: 'disableBtn.textContent must use t(...)',
    groups: ['assignments'],
    kind: 'assignment',
    left: 'disableBtn.textContent',
  },
  {
    id: 'assign-err-message',
    name: 'err.message must use t(...)',
    groups: ['assignments'],
    kind: 'assignment',
    left: 'err.message',
  },
];

// -----------------------
// Runtime toggles (env)
// -----------------------
function parseCsvEnv(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

const DISABLED_RULES = parseCsvEnv('I18N_DISABLE');
const DISABLED_GROUPS = parseCsvEnv('I18N_DISABLE_GROUPS');
const ONLY_RULES = parseCsvEnv('I18N_ONLY');
const ONLY_GROUPS = parseCsvEnv('I18N_ONLY_GROUPS');
const LIST_RULES = (process.env.I18N_LIST_RULES ?? '').toLowerCase() === 'true';

function isRuleEnabled(rule: Rule): boolean {
  const inOnlyMode = ONLY_RULES.size > 0 || ONLY_GROUPS.size > 0;

  const matchesOnly =
    (ONLY_RULES.size === 0 || ONLY_RULES.has(rule.id)) &&
    (ONLY_GROUPS.size === 0 || rule.groups.some((g) => ONLY_GROUPS.has(g)));

  if (inOnlyMode && !matchesOnly) return false;

  if (DISABLED_RULES.has(rule.id)) return false;
  if (rule.groups.some((g) => DISABLED_GROUPS.has(g))) return false;

  return true;
}

function enabledRules(): Rule[] {
  return RULES.filter(isRuleEnabled);
}

function listRulesText(): string {
  const groups = new Map<string, string[]>();
  for (const r of RULES) {
    for (const g of r.groups) {
      const arr = groups.get(g) ?? [];
      arr.push(r.id);
      groups.set(g, arr);
    }
  }

  const groupLines = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, ids]) => `- ${g}: ${ids.sort().join(', ')}`)
    .join('\n');

  const ruleLines = RULES.map((r) => `- ${r.id} [${r.groups.join(', ')}]: ${r.name}`).join('\n');

  return `Available groups:\n${groupLines}\n\nRules:\n${ruleLines}\n`;
}

// -----------------------
// Finders
// -----------------------
function findTagInnerViolations(code: string, tag: string, ignoreIfNoText: boolean): Hit[] {
  const hits: Hit[] = [];
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?>[\\s\\S]*?<\\/${tag}>`, 'gi');

  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const block = m[0];
    if (isIgnored(block)) continue;

    const inner = block
      .replace(new RegExp(`^<${tag}\\b[\\s\\S]*?>`, 'i'), '')
      .replace(new RegExp(`<\\/${tag}>$`, 'i'), '')
      .trim();

    if (ignoreIfNoText) {
      // Remove tags to examine visible text-ish content only
      const innerNoTags = inner
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Ignore common icon-only patterns (SVG icons, ×, &times;, etc.)
      const hasLettersOrDigits = /[A-Za-z0-9\u00C0-\u024F\u4E00-\u9FFF\u3040-\u30FF]/.test(
        innerNoTags
      );
      const looksLikeOnlyTimes = innerNoTags === '×' || innerNoTags === '&times;';

      if (!hasLettersOrDigits || looksLikeOnlyTimes) {
        // icon-only button (no real text) → don't require t() in inner text
        continue;
      }
    }

    // Allow variable-driven content like: ${escapeHtml(cancelText)}
    if (/\$\{[^}]+\}/.test(inner) && !/t\s*\(/.test(inner)) {
      continue;
    }

    if (!hasTCall(inner)) hits.push({ index: m.index, snippet: compact(block) });
  }

  return hits;
}

function findJsxAttrViolations(code: string, attr: string): Hit[] {
  const hits: Hit[] = [];

  // Match attr=VALUE (string or expression)
  // NOTE: heuristic — good for most cases, not a full parser
  const re = new RegExp(`\\b${attr}\\s*=\\s*([^\\s>]+)`, 'g');

  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const raw = m[1]; // RHS token
    const snippet = `${attr}=${raw}`;
    if (isIgnored(snippet)) continue;

    const isDoubleQuoted = /^"[^"]*"$/.test(raw);
    const isSingleQuoted = /^'[^']*'$/.test(raw);

    // Case 1: quoted attribute value
    if (isDoubleQuoted || isSingleQuoted) {
      // ✅ Allow template-literal interpolation inside HTML strings:
      // placeholder="${t('key')}" or placeholder="... ${t('key')} ..."
      if (raw.includes('${') && hasTCall(raw)) {
        continue;
      }

      // ❌ Otherwise it's a hardcoded literal attribute
      hits.push({ index: m.index, snippet: compact(snippet) });
      continue;
    }

    // Case 2: JSX expression attribute: placeholder={...}
    if (raw.startsWith('{') && raw.endsWith('}')) {
      // ✅ Allowed if it directly uses t(...)
      if (hasTCall(raw)) continue;

      // ✅ Otherwise allow variables/expressions (may already be translated upstream)
      // If you want STRICT mode later, we can require hasTCall(raw) here.
      continue;
    }

    // Anything else → conservative allow
  }

  return hits;
}

function findCallArgViolations(code: string, call: string): Hit[] {
  const hits: Hit[] = [];
  const re = new RegExp(`\\b${call.replace('.', '\\.')}\\s*\\(([^\\)]*)\\)`, 'g');

  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const args = (m[1] ?? '').trim();
    const snippet = `${call}(${args})`;
    if (isIgnored(snippet)) continue;

    const firstArg = args.split(',')[0]?.trim() ?? '';
    if (!firstArg) continue;

    // Violation if first arg is a plain string literal
    if (/^['"`]/.test(firstArg)) hits.push({ index: m.index, snippet: compact(snippet) });
  }

  return hits;
}

function findAssignmentViolations(code: string, left: string): Hit[] {
  const hits: Hit[] = [];
  const re = new RegExp(`\\b${left.replace('.', '\\.')}\\s*=\\s*([^;\\n]+)`, 'g');

  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const rhs = (m[1] ?? '').trim();
    const snippet = `${left} = ${rhs}`;
    if (isIgnored(snippet)) continue;

    // If RHS is a string literal -> violation
    if (/^['"`]/.test(rhs)) {
      hits.push({ index: m.index, snippet: compact(snippet) });
      continue;
    }

    // If RHS isn't a literal, require t(...) somewhere in RHS
    if (!hasTCall(rhs)) hits.push({ index: m.index, snippet: compact(snippet) });
  }

  return hits;
}

// -----------------------
// Test
// -----------------------
describe('i18n usage enforcement (runtime toggles via env)', () => {
  it('enforces translation usage rules under src/ (file+line+snippet)', () => {
    if (LIST_RULES) {
      // Print rules for discovery and exit early without failing
      // (still counts as a passing test run)

      console.log(listRulesText());
      expect(true).toBe(true);
      return;
    }

    const files = walkFiles(SRC_ROOT);
    const activeRules = enabledRules();

    console.log(
      `i18n rules active: ${activeRules.length}/${RULES.length}` +
        (DISABLED_RULES.size
          ? ` | disabled rule IDs: ${Array.from(DISABLED_RULES).join(', ')}`
          : '') +
        (DISABLED_GROUPS.size
          ? ` | disabled groups: ${Array.from(DISABLED_GROUPS).join(', ')}`
          : '') +
        (ONLY_RULES.size ? ` | ONLY rule IDs: ${Array.from(ONLY_RULES).join(', ')}` : '') +
        (ONLY_GROUPS.size ? ` | ONLY groups: ${Array.from(ONLY_GROUPS).join(', ')}` : '')
    );

    const violations: Violation[] = [];

    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8');

      for (const rule of activeRules) {
        if (rule.kind === 'tagInner') {
          const hits = findTagInnerViolations(code, rule.tag, rule.ignoreIfNoText);
          for (const h of hits) {
            violations.push({
              file,
              line: lineNumberFromIndex(code, h.index),
              ruleId: rule.id,
              ruleName: rule.name,
              snippet: h.snippet,
            });
          }
        }

        if (rule.kind === 'jsxAttr') {
          const hits = findJsxAttrViolations(code, rule.attr);
          for (const h of hits) {
            violations.push({
              file,
              line: lineNumberFromIndex(code, h.index),
              ruleId: rule.id,
              ruleName: rule.name,
              snippet: h.snippet,
            });
          }
        }

        if (rule.kind === 'callArg') {
          const hits = findCallArgViolations(code, rule.call);
          for (const h of hits) {
            violations.push({
              file,
              line: lineNumberFromIndex(code, h.index),
              ruleId: rule.id,
              ruleName: rule.name,
              snippet: h.snippet,
            });
          }
        }

        if (rule.kind === 'assignment') {
          const hits = findAssignmentViolations(code, rule.left);
          for (const h of hits) {
            violations.push({
              file,
              line: lineNumberFromIndex(code, h.index),
              ruleId: rule.id,
              ruleName: rule.name,
              snippet: h.snippet,
            });
          }
        }
      }
    }

    if (violations.length) {
      const msg =
        `Found ${violations.length} i18n usage violations:\n\n` +
        violations
          .slice(0, 200)
          .map(
            (v) => `- ${v.file}:${v.line}\n` + `  [${v.ruleId}] ${v.ruleName}\n` + `  ${v.snippet}`
          )
          .join('\n\n') +
        (violations.length > 200 ? `\n\n…and ${violations.length - 200} more` : '');

      throw new Error(msg);
    }

    expect(violations.length).toBe(0);
  });
});

// -----------------------
// i18n runtime behavior tests
// -----------------------
import { getLang, setLang, onLangChange } from '../src/i18n/i18n';

describe('i18n runtime behavior', () => {
  const originalNavigator = navigator;
  let mockNavigator: { language: string; languages: string[] };

  beforeEach(() => {
    localStorage.clear();
    mockNavigator = { language: 'en', languages: ['en'] };
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('detectBrowserLang via getLang()', () => {
    it('should detect Japanese browser language', () => {
      mockNavigator.language = 'ja-JP';
      mockNavigator.languages = ['ja-JP', 'ja'];
      expect(getLang()).toBe('ja');
    });

    it('should detect French browser language', () => {
      mockNavigator.language = 'fr-FR';
      mockNavigator.languages = ['fr-FR', 'fr'];
      expect(getLang()).toBe('fr');
    });

    it('should detect German browser language', () => {
      mockNavigator.language = 'de-DE';
      mockNavigator.languages = ['de-DE', 'de'];
      expect(getLang()).toBe('de');
    });

    it('should fallback to English for unsupported languages', () => {
      mockNavigator.language = 'es-ES';
      mockNavigator.languages = ['es-ES', 'es'];
      expect(getLang()).toBe('en');
    });
  });

  describe('setLang()', () => {
    it('should not trigger listeners when setting same language', () => {
      localStorage.setItem('lang', 'en');
      const listener = vi.fn();
      const unsubscribe = onLangChange(listener);

      setLang('en'); // same as current
      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
    });

    it('should trigger listeners when setting different language', () => {
      localStorage.setItem('lang', 'en');
      const listener = vi.fn();
      const unsubscribe = onLangChange(listener);

      setLang('fr'); // different from current
      expect(listener).toHaveBeenCalledTimes(1);
      expect(getLang()).toBe('fr');

      unsubscribe();
    });

    it('should update localStorage when language changes', () => {
      setLang('ja');
      expect(localStorage.getItem('lang')).toBe('ja');

      setLang('de');
      expect(localStorage.getItem('lang')).toBe('de');
    });
  });

  describe('onLangChange()', () => {
    it('should register and unregister listeners', () => {
      const listener = vi.fn();
      const unsubscribe = onLangChange(listener);

      setLang('fr');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      setLang('de');
      expect(listener).toHaveBeenCalledTimes(1); // still 1, not called again
    });
  });
});
