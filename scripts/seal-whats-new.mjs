#!/usr/bin/env node
/**
 * seal-whats-new.mjs — fold `pendingNews.ts` into `whatsNew.ts`.
 *
 * The seal step runs whenever the *current* `package.json.version` has
 * advanced past the top of `whatsNew.ts`. It:
 *
 *   1. Reads the staged bullets from `src/data/pendingNews.ts`.
 *   2. Builds a new ReleaseNote (version, date, build:null, headline,
 *      summary, bullets) — using the manual headline/summary overrides if
 *      set, otherwise auto-generating them the same way the old
 *      `build-whats-new.mjs` did.
 *   3. Prepends the new entry to `src/data/whatsNew.ts`.
 *   4. Resets `pendingNews.ts` back to empty so the *next* version starts
 *      fresh.
 *
 * Idempotent: if `package.json.version === whatsNew.ts[0].version`, no-op
 * (the seal already happened, or nothing was bumped).
 *
 * Empty-pending fallback: if there are zero bullets when seal triggers, we
 * emit a single placeholder `improved` bullet ("Stability and polish
 * improvements.") rather than blocking the build. Players prefer a small
 * note over an empty card.
 *
 * Usage:
 *   node scripts/seal-whats-new.mjs              # seal if needed
 *   node scripts/seal-whats-new.mjs --dry-run    # preview, no writes
 *   node scripts/seal-whats-new.mjs --force      # seal even if versions match
 *
 * Exits 0 on success or no-op, 1 on errors. Designed to be called from
 * `prebuild` (idempotent on dev builds) and the iOS TestFlight workflow.
 */

import {
  PENDING_NEWS_PATH,
  WHATS_NEW_PATH,
  buildAutoHeadline,
  buildAutoSummary,
  findArrayStart,
  parsePendingNews,
  parseTopEntry,
  readFile,
  readPkgVersion,
  renderEntry,
  todayIso,
  writeFile,
  writePendingNews,
} from './lib/whatsNewIO.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function info(msg) {
  console.log(`  ⓘ ${msg}`);
}

function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

const EMPTY_PENDING = {
  highlights: [],
  new: [],
  improved: [],
  fixed: [],
  headline: null,
  summary: null,
};

const STABILITY_FALLBACK_BULLET = 'Stability and polish improvements.';

function main() {
  const pkgVersion = readPkgVersion();
  const whatsNewSource = readFile(WHATS_NEW_PATH);
  const pendingSource = readFile(PENDING_NEWS_PATH);

  const top = parseTopEntry(whatsNewSource);
  const pending = parsePendingNews(pendingSource);

  console.log('═'.repeat(60));
  console.log("Seal What's New");
  console.log('═'.repeat(60));
  console.log(`  package.json:    v${pkgVersion}`);
  console.log(`  whatsNew.ts top: ${top?.fields ? `v${top.fields.version} (${top.fields.date})` : '(empty)'}`);
  const totalBullets = (
    pending.fields.highlights.length +
    pending.fields.new.length +
    pending.fields.improved.length +
    pending.fields.fixed.length
  );
  console.log(`  Pending bullets: ${totalBullets}`);
  console.log('');

  // Idempotency: if the top entry already matches the current version, the
  // seal already happened (or this is a manual edit). Don't double-seal.
  if (top?.fields && top.fields.version === pkgVersion && !FORCE) {
    info(`v${pkgVersion} is already sealed in whatsNew.ts — nothing to do.`);
    if (totalBullets > 0) {
      console.log('');
      console.log(`  ⚠  pendingNews.ts has ${totalBullets} bullet(s) but the current version is already sealed.`);
      console.log('     These bullets will be sealed when package.json is bumped to the next version.');
    }
    return;
  }

  // Build the new sealed entry.
  let { highlights, new: news, improved, fixed, headline, summary } = pending.fields;
  let usedFallback = false;
  if (totalBullets === 0) {
    improved = [STABILITY_FALLBACK_BULLET];
    usedFallback = true;
  }

  const sealedFields = {
    version: pkgVersion,
    buildRaw: 'null',
    date: todayIso(),
    headline: headline || buildAutoHeadline({ highlights, new: news, improved, fixed }),
    summary: summary || buildAutoSummary({ highlights, new: news, improved, fixed }),
    highlights,
    new: news,
    improved,
    fixed,
  };

  console.log(`  → Sealing v${pkgVersion} (date ${sealedFields.date})`);
  if (usedFallback) {
    console.log(`     (pending was empty — used "${STABILITY_FALLBACK_BULLET}" fallback)`);
  }
  console.log(`     Headline: "${sealedFields.headline}"  ${headline ? '[manual]' : '[auto]'}`);
  console.log(`     Summary:  "${sealedFields.summary}"  ${summary ? '[manual]' : '[auto]'}`);
  for (const cat of ['highlights', 'new', 'improved', 'fixed']) {
    const list = sealedFields[cat] || [];
    if (list.length === 0) continue;
    console.log(`     ${cat}:`);
    for (const b of list) console.log(`       • ${b}`);
  }

  if (DRY_RUN) {
    console.log('');
    info('Dry-run — no files written.');
    return;
  }

  // Splice the new entry into whatsNew.ts at the head of RELEASE_NOTES.
  const arrayStart = findArrayStart(whatsNewSource);
  if (arrayStart < 0) {
    fail('Could not find `export const RELEASE_NOTES` in src/data/whatsNew.ts');
  }
  const rendered = renderEntry(sealedFields, { indent: '  ' });
  const newWhatsNew =
    whatsNewSource.slice(0, arrayStart) +
    `\n${rendered},` +
    whatsNewSource.slice(arrayStart);
  writeFile(WHATS_NEW_PATH, newWhatsNew);
  ok(`Prepended sealed entry to src/data/whatsNew.ts`);

  // Reset pending back to empty.
  const newPending = writePendingNews(pendingSource, EMPTY_PENDING);
  writeFile(PENDING_NEWS_PATH, newPending);
  ok(`Reset src/data/pendingNews.ts`);
}

try {
  main();
} catch (err) {
  fail(err.message || String(err));
}
