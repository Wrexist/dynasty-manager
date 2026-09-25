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
 * EVERY OCCURRENCE IS CHECKED. The first version matched each claim once
 * (a non-global `String.match`), so a number repeated elsewhere drifted
 * unseen: weekAdvance.ts was right in the architecture tree and ~400 lines
 * stale in Critical Files and Tech Debt, and the gate stayed green. Each
 * pattern below is now applied globally, every match must agree with the
 * code, and a claim with no match at all is itself drift.
 *
 * Only mechanically checkable claims are covered — versions, counts, sizes.
 * Prose is left alone.
 *
 * The app version is checked against the top SEALED entry of
 * src/data/whatsNew.ts ("latest shipped v…"), not package.json: the TestFlight
 * and Android workflows run `npm version <input>` on the runner before
 * `preflight:full`, and release.yml bumps package.json in a bot commit, so a
 * package.json-based claim would fail those builds for a mutation that is never
 * committed. The sealed entry only moves in a commit someone runs preflight on.
 *
 * Usage:
 *   node scripts/check-docs-drift.mjs         # report drift, exit 1 if any
 *   node scripts/check-docs-drift.mjs --fix   # rewrite CLAUDE.md in place
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(root, rel) {
  try {
    return readFileSync(resolve(root, rel), 'utf8');
  } catch {
    return '';
  }
}

/** Count lines in a file, 0 if missing. */
function lines(root, rel) {
  const src = read(root, rel);
  return src ? src.split('\n').length : 0;
}

