#!/usr/bin/env node
/**
 * append-pending-from-pr.mjs — append a single PR's bullets to pendingNews.ts.
 *
 * Called by `.github/workflows/append-pending-news.yml` whenever a PR merges
 * into `main`. The workflow passes the PR title, body, and labels via env
 * vars (set from the `github.event.pull_request` payload).
 *
 * Conventions matched (same as the old build-whats-new.mjs deploy-time
 * scrape, just per-PR now instead of a batch):
 *   - Skip labels: skip-changelog, no-changelog, dependencies, infra, ci.
 *   - Category labels: type:highlight / type:new / type:improved / type:fixed.
 *     Default = improved. Highest-promotion tier wins on conflict
 *     (highlight > new > fixed > improved).
 *   - Bullets: lines under a `## What's New` markdown heading in the body.
 *     If the section is missing, fall back to the (cleaned) PR title.
 *
 * Inputs (env vars):
 *   PR_TITLE   — PR title.
 *   PR_BODY    — PR body (markdown). May be empty.
 *   PR_LABELS  — comma- or newline-separated label names.
 *   PR_NUMBER  — informational; logged in the resulting commit message.
 *
 * Or pass them as CLI args:
 *   --title "..." --body "..." --labels "type:improved,foo" --number 123
 *
 * Exits 0 with code "no-op" stdout when the PR is intentionally skipped (so
 * the workflow can short-circuit the commit step). Exits non-zero only on
 * unexpected errors.
 *
 * Output: writes the updated pendingNews.ts to disk and prints a short
 * summary. The workflow then commits + pushes.
 */

import {
  PENDING_NEWS_PATH,
  parsePendingNews,
  readFile,
  writeFile,
  writePendingNews,
  normaliseBullet,
  normaliseTitle,
} from './lib/whatsNewIO.mjs';

const SKIP_LABELS = new Set([
  'skip-changelog',
  'no-changelog',
  'dependencies',
  'infra',
  'ci',
]);

// `fixed` outranks `improved` only because, when a PR is labelled both, the
// fix is the headline. `highlight` and `new` outrank both.
const CATEGORY_PRIORITY = ['highlight', 'new', 'fixed', 'improved'];
const CATEGORY_TO_FIELD = {
  highlight: 'highlights',
  new: 'new',
  improved: 'improved',
  fixed: 'fixed',
};

function readArgs() {
  const out = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--title') out.title = args[++i];
    else if (a === '--body') out.body = args[++i];
    else if (a === '--labels') out.labels = args[++i];
    else if (a === '--number') out.number = args[++i];
  }
  return {
    title: out.title ?? process.env.PR_TITLE ?? '',
    body: out.body ?? process.env.PR_BODY ?? '',
    labels: out.labels ?? process.env.PR_LABELS ?? '',
    number: out.number ?? process.env.PR_NUMBER ?? '?',
  };
}

function parseLabels(raw) {
  return String(raw || '')
    .split(/[,\n]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function categoriseFromLabels(labels) {
  for (const cat of CATEGORY_PRIORITY) {
    if (labels.includes(`type:${cat}`)) return cat;
  }
  return 'improved';
}

/** Pull bullet lines out of a `## What's New` body section. */
function extractWhatsNewBullets(body) {
  if (!body) return [];
  const heading = body.match(/##\s*what['’]?s\s+new[^\n]*\n/i);
  if (!heading) return [];
  const start = heading.index + heading[0].length;
  const next = body.slice(start).match(/\n##\s/);
  const end = next ? start + next.index : body.length;
  const block = body.slice(start, end);
  const bullets = [];
  for (const line of block.split('\n')) {
    const m = line.trim().match(/^[-*]\s+(.+)$/);
    if (m) bullets.push(m[1].trim());
  }
  return bullets;
}

function ok(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ⓘ ${msg}`); }
function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

function main() {
  const { title, body, labels: rawLabels, number } = readArgs();
  const labels = parseLabels(rawLabels);

  console.log('═'.repeat(60));
  console.log(`Append pending news from PR #${number}`);
  console.log('═'.repeat(60));
  console.log(`  Title:  ${title}`);
  console.log(`  Labels: ${labels.length ? labels.join(', ') : '(none)'}`);

  const skipLabel = labels.find(l => SKIP_LABELS.has(l));
  if (skipLabel) {
    info(`Skipping — label "${skipLabel}" suppresses changelog entry.`);
    console.log('::set-output name=action::skip');
    console.log('action=skip');
    return;
  }

  const category = categoriseFromLabels(labels);
  const field = CATEGORY_TO_FIELD[category];
  console.log(`  Category: ${category} → pending.${field}`);

  const bodyBullets = extractWhatsNewBullets(body);
  const rawBullets = bodyBullets.length > 0
    ? bodyBullets
    : [normaliseTitle(title)];
  const bullets = rawBullets.map(normaliseBullet).filter(b => b.length > 0);
  if (bullets.length === 0) {
    info('PR yielded no usable bullet text (empty title and no `## What\'s New` section).');
    console.log('action=skip');
    return;
  }

  // Release notes are strictly player-facing. PRs from agent branches
  // (claude/*, codex/* …) often carry only a branch-style title and no
  // `## What's New` section, so the title fallback can leak text that names
  // the AI tool or the dev workflow ("Claude/phase 1 all critical fixes").
  // Drop any such bullet — add a `## What's New` section to the PR body to
  // control the wording instead.
  const FORBIDDEN_BULLET_RE =
    /\b(claude|cursor|lovable|copilot|codex|chatgpt|gpt-?\d|vibe[\s-]?cod\w*|ai[\s-](generated|assisted|written))\b/i;
  const userFacingBullets = bullets.filter(b => {
    if (FORBIDDEN_BULLET_RE.test(b)) {
      info(`Dropped bullet — names an AI/dev tool, not a player-facing change: "${b}"`);
      return false;
    }
    return true;
  });
  if (userFacingBullets.length === 0) {
    info('PR yielded no player-facing bullets after filtering AI/dev-tooling noise.');
    console.log('action=skip');
    return;
  }

  const source = readFile(PENDING_NEWS_PATH);
  const { fields } = parsePendingNews(source);
  const existing = fields[field] || [];
  const additions = [];
  for (const b of userFacingBullets) {
    if (!existing.includes(b) && !additions.includes(b)) additions.push(b);
  }

  if (additions.length === 0) {
    info('All bullets already present in pending — no change.');
    console.log('action=noop');
    return;
  }

  const next = { ...fields, [field]: [...existing, ...additions] };
  const newSource = writePendingNews(source, next);
  writeFile(PENDING_NEWS_PATH, newSource);
  for (const b of additions) ok(`Appended to pending.${field}: "${b}"`);
  console.log('action=append');
  // Surface the bullet count for the workflow's commit message.
  console.log(`appended_count=${additions.length}`);
}

try {
  main();
} catch (err) {
  fail(err.message || String(err));
}
