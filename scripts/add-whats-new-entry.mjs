#!/usr/bin/env node
/**
 * add-whats-new-entry.mjs — the "smooth path" for authoring release notes.
 *
 * Writes to `src/data/pendingNews.ts` — the staging area for the *next*,
 * unshipped version. When `package.json.version` advances past the top of
 * `whatsNew.ts`, `scripts/seal-whats-new.mjs` folds these bullets into a new
 * sealed entry and resets the pending file.
 *
 * Usage (via `npm run whats-new -- <cmd> [arg]`):
 *
 *   npm run whats-new -- new       "Short, player-facing description."
 *   npm run whats-new -- improved  "Describe an improvement."
 *   npm run whats-new -- fixed     "Describe a user-visible bug fix."
 *   npm run whats-new -- highlight "Marquee change worth calling out."
 *
 *   npm run whats-new -- headline  "Faster matches, sharper AI."
 *   npm run whats-new -- summary   "One to three sentence player summary."
 *   npm run whats-new -- clear     # reset the pending entry to empty
 *
 *   npm run whats-new -- show      # print pending + last shipped status
 *
 * Behaviour:
 *   - `headline` / `summary` are optional manual overrides. Leave them unset
 *     (`null`) to let the seal step auto-generate them from the lead bullets.
 *   - Bullets are normalised (capitalised + trailing period) before write,
 *     so "fixed crash" / "Fixed crash." / "Fixed crash" all dedupe to one.
 *   - `clear` is destructive on the pending file only — sealed entries in
 *     `whatsNew.ts` are never touched.
 *
 * Philosophy: one command, no prompts, idempotent. Safe to run repeatedly.
 */

import {
  CATEGORY_ALIASES,
  CATEGORIES,
  PENDING_NEWS_PATH,
  WHATS_NEW_PATH,
  parsePendingNews,
  parseTopEntry,
  readFile,
  readPkgVersion,
  writePendingNews,
  writeFile,
  normaliseBullet,
} from './lib/whatsNewIO.mjs';

/* ────────────────────────────────────────────────────────────────────────
 * CLI parsing
 * ──────────────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

const cmd = args[0].toLowerCase();
const arg = args.slice(1).join(' ').trim();

function printHelp() {
  console.log(`
Dynasty Manager — What's New helper

Append a bullet (writes to src/data/pendingNews.ts):
  npm run whats-new -- new       "Added adaptive AI tactics."
  npm run whats-new -- improved  "Match engine runs 30% faster."
  npm run whats-new -- fixed     "Fixed crash on Cup Final."
  npm run whats-new -- highlight "Rival managers adapt to scoreline."

Set / clear an optional override on the pending entry:
  npm run whats-new -- headline  "Short App Store hook."
  npm run whats-new -- summary   "One to three sentence player summary."
  npm run whats-new -- headline  ""        # clear (back to auto)
  npm run whats-new -- clear              # wipe pending bullets

Inspect:
  npm run whats-new -- show

Pending bullets are sealed into src/data/whatsNew.ts when package.json
version advances past the top of whatsNew.ts (see scripts/seal-whats-new.mjs,
or run \`npm run whats-new:seal\`).
`);
}

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

/* ────────────────────────────────────────────────────────────────────────
 * Mutators
 * ──────────────────────────────────────────────────────────────────────── */

function readPendingState() {
  const source = readFile(PENDING_NEWS_PATH);
  return { source, ...parsePendingNews(source) };
}

function appendBullet(category, text) {
  if (!text) {
    fail(`Missing bullet text. Example: npm run whats-new -- ${category} "Your change here."`);
  }
  const bullet = normaliseBullet(text);
  if (!bullet) fail('Bullet text is empty after normalisation.');

  const state = readPendingState();
  const existing = state.fields[category] || [];
  if (existing.includes(bullet)) {
    ok(`\`${category}\` already contains "${bullet}" — no change.`);
    return;
  }

  const next = { ...state.fields, [category]: [...existing, bullet] };
  const newSource = writePendingNews(state.source, next);
  writeFile(PENDING_NEWS_PATH, newSource);
  ok(`Appended to pending \`${category}\`: "${bullet}"`);
}

function setOverride(field, value) {
  const state = readPendingState();
  // Empty string clears the override back to null (auto-generation).
  const next = { ...state.fields, [field]: value === '' ? null : value };
  const newSource = writePendingNews(state.source, next);
  writeFile(PENDING_NEWS_PATH, newSource);
  if (next[field] === null) {
    ok(`Cleared pending \`${field}\` — seal will auto-generate it.`);
  } else {
    ok(`Set pending \`${field}\` to: "${next[field]}"`);
  }
}

function clearPending() {
  const state = readPendingState();
  const next = {
    headline: null,
    summary: null,
    highlights: [],
    new: [],
    improved: [],
    fixed: [],
  };
  const newSource = writePendingNews(state.source, next);
  writeFile(PENDING_NEWS_PATH, newSource);
  const had = (
    state.fields.highlights.length +
    state.fields.new.length +
    state.fields.improved.length +
    state.fields.fixed.length
  );
  ok(`Cleared pending (${had} bullet${had === 1 ? '' : 's'} removed).`);
}

function show() {
  const pkgVersion = readPkgVersion();
  const pendingSource = readFile(PENDING_NEWS_PATH);
  const pending = parsePendingNews(pendingSource).fields;
  const whatsNew = parseTopEntry(readFile(WHATS_NEW_PATH));
  const top = whatsNew?.fields;

  console.log('');
  console.log(`  package.json:    v${pkgVersion}`);
  if (top) {
    const match = top.version === pkgVersion ? '✓ already sealed' : '⚠ awaiting seal';
    console.log(`  whatsNew.ts top: v${top.version} (${top.date}) — ${match}`);
  } else {
    console.log('  whatsNew.ts top: (none — first release)');
  }

  const total = (
    pending.highlights.length +
    pending.new.length +
    pending.improved.length +
    pending.fixed.length
  );
  console.log('');
  console.log(`  Pending bullets: ${total} total`);
  console.log(`  Headline:        ${pending.headline ?? '(auto-generated at seal)'}`);
  console.log(`  Summary:         ${pending.summary ?? '(auto-generated at seal)'}`);
  for (const cat of CATEGORIES) {
    const list = pending[cat] || [];
    if (list.length === 0) continue;
    console.log(`    ${cat}:`);
    for (const b of list) console.log(`      • ${b}`);
  }
  if (top && top.version !== pkgVersion && total > 0) {
    console.log('');
    console.log(`  → Seal these into v${pkgVersion} with: npm run whats-new:seal`);
  }
  console.log('');
}

/* ────────────────────────────────────────────────────────────────────────
 * Dispatch
 * ──────────────────────────────────────────────────────────────────────── */

try {
  if (cmd === 'show' || cmd === 'list') {
    show();
    process.exit(0);
  }

  if (cmd === 'clear' || cmd === 'reset') {
    clearPending();
    process.exit(0);
  }

  if (cmd === 'headline' || cmd === 'summary') {
    setOverride(cmd, arg);
    process.exit(0);
  }

  // `date` no longer applies to the pending entry — date is stamped at seal.
  if (cmd === 'date') {
    fail('`date` is set automatically when bullets are sealed. Run `npm run whats-new -- show` to inspect.');
  }

  const categoryKey = CATEGORY_ALIASES[cmd];
  if (categoryKey) {
    appendBullet(categoryKey, arg);
    process.exit(0);
  }

  fail(`Unknown command: "${cmd}". Run \`npm run whats-new -- --help\` for usage.`);
} catch (err) {
  fail(err.message || String(err));
}
