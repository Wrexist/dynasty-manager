#!/usr/bin/env node
/**
 * build-whats-new.mjs
 *
 * Generates the top entry in `src/data/whatsNew.ts` from the PRs merged into
 * `main` since the previously-shipped release. Designed to run inside the
 * `iOS TestFlight Deploy` workflow before `check-whats-new.mjs`.
 *
 * Inputs (CLI args, workflow-dispatch inputs in CI):
 *   --headline "..."   App Store-style hook (optional — auto-generated from
 *                      the lead PR's bullet when omitted)
 *   --summary  "..."   1–3 sentence player-facing summary (optional —
 *                      auto-generated from the lead bullets + category counts
 *                      when omitted)
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
 *
 * Auto-fallback voice (when --headline / --summary omitted):
 *   - Headline → first bullet from the highest-priority non-empty category
 *     (highlight > new > improved > fixed).
 *   - Summary  → first 1-2 lead bullets joined as prose, plus a tail
 *     enumerating remaining changes by category count. Always passes
 *     check-whats-new.mjs's >=20-char minimum.
 *   Both fields stay overridable for builds that deserve hand-crafted
 *   App Store voice. Empty inputs in the workflow form trigger the fallback.
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
const HEADLINE_INPUT = getFlag('headline');
const SUMMARY_INPUT = getFlag('summary');
const SINCE_OVERRIDE = getFlag('since');
const REPO = getFlag('repo') || 'Wrexist/dynasty-manager';
const DRY_RUN = args.includes('--dry-run');

// Treat all-whitespace inputs as omitted so the workflow form's empty fields
// route to the auto-fallback path instead of writing blank strings.
const HEADLINE = HEADLINE_INPUT && HEADLINE_INPUT.trim().length > 0 ? HEADLINE_INPUT.trim() : null;
const SUMMARY = SUMMARY_INPUT && SUMMARY_INPUT.trim().length > 0 ? SUMMARY_INPUT.trim() : null;

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

/** Parse a SemVer-ish version string into [major, minor, patch] integers.
 *  Returns null if the input doesn't look like a version. Used to gauge how
 *  far the current version has drifted past the last shipped one. */
