/**
 * Squad-strength analysis — compares the player's squad to the rest of their
 * league by position group, to guide transfer priorities. Pure functions, no
 * store access, so they're trivially testable and reusable.
 */
import type { Player, Club, Position } from '@/types/game';

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

export const POSITION_GROUPS: PositionGroup[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Map a granular position to its broad group (mirrors the Squad Depth tally). */
export function positionGroup(pos: Position): PositionGroup {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'CDM' || pos === 'CM' || pos === 'CAM' || pos === 'LM' || pos === 'RM') return 'MID';
  return 'ATT';
}

export interface GroupStrength {
  count: number;
  /** Mean overall of the players in this group, rounded. 0 when count === 0. */
  avgOverall: number;
}

function emptySums(): Record<PositionGroup, { total: number; count: number }> {
  return {
    GK: { total: 0, count: 0 },
    DEF: { total: 0, count: 0 },
    MID: { total: 0, count: 0 },
    ATT: { total: 0, count: 0 },
  };
}

/** Average overall of a squad, bucketed into GK/DEF/MID/ATT. */
export function squadStrengthByGroup(players: Player[]): Record<PositionGroup, GroupStrength> {
  const sums = emptySums();
  for (const p of players) {
    const g = positionGroup(p.position);
    sums[g].total += p.overall;
    sums[g].count += 1;
  }
  const out = {} as Record<PositionGroup, GroupStrength>;
  for (const g of POSITION_GROUPS) {
    out[g] = { count: sums[g].count, avgOverall: sums[g].count ? Math.round(sums[g].total / sums[g].count) : 0 };
  }
  return out;
}

/**
 * Mean overall per position group across every player in the given clubs —
 * intended to be the *rest* of the player's league (exclude the player's own
 * club at the call site so the comparison isn't diluted by their own squad).
 * Missing clubs/players are skipped defensively (deleted-ID safety).
 */
export function leagueAverageByGroup(
  clubIds: string[],
  clubs: Record<string, Club>,
  players: Record<string, Player>,
): Record<PositionGroup, number> {
  const sums = emptySums();
  for (const clubId of clubIds) {
    const club = clubs[clubId];
    if (!club) continue;
    for (const pid of club.playerIds) {
      const p = players[pid];
      if (!p) continue;
      const g = positionGroup(p.position);
      sums[g].total += p.overall;
      sums[g].count += 1;
    }
  }
  const out = {} as Record<PositionGroup, number>;
  for (const g of POSITION_GROUPS) {
    out[g] = sums[g].count ? Math.round(sums[g].total / sums[g].count) : 0;
  }
  return out;
}

export interface GroupComparison {
  group: PositionGroup;
  count: number;
  mine: number;
  league: number;
  /** mine − league. Positive = stronger than the league; negative = a gap. */
  delta: number;
}

/** Build the per-group "you vs the rest of the league" comparison rows. */
export function compareSquadToLeague(
  squad: Player[],
  leagueClubIds: string[],
  clubs: Record<string, Club>,
  players: Record<string, Player>,
): GroupComparison[] {
  const mine = squadStrengthByGroup(squad);
  const league = leagueAverageByGroup(leagueClubIds, clubs, players);
  return POSITION_GROUPS.map(g => ({
    group: g,
    count: mine[g].count,
    mine: mine[g].avgOverall,
    league: league[g],
    delta: mine[g].avgOverall - league[g],
  }));
}
