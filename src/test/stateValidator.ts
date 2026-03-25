/**
 * Reusable game state invariant checker for longevity testing.
 * Call validateGameState(state) at any point to verify all invariants hold.
 */
import type { GameState } from '@/store/storeTypes';
import { LEAGUES } from '@/data/league';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'warning';
}

/**
 * Validate all game state invariants. Returns array of validation errors (empty = valid).
 */
export function validateGameState(state: GameState): ValidationError[] {
  const errors: ValidationError[] = [];

  // ── Season & Week bounds ──
  if (state.season < 1) {
    errors.push({ field: 'season', message: `season is ${state.season}, expected >= 1`, severity: 'critical' });
  }
  if (state.week < 1 || state.week > 46) {
    errors.push({ field: 'week', message: `week is ${state.week}, expected 1-46`, severity: 'critical' });
  }

  // ── League club counts ──
  // The player's league must exist in divisionClubs with the correct club count
  const playerLeague = state.playerDivision;
  if (playerLeague) {
    const leagueInfo = LEAGUES.find(l => l.id === playerLeague);
    const clubs = state.divisionClubs[playerLeague];
    if (!clubs) {
      errors.push({ field: `divisionClubs.${playerLeague}`, message: `player's league ${playerLeague} missing from divisionClubs`, severity: 'critical' });
    } else if (leagueInfo && clubs.length !== leagueInfo.teamCount) {
      errors.push({ field: `divisionClubs.${playerLeague}`, message: `${playerLeague} has ${clubs.length} clubs, expected ${leagueInfo.teamCount}`, severity: 'critical' });
    }
  }

  // Validate all loaded leagues have correct sizes
  for (const [leagueId, clubs] of Object.entries(state.divisionClubs)) {
    const leagueInfo = LEAGUES.find(l => l.id === leagueId);
    if (leagueInfo && clubs.length !== leagueInfo.teamCount) {
      errors.push({ field: `divisionClubs.${leagueId}`, message: `${leagueId} has ${clubs.length} clubs, expected ${leagueInfo.teamCount}`, severity: 'critical' });
    }
  }

  // ── No club in multiple leagues ──
  const allDivClubIds = new Set<string>();
  for (const [leagueId, clubs] of Object.entries(state.divisionClubs)) {
    for (const clubId of clubs) {
      if (allDivClubIds.has(clubId)) {
        errors.push({ field: `divisionClubs.${leagueId}`, message: `club ${clubId} appears in multiple leagues`, severity: 'critical' });
      }
      allDivClubIds.add(clubId);
    }
  }

  // ── Every league club exists in state.clubs ──
  for (const clubId of allDivClubIds) {
    if (!state.clubs[clubId]) {
      errors.push({ field: `clubs.${clubId}`, message: `club ${clubId} is in divisionClubs but not in state.clubs`, severity: 'critical' });
    }
  }

  // ── Player-Club integrity ──
  const playerToClub = new Map<string, string>();

  for (const [clubId, club] of Object.entries(state.clubs)) {
    if (!allDivClubIds.has(clubId)) continue; // skip orphaned/replaced clubs

    // Every playerIds entry exists in state.players
    for (const pid of club.playerIds) {
      const player = state.players[pid];
      if (!player) {
        // Stale playerIds are a known issue (players removed during season-end but IDs linger)
        errors.push({ field: `clubs.${clubId}.playerIds`, message: `player ${pid} in club ${club.name || clubId} playerIds but not in state.players`, severity: 'warning' });
        continue;
      }

      // No player in multiple clubs
      if (playerToClub.has(pid)) {
        errors.push({ field: `players.${pid}`, message: `player ${pid} exists in clubs ${playerToClub.get(pid)} AND ${clubId}`, severity: 'critical' });
      }
      playerToClub.set(pid, clubId);
    }

    // lineup ⊆ playerIds, max 11
    if (club.lineup.length > 11) {
      errors.push({ field: `clubs.${clubId}.lineup`, message: `lineup has ${club.lineup.length} players, max 11`, severity: 'warning' });
    }
    for (const pid of club.lineup) {
      if (!club.playerIds.includes(pid)) {
        errors.push({ field: `clubs.${clubId}.lineup`, message: `lineup player ${pid} not in playerIds`, severity: 'warning' });
      }
    }

    // subs ⊆ playerIds, no overlap with lineup
    for (const pid of club.subs) {
      if (!club.playerIds.includes(pid)) {
        errors.push({ field: `clubs.${clubId}.subs`, message: `sub player ${pid} not in playerIds`, severity: 'warning' });
      }
      if (club.lineup.includes(pid)) {
        errors.push({ field: `clubs.${clubId}.subs`, message: `sub player ${pid} also in lineup`, severity: 'warning' });
      }
    }

    // Squad size minimum
    const validPlayerCount = club.playerIds.filter(id => state.players[id]).length;
    if (validPlayerCount < 11) {
      errors.push({ field: `clubs.${clubId}.playerIds`, message: `club ${club.name || clubId} has only ${validPlayerCount} valid players, need at least 11`, severity: 'critical' });
    }

    // Budget/wage checks
    if (isNaN(club.budget) || !isFinite(club.budget)) {
      errors.push({ field: `clubs.${clubId}.budget`, message: `budget is ${club.budget} (NaN or Infinity)`, severity: 'critical' });
    }
    if (isNaN(club.wageBill) || !isFinite(club.wageBill)) {
      errors.push({ field: `clubs.${clubId}.wageBill`, message: `wageBill is ${club.wageBill} (NaN or Infinity)`, severity: 'critical' });
    }
  }

  // ── Player integrity ──
  for (const [pid, player] of Object.entries(state.players)) {
    if (!player) continue;
    // Skip free agents and players not in any active club
    const isInAClub = playerToClub.has(pid);

    // Numeric field checks
    if (player.age !== undefined && (player.age <= 0 || player.age > 50)) {
      errors.push({ field: `players.${pid}.age`, message: `age is ${player.age} for ${player.lastName}`, severity: 'warning' });
    }
    if (isNaN(player.overall) || player.overall <= 0 || player.overall > 99) {
      errors.push({ field: `players.${pid}.overall`, message: `overall is ${player.overall} for ${player.lastName}`, severity: 'critical' });
    }
    if (isNaN(player.potential)) {
      errors.push({ field: `players.${pid}.potential`, message: `potential is NaN for ${player.lastName}`, severity: 'critical' });
    }
    if (isNaN(player.wage) || !isFinite(player.wage)) {
      errors.push({ field: `players.${pid}.wage`, message: `wage is ${player.wage} for ${player.lastName}`, severity: 'critical' });
    }
    if (isNaN(player.value) || !isFinite(player.value)) {
      errors.push({ field: `players.${pid}.value`, message: `value is ${player.value} for ${player.lastName}`, severity: 'critical' });
    }

    // Stats should not be negative
    if (player.goals < 0) {
      errors.push({ field: `players.${pid}.goals`, message: `goals is ${player.goals}`, severity: 'warning' });
    }
    if (player.assists < 0) {
      errors.push({ field: `players.${pid}.assists`, message: `assists is ${player.assists}`, severity: 'warning' });
    }
    if (player.appearances < 0) {
      errors.push({ field: `players.${pid}.appearances`, message: `appearances is ${player.appearances}`, severity: 'warning' });
    }

    // clubId consistency (only for players in a club)
    if (isInAClub) {
      const expectedClub = playerToClub.get(pid);
      if (player.clubId !== expectedClub && !player.onLoan) {
        errors.push({ field: `players.${pid}.clubId`, message: `player ${player.lastName} has clubId=${player.clubId} but is in club ${expectedClub}`, severity: 'warning' });
      }
    }
  }

  // ── League table row counts ──
  for (const [leagueId, table] of Object.entries(state.divisionTables)) {
    const leagueInfo = LEAGUES.find(l => l.id === leagueId);
    if (leagueInfo && table && table.length !== leagueInfo.teamCount) {
      errors.push({ field: `divisionTables.${leagueId}`, message: `table has ${table.length} rows, expected ${leagueInfo.teamCount}`, severity: 'warning' });
    }
  }

  // ── Fixtures exist ──
  if (!state.fixtures || state.fixtures.length === 0) {
    errors.push({ field: 'fixtures', message: 'fixtures array is empty', severity: 'warning' });
  }
  for (const [leagueId, fixtures] of Object.entries(state.divisionFixtures)) {
    if (!fixtures || fixtures.length === 0) {
      errors.push({ field: `divisionFixtures.${leagueId}`, message: `divisionFixtures for ${leagueId} is empty`, severity: 'warning' });
    }
  }

  return errors;
}

/**
 * Assert that game state is valid. Throws if any critical errors found.
 * Warnings are returned but don't cause failure.
 */
export function assertValidGameState(state: GameState, context?: string): ValidationError[] {
  const errors = validateGameState(state);
  const critical = errors.filter(e => e.severity === 'critical');
  const warnings = errors.filter(e => e.severity === 'warning');

  if (critical.length > 0) {
    const prefix = context ? `[${context}] ` : '';
    const details = critical.map(e => `  ${e.field}: ${e.message}`).join('\n');
    throw new Error(`${prefix}Game state has ${critical.length} critical error(s):\n${details}`);
  }

  return warnings;
}
