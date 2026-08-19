/**
 * Sunday League — how big this afternoon actually is.
 *
 * Every fixture used to be presented identically: the same header, the same
 * reveal, the same panels. A cup final looked like a wet Tuesday against the
 * side in sixth, and the last day of a promotion race looked like week three.
 * This module derives ONE tier per fixture and, where there is something real
 * to say, one factual line about what the result settles.
 *
 * THE HARD RULE. A stakes line is arithmetic, never atmosphere. "Win and you
 * are up" is only ever printed when winning makes promotion mathematically
 * certain and losing does not — worked out from the current table, the
 * fixtures every club has left, and the division's own promotion and
 * relegation spots. If the maths does not settle it, the tier is `routine` and
 * nothing is said. A mode whose stakes lines are vibes teaches the player to
 * ignore them.
 *
 * WHY MATHEMATICAL AND NOT "CLOSE": "you are three points off with four to
 * play" is true of half a season and would fire the big-game treatment on
 * fixtures that decide nothing. Certainty is conservative by construction: it
 * cannot fire in September, and on the last afternoon it is exact.
 */
import type {
  LeagueTableEntry, Match, SundayDivisionId, SundayMatchTier,
} from '@/types/game';
import {
  SUNDAY_CUP_ROUNDS, SUNDAY_POINTS_DRAW, SUNDAY_POINTS_WIN, getSundayDivision,
} from '@/config/sundayLeague';
import { sundayCupRoundName } from './season';

/** Points and games left for one club, which is all the arithmetic needs. */
interface Standing {
  clubId: string;
  points: number;
  /** League fixtures not yet played, THIS one included. */
  remaining: number;
}

export interface SundayStakesInput {
  divisionId: SundayDivisionId;
  clubId: string;
  opponentClubId: string;
  /** Every league fixture in the division, played and unplayed. */
  fixtures: readonly Match[];
  divisionClubIds: readonly string[];
  /** The current table, in order. */
  table: readonly LeagueTableEntry[];
  /** The persistent rival's club id, when there is one. */
  rivalClubId: string | null;
  /** Cup round number for a cup tie, null for a league fixture. */
  cupRound: number | null;
}

export interface SundayStakes {
  tier: SundayMatchTier;
  /** One factual English line about what this result settles, or null when it
   *  settles nothing that can be proved. */
  line: string | null;
}

/** Games each club still has to play, from the fixture list itself — never
 *  from a games-per-season constant, which a short or repaired season breaks. */
function standings(input: SundayStakesInput): Standing[] {
  const remaining = new Map<string, number>();
  for (const id of input.divisionClubIds) remaining.set(id, 0);
  for (const m of input.fixtures) {
    if (m.played) continue;
    if (remaining.has(m.homeClubId)) remaining.set(m.homeClubId, remaining.get(m.homeClubId)! + 1);
    if (remaining.has(m.awayClubId)) remaining.set(m.awayClubId, remaining.get(m.awayClubId)! + 1);
  }
  return input.divisionClubIds.map(id => ({
    clubId: id,
    points: input.table.find(r => r.clubId === id)?.points ?? 0,
    remaining: remaining.get(id) ?? 0,
  }));
}

/** The table as it would stand at kick-off plus this one result. */
function afterResult(rows: readonly Standing[], clubId: string, oppId: string, ourPoints: number): Standing[] {
  const theirPoints = ourPoints === SUNDAY_POINTS_WIN ? 0
    : ourPoints === SUNDAY_POINTS_DRAW ? SUNDAY_POINTS_DRAW : SUNDAY_POINTS_WIN;
  return rows.map(r => {
    if (r.clubId === clubId) return { ...r, points: r.points + ourPoints, remaining: Math.max(0, r.remaining - 1) };
    if (r.clubId === oppId) return { ...r, points: r.points + theirPoints, remaining: Math.max(0, r.remaining - 1) };
    return r;
  });
}

const ceiling = (r: Standing) => r.points + SUNDAY_POINTS_WIN * r.remaining;

/**
 * Can this club still be caught out of the top `spots`?
 *
 * Certainty means: even if we take nothing more and every rival takes
 * everything, fewer than `spots` clubs finish at or above us. Ties count
 * AGAINST us — goal difference is not modelled here, so a club that can draw
 * level is treated as a club that can pass us.
 */
