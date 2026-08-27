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
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { RAW_DIR } from './paths.mjs';

const STATE_FILE = '_state.json';
const pageName = (offset) => `source_${String(offset).padStart(6, '0')}.json`;

/** @returns {{source:string, slug:string|null, base:string|null, total:number|null, pages:Record<string,{file:string,count:number}>, done:boolean}} */
export function loadState(rawDir = RAW_DIR, { fresh = false } = {}) {
  const file = join(rawDir, STATE_FILE);
  if (fresh || !existsSync(file)) {
    return { source: 'ea-drop-api', slug: null, base: null, total: null, pages: {}, done: false };
  }
  return JSON.parse(readFileSync(file, 'utf8'));
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
