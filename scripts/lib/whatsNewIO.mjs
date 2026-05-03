/**
 * Shared parsing / rendering helpers for the What's New tooling.
 *
 * Two on-disk shapes:
 *   1. `src/data/whatsNew.ts`    → array of sealed ReleaseNote entries.
 *   2. `src/data/pendingNews.ts` → single PENDING_NEWS object that stages
 *      bullets for the next, unshipped version.
 *
 * Both are TS source files mutated as text so diffs stay reviewable. The
 * parsers below are deliberately narrow — they assume the conventions our
 * own tooling emits and won't survive arbitrary hand-editing. That's fine:
 * the helpers (`add-whats-new-entry.mjs`, `seal-whats-new.mjs`,
 * `append-pending-from-pr.mjs`) are the only writers, and their output is
 * stable.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const REPO_ROOT = resolve(__dirname, '..', '..');

export const WHATS_NEW_PATH = resolve(REPO_ROOT, 'src/data/whatsNew.ts');
export const PENDING_NEWS_PATH = resolve(REPO_ROOT, 'src/data/pendingNews.ts');
export const PKG_PATH = resolve(REPO_ROOT, 'package.json');

export const CATEGORIES = ['highlights', 'new', 'improved', 'fixed'];
export const CATEGORY_ALIASES = {
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
 * I/O
 * ──────────────────────────────────────────────────────────────────────── */

export function readPkgVersion() {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  if (!pkg.version || pkg.version === '0.0.0') {
    throw new Error('package.json version is missing or 0.0.0');
  }
  return pkg.version;
}

export function readFile(path) {
  return readFileSync(path, 'utf8');
}

export function writeFile(path, contents) {
  writeFileSync(path, contents, 'utf8');
}

/* ────────────────────────────────────────────────────────────────────────
 * Source-text parsing — string / array / raw extractors
 * ──────────────────────────────────────────────────────────────────────── */

export function unescapeString(s) {
  return s.replace(/\\(['"` nrt\\])/g, (_, c) => {
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c === 'r') return '\r';
    return c;
  });
}

export function extractString(block, field) {
  const patterns = [
    new RegExp(`\\b${field}\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`),
    new RegExp(`\\b${field}\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
    new RegExp(`\\b${field}\\s*:\\s*\`((?:\\\\.|[^\`\\\\])*)\``),
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m) return unescapeString(m[1]);
  }
  return null;
}

