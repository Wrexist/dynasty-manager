#!/usr/bin/env node
/**
 * Verify the countable claims in CLAUDE.md against the codebase.
 *
 * CLAUDE.md opens with "If the numbers below disagree with the code, trust the
 * code — and update this file." Nobody did: a week after it was last verified it
 * was wrong on the save schema version, the test-file count and the line counts
 * of three named files. A document that invites distrust of itself and then
 * earns it is worse than no document.
 *
 * Only mechanically checkable claims are covered — versions, counts, sizes.
 * Prose is left alone.
 *
 * Usage:
 *   node scripts/check-docs-drift.mjs         # report drift, exit 1 if any
 *   node scripts/check-docs-drift.mjs --fix   # rewrite CLAUDE.md in place
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = resolve(ROOT, 'CLAUDE.md');

const fix = process.argv.includes('--fix');

/** Count lines in a file, 0 if missing. */
function lines(rel) {
  try {
    return readFileSync(resolve(ROOT, rel), 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

/** Recursively count files matching a predicate. */
function countFiles(dir, pred) {
  let n = 0;
  let entries;
  try {
    entries = readdirSync(resolve(ROOT, dir), { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) n += countFiles(rel, pred);
    else if (pred(e.name, rel)) n++;
  }
  return n;
}

const saveVersion = (() => {
  const src = readFileSync(resolve(ROOT, 'src/utils/saveMigration.ts'), 'utf8');
  const m = src.match(/const CURRENT_VERSION = (\d+);/);
  return m ? Number(m[1]) : null;
})();

const testFiles = countFiles('src/test', name => /\.test\.tsx?$/.test(name));
const leagueFiles = countFiles('src/data/leagues', (name, rel) =>
  name.endsWith('.ts') && !rel.endsWith('index.ts'));

/**
 * Each check: a label, the value from the code, and a regex over CLAUDE.md
 * whose FIRST capture group is the documented number.
 */
const checks = [
  {
    label: 'save schema version',
    actual: saveVersion,
    // "save schema v78" in the header line.
    re: /save schema v(\d+)/,
  },
  {
    label: 'save schema version (Persistence section)',
    actual: saveVersion,
    re: /\*\*Save schema version `(\d+)`\*\*/,
  },
  {
    label: 'test file count',
    actual: testFiles,
    re: /(\d+) test files in `src\/test\/`/,
  },
  {
    label: 'test file count (Commands section)',
    actual: testFiles,
    re: /# Vitest \((\d+) test files\)/,
  },
  {
    label: 'league file count',
    actual: leagueFiles,
    re: /→ (\d+) league files/,
  },
  {
    label: 'weekAdvance.ts LOC',
    actual: lines('src/store/slices/orchestration/weekAdvance.ts'),
    re: /weekAdvance\.ts \((\d[\d,]*) LOC/,
  },
  {
    label: 'match.ts LOC',
    actual: lines('src/engine/match.ts'),
    re: /match simulation \((\d[\d,]*) LOC\)/,
  },
  {
    label: 'storeTypes.ts LOC',
    actual: lines('src/store/storeTypes.ts'),
    re: /complete `GameState` interface \((\d[\d,]*) LOC\)/,
  },
];

let doc = readFileSync(DOC, 'utf8');
const drift = [];

for (const check of checks) {
  const m = doc.match(check.re);
  if (!m) {
    drift.push({ ...check, documented: null, reason: 'claim not found in CLAUDE.md' });
    continue;
  }
  const documented = Number(m[1].replace(/,/g, ''));
  if (documented === check.actual) continue;
  drift.push({ ...check, documented, matched: m[0] });
  if (fix) {
    const replacement = m[0].replace(m[1], String(check.actual));
    doc = doc.replace(m[0], replacement);
  }
}

if (drift.length === 0) {
  console.log(`CLAUDE.md is in sync (${checks.length} claims checked).`);
  process.exit(0);
}

if (fix) {
  writeFileSync(DOC, doc);
  console.log(`Updated ${drift.length} claim(s) in CLAUDE.md:`);
  for (const d of drift) {
    if (d.documented === null) { console.log(`  ! ${d.label}: ${d.reason}`); continue; }
    console.log(`  ${d.label}: ${d.documented} -> ${d.actual}`);
  }
  // A missing claim cannot be auto-fixed.
  process.exit(drift.some(d => d.documented === null) ? 1 : 0);
}

console.error('CLAUDE.md has drifted from the code:\n');
for (const d of drift) {
  if (d.documented === null) console.error(`  ! ${d.label}: ${d.reason}`);
  else console.error(`  ${d.label}: documented ${d.documented}, actual ${d.actual}`);
}
console.error('\nRun `npm run docs:check -- --fix` to update the countable claims.');
process.exit(1);
