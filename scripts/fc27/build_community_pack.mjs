#!/usr/bin/env node
/**
 * Regenerate src/data/communityPack/* from the reconciled FC27 dataset.
 *
 * Deliberately reuses `scripts/processFC26.mjs`'s exported transforms —
 * buildPlayer, writeByClub, writeFreeAgents — rather than reimplementing
 * them. Those carry behaviour that must not drift: `applyFudge` seeds its
 * per-attribute jitter from the player id, so a second implementation would
 * silently produce different stats for the same player.
 *
 * The one thing this does differently is routing. processFC26 resolves a club
 * by name through the bucket report from analyzeFC26; the FC27 rows already
 * carry `game_club_id`, resolved by reconcile_clubs.mjs from player-identity
 * votes, so routing here is a direct lookup with nothing left to guess.
 *
 * Run: npx vite-node scripts/fc27/build_community_pack.mjs [--dry-run]
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ALL_CLUBS, LEAGUES } from '@/data/league';
import { parseCsv } from './lib/csv.mjs';
import { toGameRow, buildLeagueMap } from './export_for_game.mjs';
import { buildPlayer, writeByClub, writeFreeAgents } from '../processFC26.mjs';
import { BASELINES } from './lib/paths.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RECONCILED = join(ROOT, 'data/fc27/FC27_male_players_reconciled.csv');

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rows = parseCsv(readFileSync(RECONCILED, 'utf8'));
  const leagueMap = buildLeagueMap(readFileSync(BASELINES.fc26, 'utf8'));
  const clubById = new Map(ALL_CLUBS.map((c) => [c.id, c]));

  const byClubMap = new Map();
  const freeAgents = [];
  const seen = new Set();
  const stats = { routed: 0, free: 0, dupes: 0, noPotential: 0, unknownClub: 0, potentialClamped: 0 };

  for (const row of rows) {
    // The game reads `pot` with no fallback, so a player without one would
    // become NaN in the generated file. Drop rather than invent.
    if (!row.potential) { stats.noPotential += 1; continue; }

    if (seen.has(row.player_id)) { stats.dupes += 1; continue; }
    seen.add(row.player_id);

    // toGameRow renames the columns buildPlayer reads (physical -> physic,
    // derived_age -> age, and so on).
    const player = buildPlayer(toGameRow(row, leagueMap));

    // Potential is carried over from FC26 while EA publishes none, so a player
    // whose FC27 rating rose above last season's ceiling ends up with
    // pot < ovr. The game derives development from the ovr->pot gap, where a
    // negative gap is meaningless, so the ceiling is raised to the player's
    // current ability. That is a correction to an incoherent pair, not a claim
    // about how good he will become.
    if (Number.isFinite(player.pot) && Number.isFinite(player.ovr) && player.pot < player.ovr) {
      player.pot = player.ovr;
      stats.potentialClamped += 1;
    }

    const clubId = row.game_club_id;
    if (!clubId) { freeAgents.push(player); stats.free += 1; continue; }
    if (!clubById.has(clubId)) { stats.unknownClub += 1; freeAgents.push(player); continue; }

    if (!byClubMap.has(clubId)) byClubMap.set(clubId, []);
    byClubMap.get(clubId).push(player);
    stats.routed += 1;
  }

  const squadSizes = [...byClubMap.values()].map((p) => p.length).sort((a, b) => a - b);
  const thin = [...byClubMap.entries()].filter(([, p]) => p.length < 11);

  console.log(`rows read              : ${rows.length}`);
  console.log(`routed to a game club  : ${stats.routed} across ${byClubMap.size} clubs`);
  console.log(`free agents            : ${stats.free}`);
  console.log(`dropped (no potential) : ${stats.noPotential}`);
  console.log(`duplicate ids skipped  : ${stats.dupes}`);
  console.log(`potential raised to ovr: ${stats.potentialClamped} (FC26 ceiling below the FC27 rating)`);
  console.log(`squad size min/median/max: ${squadSizes[0]} / ${squadSizes[Math.floor(squadSizes.length / 2)]} / ${squadSizes[squadSizes.length - 1]}`);
  console.log(`clubs with fewer than 11 players: ${thin.length}`);

  const leagueCovered = new Map();
  for (const clubId of byClubMap.keys()) {
    const club = clubById.get(clubId);
    if (!club) continue;
    leagueCovered.set(club.divisionId, (leagueCovered.get(club.divisionId) ?? 0) + 1);
  }
  const fullyCovered = LEAGUES.filter((l) => {
    const total = ALL_CLUBS.filter((c) => c.divisionId === l.id).length;
    return total > 0 && (leagueCovered.get(l.id) ?? 0) === total;
  });
  console.log(`leagues with every club covered: ${fullyCovered.length}/${LEAGUES.length}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }
  writeByClub(byClubMap, {});
  writeFreeAgents(freeAgents);
  console.log('\nwrote src/data/communityPack/byClub.ts and freeAgents.ts');
}

main();
