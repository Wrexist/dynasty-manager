#!/usr/bin/env node
/**
 * Derive the EA-club-name -> game-club mapping FROM THE PLAYERS, not from
 * string similarity between club names.
 *
 * The insight: 99.4% of FC27 players already match a baseline player on a
 * stable id, and identity is far more reliable than club spelling. Each
 * matched player is therefore a vote — "EA calls this club X, the baseline
 * calls the same player's club Y" — and the majority vote across a whole squad
 * names the club with no guessing at all. That resolves "Spurs" ->
 * "Tottenham Hotspur" and, crucially, the South American clubs EA files under
 * Libertadores/Sudamericana rather than their domestic league.
 *
 * Every vote is cross-checked on NATIONALITY. If the id-matched pair disagrees
 * about the player's country, the identity is suspect and the vote is
 * discarded rather than counted.
 *
 * Run: npx vite-node scripts/fc27/derive_club_aliases.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LEAGUES, ALL_CLUBS } from '@/data/league';
import { parseCsv } from './lib/csv.mjs';
import { normClub } from './match_game_clubs.mjs';
import { LEAGUE_ALIASES } from './leagueAliases.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FC27 = join(ROOT, 'data/fc27/FC27_male_players.csv');
const BASELINE = join(ROOT, 'FC26_20250921.csv');
const OUT_JSON = join(ROOT, 'data/fc27/club-alias-report.json');

const norm = (s) => normClub(s);

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

function main() {
  const fc27 = parseCsv(readFileSync(FC27, 'utf8'));
  const baseline = parseCsv(readFileSync(BASELINE, 'utf8'));
  const byId = new Map(baseline.map((b) => [String(b.player_id), b]));
  const gameByName = gameClubIndex();

  // EA club name -> { baselineClubName -> votes }
  const votes = new Map();
  let checked = 0;
  let nationalityMismatch = 0;

  for (const row of fc27) {
    const eaClub = (row.club ?? '').trim();
    if (!eaClub) continue;
    const base = byId.get(String(row.player_id));
    if (!base) continue;

    checked += 1;
    // Nationality is the cross-check on identity: same id AND same country.
    if (norm(row.nationality) !== norm(base.nationality_name)) {
      nationalityMismatch += 1;
      continue;
    }

    const baseClub = (base.club_name ?? '').trim();
    if (!baseClub) continue;
    if (!votes.has(eaClub)) votes.set(eaClub, new Map());
    const tally = votes.get(eaClub);
    tally.set(baseClub, (tally.get(baseClub) ?? 0) + 1);
  }

  const aliases = {};
  const unresolved = [];

  for (const [eaClub, tally] of votes) {
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const [winner, winnerVotes] = ranked[0];
    const total = ranked.reduce((n, [, v]) => n + v, 0);
    const confidence = winnerVotes / total;

    // Resolve the voted baseline name to a club the game actually ships.
    const gameClub = gameByName.get(norm(winner)) ?? gameByName.get(norm(eaClub));

    if (gameClub && confidence >= 0.5) {
      aliases[eaClub] = {
        gameClubId: gameClub.id,
        gameClubName: gameClub.name,
        leagueId: gameClub.divisionId,
        via: winner,
        confidence: +confidence.toFixed(2),
        votes: winnerVotes,
      };
    } else {
      unresolved.push({
        eaClub, votedName: winner, votes: winnerVotes, confidence: +confidence.toFixed(2),
        reason: gameClub ? 'low confidence' : 'voted club is not in the game',
      });
    }
  }

  const leagueOf = new Map(LEAGUES.map((l) => [l.id, l]));
  const covered = new Map();
  for (const a of Object.values(aliases)) {
    if (!covered.has(a.leagueId)) covered.set(a.leagueId, new Set());
    covered.get(a.leagueId).add(a.gameClubId);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    playersConsidered: checked,
    nationalityMismatch,
    eaClubsSeen: votes.size,
    aliasesDerived: Object.keys(aliases).length,
    unresolved,
    leagueCoverage: LEAGUES.map((l) => ({
      id: l.id,
      name: l.name,
      country: l.country,
      gameClubs: ALL_CLUBS.filter((c) => c.divisionId === l.id).length,
      clubsMatched: covered.get(l.id)?.size ?? 0,
      eaLeagueNames: [...new Set(Object.entries(LEAGUE_ALIASES).filter(([, v]) => v === l.id).map(([k]) => k))],
    })).sort((a, b) => (a.clubsMatched / (a.gameClubs || 1)) - (b.clubsMatched / (b.gameClubs || 1))),
    aliases,
  };

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`id-matched players considered: ${checked}`);
  console.log(`  discarded on nationality mismatch: ${nationalityMismatch} (${(100 * nationalityMismatch / checked).toFixed(2)}%)`);
  console.log(`EA clubs seen: ${votes.size}  ->  aliases derived: ${Object.keys(aliases).length}`);
  console.log(`unresolved: ${unresolved.length}`);
  console.log(`\nLeague coverage (game clubs matched / game clubs):`);
  for (const l of report.leagueCoverage) {
    const pct = l.gameClubs ? (100 * l.clubsMatched / l.gameClubs).toFixed(0) : '—';
    console.log(`  ${String(pct).padStart(4)}%  ${String(l.clubsMatched).padStart(2)}/${String(l.gameClubs).padEnd(2)}  ${l.name} (${l.country})`);
  }
  console.log(`\nwritten: ${OUT_JSON}`);
}

main();
