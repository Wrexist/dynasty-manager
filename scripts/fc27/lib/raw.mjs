/**
 * Raw page storage and the restart checkpoint.
 *
 * Kept apart from the extractor so that reading a completed pull does not mean
 * importing the thing that performs network requests: normalization only needs
 * the files on disk.
 *
 * Raw pages are written once and never rewritten. Later stages read them and
 * write elsewhere, so the untouched API responses always remain to re-derive
 * from if the normalizer changes.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { RAW_DIR } from './paths.mjs';

const STATE_FILE = '_state.json';
const pageName = (offset) => `source_${String(offset).padStart(6, '0')}.json`;

/** @returns {{source:string, slug:string|null, base:string|null, total:number|null, pages:Record<string,{file:string,count:number}>, done:boolean}} */
/** Delete cached page files so a reset checkpoint cannot inherit them.
 *
 *  `--fresh` used to clear only `_state.json`, but `readRawItems` globs every
 *  `source_*.json` in the directory — so a fresh run, or a run with a
 *  different `--base`/`--gender`, normalised whatever the previous pull left
 *  behind. That is how wrong-gender or stale records reach the CSV without
 *  anything reporting it. */
function clearRawPages(rawDir) {
  if (!existsSync(rawDir)) return;
  for (const f of readdirSync(rawDir)) {
    if (/^source_\d+\.json$/.test(f)) rmSync(join(rawDir, f), { force: true });
  }
}

/** Identity of the request set a checkpoint's pages were pulled with. Pages
 *  are only reusable by a run asking EA the same question. */
export function requestFingerprint({ base = null, gender = null, locale = null, slug = null } = {}) {
  return JSON.stringify({ base, gender: gender ?? null, locale: locale ?? null, slug: slug ?? null });
}

export function loadState(rawDir = RAW_DIR, { fresh = false, fingerprint = null } = {}) {
  const file = join(rawDir, STATE_FILE);
  const empty = () => ({
    source: 'ea-drop-api', slug: null, base: null, fingerprint, total: null, pages: {}, done: false,
  });
  if (fresh || !existsSync(file)) {
    clearRawPages(rawDir);
    return empty();
  }
  const state = JSON.parse(readFileSync(file, 'utf8'));
  // A checkpoint whose pages answer a different question is not a checkpoint
  // for this run — resuming from it would silently mix two extractions.
  if (fingerprint !== null && state.fingerprint !== undefined && state.fingerprint !== fingerprint) {
    console.log('[extract] request parameters changed since the last run — discarding cached pages');
    clearRawPages(rawDir);
    return empty();
  }
  if (fingerprint !== null && state.fingerprint === undefined) state.fingerprint = fingerprint;
  return state;
}

export function saveState(rawDir, state) {
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Persist one page of results and record it in the checkpoint.
 * @returns {{file: string, count: number}}
 */
export function writeRawPage(rawDir, offset, { url, items }) {
  mkdirSync(rawDir, { recursive: true });
  const file = pageName(offset);
  const body = { url, fetchedAt: new Date().toISOString(), items };
  writeFileSync(join(rawDir, file), `${JSON.stringify(body)}\n`, 'utf8');
  return { file, count: items.length };
}

/**
 * Read every stored page back, in offset order.
 * Sorting matters: the file names are zero-padded so lexical order is offset
 * order, which keeps the emitted dataset stable across runs.
 */
export function readRawItems(rawDir = RAW_DIR) {
  if (!existsSync(rawDir)) return [];
  const files = readdirSync(rawDir)
    .filter((f) => f.startsWith('source_') && f.endsWith('.json'))
    .sort();
  const items = [];
  for (const file of files) {
    const body = JSON.parse(readFileSync(join(rawDir, file), 'utf8'));
    items.push(...(body.items ?? []));
  }
  return items;
}
