#!/usr/bin/env node
/**
 * build-whats-new.mjs
 *
 * Generates the top entry in `src/data/whatsNew.ts` from the PRs merged into
 * `main` since the previously-shipped release. Designed to run inside the
 * `iOS TestFlight Deploy` workflow before `check-whats-new.mjs`.
 *
 * Inputs (CLI args, workflow-dispatch inputs in CI):
 *   --headline "..."   App Store-style hook (required)
 *   --summary  "..."   1–3 sentence player-facing summary (required)
 *   --since    YYYY-MM-DD  override the merge cutoff (default: read from whatsNew.ts)
 *   --repo     owner/name  default: Wrexist/dynasty-manager
 *   --dry-run             list what would be added without mutating the file
 *
 * Source-of-truth conventions (read from each PR):
 *   - Skip labels: skip-changelog, no-changelog, dependencies, infra, ci.
 *   - Category labels: type:highlight, type:new, type:improved, type:fixed.
 *     Default = improved. If multiple, the highest-promotion tier wins
 *     (highlight > new > fixed > improved).
 *   - Bullets: body section starting with `## What's New` (lines like
 *     `- text` become bullets). If absent, fall back to the PR title.
 *
 * The script shells out to `npm run whats-new -- <cmd>` for the actual file
 * mutations so we reuse the existing helper's dedupe + render logic and
 * don't drift in formatting.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const WHATS_NEW_PATH = resolve(root, 'src/data/whatsNew.ts');
const PKG_PATH = resolve(root, 'package.json');

// ── CLI parsing ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}
const HEADLINE = getFlag('headline');
const SUMMARY = getFlag('summary');
const SINCE_OVERRIDE = getFlag('since');
const REPO = getFlag('repo') || 'Wrexist/dynasty-manager';
const DRY_RUN = args.includes('--dry-run');

if (!HEADLINE || !SUMMARY) {
  console.error('::error::build-whats-new requires --headline "..." and --summary "..."');
  console.error('Both fields gate the App Store voice — they cannot be derived from PRs.');
  process.exit(1);
}

const SKIP_LABELS = new Set([
  'skip-changelog',
  'no-changelog',
  'dependencies',
  'infra',
  'ci',
]);

const CATEGORY_PRIORITY = ['highlight', 'new', 'fixed', 'improved'];
const CATEGORY_LABEL_MAP = {
  'type:highlight': 'highlight',
  'type:new': 'new',
  'type:improved': 'improved',
  'type:fixed': 'fixed',
};

// ── Helpers ─────────────────────────────────────────────────────────────
function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Find each release entry's `version` + `date` in source order. */
function listEntries(source) {
  const re = /version:\s*['"]([^'"]+)['"][^}]*?date:\s*['"](\d{4}-\d{2}-\d{2})['"]/g;
  const entries = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    entries.push({ version: m[1], date: m[2] });
  }
  return entries;
}

