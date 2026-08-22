#!/usr/bin/env node
/**
 * Eager first-load bundle budget.
 *
 * Sums the gzipped size of the JS the browser pulls at startup — the entry
 * chunk plus every `<link rel="modulepreload">` chunk referenced from
 * dist/index.html — and fails if it exceeds `eagerGzHardLimitBytes` in
 * .github/bundle-budget.json.
 *
 * Why this exists alongside the on-disk core-JS guard in pr-checks.yml: that
 * guard counts every chunk the same whether or not it loads at boot, so it
 * cannot see a lazy chunk slipping into the eager graph (e.g. a 2.1MB data
 * chunk merged into an eagerly-imported chunk by a stray manualChunks match or
 * a static import). This guard measures exactly the first-load payload, which
 * is what first-paint UX depends on.
 *
 * ALSO enforces `mainChunkHardLimitBytes` — the uncompressed size of the
 * largest index-*.js — mirroring the check in pr-checks.yml.
 *
 * WHY THE DUPLICATION. That budget used to be enforced ONLY by the CI shell
 * script, so `npm run preflight` could pass while CI failed on the very next
 * push. It did exactly that: a branch shipped green locally and CI rejected the
 * main chunk at 1,285,939 bytes. A local gate that does not check what the
 * remote gate checks is not a gate. Both read the same
 * .github/bundle-budget.json, so there is one number, not two.
 *
 * Run after `npm run build`. Usage: `node scripts/check-eager-bundle.mjs`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = 'dist';
const BUDGET_FILE = '.github/bundle-budget.json';

const fail = (msg) => { console.error(`::error::${msg}`); process.exit(1); };
const kb = (bytes) => (bytes / 1024).toFixed(1);

let html;
try {
  html = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
  fail('dist/index.html not found — run `npm run build` first.');
}

let limit;
let mainLimit;
try {
  const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
  limit = budget.eagerGzHardLimitBytes;
  mainLimit = budget.mainChunkHardLimitBytes;
} catch {
  fail(`Could not read ${BUDGET_FILE}`);
}
if (!limit) fail(`Missing eagerGzHardLimitBytes in ${BUDGET_FILE}`);
if (!mainLimit) fail(`Missing mainChunkHardLimitBytes in ${BUDGET_FILE}`);

// Entry <script src> + every modulepreload <link href> resolve to /assets/*.js.
const refs = [...new Set(
  [...html.matchAll(/\/assets\/([A-Za-z0-9_-]+\.js)/g)].map((m) => m[1]),
)];
if (refs.length === 0) fail('No /assets/*.js references found in dist/index.html');

let total = 0;
const rows = [];
for (const file of refs) {
  const gz = gzipSync(readFileSync(join(DIST, 'assets', file))).length;
  total += gz;
  rows.push([file, gz]);
}
rows.sort((a, b) => b[1] - a[1]);

console.log('Eager first-load payload (entry + modulepreload, gzipped):');
for (const [file, gz] of rows) console.log(`  ${kb(gz).padStart(8)} kB  ${file}`);
console.log(`  ── TOTAL ${kb(total)} kB gz across ${rows.length} files (hard limit ${kb(limit)} kB)`);

if (total > limit) {
  fail(
    `Eager first-load payload ${kb(total)} kB gz exceeds the ${kb(limit)} kB hard limit. ` +
    'A lazy chunk likely entered the boot graph — check vite.config manualChunks and ' +
    'static imports of large data modules. If this is a deliberate ceiling raise, bump ' +
    `eagerGzHardLimitBytes in ${BUDGET_FILE} with reasoning.`,
  );
}
console.log(`Eager bundle OK — ${kb(limit - total)} kB gz headroom.`);

// Main chunk — uncompressed, same rule pr-checks.yml applies: the LARGEST
// index-*.js in dist/assets, not the first one found. There are several
// (Vite names more than one chunk `index-*`), and picking the wrong one
// silently measures a 700-byte file against a 1.3 MB budget.
const mainCandidates = readdirSync(join(DIST, 'assets'))
  .filter((f) => /^index-.*\.js$/.test(f))
  .map((f) => [f, statSync(join(DIST, 'assets', f)).size])
  .sort((a, b) => b[1] - a[1]);

if (mainCandidates.length === 0) {
  fail('No index-*.js found in dist/assets — build output looks wrong.');
}
const [mainFile, mainSize] = mainCandidates[0];
console.log(`Main chunk: ${kb(mainSize)} kB uncompressed (${mainFile}, hard limit ${kb(mainLimit)} kB)`);
if (mainSize > mainLimit) {
  fail(
    `Main chunk ${kb(mainSize)} kB exceeds the ${kb(mainLimit)} kB hard limit. ` +
    'Trim what is eagerly imported, or — if this is a deliberate ceiling raise — bump ' +
    `mainChunkHardLimitBytes in ${BUDGET_FILE} with the measurement and the reasoning.`,
  );
}
console.log(`Main chunk OK — ${kb(mainLimit - mainSize)} kB headroom.`);
