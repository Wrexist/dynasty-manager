/**
 * Every path the FC27 pipeline reads or writes, in one place.
 *
 * Each stage used to recompute the repo root and its own defaults, which is
 * how a redirected run ended up writing its reports over the repo's real ones.
 * `sidecarFor()` is the fix: give it the dataset directory a run was pointed
 * at, and it returns that run's own home for every downstream artifact.
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const DATA_DIR = join(REPO_ROOT, 'data/fc27');
export const RAW_DIR = join(DATA_DIR, 'raw');
export const COMPARISON_DIR = join(DATA_DIR, 'comparison');
export const DISCOVERY_PATH = join(DATA_DIR, 'discovery.json');
export const RUN_REPORT_PATH = join(DATA_DIR, 'last-run.json');
export const GAME_INPUT_PATH = join(DATA_DIR, 'FC27_community_pack_input.csv');

export const MALE_CSV = join(DATA_DIR, 'FC27_male_players.csv');
export const QUALITY_REPORT_PATH = join(REPO_ROOT, 'docs/fc27-data-quality.md');
export const COMPARISON_REPORT_PATH = join(REPO_ROOT, 'docs/fc25-vs-fc27.md');

/** Baseline datasets already in the repo, usable as comparison or potential providers. */
export const BASELINES = {
  fc26: join(REPO_ROOT, 'FC26_20250921.csv'),
  fc25: join(REPO_ROOT, 'fc25_players.csv'),
};

/** Dataset file names, so normalize and its readers cannot drift apart. */
export const DATASET_NAMES = {
  male: 'FC27_male_players',
  female: 'FC27_female_players',
  unknown: 'FC27_unknown_gender_players',
};

/**
 * Artifact paths for one run.
 *
 * With no `outDir`, a run writes to the repo's real locations — that is a real
 * build. With an `outDir` (a fixture run, a side-by-side rebuild), EVERY
 * artifact moves next to the dataset it describes, so such a run can never
 * overwrite the committed reports.
 *
 * @param {string | undefined} outDir
 */
export function sidecarFor(outDir) {
  if (!outDir) {
    return {
      redirected: false,
      dataDir: DATA_DIR,
      comparisonDir: COMPARISON_DIR,
      qualityReport: QUALITY_REPORT_PATH,
      comparisonReport: COMPARISON_REPORT_PATH,
      runReport: RUN_REPORT_PATH,
      gameInput: GAME_INPUT_PATH,
    };
  }
  return {
    redirected: true,
    dataDir: outDir,
    comparisonDir: join(outDir, 'comparison'),
    qualityReport: join(outDir, 'fc27-data-quality.md'),
    comparisonReport: join(outDir, 'fc25-vs-fc27.md'),
    runReport: join(outDir, 'last-run.json'),
    gameInput: join(outDir, 'FC27_community_pack_input.csv'),
  };
}
