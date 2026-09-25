/**
 * Guardrail: the repository tracks source, not working files.
 *
 * `artifacts/` once kept 1,016 files in git — 267 MB, of which 264 MB were 144
 * PNG review sheets and source images from the portrait rollout. Nothing at
 * build or test time reads them. The text provenance (receipts, manifests,
 * validation reports, batch scripts) is ~3 MB, is what LEARNINGS.md cites, and
 * stays tracked; the images are ignored and live only on the machine that made
 * them.
 *
 * `fc25_players.csv` was listed in .gitignore and tracked anyway (a file added
 * before its ignore rule stays tracked). It is an optional FC27 comparison
 * baseline, not a build input.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
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

describe('repository hygiene', () => {
  it.skipIf(!hasGit)('tracks no images under artifacts/', () => {
    const images = (gitLsFiles('artifacts') ?? []).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
    expect(images).toEqual([]);
  });

  it.skipIf(!hasGit)('does not track the ignored FC25 CSV', () => {
    expect(gitLsFiles('fc25_players.csv')).toEqual([]);
  });

  it.skipIf(!hasGit)('tracks no file that .gitignore excludes', () => {
    // The general form of the FC25 case: a file committed before (or around)
    // its ignore rule stays tracked for good. scripts/.icons-debug.html, a raw
    // scraper page dump, was the other one.
    const out = execFileSync('git', ['ls-files', '--cached', '--ignored', '--exclude-standard'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(out.split('\n').filter(Boolean)).toEqual([]);
  });
});