function tryGit(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** ISO timestamp of the build commit (HEAD). Used as the upper bound so PRs
 *  merged AFTER actions/checkout pinned its SHA can't slip into the notes
 *  for a build whose binary doesn't contain them. */
function getHeadCommitTime() {
  return tryGit('git log -1 --format=%cI HEAD');
}

/** ISO timestamp of the most recent first-parent commit on the build branch
 *  whose package.json carries a DIFFERENT version than the current one — i.e.
 *  the commit just before the version bump that introduced this release. PRs
 *  merged at or before this timestamp belong to the previous shipped build
 *  and must be excluded.
 *
 *  Requires full git history (workflow checkout uses fetch-depth: 0). On a
 *  shallow clone the helper returns null and we degrade to a date-only
 *  filter, which is fine for the common case but loses the same-day
 *  precision fix. */
function getPreviousReleaseTime(currentVersion) {
  const log = tryGit('git log --first-parent --pretty=%H%x09%cI HEAD -- package.json');
  if (!log) return null;
  for (const line of log.split('\n')) {
    const [sha, iso] = line.split('\t');
    if (!sha || !iso) continue;
    const pkgJson = tryGit(`git show ${sha}:package.json`);
    if (!pkgJson) continue;
    let v;
    try { v = JSON.parse(pkgJson).version; } catch { continue; }
    if (v && v !== currentVersion) return iso;
  }
  return null;
}

/** Determine the coarse YYYY-MM-DD `since` for the gh PR query. Used as a
 *  pre-filter only — final inclusion is decided by ISO-timestamp bounds. */
function determineSinceDate(source, pkgVersion) {
  const entries = listEntries(source);
  if (entries.length === 0) {
    fail('whatsNew.ts has no entries — cannot determine merge cutoff.');
  }
  const previousShipped = entries.find(e => e.version !== pkgVersion);
  if (!previousShipped) return entries[0].date;
  return previousShipped.date;
}

/** Pick the highest-priority category from a label set, default 'improved'. */
function categoriseFromLabels(labels) {
  const names = labels.map(l => (l.name || '').toLowerCase());
  for (const cat of CATEGORY_PRIORITY) {
    const labelKey = `type:${cat}`;
    if (names.includes(labelKey)) return cat;
  }
  return 'improved';
}

/** Extract bullet lines from a `## What's New` section. Returns [] if missing. */
function extractWhatsNewBullets(body) {
  if (!body) return [];
  // Find the `## What's New` heading. Allows curly or straight apostrophe.
  const heading = body.match(/##\s*what['’]?s\s+new[^\n]*\n/i);
  if (!heading) return [];
  const start = heading.index + heading[0].length;
  // Section ends at the next `## ` heading on its own line, or end of body.
  const next = body.slice(start).match(/\n##\s/);
  const end = next ? start + next.index : body.length;
  const block = body.slice(start, end);
  const bullets = [];
  for (const line of block.split('\n')) {
    const bm = line.trim().match(/^[-*]\s+(.+)$/);
    if (bm) bullets.push(bm[1].trim());
  }
  return bullets;
}

/** Strip conventional-commit prefixes from a PR title for use as a bullet. */
function normaliseTitle(title) {
  return title
    .replace(/^(feat|fix|chore|refactor|perf|docs|test|ci|build|style)(\([^)]+\))?:\s*/i, '')
    .trim();
}

function runHelper(category, text) {
  if (DRY_RUN) {
    console.log(`  [dry-run] ${category}: "${text}"`);
    return;
  }
  // Shell-escape the bullet for safe single-quote passing.
  const escaped = text.replace(/'/g, "'\\''");
  execSync(`npm run --silent whats-new -- ${category} '${escaped}'`, {
    cwd: root,
    stdio: 'inherit',
  });
}

function runHelperField(field, value) {
  if (DRY_RUN) {
    console.log(`  [dry-run] ${field}: "${value}"`);
    return;
  }
  const escaped = value.replace(/'/g, "'\\''");
  execSync(`npm run --silent whats-new -- ${field} '${escaped}'`, {
    cwd: root,
    stdio: 'inherit',
  });
}

// ── Main ────────────────────────────────────────────────────────────────
const pkg = readJson(PKG_PATH);
const pkgVersion = pkg.version;
const source = readFileSync(WHATS_NEW_PATH, 'utf8');

// Coarse pre-filter for the gh search query — we cast a wide net, then
// narrow client-side with the precise ISO bounds below.
const sinceDate = SINCE_OVERRIDE || determineSinceDate(source, pkgVersion);

// Precise bounds. Lower = the previous release commit's timestamp on this
// branch (so same-day re-runs don't replay already-shipped PRs). Upper =
// the build commit's timestamp (so PRs merged after actions/checkout pinned
// HEAD can't slip into a build whose binary doesn't contain them).
const headIso = getHeadCommitTime();
const lowerIso = SINCE_OVERRIDE ? null : getPreviousReleaseTime(pkgVersion);

console.log(`Building What's New entry for v${pkgVersion}`);
console.log(`  Repo:        ${REPO}`);
console.log(`  Since (date): ${sinceDate} (coarse pre-filter for gh search)`);
console.log(`  Lower bound:  ${lowerIso || '(none — shallow clone or no previous release)'}`);
console.log(`  Upper bound:  ${headIso || '(none — git not available)'}`);
console.log('');

if (!headIso) {
  console.warn('::warning::Could not read HEAD commit time. PRs merged after ' +
    'actions/checkout will not be filtered out. Ensure git is available and ' +
    'fetch-depth: 0 is set on the checkout step.');
}
if (!lowerIso && !SINCE_OVERRIDE) {
  console.warn('::warning::Could not find the previous release commit. Falling ' +
    'back to date-only lower bound. Same-day re-runs may re-include already-' +
    'shipped PRs. Ensure fetch-depth: 0 is set on the checkout step.');
}

// ── Fetch merged PRs via gh CLI ─────────────────────────────────────────
let prs;
try {
  const out = execSync(
    `gh pr list --repo ${REPO} --base main --state merged ` +
    `--search "merged:>=${sinceDate}" ` +
    `--json number,title,body,labels,mergedAt ` +
    `--limit 200`,
    { encoding: 'utf8' },
  );
  prs = JSON.parse(out);
} catch (err) {
  fail(`gh pr list failed: ${err.message}. Is the GH CLI authenticated? (GITHUB_TOKEN required.)`);
}

// Narrow with the precise ISO bounds.
const before = prs.length;
prs = prs.filter(pr => {
  if (!pr.mergedAt) return false;
  if (lowerIso && pr.mergedAt <= lowerIso) return false;
  if (headIso && pr.mergedAt > headIso) return false;
  return true;
});
const droppedByBounds = before - prs.length;

console.log(`  Found ${prs.length} merged PR(s) in window.${droppedByBounds > 0 ? ` (Dropped ${droppedByBounds} outside ISO bounds.)` : ''}`);
console.log('');

// ── Classify ────────────────────────────────────────────────────────────
const planned = []; // { number, category, bullet }
const skipped = []; // { number, reason }

for (const pr of prs) {
  const labels = pr.labels || [];
  const labelNames = labels.map(l => (l.name || '').toLowerCase());

  const skipLabel = labelNames.find(n => SKIP_LABELS.has(n));
  if (skipLabel) {
    skipped.push({ number: pr.number, reason: `label "${skipLabel}"` });
    continue;
  }

  const category = categoriseFromLabels(labels);
  const bodyBullets = extractWhatsNewBullets(pr.body);

  if (bodyBullets.length > 0) {
    for (const b of bodyBullets) {
      planned.push({ number: pr.number, category, bullet: b });
    }
  } else {
    planned.push({ number: pr.number, category, bullet: normaliseTitle(pr.title) });
  }
}

console.log(`  Planned: ${planned.length} bullet(s) across ${prs.length - skipped.length} PR(s).`);
if (skipped.length > 0) {
  console.log(`  Skipped: ${skipped.length} PR(s):`);
  for (const s of skipped) console.log(`    - PR #${s.number} (${s.reason})`);
}
console.log('');

// ── Set headline + summary first (also creates the entry if needed) ────
runHelperField('headline', HEADLINE);
runHelperField('summary', SUMMARY);

// ── Append bullets, sorted by category priority then PR number ─────────
const ORDER = { highlight: 0, new: 1, improved: 2, fixed: 3 };
planned.sort((a, b) => {
  const o = ORDER[a.category] - ORDER[b.category];
  return o !== 0 ? o : a.number - b.number;
});

for (const p of planned) {
  console.log(`  PR #${p.number} → ${p.category}`);
  runHelper(p.category, p.bullet);
}

console.log('');
ok(`Done. Generated ${planned.length} bullet(s) for v${pkgVersion}.`);
if (DRY_RUN) {
  console.log('  (Dry-run — no files were written.)');
}
