#!/usr/bin/env node
/**
 * Phases 6 + 7 — normalize raw EA records, split by gender, deduplicate.
 *
 * Gender comes from EA's own `gender.label`, an explicit field on every
 * record. That is the strongest available signal and is used in preference to
 * any league or club heuristic: guessing "women's league" from a competition
 * name misfiles every player whose club EA lists unusually, and silently drops
 * men. Records with no gender are NOT assumed male — they go to an `unknown`
 * bucket that validate_fc27.mjs reports on.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { toCsv } from './lib/csv.mjs';
import { normalizeEaPlayer, resolveColumns, isMale, isFemale } from './lib/schema.mjs';
import { readRawItems } from './lib/raw.mjs';
import { parseArgs } from './lib/args.mjs';
import { DATA_DIR, RAW_DIR, DATASET_NAMES } from './lib/paths.mjs';

const SOURCE_URL_TEMPLATE = 'https://www.ea.com/games/ea-sports-fc/ratings?playerId={id}';

/**
 * Collapse repeated ids, keeping the first occurrence. A repeated id means
 * overlapping pages (a shifting offset window during a long pull), not two
 * players — EA ids are unique per record.
 */
export function dedupeById(rows) {
  const seen = new Map();
  const counts = new Map();
  for (const row of rows) {
    const id = row.player_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!seen.has(id)) seen.set(id, row);
  }
  return {
    rows: [...seen.values()],
    duplicates: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([player_id, count]) => ({ player_id, count })),
  };
}

export function normalize(items, { dataVersion = 'fc27', scrapedAt = new Date().toISOString() } = {}) {
  const meta = {
    source: 'ea-drop-api',
    sourceUrlTemplate: SOURCE_URL_TEMPLATE,
    dataVersion,
    scrapedAt,
    asOf: new Date(scrapedAt),
  };
  return items.map((raw) => normalizeEaPlayer(raw, meta));
}

export const splitByGender = (rows) => ({
  male: rows.filter(isMale),
  female: rows.filter(isFemale),
  unknown: rows.filter((r) => !isMale(r) && !isFemale(r)),
});

export function run({ rawDir = RAW_DIR, outDir = DATA_DIR, dataVersion = 'fc27' } = {}) {
  const items = readRawItems(rawDir);
  if (items.length === 0) {
    throw new Error(`No raw records under ${rawDir}. Run extract_fc27.mjs first.`);
  }

  const normalized = normalize(items, { dataVersion });
  const { rows, duplicates } = dedupeById(normalized);
  const split = splitByGender(rows);
  const columns = resolveColumns(rows);

  mkdirSync(outDir, { recursive: true });
  const write = (name, subset) => {
    if (subset.length === 0) return null;
    const csvPath = join(outDir, `${name}.csv`);
    const jsonPath = join(outDir, `${name}.json`);
    writeFileSync(csvPath, toCsv(columns, subset), 'utf8');
    writeFileSync(jsonPath, `${JSON.stringify(subset)}\n`, 'utf8');
    return { csvPath, jsonPath, count: subset.length };
  };

  return {
    columns,
    duplicates,
    split,
    total: rows.length,
    rawCount: items.length,
    written: {
      male: write(DATASET_NAMES.male, split.male),
      female: write(DATASET_NAMES.female, split.female),
      unknown: write(DATASET_NAMES.unknown, split.unknown),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const result = run({ rawDir: args.rawDir, outDir: args.outDir });
  console.log(`[normalize] ${result.rawCount} raw -> ${result.total} unique`);
  console.log(`[normalize] male=${result.split.male.length} female=${result.split.female.length}`
    + ` unknown=${result.split.unknown.length}`);
  if (result.duplicates.length) console.log(`[normalize] duplicate ids collapsed: ${result.duplicates.length}`);
}
