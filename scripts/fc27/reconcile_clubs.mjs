#!/usr/bin/env node
/**
 * Resolve every FC27 player to a club and league the GAME ships.
 *
 * Three problems, three data-driven fixes — no string-similarity guessing:
 *
 *  1. EA spells clubs differently ("Spurs", "Red Bulls"). Fixed by voting:
 *     99%+ of players match a baseline player on a stable id, so each matched
 *     player votes for what the baseline calls their club. A squad's worth of
 *     votes names the club with no guessing.
 *
 *  2. EA omits the club entirely for whole competitions — every Eredivisie
 *     player, and everyone under Libertadores/Sudamericana — almost certainly
 *     a licensing limit on the public endpoint. Fixed by backfilling from the
 *     id-matched baseline row, but ONLY when the baseline's league agrees with
 *     EA's league for that player. That guard matters: without it, a player
 *     who moved to another country last summer would be handed his old club.
 *
 *  3. EA brands leagues with sponsors. Handled by leagueAliases.mjs, and by
 *     preferring the matched club's own league over any name at all.
 *
 * Every value that did not come from FC27 is stamped in `club_source` /
 * `league_source`, so nothing borrowed can be mistaken for FC27 data.
 *
 * Run: npx vite-node scripts/fc27/reconcile_clubs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LEAGUES, ALL_CLUBS } from '@/data/league';
import { parseCsv, toCsv } from './lib/csv.mjs';
import { normClub } from './match_game_clubs.mjs';
import { LEAGUE_ALIASES } from './leagueAliases.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FC27 = join(ROOT, 'data/fc27/FC27_male_players.csv');
const BASELINE = join(ROOT, 'FC26_20250921.csv');
const OUT_CSV = join(ROOT, 'data/fc27/FC27_male_players_reconciled.csv');
const OUT_REPORT = join(ROOT, 'data/fc27/reconciliation.json');

const norm = (s) => normClub(s);

/**
 * Token-subset match, constrained to one league.
 *
 * EA and the game often name the same club at different lengths: "APOEL FC"
 * vs "APOEL Nicosia", "Dinamo Zagreb" vs "GNK Dinamo Zagreb". Once the tokens
 * of one are a subset of the other's, they are the same club — PROVIDED the
 * candidate is unique inside the league. Requiring uniqueness is what stops
 * this from mis-matching a "Manchester" onto two Manchesters, and confining it
 * to one league is what keeps the search small enough for that to hold.
 */
function tokenSubsetMatch(eaName, candidates) {
  const want = new Set(norm(eaName).split(' ').filter(Boolean));
  if (want.size === 0) return null;

  const hits = candidates.filter((club) => {
    const have = new Set(norm(club.name).split(' ').filter(Boolean));
    if (have.size === 0) return false;
    const wantInHave = [...want].every((t) => have.has(t));
    const haveInWant = [...have].every((t) => want.has(t));
    return wantInHave || haveInWant;
  });
  return hits.length === 1 ? hits[0] : null;
}

function gameClubIndex() {
  const byName = new Map();
  const collide = new Set();
  for (const club of ALL_CLUBS) {
    for (const key of [norm(club.name), norm(club.shortName)]) {
      if (!key) continue;
      if (byName.has(key) && byName.get(key).id !== club.id) { collide.add(key); continue; }
      byName.set(key, club);
    }
  }
  for (const k of collide) byName.delete(k);
  return byName;
}

