#!/usr/bin/env node
/**
 * Phase 15 — merge `potential` onto the EA base from a second source.
 *
 * EA's ratings API publishes no career-mode potential, and the game cannot run
 * without it (`processFC26.mjs` writes `pot` on every generated player and
 * development is driven by the ovr->pot gap). This stage fills that one column
 * from a source that has it, and stamps `potential_source` on every row it
 * touches so the two sources are never silently blended.
 *
 * The provider is a CSV in either baseline shape (SoFIFA-style with
 * `player_id`/`potential`, or a previously built FC27 file). That covers both
 * the intended end state — a CMTracker/SoFIFA FC27 export dropped in here — and
 * the interim: carrying the prior season's potential across while no FC27
 * potential source is reachable.
 *
 * Carried-over potential is labelled as such (`potential_source` records the
 * provider AND that it is a carry-over) precisely because it is NOT FC27 data.
 * It is a stopgap that keeps career mode functional, not a substitute for the
 * real thing.
 *
 * Usage:
 *   node scripts/fc27/merge_potential.mjs --from FC26_20250921.csv \
 *        [--csv data/fc27/FC27_male_players.csv] [--label fc26-carryover] \
 *        [--clamp] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { readBaseline, matchPlayers } from './compare_fc25.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_CSV = join(ROOT, 'data/fc27/FC27_male_players.csv');

/** Normalized FC27 rows -> the shape matchPlayers() compares on. */
const toComparable = (row) => ({
  id: String(row.player_id ?? ''),
  name: row.name || '',
  longName: [row.first_name, row.last_name].filter(Boolean).join(' '),
  dob: row.date_of_birth || '',
  club: row.club || '',
  league: row.league || '',
  position: row.position || '',
  overall: row.overall === '' ? null : Number(row.overall),
  potential: row.potential === '' ? null : Number(row.potential),
});

/**
 * Fill `potential` on rows that lack it, from matched provider records.
 *
 * Rows that already carry a potential are never overwritten — a real FC27
 * source merged earlier outranks a carry-over merged later.
 *
 * @param {Record<string,string>[]} rows normalized FC27 rows
 * @param {object[]} provider baseline-shaped provider records
 * @param {{ label: string, clamp?: boolean }} opts
 */
export function mergePotential(rows, provider, { label, clamp = false }) {
  const comparable = rows.map(toComparable);
  const { pairs, tiers } = matchPlayers(comparable, provider);

  const byId = new Map();
  // An empty id would collide every id-less row onto one pair, so those are
  // skipped here. validate_fc27.mjs already fails a dataset with blank ids.
  for (const pair of pairs) {
    if (pair.current.id) byId.set(pair.current.id, pair);
  }

  let filled = 0;
  let clamped = 0;
  let matchedWithoutPotential = 0;
  let alreadyPresent = 0;

  for (const row of rows) {
    // Absent is '' when the rows came from a CSV and null when they came
    // straight from the normalizer. Both mean "not supplied" and both must be
    // fillable — treating null as present would silently skip every row on the
    // in-memory path.
    const existing = row.potential;
    if (existing !== '' && existing !== undefined && existing !== null) {
      alreadyPresent += 1;
      continue;
    }
    const pair = byId.get(String(row.player_id ?? ''));
    if (!pair) continue;

    const supplied = pair.base.potential;
    if (supplied === null || supplied === undefined || Number.isNaN(supplied)) {
      matchedWithoutPotential += 1;
      continue;
    }

    let value = Number(supplied);
    let sourceLabel = label;

    // A potential below overall means the player has already outgrown the
    // carried-over figure. Raising it is a judgement call, not source data, so
    // it is opt-in and it changes the provenance stamp.
    const overall = row.overall === '' ? null : Number(row.overall);
    if (clamp && overall !== null && value < overall) {
      value = overall;
      sourceLabel = `${label}+clamped-to-overall`;
      clamped += 1;
    }

    row.potential = value;
    row.potential_source = sourceLabel;
    filled += 1;
  }

  const unmatched = rows.length - pairs.length;
  return { filled, clamped, matchedWithoutPotential, alreadyPresent, unmatched, tiers };
}

export function run({ csvPath = DEFAULT_CSV, from, label, clamp = false, dryRun = false } = {}) {
  if (!from) throw new Error('--from <provider.csv> is required.');
  if (!existsSync(csvPath)) throw new Error(`No FC27 dataset at ${csvPath}.`);
  if (!existsSync(from)) throw new Error(`No potential provider at ${from}.`);

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (rows.length === 0) throw new Error(`${csvPath} has no rows.`);
  const provider = readBaseline(from);

  const providerWithPotential = provider.filter((p) => p.potential !== null && !Number.isNaN(p.potential));
  if (providerWithPotential.length === 0) {
    throw new Error(`${from} carries no potential values — it cannot be a potential provider.`);
  }

  const result = mergePotential(rows, provider, { label, clamp });
  const columns = Object.keys(rows[0]);

  if (!dryRun) {
    writeFileSync(csvPath, toCsv(columns, rows), 'utf8');
    const jsonPath = csvPath.replace(/\.csv$/, '.json');
    writeFileSync(jsonPath, `${JSON.stringify(rows, null, 0)}\n`, 'utf8');
  }

  return { ...result, total: rows.length, providerRows: provider.length, csvPath, dryRun };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const from = arg('--from');
  const result = run({
    csvPath: arg('--csv'),
    from,
    label: arg('--label') ?? `${from ? from.split('/').pop().replace(/\.csv$/, '') : 'provider'}-carryover`,
    clamp: process.argv.includes('--clamp'),
    dryRun: process.argv.includes('--dry-run'),
  });
  console.log(`[merge] provider rows: ${result.providerRows}`);
  console.log(`[merge] match tiers: ${JSON.stringify(result.tiers)}`);
  console.log(`[merge] potential filled: ${result.filled}/${result.total}`
    + ` (already present ${result.alreadyPresent}, matched-but-no-potential ${result.matchedWithoutPotential},`
    + ` unmatched ${result.unmatched}${result.clamped ? `, clamped ${result.clamped}` : ''})`);
  if (result.dryRun) console.log('[merge] --dry-run: nothing written');
}
