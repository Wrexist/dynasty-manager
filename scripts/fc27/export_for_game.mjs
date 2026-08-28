#!/usr/bin/env node
/**
 * Compatibility layer — FC27 normalized schema -> the CSV shape the game's
 * existing pipeline already consumes.
 *
 * `scripts/processFC26.mjs` reads a SoFIFA-shaped CSV (`player_id`,
 * `short_name`, `player_positions`, `physic`, `goalkeeping_*`, …). The FC27
 * normalizer emits an EA-shaped schema. Rather than rewrite the working
 * community-pack pipeline against a new shape, this stage translates, so
 * FC27 data can be dropped into the existing `npm run process-fc26` flow.
 *
 * Two things it does NOT do:
 *   - It does not invent values. Columns the FC27 data has no answer for stay
 *     empty, and `processFC26.mjs`'s own `toIntOr50` default is left to decide
 *     what that means downstream — that default is visible in the game's code,
 *     whereas a number written here would look like source data.
 *   - It does not overwrite anything under src/data/. It writes one CSV and
 *     stops; running the community-pack build is a separate, deliberate step.
 *
 * League ids are the one genuine incompatibility: EA does not publish the
 * numeric league ids the game's league map is keyed on. They are resolved by
 * matching league NAME against the existing baseline CSV, and every league
 * that fails to resolve is reported rather than silently dropped.
 *
 * Usage:
 *   node scripts/fc27/export_for_game.mjs [--csv <fc27.csv>]
 *        [--league-map FC26_20250921.csv] [--out data/fc27/FC27_community_pack_input.csv]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { parseArgs } from './lib/args.mjs';
import { BASELINES, MALE_CSV, GAME_INPUT_PATH } from './lib/paths.mjs';

/** The exact columns processFC26.mjs reads, in the baseline's own order. */
export const GAME_COLUMNS = [
  'player_id', 'short_name', 'long_name', 'player_positions', 'overall', 'potential',
  'age', 'dob', 'height_cm', 'weight_kg', 'nationality_name',
  'club_name', 'league_id', 'league_name',
  'preferred_foot', 'weak_foot', 'skill_moves',
  'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physic',
  'movement_reactions', 'mentality_composure', 'mentality_vision',
  'goalkeeping_diving', 'goalkeeping_handling', 'goalkeeping_kicking',
  'goalkeeping_positioning', 'goalkeeping_reflexes', 'goalkeeping_speed',
  'player_traits',
];

/**
 * Two lookups for the numeric `league_id` the game keys on, which EA does not
 * publish: by league name, and by club name.
 *
 * The club lookup exists because EA names competitions with their sponsor —
 * "Ligue 1 McDonald's", "LALIGA HYPERMOTION", "Serie BKT" — where the baseline
 * uses the plain name, so league-name matching alone resolves under a quarter
 * of rows. A club's league is a fact about the club, so matching the club is
 * both more reliable and more stable across seasons.
 */
export function buildLeagueMap(baselineCsvText) {
  const byLeague = new Map();
  const byClub = new Map();
  for (const row of parseCsv(baselineCsvText)) {
    const id = String(row.league_id ?? '').trim();
    if (!id) continue;
    const league = (row.league_name ?? '').trim().toLowerCase();
    if (league && !byLeague.has(league)) byLeague.set(league, id);
    const club = (row.club_name ?? '').trim().toLowerCase();
    if (club && !byClub.has(club)) byClub.set(club, id);
  }
  // `get` keeps the old single-map call shape working for league lookups.
  byLeague.byClub = byClub;
  return byLeague;
}

/** league name first, then the club's own league. Empty when neither knows. */
function resolveLeagueId(leagueMap, league, club) {
  const byName = leagueMap.get(String(league ?? '').trim().toLowerCase());
  if (byName) return byName;
  const byClub = leagueMap.byClub?.get(String(club ?? '').trim().toLowerCase());
  return byClub ?? '';
}

/**
 * Translate one normalized FC27 row into the game pipeline's shape.
 * @param {Record<string,string>} row
 * @param {Map<string,string>} leagueMap
 */
