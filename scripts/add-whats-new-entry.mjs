#!/usr/bin/env node
/**
 * add-whats-new-entry.mjs — the "smooth path" for authoring release notes.
 *
 * Usage (via `npm run whats-new -- <cmd> [arg]`):
 *
 *   npm run whats-new -- new       "Short, player-facing description of what you added."
 *   npm run whats-new -- improved  "Describe an improvement."
 *   npm run whats-new -- fixed     "Describe a user-visible bug fix."
 *   npm run whats-new -- highlight "Marquee change worth calling out."
 *
 *   npm run whats-new -- headline "Faster matches, sharper AI."
 *   npm run whats-new -- summary  "One to three sentence player-facing summary."
 *   npm run whats-new -- date     2026-04-28       (defaults to today on new entries)
 *
 *   npm run whats-new -- show                       # prints the current top entry
 *
 * Behavior:
 *   - If the top RELEASE_NOTES entry's `version` === `package.json.version`,
 *     the command mutates the existing entry.
 *   - If the top entry is for an older version (i.e. you just bumped
 *     `package.json`), a new entry is prepended automatically with today's
 *     date + placeholder headline/summary, and your bullet is added to it.
 *   - `headline` / `summary` / `date` replace in place.
 *   - The script writes back `src/data/whatsNew.ts` with stable formatting
 *     so diffs stay readable. It never deletes historical entries.
 *
 * Philosophy: one command, no prompts, idempotent. Safe to run repeatedly.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const WHATS_NEW_PATH = resolve(root, 'src/data/whatsNew.ts');
const PKG_PATH = resolve(root, 'package.json');

const CATEGORIES = ['highlights', 'new', 'improved', 'fixed'];
const CATEGORY_ALIASES = {
  highlight: 'highlights',
  highlights: 'highlights',
  feature: 'new',
  features: 'new',
  new: 'new',
  improve: 'improved',
  improved: 'improved',
  improvement: 'improved',
  improvements: 'improved',
  fix: 'fixed',
  fixed: 'fixed',
  bug: 'fixed',
  bugfix: 'fixed',
};

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

Append a bullet:
  npm run whats-new -- new       "Added adaptive AI tactics."
  npm run whats-new -- improved  "Match engine runs 30% faster."
  npm run whats-new -- fixed     "Fixed crash on Cup Final."
  npm run whats-new -- highlight "Rival managers adapt to scoreline."

Set a field on the top entry:
  npm run whats-new -- headline "Short App Store hook."
  npm run whats-new -- summary  "One to three sentence player summary."
  npm run whats-new -- date     2026-04-28

Inspect:
  npm run whats-new -- show

If package.json.version has advanced past the current top entry, a new
top entry is created automatically before your command is applied.
`);
}

/* ────────────────────────────────────────────────────────────────────────
 * File I/O
 * ──────────────────────────────────────────────────────────────────────── */

function readPkgVersion() {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  if (!pkg.version || pkg.version === '0.0.0') {
    fail('package.json version is missing or 0.0.0');
  }
  return pkg.version;
}

function readSource() {
  return readFileSync(WHATS_NEW_PATH, 'utf8');
}

function writeSource(next) {
  writeFileSync(WHATS_NEW_PATH, next, 'utf8');
}

function fail(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

/* ────────────────────────────────────────────────────────────────────────
 * Source-text surgery — locate and parse the top RELEASE_NOTES entry.
 * ──────────────────────────────────────────────────────────────────────── */

function findArrayStart(source) {
  const m = source.match(/export const RELEASE_NOTES:\s*ReleaseNote\[\]\s*=\s*\[/);
  if (!m) fail('Could not find `export const RELEASE_NOTES` in src/data/whatsNew.ts');
  return m.index + m[0].length;
}

function findTopEntryBounds(source) {
  const arrayStart = findArrayStart(source);
  let i = arrayStart;
  while (i < source.length && source[i] !== '{' && source[i] !== ']') i++;
  if (source[i] !== '{') return null; // empty array
  const entryStart = i;
  let depth = 0;
  let inString = null;
  for (let j = entryStart; j < source.length; j++) {
    const ch = source[j];
    const prev = source[j - 1];
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start: entryStart, end: j + 1, arrayStart };
    }
  }
  fail('Top RELEASE_NOTES entry has unbalanced braces — fix the file manually.');
}

function extractString(block, field) {
  const patterns = [
    new RegExp(`\\b${field}\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`),
    new RegExp(`\\b${field}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
    new RegExp(`\\b${field}\\s*:\\s*\`((?:\\\\.|[^\`\\\\])*)\``),
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m) return unescape(m[1]);
  }
  return null;
}

