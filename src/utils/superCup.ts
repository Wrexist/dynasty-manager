/**
 * Super Cup scheduling — one place for "is this tie still owed?" and "was it
 * played in this week?".
 *
 * WHY THIS FILE EXISTS. `DOMESTIC_SUPER_CUP_WEEK` (1) and
 * `CONTINENTAL_SUPER_CUP_WEEK` (2) are raw, unscaled constants, while the cup,
 * League Cup and continental calendars compress into those same weeks in short
 * seasons. Super Cup is LAST in the match-priority chain, so in practice the tie
 * is routinely outranked on its own week and must be caught up later. The
 * selection sites were changed from `week === sc.week` to `week >= sc.week` to
 * allow that — but the RESOLUTION sites in `matchActions` were not.
 *
 * The result was worse than the bug the catch-up was meant to fix. Measured:
 * Manchester City's domestic Super Cup was selected and simulated in weeks 2, 3,
 * 4, 6 and 7 of the same season — `lastMatchCompetition` read "Super Cup" every
 * time — and `played` was never set, because resolution still asked
 * `dsc.week === week` (1 === 2). So the tie ate the player's match slot on every
 * otherwise-free week for the whole season, awarded no trophy and no prize
 * money, and finished the season unplayed.
 *
 * Two rules, applied everywhere:
 *   - PENDING is `!played && week >= sc.week`, domestic before continental —
 *     the same order the priority chain uses.
 *   - PLAYED-THIS-WEEK is `played && (playedWeek ?? week) === week`. It must not
 *     read `week` alone: after a catch-up that is the scheduled week, not the
 *     week it happened, and `weekAdvance` uses this to decide whether to
 *     auto-sim the league fixture the Super Cup displaced. Miss it and the
 *     player's club ends the season a match short and the table is wrong.
 */
import type { SuperCupMatch } from '@/types/game';

/** The Super Cups a state can hold, in priority order. */
interface SuperCupHolder {
  domesticSuperCup: SuperCupMatch | null;
  continentalSuperCup: SuperCupMatch | null;
}

/** True when `sc` is still owed as of `week` and involves `clubId`. */
export function isSuperCupPending(sc: SuperCupMatch | null | undefined, week: number, clubId: string): boolean {
  return !!sc && !sc.played && week >= sc.week && (sc.homeClubId === clubId || sc.awayClubId === clubId);
}

/**
 * The Super Cup `clubId` still owes as of `week`, domestic first, or null.
 *
 * This is the single source for match selection — `playCurrentMatch`,
 * `playFirstHalf`, `findTournamentMatch` and MatchDay all route through it, so
 * the screen can never offer a tie the resolver will refuse to close (which is
 * exactly how the repeat-play bug survived).
 */
export function pendingSuperCup(state: SuperCupHolder, week: number, clubId: string): SuperCupMatch | null {
  if (isSuperCupPending(state.domesticSuperCup, week, clubId)) return state.domesticSuperCup;
  if (isSuperCupPending(state.continentalSuperCup, week, clubId)) return state.continentalSuperCup;
  return null;
}

/** True when `sc` was played in `week`, honouring a catch-up week. */
export function superCupPlayedOn(sc: SuperCupMatch | null | undefined, week: number): boolean {
  return !!sc && sc.played && (sc.playedWeek ?? sc.week) === week;
}

/** Stamp a finished Super Cup with the week it was actually played. */
export function markSuperCupPlayed(
  sc: SuperCupMatch,
  week: number,
  result: { homeGoals: number; awayGoals: number },
  winnerId: string,
  penaltyShootout?: { home: number; away: number },
): SuperCupMatch {
  return {
    ...sc,
    played: true,
    playedWeek: week,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    winnerId,
    ...(penaltyShootout ? { penaltyShootout } : {}),
  };
}