export function toGameRow(row, leagueMap) {
  const league = (row.league ?? '').trim();
  return {
    player_id: row.player_id ?? '',
    short_name: row.short_name || row.name || '',
    long_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.name || '',
    player_positions: row.positions || row.position || '',
    overall: row.overall ?? '',
    potential: row.potential ?? '',
    // EA sends no age; this is the pipeline's derived_age carried across under
    // the name the consumer expects. Provenance for it lives in the FC27 file.
    age: row.derived_age ?? '',
    dob: row.date_of_birth ?? '',
    height_cm: row.height ?? '',
    weight_kg: row.weight ?? '',
    nationality_name: row.nationality ?? '',
    club_name: row.club ?? '',
    league_id: resolveLeagueId(leagueMap, league, row.club),
    league_name: league,
    preferred_foot: row.preferred_foot ?? '',
    weak_foot: row.weak_foot ?? '',
    skill_moves: row.skill_moves ?? '',
    pace: row.pace ?? '',
    shooting: row.shooting ?? '',
    passing: row.passing ?? '',
    dribbling: row.dribbling ?? '',
    defending: row.defending ?? '',
    // The game's column for physicality is spelled `physic`.
    physic: row.physical ?? '',
    movement_reactions: row.reactions ?? '',
    mentality_composure: row.composure ?? '',
    mentality_vision: row.vision ?? '',
    goalkeeping_diving: row.gk_diving ?? '',
    goalkeeping_handling: row.gk_handling ?? '',
    goalkeeping_kicking: row.gk_kicking ?? '',
    goalkeeping_positioning: row.gk_positioning ?? '',
    goalkeeping_reflexes: row.gk_reflexes ?? '',
    // Not published by EA; left empty rather than approximated.
    goalkeeping_speed: '',
    // PlayStyles are the nearest equivalent of the traits column.
    player_traits: [row.playstyles, row.playstyles_plus].filter(Boolean).join(', '),
  };
}

export function run({
  csvPath = MALE_CSV,
  leagueMapPath = BASELINES.fc26,
  outPath = GAME_INPUT_PATH,
  allowMissingPotential = false,
} = {}) {
  if (!existsSync(csvPath)) throw new Error(`No FC27 dataset at ${csvPath}.`);
  const leagueMap = existsSync(leagueMapPath)
    ? buildLeagueMap(readFileSync(leagueMapPath, 'utf8'))
    : new Map();

  const allRows = parseCsv(readFileSync(csvPath, 'utf8'));

  // `processFC26.mjs` does `pot: parseInt(row.potential, 10)` with no fallback,
  // so a row with no potential becomes `pot: NaN` in the generated data and
  // breaks development for that player. Rows without one are dropped rather
  // than given a made-up figure: setting potential = overall would assert
  // "this player cannot improve", which for a 25-year-old is a claim the
  // source never made. Pass allowMissingPotential to keep them anyway.
  const missingPotential = allRows.filter((r) => r.potential === '' || r.potential === undefined);
  const rows = allowMissingPotential
    ? allRows
    : allRows.filter((r) => r.potential !== '' && r.potential !== undefined);

  const gameRows = rows.map((r) => toGameRow(r, leagueMap));

  const unresolved = new Map();
  for (let i = 0; i < gameRows.length; i++) {
    if (!gameRows[i].league_id && gameRows[i].league_name) {
      unresolved.set(gameRows[i].league_name, (unresolved.get(gameRows[i].league_name) ?? 0) + 1);
    }
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, toCsv(GAME_COLUMNS, gameRows), 'utf8');

  return {
    outPath,
    total: gameRows.length,
    knownLeagues: leagueMap.size,
    unresolvedLeagues: [...unresolved.entries()].sort((a, b) => b[1] - a[1]),
    droppedForMissingPotential: allowMissingPotential ? 0 : missingPotential.length,
    missingPotential: gameRows.filter((r) => r.potential === '').length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const result = run({
    csvPath: args.csv,
    leagueMapPath: args.leagueMap,
    outPath: args.out,
    allowMissingPotential: Boolean(args.allowMissingPotential),
  });
  console.log(`[export] ${result.total} rows -> ${result.outPath}`);
  console.log(`[export] league ids resolved from ${result.knownLeagues} known league names`);
  if (result.unresolvedLeagues.length) {
    console.log(`[export] ${result.unresolvedLeagues.length} leagues had no id match:`);
    for (const [name, count] of result.unresolvedLeagues.slice(0, 15)) console.log(`   ${count.toString().padStart(5)}  ${name}`);
  }
  if (result.droppedForMissingPotential) {
    console.log(`[export] dropped ${result.droppedForMissingPotential} rows with no potential `
      + '(the game has no fallback for it). Pass --allow-missing-potential to keep them.');
  }
  if (result.missingPotential) {
    console.log(`[export] ⚠️  ${result.missingPotential} rows still have no potential — `
      + 'run merge_potential.mjs before feeding this to processFC26.mjs.');
  }
}