function extractRaw(block, field) {
  const re = new RegExp(`\\b${field}\\s*:\\s*([^,\\n]+)[,\\n]`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function extractArray(block, field) {
  // Match `<field>: [ ... ]` balancing brackets conservatively.
  const re = new RegExp(`\\b${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const m = block.match(re);
  if (!m) return [];
  const items = [];
  // Pull out each string literal item.
  const str = /(['"\`])((?:\\.|(?!\1).)*)\1/g;
  let sm;
  while ((sm = str.exec(m[1])) !== null) {
    items.push(unescape(sm[2]));
  }
  return items;
}

function unescape(s) {
  return s.replace(/\\(['"` nrt\\])/g, (_, c) => {
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c === 'r') return '\r';
    return c;
  });
}

function parseTopEntry(source) {
  const bounds = findTopEntryBounds(source);
  if (!bounds) return { bounds: null, fields: null };
  const block = source.slice(bounds.start, bounds.end);
  const fields = {
    version: extractString(block, 'version'),
    buildRaw: extractRaw(block, 'build'),
    date: extractString(block, 'date'),
    headline: extractString(block, 'headline'),
    summary: extractString(block, 'summary'),
    highlights: extractArray(block, 'highlights'),
    new: extractArray(block, 'new'),
    improved: extractArray(block, 'improved'),
    fixed: extractArray(block, 'fixed'),
  };
  return { bounds, block, fields };
}

/* ────────────────────────────────────────────────────────────────────────
 * Stringification — render an entry object back into TS source.
 * ──────────────────────────────────────────────────────────────────────── */

function strLit(s) {
  // Single-quoted with escaped backslashes + apostrophes. Matches the
  // existing file's convention so git diffs stay minimal.
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function renderArray(indent, items) {
  if (!items || items.length === 0) return '[]';
  const inner = items.map(i => `${indent}  ${strLit(i)},`).join('\n');
  return `[\n${inner}\n${indent}]`;
}

function renderEntry(fields, { indent = '  ' } = {}) {
  // NOTE: we deliberately don't emit a trailing comma on the closing brace
  // — our insertion points replace just `{...}` and the surrounding source
  // already carries array-separator commas.
  const build = fields.buildRaw ?? 'null';
  const lines = [
    `${indent}{`,
    `${indent}  version: ${strLit(fields.version)},`,
    `${indent}  build: ${build},`,
    `${indent}  date: ${strLit(fields.date)},`,
    `${indent}  headline: ${strLit(fields.headline || '')},`,
    `${indent}  summary: ${strLit(fields.summary || '')},`,
    `${indent}  highlights: ${renderArray(`${indent}  `, fields.highlights)},`,
    `${indent}  new: ${renderArray(`${indent}  `, fields.new)},`,
    `${indent}  improved: ${renderArray(`${indent}  `, fields.improved)},`,
    `${indent}  fixed: ${renderArray(`${indent}  `, fields.fixed)},`,
    `${indent}}`,
  ];
  return lines.join('\n');
}

/* ────────────────────────────────────────────────────────────────────────
 * Commands
 * ──────────────────────────────────────────────────────────────────────── */

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Ensure the top entry is for the current package.json version. If not,
 *  prepend a fresh placeholder entry and return the parsed state. */
function ensureCurrentTopEntry(source, pkgVersion) {
  const parsed = parseTopEntry(source);
  if (parsed.fields && parsed.fields.version === pkgVersion) {
    return { source, ...parsed, created: false };
  }

  // Create a new top entry immediately after the `[`. We emit:
  //     [
  //       { <new entry fields> },
  //       { <existing entries> },
  //       ...
  //     ]
  const arrayStart = findArrayStart(source);

  const newFields = {
    version: pkgVersion,
    buildRaw: 'null',
    date: todayIso(),
    headline: '',
    summary: '',
    highlights: [],
    new: [],
    improved: [],
    fixed: [],
  };
  const rendered = renderEntry(newFields, { indent: '  ' });

  const before = source.slice(0, arrayStart);
  const after = source.slice(arrayStart);
  // Insert the new entry + its array-separator comma + a newline before the
  // existing content. Leave the rest of the file untouched.
  const nextSource = `${before}\n${rendered},${after}`;

  ok(`Created new top entry for v${pkgVersion} (date: ${newFields.date}).`);
  const reparsed = parseTopEntry(nextSource);
  return { source: nextSource, ...reparsed, created: true };
}

function appendBullet(category, text) {
  if (!text) fail(`Missing bullet text. Example: npm run whats-new -- ${category} "Your change here."`);
  const pkgVersion = readPkgVersion();
  let source = readSource();
  let state = ensureCurrentTopEntry(source, pkgVersion);

  // Normalize bullet — capitalize first letter, ensure trailing period.
  let bullet = text.trim();
  if (bullet.length === 0) fail('Bullet text is empty.');
  bullet = bullet[0].toUpperCase() + bullet.slice(1);
  if (!/[.!?]$/.test(bullet)) bullet += '.';

  const next = { ...state.fields };
  next[category] = [...(next[category] || []), bullet];

  const rendered = renderEntry(next, { indent: '  ' });
  const nextSource =
    state.source.slice(0, state.bounds.start) +
    rendered.replace(/^ {2}/, '') + // remove outer indent — we match existing file pattern
    state.source.slice(state.bounds.end);

  // The renderEntry output starts with 2-space indent; the existing file
  // already has 2-space indent before `{`. Rebuild more carefully:
  const block = state.source.slice(state.bounds.start, state.bounds.end);
  const leadingIndentMatch = block.match(/^(\s*)/);
  const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
  const rerendered = renderEntry(next, { indent: leadingIndent || '  ' });
  // rerendered begins with `${leadingIndent}{` — we need to drop the
  // leading indent since state.bounds.start already points at `{`.
  const renderedFromBrace = rerendered.replace(/^\s*/, '');

  const finalSource =
    state.source.slice(0, state.bounds.start) +
    renderedFromBrace +
    state.source.slice(state.bounds.end);

  writeSource(finalSource);
  ok(`Appended to \`${category}\`: "${bullet}"`);
  if (state.created) {
    console.log(`\n  ⚠  Don't forget to set the headline + summary:`);
    console.log(`     npm run whats-new -- headline "Short App Store hook."`);
    console.log(`     npm run whats-new -- summary  "One to three sentence summary."`);
  }
}

function setField(field, value) {
  if (!value) fail(`Missing value. Example: npm run whats-new -- ${field} "Your text here."`);
  const pkgVersion = readPkgVersion();
  const source = readSource();
  const state = ensureCurrentTopEntry(source, pkgVersion);

  if (field === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`date must be ISO YYYY-MM-DD (got "${value}").`);
  }

  const next = { ...state.fields };
  next[field] = value;

  const block = state.source.slice(state.bounds.start, state.bounds.end);
  const leadingIndentMatch = block.match(/^(\s*)/);
  const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
  const rerendered = renderEntry(next, { indent: leadingIndent || '  ' });
  const renderedFromBrace = rerendered.replace(/^\s*/, '');

  const finalSource =
    state.source.slice(0, state.bounds.start) +
    renderedFromBrace +
    state.source.slice(state.bounds.end);

  writeSource(finalSource);
  ok(`Set \`${field}\` to: "${value}"`);
}

