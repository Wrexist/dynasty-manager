#!/usr/bin/env node
/**
 * check-whats-new.mjs
 *
 * Guard-rail that runs in CI before every TestFlight build. Verifies that
 * `src/data/whatsNew.ts` has a top entry that:
 *   1. Matches `package.json.version` (so the shipped app shows the correct
 *      version on its What's New card).
 *   2. Has a non-empty `headline`, `summary`, `date` (YYYY-MM-DD), and at
 *      least one populated change section (highlights / new / improved / fixed).
 *
 * Also supports `--inject-build <N>` which rewrites the top entry's
 * `build: null` (or `build: pending`) to the provided build number. Used by
 * the GitHub Actions TestFlight workflow so the shipped bundle always carries
 * the real CFBundleVersion in its in-app release notes, even if Claude
 * forgot to fill it in at commit time.
 *
 * Exits 0 on success, 1 on any validation failure (with GitHub Actions
 * `::error::` annotations so problems show up inline on the workflow).
 *
 * Usage:
 *   node scripts/check-whats-new.mjs               # validate only
 *   node scripts/check-whats-new.mjs --inject-build 42   # validate + rewrite build number
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const WHATS_NEW_PATH = resolve(root, 'src/data/whatsNew.ts');
const PKG_PATH = resolve(root, 'package.json');

const args = process.argv.slice(2);
const injectIdx = args.indexOf('--inject-build');
const injectBuild = injectIdx >= 0 ? Number(args[injectIdx + 1]) : null;

const errors = [];
const warnings = [];

function fail(msg) {
  // GitHub Actions annotation — renders inline on the workflow run UI.
  console.error(`::error file=src/data/whatsNew.ts::${msg}`);
  errors.push(msg);
}

function warn(msg) {
  console.warn(`::warning file=src/data/whatsNew.ts::${msg}`);
  warnings.push(msg);
}

// --- Read package.json version ---
let pkgVersion;
try {
  pkgVersion = JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;
} catch (err) {
  fail(`Could not read package.json: ${err.message}`);
  process.exit(1);
}

if (!pkgVersion || pkgVersion === '0.0.0') {
  fail('package.json version is missing or 0.0.0');
  process.exit(1);
}

// --- Read whatsNew.ts as text ---
let whatsNewSource;
try {
  whatsNewSource = readFileSync(WHATS_NEW_PATH, 'utf8');
} catch (err) {
  fail(`Could not read src/data/whatsNew.ts: ${err.message}`);
  process.exit(1);
}

// --- Locate the RELEASE_NOTES array and extract the first entry ---
const arrayMatch = whatsNewSource.match(/export const RELEASE_NOTES:\s*ReleaseNote\[\]\s*=\s*\[/);
if (!arrayMatch) {
  fail('Could not find `export const RELEASE_NOTES` in src/data/whatsNew.ts');
  process.exit(1);
}

const arrayStart = arrayMatch.index + arrayMatch[0].length;

// Walk forward from arrayStart until we hit the opening `{` of the first
// entry, then balance-match to its closing `}`. This is fine because we
// control the file format (no comments containing `{`/`}` before the first
// entry is allowed — see the file header).
let i = arrayStart;
while (i < whatsNewSource.length && whatsNewSource[i] !== '{' && whatsNewSource[i] !== ']') i++;
if (whatsNewSource[i] !== '{') {
  fail('RELEASE_NOTES is empty — every TestFlight build must prepend a new entry.');
  process.exit(1);
}

const entryStart = i;
let depth = 0;
let inString = null; // "'" | '"' | '`' | null
let entryEnd = -1;
for (let j = entryStart; j < whatsNewSource.length; j++) {
  const ch = whatsNewSource[j];
  if (inString) {
    if (ch === inString) {
      // Only treat the quote as escaped when preceded by an ODD number of
      // backslashes. `\'` = escaped, `\\'` = literal backslash + closing
      // quote, `\\\'` = literal backslash + escaped quote, etc.
      let bs = 0;
      for (let k = j - 1; k >= 0 && whatsNewSource[k] === '\\'; k--) bs++;
      if (bs % 2 === 0) inString = null;
    }
    continue;
  }
  if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { entryEnd = j; break; }
  }
}

if (entryEnd < 0) {
  fail('Malformed RELEASE_NOTES entry — unbalanced braces.');
  process.exit(1);
}

const entryBlock = whatsNewSource.slice(entryStart, entryEnd + 1);

// --- Field extractors (regex is OK — our schema is narrow) ---
function extractString(field) {
  // Allow escaped quotes inside the string (e.g. `What\'s New`). Tries single,
  // double, then backtick — first match wins. We unescape `\'`, `\"`, `\`` in
  // the returned value so length checks reflect the real displayed string.
  const patterns = [
    new RegExp(`${field}\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`),
    new RegExp(`${field}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
    new RegExp(`${field}\\s*:\\s*\`((?:\\\\.|[^\`\\\\])*)\``),
  ];
  for (const re of patterns) {
    const m = entryBlock.match(re);
    if (m) return m[1].replace(/\\(['"` nrt\\])/g, (_, c) => {
      if (c === 'n') return '\n';
      if (c === 't') return '\t';
      if (c === 'r') return '\r';
      return c;
    });
  }
  return null;
}

function extractRaw(field) {
  const re = new RegExp(`${field}\\s*:\\s*([^,\\n]+)[,\\n]`);
  const m = entryBlock.match(re);
  return m ? m[1].trim() : null;
}

function extractArray(field) {
  const re = new RegExp(`${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const m = entryBlock.match(re);
  if (!m) return null;
  // Count string literals — any single- or double-quoted string is one item.
  // This is a pragmatic heuristic; entries with embedded quotes escape them.
  const items = m[1].match(/(['"])((?:\\.|(?!\1).)*)\1/g) || [];
  return items.length;
}

const entryVersion = extractString('version');
const entryDate = extractString('date');
const entryHeadline = extractString('headline');
const entrySummary = extractString('summary');
const entryBuildRaw = extractRaw('build');

// --- Validate ---
if (!entryVersion) fail('Top RELEASE_NOTES entry is missing `version`.');
else if (entryVersion !== pkgVersion) {
  fail(`Top RELEASE_NOTES version (${entryVersion}) does not match package.json version (${pkgVersion}). Bump package.json or prepend a new What's New entry before shipping.`);
}

if (!entryDate) fail('Top RELEASE_NOTES entry is missing `date`.');
else if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) fail(`Top RELEASE_NOTES \`date\` "${entryDate}" is not ISO YYYY-MM-DD.`);

if (!entryHeadline) fail('Top RELEASE_NOTES entry is missing `headline` — write a short App Store–style hook.');
else if (entryHeadline.trim().length < 4) fail('Top RELEASE_NOTES `headline` is too short.');

if (!entrySummary) fail('Top RELEASE_NOTES entry is missing `summary` — write a 1–3 sentence player-facing summary.');
else if (entrySummary.trim().length < 20) fail('Top RELEASE_NOTES `summary` is too short — tell players what actually changed.');

// At least one category must have items.
const highlightsN = extractArray('highlights') || 0;
const newN = extractArray('new') || 0;
const improvedN = extractArray('improved') || 0;
const fixedN = extractArray('fixed') || 0;
const totalBullets = highlightsN + newN + improvedN + fixedN;
if (totalBullets === 0) {
  fail('Top RELEASE_NOTES entry has no bullet points. Fill in at least one of `highlights`, `new`, `improved`, or `fixed`.');
}

if (entryBuildRaw === null) {
  warn('Top RELEASE_NOTES entry is missing `build`. CI will inject github.run_number at build time.');
}

// --- Optionally inject the build number ---
if (injectBuild !== null && !Number.isNaN(injectBuild)) {
  // Replace the first `build: null` OR `build: 'pending'` OR `build: <number>`
  // inside the top entry only. We anchor on a preceding `{`, `,`, or
  // newline+whitespace so the regex never matches `build:` inside string
  // literals (e.g. a future bullet that says "Fixed rebuild: null crash.").
  // Rebuild the file around the new block.
  const newEntryBlock = entryBlock.replace(
    /([{,\n]\s*)build:\s*(null|['"]pending['"]|\d+)/,
    `$1build: ${injectBuild}`,
  );
  if (newEntryBlock === entryBlock) {
    warn(`Could not inject build number ${injectBuild} — no \`build:\` field found in top entry.`);
  } else {
    const updated =
      whatsNewSource.slice(0, entryStart) +
      newEntryBlock +
      whatsNewSource.slice(entryEnd + 1);
    writeFileSync(WHATS_NEW_PATH, updated, 'utf8');
    console.log(`  Injected build number ${injectBuild} into top RELEASE_NOTES entry (v${entryVersion}).`);
  }
}

// --- Summary ---
if (errors.length > 0) {
  console.error(`\nWhat's New check failed (${errors.length} error${errors.length > 1 ? 's' : ''}). Fix \`src/data/whatsNew.ts\` before shipping.`);
  process.exit(1);
}

console.log(`What's New check passed. Top entry: v${entryVersion} · ${entryDate} · "${entryHeadline}"`);
if (warnings.length > 0) {
  console.log(`  ${warnings.length} warning${warnings.length > 1 ? 's' : ''} — see above.`);
}
process.exit(0);
