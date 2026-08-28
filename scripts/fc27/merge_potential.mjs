#!/usr/bin/env node
/**
 * Phase 15 — merge `potential` onto the EA base from a second source.
 *
 * EA's ratings API publishes no career-mode potential, and the game cannot run
 * without it (`processFC26.mjs` writes `pot` on every generated player, and
 * development is driven by the ovr->pot gap). This stage fills that one column
 * and stamps `potential_source` on every row it touches, so the two sources
 * are never silently blended.
 *
 * The provider is any CSV the pipeline can read into the comparable shape,
 * which covers both the intended end state — a CMTracker/SoFIFA FC27 export
 * dropped in here — and the interim: carrying the prior season's potential
 * across while no FC27 potential source is reachable. Carried-over values are
 * labelled as such, because they are NOT FC27 data.
 *
 * Usage:
 *   node scripts/fc27/merge_potential.mjs --from FC26_20250921.csv
 *        [--csv <dataset.csv>] [--label fc26-carryover] [--clamp] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { readComparable, matchPlayers, fromNormalizedRow } from './lib/players.mjs';
import { parseArgs } from './lib/args.mjs';
import { BASELINES, MALE_CSV } from './lib/paths.mjs';

/** A value the source did not supply: '' from CSV, null straight from the normalizer. */
const isAbsent = (v) => v === '' || v === null || v === undefined;

/**
 * Fill `potential` on rows that lack it, from matched provider records.
 *
 * @param {Record<string, unknown>[]} rows normalized FC27 rows, mutated in place
 * @param {object[]} provider comparable-shaped provider records
 * @param {{ label: string, clamp?: boolean }} opts
 */
export function mergePotential(rows, provider, { label, clamp = false }) {
  const { pairs, tiers } = matchPlayers(rows.map(fromNormalizedRow), provider);

  const byId = new Map();
  // A blank id would collide every id-less row onto one pair. validate_fc27
  // already fails a dataset with blank ids; this just refuses to guess.
  for (const pair of pairs) {
    if (pair.current.id) byId.set(pair.current.id, pair);
  }

  const stats = { filled: 0, clamped: 0, matchedWithoutPotential: 0, alreadyPresent: 0 };

  for (const row of rows) {
    if (!isAbsent(row.potential)) {
      // A real FC27 source merged earlier outranks a carry-over merged later.
      stats.alreadyPresent += 1;
      continue;
    }

    const pair = byId.get(String(row.player_id ?? ''));
    if (!pair) continue;

    const supplied = pair.base.potential;
    if (supplied === null || Number.isNaN(supplied)) {
      stats.matchedWithoutPotential += 1;
      continue;
    }

    let value = Number(supplied);
    let stamp = label;

    // A potential below overall means the player has outgrown the carried-over
    // figure. Raising it is a judgement call, not source data, so it is opt-in
    // and it changes the provenance stamp.
    const overall = isAbsent(row.overall) ? null : Number(row.overall);
    if (clamp && overall !== null && value < overall) {
      value = overall;
      stamp = `${label}+clamped-to-overall`;
      stats.clamped += 1;
    }

    row.potential = value;
    row.potential_source = stamp;
    stats.filled += 1;
  }

  return { ...stats, unmatched: rows.length - pairs.length, tiers };
}

export function run({ csvPath = MALE_CSV, from, label, clamp = false, dryRun = false } = {}) {
  if (!from) throw new Error('--from <provider.csv> is required.');
  const providerPath = BASELINES[from] ?? from;
  if (!existsSync(csvPath)) throw new Error(`No FC27 dataset at ${csvPath}.`);
  if (!existsSync(providerPath)) throw new Error(`No potential provider at ${providerPath}.`);

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (rows.length === 0) throw new Error(`${csvPath} has no rows.`);

  const provider = readComparable(readFileSync(providerPath, 'utf8'));
  if (!provider.some((p) => p.potential !== null)) {
    throw new Error(`${providerPath} carries no potential values — it cannot be a potential provider.`);
  }

  const result = mergePotential(rows, provider, {
    label: label ?? `${basename(providerPath, '.csv')}-carryover`,
    clamp,
  });

  if (!dryRun) {
    writeFileSync(csvPath, toCsv(Object.keys(rows[0]), rows), 'utf8');
    writeFileSync(csvPath.replace(/\.csv$/, '.json'), `${JSON.stringify(rows)}\n`, 'utf8');
  }

  return { ...result, total: rows.length, providerRows: provider.length, csvPath, providerPath, dryRun };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const result = run({
    csvPath: args.csv,
    from: args.from,
    label: args.label,
    clamp: Boolean(args.clamp),
    dryRun: Boolean(args.dryRun),
  });
  console.log(`[merge] provider: ${result.providerPath} (${result.providerRows} rows)`);
  console.log(`[merge] match tiers: ${JSON.stringify(result.tiers)}`);
  console.log(`[merge] potential filled: ${result.filled}/${result.total}`
    + ` (already present ${result.alreadyPresent},`
    + ` matched-but-no-potential ${result.matchedWithoutPotential},`
    + ` unmatched ${result.unmatched}${result.clamped ? `, clamped ${result.clamped}` : ''})`);
  if (result.dryRun) console.log('[merge] --dry-run: nothing written');
}
