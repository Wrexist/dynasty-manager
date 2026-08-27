#!/usr/bin/env node
/**
 * Phases 6 + 7 — normalize raw EA records, split by gender, deduplicate.
 *
 * Gender comes from EA's own `gender.label`, which is an explicit field on
 * every record. That is the strongest available signal and is used in
 * preference to any league/club heuristic: guessing "women's league" from a
 * competition name misfiles every player whose club EA lists unusually, and
 * silently drops men. Records whose gender is absent are NOT assumed male —
 * they go to an `unknown` bucket that validate_fc27.mjs reports on.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { toCsv } from './lib/csv.mjs';
import { normalizeEaPlayer, resolveColumns, isMale, isFemale } from './lib/schema.mjs';
import { readRawItems, DEFAULT_RAW_DIR } from './extract_fc27.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = join(ROOT, 'data/fc27');

/**
 * Deduplicate on player_id, keeping the first occurrence. A repeated id means
 * overlapping pages (a shifting offset window during a long pull), not two
 * players — EA ids are unique per record.
 * @returns {{ rows: object[], duplicates: {player_id: unknown, count: number}[] }}
 */
export function dedupeById(rows) {
  const seen = new Map();
  const counts = new Map();
  for (const row of rows) {
    const id = row.player_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!seen.has(id)) seen.set(id, row);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([player_id, count]) => ({ player_id, count }));
  return { rows: [...seen.values()], duplicates };
}

export function normalize(items, { dataVersion = 'fc27', scrapedAt = new Date().toISOString() } = {}) {
  const asOf = new Date(scrapedAt);
  const meta = {
    source: 'ea-drop-api',
    sourceUrlTemplate: 'https://www.ea.com/games/ea-sports-fc/ratings?playerId={id}',
    dataVersion,
    scrapedAt,
    asOf,
  };
  return items.map((raw) => normalizeEaPlayer(raw, meta));
}

export function splitByGender(rows) {
  return {
    male: rows.filter(isMale),
    female: rows.filter(isFemale),
    unknown: rows.filter((r) => !isMale(r) && !isFemale(r)),
  };
}

export function run({ rawDir = DEFAULT_RAW_DIR, outDir = OUT_DIR, dataVersion = 'fc27' } = {}) {
  const items = readRawItems(rawDir);
  if (items.length === 0) {
    throw new Error(`No raw records under ${rawDir}. Run extract_fc27.mjs first.`);
  }

  const scrapedAt = new Date().toISOString();
  const normalized = normalize(items, { dataVersion, scrapedAt });
  const { rows, duplicates } = dedupeById(normalized);
  const split = splitByGender(rows);
  const columns = resolveColumns(rows);

  mkdirSync(outDir, { recursive: true });
  const write = (name, subset) => {
    if (subset.length === 0) return null;
    const csvPath = join(outDir, `${name}.csv`);
    const jsonPath = join(outDir, `${name}.json`);
    writeFileSync(csvPath, toCsv(columns, subset), 'utf8');
    writeFileSync(jsonPath, `${JSON.stringify(subset, null, 0)}\n`, 'utf8');
    return { csvPath, jsonPath, count: subset.length };
  };

  const written = {
    male: write('FC27_male_players', split.male),
    female: write('FC27_female_players', split.female),
    unknown: write('FC27_unknown_gender_players', split.unknown),
  };

  return { columns, duplicates, split, written, total: rows.length, rawCount: items.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rawDirArg = process.argv.indexOf('--raw-dir');
  const outDirArg = process.argv.indexOf('--out-dir');
  const result = run({
    rawDir: rawDirArg > -1 ? process.argv[rawDirArg + 1] : undefined,
    outDir: outDirArg > -1 ? process.argv[outDirArg + 1] : undefined,
  });
  console.log(`[normalize] ${result.rawCount} raw -> ${result.total} unique`);
  console.log(`[normalize] male=${result.split.male.length} female=${result.split.female.length} unknown=${result.split.unknown.length}`);
  if (result.duplicates.length) console.log(`[normalize] duplicate ids collapsed: ${result.duplicates.length}`);
}
