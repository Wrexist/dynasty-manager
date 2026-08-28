#!/usr/bin/env node
/**
 * Reconcile the FC27 dataset against the clubs and leagues the GAME actually
 * ships, rather than against the FC26 CSV.
 *
 * This is the check that decides whether FC27 data can drive the game: every
 * player has to land in a club the game knows, in the league that club really
 * plays in. Matching EA's league NAME is the weak way to do it — EA brands
 * competitions with sponsors ("Ligue 1 McDonald's", "Serie BKT") — so the club
 * is the anchor: a club's league is a fact about the club.
 *
 * Run with vite-node so the `@/` alias and the TS league data resolve:
 *   npx vite-node scripts/fc27/match_game_clubs.mjs
 *
 * Writes data/fc27/club-match-report.json and prints a per-league summary.
 * Read-only with respect to the game: it never edits src/data.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LEAGUES, ALL_CLUBS } from '@/data/league';
import { parseCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FC27_CSV = join(ROOT, 'data/fc27/FC27_male_players.csv');
const OUT = join(ROOT, 'data/fc27/club-match-report.json');

/**
 * Normalise a club name for comparison.
 *
 * Strips accents, punctuation and the corporate/legal noise that differs
 * between sources ("1. FC", "AFC", "SV", "CF", "Ltd") — but NOT the
 * distinguishing parts of a name, so "Manchester United" and "Manchester
 * City" can never collapse into each other.
 */
export function normClub(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    // Leading/trailing club-form tokens only. `fc barcelona` -> `barcelona`,
    // but `fc porto` -> `porto` and never touches an interior word.
    .replace(/\b(fc|afc|cf|sc|ac|as|ss|ssc|sv|tsv|vfb|vfl|bsc|cd|ud|rc|rcd|club|calcio|futbol|football|nk|hnk|fk|sk|ks|mfk|if|ff|bk|ik|aik|pfc|cfr|csa|sa|ltd)\b/g, ' ')
    .replace(/\b(19|18|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildGameIndex() {
  const leagueById = new Map(LEAGUES.map((l) => [l.id, l]));
  const byName = new Map();
  const collisions = new Set();

  for (const club of ALL_CLUBS) {
    for (const key of [normClub(club.name), normClub(club.shortName)]) {
      if (!key) continue;
      if (byName.has(key) && byName.get(key).id !== club.id) { collisions.add(key); continue; }
      byName.set(key, club);
    }
  }
  // An ambiguous key is worse than no key: drop it rather than guess.
  for (const key of collisions) byName.delete(key);

  return { leagueById, byName };
}

function main() {
  const { leagueById, byName } = buildGameIndex();
  const rows = parseCsv(readFileSync(FC27_CSV, 'utf8'));

  const matched = [];
  const unmatched = new Map(); // fc27 club name -> { count, league, players }

  for (const row of rows) {
    const club = row.club?.trim();
    if (!club) continue; // free agents are not a club-matching failure
    const hit = byName.get(normClub(club));
    if (hit) {
      matched.push({ row, club: hit });
    } else {
      const entry = unmatched.get(club) ?? { count: 0, leagues: new Set(), topOverall: 0 };
      entry.count += 1;
      entry.leagues.add(row.league || '(none)');
      entry.topOverall = Math.max(entry.topOverall, Number(row.overall) || 0);
      unmatched.set(club, entry);
    }
  }

  // Per-league coverage, keyed on the GAME's leagues.
  const perLeague = new Map();
  for (const league of LEAGUES) {
    perLeague.set(league.id, {
      id: league.id, name: league.name, country: league.country, tier: league.tier,
      gameClubs: ALL_CLUBS.filter((c) => c.divisionId === league.id).length,
      clubsCovered: new Set(), players: 0,
    });
  }
  for (const { row, club } of matched) {
    const bucket = perLeague.get(club.divisionId);
    if (!bucket) continue;
    bucket.players += 1;
    bucket.clubsCovered.add(club.id);
  }

  const withClub = rows.filter((r) => r.club?.trim()).length;
  const freeAgents = rows.length - withClub;

  const leagues = [...perLeague.values()]
    .map((l) => ({
      ...l,
      clubsCovered: l.clubsCovered.size,
      clubCoveragePct: l.gameClubs ? +(100 * l.clubsCovered.size / l.gameClubs).toFixed(1) : 0,
    }))
    .sort((a, b) => a.clubCoveragePct - b.clubCoveragePct);

  const unmatchedList = [...unmatched.entries()]
    .map(([name, e]) => ({ name, count: e.count, topOverall: e.topOverall, leagues: [...e.leagues] }))
    .sort((a, b) => b.count - a.count);

  const report = {
    generatedAt: new Date().toISOString(),
    fc27Rows: rows.length,
    freeAgents,
    withClub,
    matchedPlayers: matched.length,
    matchedPct: +(100 * matched.length / withClub).toFixed(1),
    gameClubs: ALL_CLUBS.length,
    gameLeagues: LEAGUES.length,
    gameClubsCovered: new Set(matched.map((m) => m.club.id)).size,
    leagues,
    unmatchedClubs: unmatchedList,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`FC27 rows: ${report.fc27Rows}  (with a club: ${withClub}, free agents: ${freeAgents})`);
  console.log(`Matched to a game club: ${report.matchedPlayers} / ${withClub} (${report.matchedPct}%)`);
  console.log(`Game clubs covered: ${report.gameClubsCovered} / ${report.gameClubs}`);
  console.log(`\nWorst-covered leagues:`);
  for (const l of leagues.slice(0, 12)) {
    console.log(`  ${String(l.clubCoveragePct).padStart(5)}%  ${l.clubsCovered}/${l.gameClubs} clubs  ${l.players.toString().padStart(4)} players  ${l.name} (${l.country})`);
  }
  console.log(`\nTop unmatched FC27 clubs (${unmatchedList.length} distinct):`);
  for (const c of unmatchedList.slice(0, 20)) {
    console.log(`  ${String(c.count).padStart(3)} players  top ${c.topOverall}  ${c.name}  [${c.leagues.join(', ')}]`);
  }
  console.log(`\nwritten: ${OUT}`);
}

// Only run as a CLI. This module also exports normClub, and importing it must
// not re-run the whole report as a side effect.
if (process.argv[1] && process.argv[1].endsWith('match_game_clubs.mjs')) main();