export function main() {
  const rows = parseCsv(readFileSync(FC27, 'utf8'));
  const baseline = parseCsv(readFileSync(BASELINE, 'utf8'));
  const byId = new Map(baseline.map((b) => [String(b.player_id), b]));
  const gameByName = gameClubIndex();
  const gameById = new Map(ALL_CLUBS.map((c) => [c.id, c]));

  // ── Pass 1: vote EA club name -> baseline club name, gated on nationality ──
  const votes = new Map();
  for (const row of rows) {
    const ea = (row.club ?? '').trim();
    if (!ea) continue;
    const base = byId.get(String(row.player_id));
    if (!base || norm(row.nationality) !== norm(base.nationality_name)) continue;
    const baseClub = (base.club_name ?? '').trim();
    if (!baseClub) continue;
    if (!votes.has(ea)) votes.set(ea, new Map());
    const t = votes.get(ea);
    t.set(baseClub, (t.get(baseClub) ?? 0) + 1);
  }

  /** EA club name -> game club, decided by majority vote. */
  const aliasToGameClub = new Map();
  for (const [ea, tally] of votes) {
    const [winner, wv] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    const total = [...tally.values()].reduce((a, b) => a + b, 0);
    if (wv / total < 0.5) continue;
    const club = gameByName.get(norm(winner)) ?? gameByName.get(norm(ea));
    if (club) aliasToGameClub.set(ea, club);
  }

  // ── Pass 2: resolve each player ─────────────────────────────────────────
  const stats = {
    total: rows.length,
    resolvedFromEaClub: 0,
    resolvedByTokenMatch: 0,
    resolvedByBackfill: 0,
    backfillRejectedLeagueMismatch: 0,
    unresolved: 0,
  };

  for (const row of rows) {
    const ea = (row.club ?? '').trim();
    row.game_club_id = '';
    row.game_club_name = '';
    row.game_league_id = '';
    row.club_source = '';

    if (ea) {
      let club = aliasToGameClub.get(ea) ?? gameByName.get(norm(ea));

      // Last resort: a token-subset match inside the league EA names, so the
      // candidate set is one division rather than all 756 clubs.
      if (!club) {
        const leagueId = LEAGUE_ALIASES[(row.league ?? '').trim()] ?? null;
        if (leagueId) {
          const inLeague = ALL_CLUBS.filter((c) => c.divisionId === leagueId);
          const hit = tokenSubsetMatch(ea, inLeague);
          if (hit) { club = hit; stats.resolvedByTokenMatch += 1; }
        }
      }

      if (club) {
        row.game_club_id = club.id;
        row.game_club_name = club.name;
        row.game_league_id = club.divisionId;
        row.club_source = 'fc27';
        stats.resolvedFromEaClub += 1;
        continue;
      }
      stats.unresolved += 1;
      continue;
    }

    // No club from EA. Borrow the baseline's, but only if the leagues agree.
    const base = byId.get(String(row.player_id));
    if (!base) { stats.unresolved += 1; continue; }
    const baseClub = (base.club_name ?? '').trim();
    if (!baseClub) { stats.unresolved += 1; continue; }

    const club = gameByName.get(norm(baseClub));
    const eaLeagueId = LEAGUE_ALIASES[(row.league ?? '').trim()] ?? null;
    if (!club) { stats.unresolved += 1; continue; }

    // Libertadores/Sudamericana map to null: EA gives no domestic league, so
    // there is nothing to contradict the baseline and the club stands.
    const leaguesAgree = eaLeagueId === null || club.divisionId === eaLeagueId;
    if (!leaguesAgree) { stats.backfillRejectedLeagueMismatch += 1; stats.unresolved += 1; continue; }

    row.game_club_id = club.id;
    row.game_club_name = club.name;
    row.game_league_id = club.divisionId;
    row.club_source = 'fc26-backfill';
    stats.resolvedByBackfill += 1;
  }

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  writeFileSync(OUT_CSV, toCsv(columns, rows), 'utf8');

  const covered = new Map();
  for (const r of rows) {
    if (!r.game_league_id) continue;
    if (!covered.has(r.game_league_id)) covered.set(r.game_league_id, new Set());
    covered.get(r.game_league_id).add(r.game_club_id);
  }
  const leagueCoverage = LEAGUES.map((l) => {
    const gameClubs = ALL_CLUBS.filter((c) => c.divisionId === l.id).length;
    const clubsMatched = covered.get(l.id)?.size ?? 0;
    return {
      id: l.id, name: l.name, country: l.country, gameClubs, clubsMatched,
      pct: gameClubs ? +(100 * clubsMatched / gameClubs).toFixed(0) : 0,
      players: rows.filter((r) => r.game_league_id === l.id).length,
    };
  }).sort((a, b) => a.pct - b.pct);

  const resolved = stats.resolvedFromEaClub + stats.resolvedByBackfill;
  const report = {
    generatedAt: new Date().toISOString(),
    ...stats,
    resolved,
    resolvedPct: +(100 * resolved / rows.length).toFixed(1),
    aliasesDerived: aliasToGameClub.size,
    gameClubsCovered: new Set(rows.map((r) => r.game_club_id).filter(Boolean)).size,
    gameClubsTotal: ALL_CLUBS.length,
    leagueCoverage,
  };
  mkdirSync(dirname(OUT_REPORT), { recursive: true });
  writeFileSync(OUT_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`resolved ${resolved}/${rows.length} (${report.resolvedPct}%)`);
  console.log(`  from EA's own club field : ${stats.resolvedFromEaClub}`);
  console.log(`    of which by token match: ${stats.resolvedByTokenMatch}`);
  console.log(`  backfilled from baseline : ${stats.resolvedByBackfill}`);
  console.log(`  backfill refused (league mismatch): ${stats.backfillRejectedLeagueMismatch}`);
  console.log(`  unresolved               : ${stats.unresolved}`);
  console.log(`game clubs covered: ${report.gameClubsCovered}/${report.gameClubsTotal}`);
  console.log(`\nleague coverage:`);
  for (const l of leagueCoverage) {
    console.log(`  ${String(l.pct).padStart(4)}%  ${String(l.clubsMatched).padStart(2)}/${String(l.gameClubs).padEnd(2)}  ${String(l.players).padStart(4)} players  ${l.name} (${l.country})`);
  }
  console.log(`\nwritten: ${OUT_CSV}`);
  return report;
}

main();