export function extractRaw(block, field) {
  const re = new RegExp(`\\b${field}\\s*:\\s*([^,\\n]+)[,\\n]`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

export function extractArray(block, field) {
  const re = new RegExp(`\\b${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const m = block.match(re);
  if (!m) return [];
  const items = [];
  const str = /(['"\`])((?:\\.|(?!\1).)*)\1/g;
  let sm;
  while ((sm = str.exec(m[1])) !== null) {
    items.push(unescapeString(sm[2]));
  }
  return items;
}

/** Match a TS literal that's either `null` or a single/double/backtick string. */
export function extractStringOrNull(block, field) {
  const raw = extractRaw(block, field);
  if (raw === 'null') return null;
  return extractString(block, field);
}

/* ────────────────────────────────────────────────────────────────────────
 * whatsNew.ts — locate the top RELEASE_NOTES entry
 * ──────────────────────────────────────────────────────────────────────── */

export function findArrayStart(source) {
  const m = source.match(/export const RELEASE_NOTES:\s*ReleaseNote\[\]\s*=\s*\[/);
  if (!m) return -1;
  return m.index + m[0].length;
}

/** Walk forward from `from` until we find an opening brace, then balance-match
 *  to the closing one. Skips over single/double/backtick string literals so
 *  embedded braces inside bullets don't trip us up. Returns `null` if no
 *  entry is found before the closing bracket of the enclosing array. */
export function findBracedBlock(source, from) {
  let i = from;
  while (i < source.length && source[i] !== '{' && source[i] !== ']') i++;
  if (source[i] !== '{') return null;
  const start = i;
  let depth = 0;
  let inString = null;
  for (let j = start; j < source.length; j++) {
    const ch = source[j];
    if (inString) {
      if (ch === inString) {
        let bs = 0;
        for (let k = j - 1; k >= 0 && source[k] === '\\'; k--) bs++;
        if (bs % 2 === 0) inString = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: j + 1 };
    }
  }
  throw new Error('Unbalanced braces while parsing What\'s New source.');
}

export function findTopEntryBounds(source) {
  const arrayStart = findArrayStart(source);
  if (arrayStart < 0) {
    throw new Error('Could not find `export const RELEASE_NOTES` in src/data/whatsNew.ts');
  }
  const block = findBracedBlock(source, arrayStart);
  return block ? { ...block, arrayStart } : null;
}

export function parseReleaseEntry(block) {
  return {
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
}

export function parseTopEntry(source) {
  const bounds = findTopEntryBounds(source);
  if (!bounds) return { bounds: null, fields: null, block: null };
  const block = source.slice(bounds.start, bounds.end);
  return { bounds, block, fields: parseReleaseEntry(block) };
}

/* ────────────────────────────────────────────────────────────────────────
 * pendingNews.ts — locate and parse PENDING_NEWS object
 * ──────────────────────────────────────────────────────────────────────── */

export function findPendingBounds(source) {
  const m = source.match(/export const PENDING_NEWS:\s*PendingRelease\s*=\s*/);
  if (!m) {
    throw new Error('Could not find `export const PENDING_NEWS` in src/data/pendingNews.ts');
  }
  const from = m.index + m[0].length;
  const block = findBracedBlock(source, from);
  if (!block) throw new Error('PENDING_NEWS literal is missing its `{ ... }` body.');
  return block;
}

export function parsePendingNews(source) {
  const bounds = findPendingBounds(source);
  const block = source.slice(bounds.start, bounds.end);
  return {
    bounds,
    block,
    fields: {
      headline: extractStringOrNull(block, 'headline'),
      summary: extractStringOrNull(block, 'summary'),
      highlights: extractArray(block, 'highlights'),
      new: extractArray(block, 'new'),
      improved: extractArray(block, 'improved'),
      fixed: extractArray(block, 'fixed'),
    },
  };
}

export function pendingTotalBullets(fields) {
  return (
    (fields.highlights?.length || 0) +
    (fields.new?.length || 0) +
    (fields.improved?.length || 0) +
    (fields.fixed?.length || 0)
  );
}

export function isPendingEmpty(fields) {
  return pendingTotalBullets(fields) === 0;
}

/* ────────────────────────────────────────────────────────────────────────
 * Rendering — emit TS source for an entry / pending object
 * ──────────────────────────────────────────────────────────────────────── */

export function strLit(s) {
  return (
    "'" +
    String(s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    "'"
  );
}

export function renderArray(indent, items) {
  if (!items || items.length === 0) return '[]';
  const inner = items.map(i => `${indent}  ${strLit(i)},`).join('\n');
  return `[\n${inner}\n${indent}]`;
}

export function renderEntry(fields, { indent = '  ' } = {}) {
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

/** Render the PENDING_NEWS object back into TS. Headline / summary are
 *  emitted as `null` when the field value is null (vs. empty string). */
export function renderPendingObject(fields, { indent = '' } = {}) {
  const headline = fields.headline === null || fields.headline === undefined
    ? 'null'
    : strLit(fields.headline);
  const summary = fields.summary === null || fields.summary === undefined
    ? 'null'
    : strLit(fields.summary);
  const inner = `${indent}  `;
  return [
    `${indent}{`,
    `${inner}highlights: ${renderArray(inner, fields.highlights)},`,
    `${inner}new: ${renderArray(inner, fields.new)},`,
    `${inner}improved: ${renderArray(inner, fields.improved)},`,
    `${inner}fixed: ${renderArray(inner, fields.fixed)},`,
    `${inner}headline: ${headline},`,
    `${inner}summary: ${summary},`,
    `${indent}}`,
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────────────
 * Mutators — splice an entry/pending block back into source, preserving
 * indentation so diffs stay minimal.
 * ──────────────────────────────────────────────────────────────────────── */

export function spliceBlock(source, bounds, replacement) {
  const original = source.slice(bounds.start, bounds.end);
  const leadingIndent = (original.match(/^(\s*)/) || ['', ''])[1] || '';
  // `replacement` is rendered with `indent`; strip its leading whitespace if
  // any, then prepend the original block's leading indent so the surrounding
  // file context lines up.
  const stripped = replacement.replace(/^[ \t]*/, '');
  return source.slice(0, bounds.start) + leadingIndent + stripped + source.slice(bounds.end);
}

/** Replace the PENDING_NEWS literal in `source` with a freshly-rendered one. */
export function writePendingNews(source, fields) {
  const { bounds } = parsePendingNews(source);
  // Match the indent of the existing literal — for our format, that's the
  // column before the `{`.
  const linePrefix = source.slice(0, bounds.start).match(/(?:^|\n)([ \t]*)$/);
  const indent = linePrefix ? linePrefix[1] : '';
  const rendered = renderPendingObject(fields, { indent });
  return source.slice(0, bounds.start) + rendered + source.slice(bounds.end);
}

/* ────────────────────────────────────────────────────────────────────────
 * Bullet normalisation + dedup
 * ──────────────────────────────────────────────────────────────────────── */

/** Capitalise + add trailing period. Idempotent — running it on already-
 *  normalised text is a no-op. */
export function normaliseBullet(text) {
  let bullet = String(text || '').trim();
  if (bullet.length === 0) return '';
  bullet = bullet[0].toUpperCase() + bullet.slice(1);
  if (!/[.!?]$/.test(bullet)) bullet += '.';
  return bullet;
}

/** Strip conventional-commit prefixes from a PR title. */
export function normaliseTitle(title) {
  return String(title || '')
    .replace(/^(feat|fix|chore|refactor|perf|docs|test|ci|build|style)(\([^)]+\))?:\s*/i, '')
    .trim();
}

export function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/* ────────────────────────────────────────────────────────────────────────
 * Auto-headline / auto-summary — used by seal-whats-new.mjs when pending
 * doesn't include a manual override. Same priority order the old build
 * script used so the player-facing voice doesn't change.
 * ──────────────────────────────────────────────────────────────────────── */

const AUTO_PRIORITY = ['highlights', 'new', 'improved', 'fixed'];

export function buildAutoHeadline(fields) {
  for (const cat of AUTO_PRIORITY) {
    const list = fields[cat] || [];
    if (list.length > 0) return list[0];
  }
  return 'Stability and polish update.';
}

function pluralize(n, singular, plural = `${singular}s`) {
  return n === 1 ? singular : plural;
}

function joinNaturally(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function buildAutoSummary(fields) {
  const flat = [];
  for (const cat of AUTO_PRIORITY) {
    for (const b of fields[cat] || []) flat.push({ category: cat, bullet: b });
  }
  if (flat.length === 0) {
    return 'Internal updates and stability improvements for this build.';
  }

  const leadCount = Math.min(2, flat.length);
  const leadBullets = flat.slice(0, leadCount).map(p => p.bullet);
  const lead = leadBullets.join(' ');

  // Tail enumeration of remaining changes by category.
  const remaining = flat.slice(leadCount);
  const counts = { highlights: 0, new: 0, improved: 0, fixed: 0 };
  for (const r of remaining) counts[r.category]++;
  const parts = [];
  if (counts.highlights > 0) parts.push(`${counts.highlights} more ${pluralize(counts.highlights, 'highlight')}`);
  if (counts.new > 0) parts.push(`${counts.new} new ${pluralize(counts.new, 'feature')}`);
  if (counts.improved > 0) parts.push(`${counts.improved} ${pluralize(counts.improved, 'improvement')}`);
  if (counts.fixed > 0) parts.push(`${counts.fixed} ${pluralize(counts.fixed, 'fix', 'fixes')}`);

  if (parts.length === 0) {
    return lead.length >= 20 ? lead : `${lead} A focused update for this build.`;
  }
  return `${lead} Plus ${joinNaturally(parts)} across the rest of the build.`;
}
