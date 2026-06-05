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
 * Run after `npm run build`. Usage: `node scripts/check-eager-bundle.mjs`.
 */
import { readFileSync } from 'node:fs';
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
try {
  limit = JSON.parse(readFileSync(BUDGET_FILE, 'utf8')).eagerGzHardLimitBytes;
} catch {
  fail(`Could not read ${BUDGET_FILE}`);
}
if (!limit) fail(`Missing eagerGzHardLimitBytes in ${BUDGET_FILE}`);

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
