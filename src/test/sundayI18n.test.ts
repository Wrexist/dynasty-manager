/**
 * Sunday League copy — every key the screens ask for exists, and none is dead.
 *
 * The mode's UI strings go through `t()`, which resolves overlay → English →
 * THE KEY ITSELF. That last fallback is a kindness in production and a menace
 * in a test suite: a typo'd or deleted key renders as `sunday.hub.thing` on the
 * screen and throws nothing, so nothing fails and nobody notices until a
 * screenshot. Nine hundred lines of Sunday copy had no mechanical check at all.
 *
 * WHY THIS READS SOURCE FILES AS TEXT. The alternative is importing every
 * Sunday page, which drags React, framer-motion and nine lazy screens into a
 * fast unit suite to learn something a regex already knows. `sundayNav.test.ts`
 * and `renderHygiene.test.ts` use the same technique.
 *
 * WHY IT UNDERSTANDS PREFIXES. Two call sites compose their key from a tactic
 * id (`t(\`sunday.match.style.${oppStyle}\`)`). A naive scan calls all eight of
 * those keys orphans and invites somebody to delete live copy — which is a trap
 * a previous pass walked into. So dynamic sites are parsed as PREFIXES, each
 * prefix has to cover at least one defined key, and the two live ones are
 * additionally checked against the enumeration they are composed from.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { en } from '@/i18n/locales/en';
import { messages as sv } from '@/i18n/locales/sv';
import { t } from '@/i18n';
import { SUNDAY_TACTICS } from '@/config/sundayLeague';
import type { TranslationKey } from '@/i18n';

/**
 * Every non-test, non-locale source file.
 *
 * The two generated data blobs are skipped by name: `communityPack` alone is
 * ~395K lines of player rows, reading and regexing it costs seconds, and by
 * construction it contains no UI copy. Everything a human wrote is scanned,
 * including `src/config` and `src/store`, because keys are named by hand in the
 * navigation config as well as in `t()` calls.
 */
const GENERATED = new Set([
  path.join('src', 'data', 'communityPack'),
  path.join('src', 'data', 'nationalPlayerPool.ts'),
]);

function sourceFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.resolve(dir), { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (GENERATED.has(full)) continue;
    if (entry.isDirectory()) {
      if (entry.name === 'test' || full === path.join('src', 'i18n')) continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Read once. The scan touches every source file in the project, and running
 *  it per case turned a 0.2s test into a 5s one. */
const SOURCES: { file: string; text: string }[] = sourceFiles()
  .map(file => ({ file, text: fs.readFileSync(path.resolve(file), 'utf8') }));

/** `'sunday.x.y'` / `"sunday.x.y"` anywhere in the source — `t()` calls, the
 *  `labelKey` fields in the navigation config, and anything else that names a
 *  key by hand. */
function usedLiterals(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const { file, text } of SOURCES) {
    for (const m of text.matchAll(/['"](sunday\.[A-Za-z0-9_.-]+)['"]/g)) {
      const list = out.get(m[1]) ?? [];
      list.push(file);
      out.set(m[1], list);
    }
  }
  return out;
}

/** ``t(`sunday.match.style.${x}`)`` → the prefix `sunday.match.style.`. */
function usedPrefixes(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const { file, text } of SOURCES) {
    for (const m of text.matchAll(/`(sunday\.[A-Za-z0-9_.-]*)\$\{/g)) {
      const list = out.get(m[1]) ?? [];
      list.push(file);
      out.set(m[1], list);
    }
  }
  return out;
}

const DEFINED = Object.keys(en).filter(k => k.startsWith('sunday.'));
const USED = usedLiterals();
const PREFIXES = usedPrefixes();

describe('Sunday copy resolves', () => {
  it('every key the source names is defined in English', () => {
    const used = USED;
    const missing = [...used.entries()]
      .filter(([key]) => !(key in en))
      .map(([key, files]) => `${key} (${[...new Set(files)].join(', ')})`);
    expect(missing, `keys that would render as their own name:\n${missing.join('\n')}`).toEqual([]);
    // ...and the scan found something, so a broken regex cannot pass this file.
    expect(used.size, 'the key scan found nothing — the regex is broken').toBeGreaterThan(150);
  });

  it('every composed key resolves for every value it is composed from', () => {
    const prefixes = PREFIXES;
    expect(prefixes.size, 'no composed keys found — the prefix scan is broken').toBeGreaterThan(0);
    for (const [prefix, files] of prefixes) {
      const covered = DEFINED.filter(k => k.startsWith(prefix));
      expect(covered.length, `${prefix}* is composed in ${files.join(', ')} and defines nothing`)
        .toBeGreaterThan(0);
    }
    // The two live sites both compose from a tactic id, so the enumeration is
    // known and every member of it must land. This is the assertion a prefix
    // check alone cannot make: `sunday.match.style.` having ONE key would
    // satisfy the loop above and still leave three opponents undescribed.
    for (const tactic of SUNDAY_TACTICS) {
      for (const prefix of ['sunday.match.style.', 'sunday.match.counter.']) {
        const key = `${prefix}${tactic.id}`;
        expect(prefixes.has(prefix), `${prefix} is no longer composed anywhere`).toBe(true);
        expect(en, `${key} is missing — the opponent's shape would render as a key`)
          .toHaveProperty(key);
      }
    }
  });

  it('no Sunday key is dead copy', () => {
    const used = USED;
    const prefixes = [...PREFIXES.keys()];
    const orphans = DEFINED.filter(k => !used.has(k) && !prefixes.some(p => k.startsWith(p)));
    // Orphans are not a crash, they are drift: copy nobody reads, translated
    // and reviewed forever. Wave 6 cleared twenty-three of them; this keeps the
    // count at zero so the next clean-up is a deletion, not an investigation.
    expect(orphans, `Sunday keys nothing reads:\n${orphans.join('\n')}`).toEqual([]);
  });

  it('no Sunday string is blank, and none is left as a placeholder', () => {
    for (const key of DEFINED) {
      const value = en[key as TranslationKey];
      expect(typeof value, key).toBe('string');
      expect(value.trim().length, `${key} is empty`).toBeGreaterThan(0);
      expect(value, `${key} still contains a TODO`).not.toMatch(/\bTODO\b/);
      // A `{placeholder}` that was never given a name is a rendering bug
      // waiting for a screenshot.
      expect(value, `${key} has an empty placeholder`).not.toContain('{}');
    }
  });

  it('resolves through t() rather than falling through to the key', () => {
    // The end-to-end version of the first case: `t()` must return copy, not the
    // id it was asked for. Cheap, and it covers the resolution path itself
    // rather than just the presence of the key in the object.
    for (const key of DEFINED) {
      expect(t(key as TranslationKey), `${key} fell through to its own name`).not.toBe(key);
    }
  });

  it('the Swedish overlay never invents a key English does not have', () => {
    // Every locale is a PARTIAL of English, so a key here that English lacks is
    // dead weight that can never be reached — and usually a rename that only
    // got applied on one side.
    const unknown = Object.keys(sv).filter(k => k.startsWith('sunday.') && !(k in en));
    expect(unknown, `Swedish keys with no English original:\n${unknown.join('\n')}`).toEqual([]);
  });
});