function showTopEntry() {
  const pkgVersion = readPkgVersion();
  const source = readSource();
  const parsed = parseTopEntry(source);
  if (!parsed.fields) {
    console.log('  (RELEASE_NOTES array is empty.)');
    return;
  }
  const f = parsed.fields;
  const match = f.version === pkgVersion ? '✓ matches package.json' : `⚠  package.json is v${pkgVersion}`;
  const totalBullets = (f.highlights.length + f.new.length + f.improved.length + f.fixed.length);
  console.log('');
  console.log(`  Top entry:  v${f.version}  (${match})`);
  console.log(`  Date:       ${f.date}`);
  console.log(`  Build:      ${f.buildRaw}`);
  console.log(`  Headline:   ${f.headline || '(empty — set with `npm run whats-new -- headline "..."`)'}`);
  console.log(`  Summary:    ${f.summary || '(empty — set with `npm run whats-new -- summary "..."`)'}`);
  console.log(`  Bullets:    ${totalBullets} total`);
  for (const cat of CATEGORIES) {
    if (f[cat].length === 0) continue;
    console.log(`    ${cat}:`);
    for (const b of f[cat]) console.log(`      • ${b}`);
  }
  console.log('');
}

/* ────────────────────────────────────────────────────────────────────────
 * Dispatch
 * ──────────────────────────────────────────────────────────────────────── */

if (cmd === 'show' || cmd === 'list') {
  showTopEntry();
  process.exit(0);
}

if (cmd === 'headline' || cmd === 'summary' || cmd === 'date') {
  setField(cmd, arg);
  process.exit(0);
}

const categoryKey = CATEGORY_ALIASES[cmd];
if (categoryKey) {
  appendBullet(categoryKey, arg);
  process.exit(0);
}

fail(`Unknown command: "${cmd}". Run \`npm run whats-new -- --help\` for usage.`);