function parseSemver(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Describe the kind of bump from `prev` → `cur` (major / minor / patch /
 *  multi-patch / equal / regression / unknown). Drives the deploy-state
 *  banner so the runner logs say things like "two patch versions ahead of
 *  last shipped — likely a re-run after a failed attempt". */
function describeVersionDelta(prev, cur) {
  const a = parseSemver(prev);
  const b = parseSemver(cur);
  if (!a || !b) return { kind: 'unknown', label: 'unknown' };
  if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) return { kind: 'equal', label: 'same as last shipped' };
  if (b[0] > a[0]) return { kind: 'major', label: `major bump (+${b[0] - a[0]}.0.0)` };
  if (b[0] === a[0] && b[1] > a[1]) return { kind: 'minor', label: `minor bump (+0.${b[1] - a[1]}.0)` };
  if (b[0] === a[0] && b[1] === a[1] && b[2] > a[2]) {
    const diff = b[2] - a[2];
    return diff === 1
      ? { kind: 'patch', label: 'patch bump (+0.0.1)' }
      : { kind: 'multi-patch', label: `+0.0.${diff} patches ahead` };
  }
  return { kind: 'regression', label: 'BEHIND last shipped' };
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

/** Stable priority ordering used by both the bullet append loop and the
 *  auto-headline / auto-summary fallback. Highlights surface first, then
 *  new features, then improvements, then fixes. Within a category we keep
 *  PR-number order so older work shows ahead of newer work. */
const ENTRY_ORDER = { highlight: 0, new: 1, improved: 2, fixed: 3 };
function sortPlannedByPriority(planned) {
  return [...planned].sort((a, b) => {
    const o = ENTRY_ORDER[a.category] - ENTRY_ORDER[b.category];
    return o !== 0 ? o : a.number - b.number;
  });
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

/** Build a "X highlights, Y new features, Z improvements, W fixes" phrase
 *  from a list of planned bullets. `excludeBullets` keeps lead bullets that
 *  already appear earlier in the summary out of the count. Returns null if
 *  there's nothing left to enumerate. */
function buildCategoryCountPhrase(planned, { excludeBullets = [] } = {}) {
  const counts = { highlight: 0, new: 0, improved: 0, fixed: 0 };
  const excluded = new Set(excludeBullets);
  for (const p of planned) {
    if (excluded.has(p.bullet)) {
      excluded.delete(p.bullet); // only exclude one match per duplicate
      continue;
    }
    counts[p.category]++;
  }
  const parts = [];
  if (counts.highlight > 0) parts.push(`${counts.highlight} more ${pluralize(counts.highlight, 'highlight')}`);
  if (counts.new > 0) parts.push(`${counts.new} new ${pluralize(counts.new, 'feature')}`);
  if (counts.improved > 0) parts.push(`${counts.improved} ${pluralize(counts.improved, 'improvement')}`);
  if (counts.fixed > 0) parts.push(`${counts.fixed} ${pluralize(counts.fixed, 'fix', 'fixes')}`);
  if (parts.length === 0) return null;
  return joinNaturally(parts);
}

/** Auto-generate the headline when the workflow input is empty. Picks the
 *  first bullet from the highest-priority non-empty category. Bullets in
 *  this codebase are already capitalised + period-terminated by the helper,
 *  so we use them verbatim. */
function buildAutoHeadline(planned) {
  if (planned.length === 0) return 'Stability and polish update.';
  return sortPlannedByPriority(planned)[0].bullet;
}

/** Auto-generate the summary when the workflow input is empty. Joins the
 *  top 1-2 priority bullets as prose and appends an enumerated tail for the
 *  rest. Always returns a string >=20 chars (the floor enforced by
 *  check-whats-new.mjs). */
function buildAutoSummary(planned) {
  if (planned.length === 0) return 'Internal updates and stability improvements for this build.';

  const sorted = sortPlannedByPriority(planned);
  const leadCount = Math.min(2, sorted.length);
  const leadBullets = sorted.slice(0, leadCount).map(p => p.bullet);
  const lead = leadBullets.join(' ');

  const tail = buildCategoryCountPhrase(planned, { excludeBullets: leadBullets });
  if (!tail) {
    return lead.length >= 20 ? lead : `${lead} A focused update for this build.`;
  }
  return `${lead} Plus ${tail} across the rest of the build.`;
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

// ── Deploy-state banner ───────────────────────────────────────────────
// Spell out the version state up-front so the workflow log makes it
// obvious whether this is a fresh build, a re-run after failure, or an
// unintended re-deploy. The "smart" recovery story (PRs from failed
// attempts are preserved automatically) lives in the actual logic
// further down, but this banner is what makes it AUDITABLE.
const allEntries = listEntries(source);
const previousShipped = allEntries.find(e => e.version !== pkgVersion) || allEntries[0];
const topEntry = allEntries[0] || null;
const versionDelta = previousShipped ? describeVersionDelta(previousShipped.version, pkgVersion) : { kind: 'first', label: 'first release' };
// Detect the case where the user is re-deploying without bumping. The
// runner-side mutation never commits back, so whatsNew.ts on main only
// has an entry at this version if a previous run already SUCCEEDED and
// committed it back. If a top entry exists at this version, it's either
// a backfill or a re-deploy of an already-shipped build.
const sameVersionAsTop = topEntry && topEntry.version === pkgVersion;

console.log('═'.repeat(60));
console.log(`What's New plan for v${pkgVersion}`);
console.log('═'.repeat(60));
console.log(`  Repo:           ${REPO}`);
console.log(`  Last shipped:   ${previousShipped ? `v${previousShipped.version} (${previousShipped.date})` : '(none — first release)'}`);
console.log(`  Current:        v${pkgVersion}`);
console.log(`  Version delta:  ${versionDelta.label}`);
if (sameVersionAsTop) {
  console.log('  ⚠  whatsNew.ts already has a top entry at this version — likely a re-deploy of a previously shipped build, or a local backfill.');
}
if (versionDelta.kind === 'multi-patch') {
  console.log('  ⓘ  Multiple patch versions ahead of last shipped. If earlier patch attempts failed, their PRs are still included automatically (the lower bound walks back to the last DIFFERENT version on disk).');
}
if (versionDelta.kind === 'equal') {
  console.log('  ⓘ  Same version as last shipped — re-running the deploy. PRs merged since the original ship-date will be picked up.');
}
if (versionDelta.kind === 'regression') {
  console.log('  ✗  Current version is BEHIND last shipped. This is almost certainly a mistake. Bump package.json before continuing.');
}
console.log('');
console.log(`  Since (date):   ${sinceDate} (coarse pre-filter for gh search)`);
console.log(`  Lower bound:    ${lowerIso || '(none — shallow clone or no previous release)'}`);
console.log(`  Upper bound:    ${headIso || '(none — git not available)'}`);
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

// Empty-window guidance. Without this, the script would still set the
// headline+summary, then check-whats-new.mjs would fail downstream with a
// generic "no bullets" error and the user would have to read three log
// sections to figure out what happened. Bail early with one clear,
// actionable message instead.
if (prs.length === 0) {
  console.error('');
  console.error('::error::No merged PRs in this window — there is nothing to ship.');
  console.error('');
  console.error('  Likely causes:');
  if (versionDelta.kind === 'equal' || sameVersionAsTop) {
    console.error('    • You re-deployed the same version (v' + pkgVersion + ') with no new merges since.');
    console.error('      → If the previous attempt actually succeeded, this is expected — skip the run.');
    console.error('      → If it failed, merge the next change (or wait for one) and re-trigger.');
  } else {
    console.error('    • The version was bumped on a commit that came AFTER all the PRs you wanted to ship.');
    console.error('      → Check `git log --first-parent -- package.json` to see when the bump landed.');
    console.error('    • The previous shipped entry already covers everything that\'s merged.');
    console.error('      → Either ship a manual bullet via `npm run whats-new -- improved "..."`, or skip the build.');
  }
  console.error('');
  process.exit(1);
}

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

// ── Resolve headline + summary (auto-fallback when omitted) ────────────
const finalHeadline = HEADLINE ?? buildAutoHeadline(planned);
const finalSummary = SUMMARY ?? buildAutoSummary(planned);

console.log('  Headline source: ' + (HEADLINE ? 'workflow input' : 'auto-generated from PRs'));
console.log(`    "${finalHeadline}"`);
console.log('  Summary source:  ' + (SUMMARY ? 'workflow input' : 'auto-generated from PRs'));
console.log(`    "${finalSummary}"`);
console.log('');

// ── Set headline + summary first (also creates the entry if needed) ────
runHelperField('headline', finalHeadline);
runHelperField('summary', finalSummary);

// ── Append bullets, sorted by category priority then PR number ─────────
planned.sort((a, b) => {
  const o = ENTRY_ORDER[a.category] - ENTRY_ORDER[b.category];
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