function topCertain(rows: readonly Standing[], clubId: string, spots: number): boolean {
  if (spots <= 0) return false;
  const us = rows.find(r => r.clubId === clubId);
  if (!us) return false;
  const threats = rows.filter(r => r.clubId !== clubId && ceiling(r) >= us.points).length;
  return threats < spots;
}

/** Is the top `spots` out of reach even with a maximum finish? Clubs already
 *  above our ceiling cannot lose points they have banked, so this is exact. */
function topImpossible(rows: readonly Standing[], clubId: string, spots: number): boolean {
  if (spots <= 0) return false;
  const us = rows.find(r => r.clubId === clubId);
  if (!us) return false;
  const above = rows.filter(r => r.clubId !== clubId && r.points > ceiling(us)).length;
  return above >= spots;
}

/** Safe from the drop whatever happens: at most `size - spots - 1` clubs can
 *  reach us. */
function safeCertain(rows: readonly Standing[], clubId: string, spots: number): boolean {
  if (spots <= 0) return true;
  const us = rows.find(r => r.clubId === clubId);
  if (!us) return false;
  const threats = rows.filter(r => r.clubId !== clubId && ceiling(r) >= us.points).length;
  return threats <= rows.length - spots - 1;
}

/** Down whatever happens: enough clubs have already banked more than we can
 *  possibly reach. */
function doomed(rows: readonly Standing[], clubId: string, spots: number): boolean {
  if (spots <= 0) return false;
  const us = rows.find(r => r.clubId === clubId);
  if (!us) return false;
  const above = rows.filter(r => r.clubId !== clubId && r.points > ceiling(us)).length;
  return above >= rows.length - spots;
}

/**
 * The tier this fixture is played at, and what the result settles.
 *
 * Cup ties are read off the round; league fixtures are read off the arithmetic
 * above, with the derby as the fallback flavour when nothing is decided.
 */
export function deriveSundayStakes(input: SundayStakesInput): SundayStakes {
  const { clubId, opponentClubId, cupRound } = input;

  if (cupRound != null) {
    if (cupRound >= SUNDAY_CUP_ROUNDS) {
      return { tier: 'cup-final', line: 'The final. One afternoon, one cup, no next week.' };
    }
    return {
      tier: 'cup',
      line: `Win and you are in the ${sundayCupRoundName(cupRound + 1)}.`,
    };
  }

  const isDerby = !!input.rivalClubId && input.rivalClubId === opponentClubId;
  const div = getSundayDivision(input.divisionId);
  const rows = standings(input);
  // A club with nothing left to play cannot have anything decided today.
  if (rows.find(r => r.clubId === clubId)?.remaining) {
    const win = afterResult(rows, clubId, opponentClubId, SUNDAY_POINTS_WIN);
    const lose = afterResult(rows, clubId, opponentClubId, 0);

    // Order is by what a manager would say first: the title, then going up,
    // then going down, then staying up, then the race being over.
    if (topCertain(win, clubId, 1) && !topCertain(lose, clubId, 1)) {
      return { tier: 'decider', line: 'Win and you are champions.' };
    }
    if (div.promotionSpots > 0 && topCertain(win, clubId, div.promotionSpots) && !topCertain(lose, clubId, div.promotionSpots)) {
      return { tier: 'decider', line: 'Win and you are up.' };
    }
    if (div.relegationSpots > 0 && doomed(lose, clubId, div.relegationSpots) && !doomed(win, clubId, div.relegationSpots)) {
      return { tier: 'decider', line: 'Lose and you are down.' };
    }
    if (div.relegationSpots > 0 && safeCertain(win, clubId, div.relegationSpots) && !safeCertain(lose, clubId, div.relegationSpots)) {
      return { tier: 'decider', line: 'Win and you are safe.' };
    }
    if (div.promotionSpots > 0 && topImpossible(lose, clubId, div.promotionSpots) && !topImpossible(win, clubId, div.promotionSpots)) {
      return { tier: 'decider', line: 'Lose and promotion is gone.' };
    }
  }

  if (isDerby) return { tier: 'derby', line: null };
  return { tier: 'routine', line: null };
}