/** Recursively count files matching a predicate. */
function countFiles(root, dir, pred) {
  let n = 0;
  let entries;
  try {
    entries = readdirSync(resolve(root, dir), { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) n += countFiles(root, rel, pred);
    else if (pred(e.name, rel)) n++;
  }
  return n;
}

/**
 * A "<file> … (N LOC" claim. The gap between the file name and the number may
 * not contain another `.ts`/`.tsx` name or a parenthesis, so in
 * "`weekAdvance.ts` (3,094 LOC) and `Dashboard.tsx` (2,192 LOC)" each number
 * is attributed to its own file.
 */
function locClaim(name) {
  return new RegExp(`${name}(?:(?!\\.tsx?\\b)[^\\n(]){0,60}\\((\\d[\\d,]*) LOC`, 'g');
}

/** Declared version of a dependency, without its range operator. */
function declared(pkg, name) {
  const spec = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  return spec ? spec.replace(/^[^\d]*/, '') : null;
}

/**
 * Every check: a label, the value from the code, and a regex over CLAUDE.md
 * whose FIRST capture group is the documented value. Numeric checks compare
 * numbers (commas ignored). Version checks (`kind: 'version'`) accept a
 * documented version that is a dot-segment prefix of the actual one, so
 * "Framer Motion 12.38" matches ^12.38.0.
 */
export function buildChecks(root = REPO_ROOT) {
  const saveVersion = (() => {
    const m = read(root, 'src/utils/saveMigration.ts').match(/const CURRENT_VERSION = (\d+);/);
    return m ? Number(m[1]) : null;
  })();

  const latestShipped = (() => {
    const src = read(root, 'src/data/whatsNew.ts');
    const open = src.search(/export const RELEASE_NOTES:\s*ReleaseNote\[\]\s*=\s*\[/);
    if (open < 0) return null;
    const m = src.slice(open).match(/version\s*:\s*['"](\d+\.\d+\.\d+)['"]/);
    return m ? m[1] : null;
  })();

  // Selectable national teams: `NATIONS` minus the legacy aliases that
  // `SELECTABLE_NATIONS` filters out (kept only so old saves resolve).
  const nationalTeams = (() => {
    const src = read(root, 'src/data/nations.ts');
    const start = src.indexOf('export const NATIONS');
    const end = src.indexOf('\n];', start);
    if (start < 0 || end < 0) return null;
    const entries = (src.slice(start, end).match(/^\s*\{\s*name:/gm) ?? []).length;
    const aliases = src.match(/SELECTABLE_NATIONS\s*=\s*NATIONS\.filter\([^[]*\[([^\]]*)\]/);
    const aliasCount = aliases ? (aliases[1].match(/'[^']*'/g) ?? []).length : 0;
    return entries - aliasCount;
  })();

  const testFiles = countFiles(root, 'src/test', name => /\.test\.tsx?$/.test(name));
  const leagueFiles = countFiles(root, 'src/data/leagues', (name, rel) =>
    name.endsWith('.ts') && !rel.endsWith('index.ts'));
  const configFiles = countFiles(root, 'src/config', name => /\.tsx?$/.test(name));
  const uiFiles = countFiles(root, 'src/components/ui', name => /\.tsx?$/.test(name));
  // Top-level `*Slice.ts` files only — the orchestration/ and sunday/
  // subfolders hold the slices' helpers, not slices of their own.
  const slices = (() => {
    try {
      return readdirSync(resolve(root, 'src/store/slices')).filter(f => /Slice\.ts$/.test(f)).length;
    } catch {
      return null;
    }
  })();
  const storeHelpers = countFiles(root, 'src/store/helpers', name => name.endsWith('.ts'));

  let pkg = {};
  try { pkg = JSON.parse(read(root, 'package.json')); } catch { /* versions report as uncomputable */ }

  const orch = 'src/store/slices/orchestration';
  return [
    // ── Save schema ──
    { label: 'save schema version (header)', actual: saveVersion, re: /save schema v(\d+)/g },
    { label: 'save schema version (Persistence section)', actual: saveVersion, re: /\*\*Save schema version `(\d+)`\*\*/g },
    { label: 'save schema version (Architecture tree)', actual: saveVersion, re: /saveMigration \(v(\d+)\)/g },
    { label: 'save schema version (Critical Files)', actual: saveVersion, re: /save schema `CURRENT_VERSION = (\d+)`/g },

    // ── Shipped version ──
    { label: 'latest shipped version (top of whatsNew.ts)', actual: latestShipped, kind: 'version', re: /latest shipped v(\d+\.\d+\.\d+)/g },

    // ── File counts ──
    { label: 'test file count', actual: testFiles, re: /(\d+) test files in `src\/test\/`/g },
    { label: 'test file count (Commands section)', actual: testFiles, re: /# Vitest \((\d+) test files\)/g },
    { label: 'test file count (Architecture tree)', actual: testFiles, re: /→ (\d+) test files incl\./g },
    { label: 'league file count', actual: leagueFiles, re: /→ (\d+) league files/g },
    { label: 'config file count (Architecture tree)', actual: configFiles, re: /config\/\s+→ (\d+) files/g },
    { label: 'config file count (slash commands)', actual: configFiles, re: /across the (\d+) config files/g },
    { label: 'shadcn/ui file count (Tech Stack)', actual: uiFiles, re: /(\d+) files in `src\/components\/ui\/`/g },
    { label: 'shadcn/ui file count (Architecture tree)', actual: uiFiles, re: /ui\/\s+→ (\d+) shadcn\/ui files/g },
    { label: 'store slice count', actual: slices, re: /(\d+) slices\b/g },
    { label: 'store helper count', actual: storeHelpers, re: /\*\*\d+ slices\*\* \+ (\d+) helpers/g },
    { label: 'national team count', actual: nationalTeams, re: /(\d+) national teams/g },

    // ── Line counts of the named files ──
    { label: 'weekAdvance.ts LOC', actual: lines(root, `${orch}/weekAdvance.ts`), re: locClaim('weekAdvance\\.ts') },
    { label: 'seasonEnd.ts LOC', actual: lines(root, `${orch}/seasonEnd.ts`), re: locClaim('seasonEnd\\.ts') },
    { label: 'matchActions.ts LOC', actual: lines(root, `${orch}/matchActions.ts`), re: locClaim('\\bmatchActions\\.ts') },
    { label: 'initGame.ts LOC', actual: lines(root, `${orch}/initGame.ts`), re: locClaim('initGame\\.ts') },
    { label: 'orchestrationSlice.ts LOC', actual: lines(root, 'src/store/slices/orchestrationSlice.ts'), re: locClaim('orchestrationSlice\\.ts') },
    { label: 'engine/match.ts LOC', actual: lines(root, 'src/engine/match.ts'), re: locClaim('\\bmatch\\.ts') },
    { label: 'types/game.ts LOC', actual: lines(root, 'src/types/game.ts'), re: locClaim('\\bgame\\.ts') },
    { label: 'storeTypes.ts LOC', actual: lines(root, 'src/store/storeTypes.ts'), re: locClaim('storeTypes\\.ts') },
    { label: 'Dashboard.tsx LOC', actual: lines(root, 'src/pages/Dashboard.tsx'), re: locClaim('\\bDashboard(?:\\.tsx)?') },

    // ── Tech Stack versions (as declared in package.json) ──
    ...[
      ['React', 'react', /\*\*React (\d[\d.]*)\*\*/g],
      ['TypeScript', 'typescript', /\*\*TypeScript (\d[\d.]*)\*\*/g],
      ['Vite', 'vite', /\*\*Vite (\d[\d.]*)\*\*/g],
      ['Tailwind CSS', 'tailwindcss', /\*\*Tailwind CSS (\d[\d.]*)\*\*/g],
      ['Zustand', 'zustand', /\*\*Zustand (\d[\d.]*)\*\*/g],
      ['React Router DOM', 'react-router-dom', /\*\*React Router DOM (\d[\d.]*)\*\*/g],
      ['Framer Motion', 'framer-motion', /\*\*Framer Motion (\d[\d.]*)\*\*/g],
      ['Recharts', 'recharts', /\*\*Recharts (\d[\d.]*)\*\*/g],
      ['Sonner', 'sonner', /\*\*Sonner (\d[\d.]*)\*\*/g],
      ['Capacitor', '@capacitor/core', /\*\*Capacitor (\d[\d.]*)\*\*/g],
      ['RevenueCat', '@revenuecat/purchases-capacitor', /`@revenuecat\/purchases-capacitor` (\d[\d.]*)/g],
      ['Sentry', '@sentry/react', /`@sentry\/react` (\d[\d.]*)/g],
      ['Vitest', 'vitest', /\*\*Vitest (\d[\d.]*)/g],
      ['Husky', 'husky', /\*\*Husky (\d[\d.]*)/g],
      ['lint-staged', 'lint-staged', /lint-staged (\d[\d.]*)\*\*/g],
    ].map(([label, name, re]) => ({
      label: `${label} version`, actual: declared(pkg, name), kind: 'version', re,
    })),
  ];
}

function agrees(check, documented) {
  if (check.kind === 'version') {
    const doc = documented.replace(/\.$/, '').split('.');
    const act = String(check.actual).split('.');
    return doc.every((part, i) => part === act[i]);
  }
  return Number(documented.replace(/,/g, '')) === check.actual;
}

/** Render `actual` in the documented value's style: a count keeps its
 *  thousands separator, a version keeps its documented precision. */
function render(check, documented) {
  if (check.kind === 'version') {
    const depth = documented.replace(/\.$/, '').split('.').length;
    return String(check.actual).split('.').slice(0, depth).join('.');
  }
  return documented.includes(',') ? check.actual.toLocaleString('en-US') : String(check.actual);
}

/**
 * Compare every occurrence of every claim with the code. Returns the drift —
 * one entry per disagreeing occurrence, plus one per claim that is missing or
 * cannot be computed — and the document with every disagreeing occurrence
 * rewritten, which is what `--fix` writes.
 */
export function findDrift(doc, checks) {
  const drift = [];
  let fixed = doc;
  for (const check of checks) {
    const flags = check.re.flags.includes('g') ? check.re.flags : `${check.re.flags}g`;
    const re = new RegExp(check.re.source, flags);
    if (check.actual === null || check.actual === undefined) {
      drift.push({ label: check.label, documented: null, actual: null, reason: 'value could not be computed from the code' });
      continue;
    }
    const matches = [...doc.matchAll(re)];
    if (matches.length === 0) {
      drift.push({ label: check.label, documented: null, actual: check.actual, reason: 'claim not found in CLAUDE.md' });
      continue;
    }
    for (const m of matches) {
      if (!agrees(check, m[1])) {
        drift.push({ label: check.label, documented: m[1], actual: check.actual, matched: m[0] });
      }
    }
    fixed = fixed.replace(re, (full, documented) =>
      (agrees(check, documented) ? full : full.replace(documented, render(check, documented))));
  }
  return { drift, fixed };
}

function main() {
  const fix = process.argv.includes('--fix');
  const docPath = resolve(REPO_ROOT, 'CLAUDE.md');
  const doc = readFileSync(docPath, 'utf8');
  const checks = buildChecks(REPO_ROOT);
  const { drift, fixed } = findDrift(doc, checks);

  if (drift.length === 0) {
    console.log(`CLAUDE.md is in sync (${checks.length} claims checked at every occurrence).`);
    process.exit(0);
  }

  const unfixable = drift.filter(d => d.documented === null);
  if (fix) {
    writeFileSync(docPath, fixed);
    console.log(`Updated ${drift.length - unfixable.length} occurrence(s) in CLAUDE.md:`);
    for (const d of drift) {
      if (d.documented === null) console.log(`  ! ${d.label}: ${d.reason}`);
      else console.log(`  ${d.label}: ${d.documented} -> ${d.actual}`);
    }
    // A missing claim cannot be auto-fixed.
    process.exit(unfixable.length > 0 ? 1 : 0);
  }

  console.error('CLAUDE.md has drifted from the code:\n');
  for (const d of drift) {
    if (d.documented === null) console.error(`  ! ${d.label}: ${d.reason}`);
    else console.error(`  ${d.label}: documented ${d.documented}, actual ${d.actual} — "${d.matched.trim()}"`);
  }
  console.error('\nRun `npm run docs:check -- --fix` to update the countable claims.');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
