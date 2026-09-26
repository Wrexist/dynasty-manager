/**
 * Guardrail: the repository tracks source, not working files.
 *
 * `artifacts/` once kept 1,016 files in git — 267 MB, of which 264 MB were 144
 * PNG review sheets and source images from the portrait rollout. Nothing at
 * build or test time reads them. The text provenance (receipts, manifests,
 * validation reports, batch scripts) is ~3 MB, is what LEARNINGS.md cites, and
 * stays tracked; the images are ignored and live only on the machine that made
 * them. The team-crest trees are the exception: the crest pipeline
 * (`scripts/prepare-team-crest-rollout.mjs`) reads their pilot PNGs as inputs,
 * so they stay tracked — under a size budget, because the portrait bloat was
 * never "an image in artifacts/", it was 264 MB of them.
 *
 * `fc25_players.csv` was listed in .gitignore and tracked anyway (a file added
 * before its ignore rule stays tracked). It is an optional FC27 comparison
 * baseline, not a build input.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function gitLsFiles(...paths: string[]): string[] | null {
  try {
    const out = execFileSync('git', ['ls-files', '--', ...paths], { cwd: REPO_ROOT, encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return null; // not a git checkout (e.g. a source tarball) — nothing to pin
  }
}

const hasGit = gitLsFiles('package.json') !== null;

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
/** One review image. The largest crest pilot PNG is ~1.1 MB; a portrait sheet was ~1.8 MB. */
const ARTIFACT_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
/** Every tracked image under artifacts/ together (~18 MB at the crest rollout). */
const ARTIFACT_IMAGES_TOTAL_MAX_BYTES = 24 * 1024 * 1024;

describe('repository hygiene', () => {
  it.skipIf(!hasGit)('tracks no portrait-rollout images under artifacts/', () => {
    const images = (gitLsFiles('artifacts') ?? [])
      .filter(f => /^artifacts\/player-portrait-/.test(f) && IMAGE_RE.test(f));
    expect(images).toEqual([]);
  });

  it.skipIf(!hasGit)('keeps the images tracked under artifacts/ inside their size budget', () => {
    const images = (gitLsFiles('artifacts') ?? []).filter(f => IMAGE_RE.test(f));
    const sizes = images.map(f => ({ f, bytes: statSync(resolve(REPO_ROOT, f)).size }));
    const oversized = sizes.filter(s => s.bytes > ARTIFACT_IMAGE_MAX_BYTES).map(s => s.f);
    const total = sizes.reduce((sum, s) => sum + s.bytes, 0);
    expect(oversized).toEqual([]);
    expect(total).toBeLessThanOrEqual(ARTIFACT_IMAGES_TOTAL_MAX_BYTES);
  });

  it.skipIf(!hasGit)('does not track the ignored FC25 CSV', () => {
    expect(gitLsFiles('fc25_players.csv')).toEqual([]);
  });

  it.skipIf(!hasGit)('tracks no file that .gitignore excludes', () => {
    // The general form of the FC25 case: a file committed before (or around)
    // its ignore rule stays tracked for good. scripts/.icons-debug.html, a raw
    // scraper page dump, was the other one. Only the repo's own .gitignore
    // files count — `--exclude-standard` would also apply a developer's global
    // excludes and fail this on their machine alone.
    const out = execFileSync('git', ['ls-files', '--cached', '--ignored', '--exclude-per-directory=.gitignore'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(out.split('\n').filter(Boolean)).toEqual([]);
  });
});
