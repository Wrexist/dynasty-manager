#!/usr/bin/env node
/**
 * Count user-visible strings that are still hardcoded English.
 *
 * WHY THIS EXISTS. The critical review filed i18n as "~490 files with hardcoded
 * English". That number was a file count, not a work estimate, and it made the
 * job look unbounded — which is part of why it stayed untouched. What matters is
 * how many STRINGS a player can actually see, and which screens they are on.
 * This prints that, so progress is a measurement rather than a feeling.
 *
 * WHAT COUNTS. Only surfaces a player reads: `src/pages` and
 * `src/components/game`. The match engine, `src/config/`, and anything that
 * produces stored strings are game data and logic, not presentation, and are
 * deliberately out of scope (see the header of `src/i18n/index.ts`).
 *
 * HEURISTIC, NOT A PARSER. This greps rather than walking a TS AST, so it will
 * miss some strings and occasionally flag a non-string. It is a progress meter,
 * not a gate — which is why it exits 0 unless `--max` is given. Treat a drop in
 * the count as real and the absolute number as approximate.
 *
 *   node scripts/check-i18n-coverage.mjs             # summary
 *   node scripts/check-i18n-coverage.mjs --by-file   # worst files first
 *   node scripts/check-i18n-coverage.mjs --max 900   # fail above a ceiling
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SCAN = ['src/pages', 'src/components/game'];

/** Attributes whose string value is read aloud or displayed.
 *
 *  The first version covered only the ARIA/HTML set and reported "0 remaining"
 *  while 85 strings of long-form copy sat in custom props like `body=` and
 *  `description=` — the help text and confirmation dialogs, some of the most
 *  word-heavy copy in the app. A meter that cannot see the biggest strings is
 *  worse than no meter, because it invites exactly that false all-clear. */
const TEXT_ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'body', 'description', 'subtitle', 'heading', 'hint', 'caption', 'tooltip', 'label'];

/** Copy that must never be translated, so it is not "remaining work". */
const NEVER_TRANSLATE = new Set(['Dynasty Manager']);

/** Lines that are never player-visible copy. */
const SKIP_LINE = [
  /^\s*(import|export)\s/,
  /^\s*\/\//,
  /^\s*\*/,
  /className=/,
  /data-testid=/,
];

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(full));
    else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Strings in one file that look like player-facing copy and are not already
 * routed through `t()`.
 */
function findHardcoded(source) {
  const hits = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_LINE.some(re => re.test(line))) continue;
    // Already translated on this line — the common case once a file is migrated.
    if (/\bt\(\s*['"]/.test(line)) continue;

    // JSX text nodes: >Some words here<
    //
    // A regex cannot tell `>Save squad<` from `a > b && c < d`, from a ternary
    // chain (`x > y ? 'W' : z < w`), or from a type generic (`Record<string,
    // X>`). All three read identically. Lines carrying that syntax are skipped
    // wholesale rather than picked apart — the same rule the bulk migration
    // used, so the meter and the migration agree on what counts.
    const lineIsCodey =
      /Record<|Array<|Map<|Set<|Promise<|React\.\w+<|=>|&&|\|\||===|!==|>=|<=| \? | : /.test(line);
    if (!lineIsCodey) {
      for (const m of line.matchAll(/>([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g)) {
        const text = m[1].trim();
        // Needs a space or a capital: filters out stray identifiers and units.
        if (text.length < 4) continue;
        if (!/[A-Za-z]/.test(text)) continue;
        if (!/\s/.test(text) && !/^[A-Z]/.test(text)) continue;
        if (NEVER_TRANSLATE.has(text)) continue;
        hits.push({ line: i + 1, text });
      }
    }

    // Displayed / announced attribute literals.
    for (const attr of TEXT_ATTRS) {
      const re = new RegExp(`${attr}=(?:"([^"]{4,})"|'([^']{4,})')`, 'g');
      for (const m of line.matchAll(re)) {
        const text = (m[1] ?? m[2]).trim();
        if (!/[A-Za-z]{2,}/.test(text)) continue;
        if (NEVER_TRANSLATE.has(text)) continue;
        hits.push({ line: i + 1, text: `${attr}="${text}"` });
      }
    }
  }
  return hits;
}

const files = SCAN.flatMap(d => walk(resolve(ROOT, d)));
const perFile = [];
let total = 0;
for (const file of files) {
  const hits = findHardcoded(readFileSync(file, 'utf8'));
  if (hits.length === 0) continue;
  perFile.push({ file: relative(ROOT, file), count: hits.length, hits });
  total += hits.length;
}
perFile.sort((a, b) => b.count - a.count);

const byFile = process.argv.includes('--by-file');
const maxIdx = process.argv.indexOf('--max');
const max = maxIdx === -1 ? null : Number(process.argv[maxIdx + 1]);

// "clean" means no hardcoded copy was DETECTED — many of these files are icons,
// wrappers or pure layout that never had any. It is not a migration count.
const clean = files.length - perFile.length;
console.log(
  `i18n: ${total} hardcoded player-facing strings across ${perFile.length} files ` +
  `(${clean}/${files.length} scanned files show none).`,
);

if (byFile) {
  console.log('');
  for (const f of perFile.slice(0, 25)) {
    console.log(`  ${String(f.count).padStart(4)}  ${f.file}`);
  }
  if (perFile.length > 25) console.log(`  … and ${perFile.length - 25} more files`);
}

if (max !== null && total > max) {
  console.error(`\nOver the ceiling: ${total} > ${max}.`);
  process.exit(1);
}
