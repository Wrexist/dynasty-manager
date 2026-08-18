/**
 * Super Cup catch-up — regression cover for a half-applied fix.
 *
 * THE SETUP. `DOMESTIC_SUPER_CUP_WEEK` (1) and `CONTINENTAL_SUPER_CUP_WEEK` (2)
 * are raw, unscaled constants while the cup / League Cup / continental
 * calendars compress into those same weeks in short seasons, and Super Cup is
 * LAST in the match-priority chain. So the tie is routinely outranked on its own
 * week. The SELECTION sites were changed from `sc.week === week` to
 * `week >= sc.week` so it could be caught up later.
 *
 * THE BUG. The RESOLUTION sites in `matchActions` were not changed. They still
 * asked `dsc.week === week`, so a tie caught up in week 2 was simulated and then
 * left `played: false` (1 === 2 is false). The next free week selected it again.
 * Measured on Manchester City, season 2: `lastMatchCompetition` read
 * "Super Cup" **25 times in one season**, the tie finished the season unplayed,
 * and no trophy or prize money was ever awarded. That is strictly worse than the
 * "never played" bug the catch-up was added to fix, because it also ate the
 * player's match slot on every otherwise-free week.
 *
 * A third consequence: `weekAdvance`'s `playerPlayedNonLeagueThisWeek` read the
 * SCHEDULED week too, so the league fixture a caught-up Super Cup displaced was
 * never auto-simmed. Same 4-season run: 5/16/22/27 of the player's league
 * fixtures unplayed at the season boundary before the fix, 2/3/13/27 after.
 *
 * `resolvesExactlyOnce` is the test that fails against the pre-fix code.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { isSuperCupPending, markSuperCupPlayed, pendingSuperCup, superCupPlayedOn } from '@/utils/superCup';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import type { SuperCupMatch } from '@/types/game';

const CLUB = 'manchester-city';
const RIVAL = 'liverpool';

function tie(over: Partial<SuperCupMatch> = {}): SuperCupMatch {
  return {
    type: 'domestic', homeClubId: CLUB, awayClubId: RIVAL,
    played: false, homeGoals: 0, awayGoals: 0, week: 1, winnerId: null, ...over,
  };
}

describe('isSuperCupPending', () => {
  it('is owed from its scheduled week onward, not only ON it', () => {
    expect(isSuperCupPending(tie(), 1, CLUB)).toBe(true);
    expect(isSuperCupPending(tie(), 9, CLUB)).toBe(true);
  });

  it('is not owed before its week', () => {
    expect(isSuperCupPending(tie({ week: 5 }), 4, CLUB)).toBe(false);
  });

  it('is not owed once played, however late', () => {
    expect(isSuperCupPending(tie({ played: true }), 30, CLUB)).toBe(false);
  });

  it('is not owed by a club that is not in it', () => {
    expect(isSuperCupPending(tie(), 3, 'arsenal')).toBe(false);
  });

  it('handles a missing tie', () => {
    expect(isSuperCupPending(null, 3, CLUB)).toBe(false);
    expect(isSuperCupPending(undefined, 3, CLUB)).toBe(false);
  });
});

describe('pendingSuperCup', () => {
  const csc = tie({ type: 'continental', week: 2 });

  it('prefers the domestic tie — the same order the priority chain uses', () => {
    const got = pendingSuperCup({ domesticSuperCup: tie(), continentalSuperCup: csc }, 5, CLUB);
    expect(got?.type).toBe('domestic');
  });

  it('falls through to the continental tie once the domestic one is settled', () => {
    const got = pendingSuperCup({ domesticSuperCup: tie({ played: true }), continentalSuperCup: csc }, 5, CLUB);
    expect(got?.type).toBe('continental');
  });

  it('returns null when nothing is owed', () => {
    expect(pendingSuperCup({ domesticSuperCup: null, continentalSuperCup: null }, 5, CLUB)).toBeNull();
    expect(pendingSuperCup({ domesticSuperCup: tie({ played: true }), continentalSuperCup: null }, 5, CLUB)).toBeNull();
  });
});

describe('superCupPlayedOn', () => {
  it('reads the week it was actually played, not the week it was due', () => {
    const settled = tie({ played: true, week: 1, playedWeek: 6 });
    expect(superCupPlayedOn(settled, 6)).toBe(true);
    expect(superCupPlayedOn(settled, 1)).toBe(false);
  });

  it('falls back to the scheduled week for pre-v83 saves with no playedWeek', () => {
    expect(superCupPlayedOn(tie({ played: true, week: 1 }), 1)).toBe(true);
    expect(superCupPlayedOn(tie({ played: true, week: 1 }), 2)).toBe(false);
  });

  it('is false for an unplayed tie and for nothing at all', () => {
    expect(superCupPlayedOn(tie(), 1)).toBe(false);
    expect(superCupPlayedOn(null, 1)).toBe(false);
  });
});

describe('markSuperCupPlayed', () => {
  it('stamps the played week alongside the result', () => {
    const settled = markSuperCupPlayed(tie(), 7, { homeGoals: 3, awayGoals: 1 }, CLUB);
    expect(settled.played).toBe(true);
    expect(settled.playedWeek).toBe(7);
    expect(settled.week).toBe(1); // the schedule is history, not rewritten
    expect(settled.winnerId).toBe(CLUB);
    expect(settled.penaltyShootout).toBeUndefined();
  });

  it('carries a shootout through when one decided it', () => {
    const settled = markSuperCupPlayed(tie(), 4, { homeGoals: 1, awayGoals: 1 }, RIVAL, { home: 3, away: 5 });
    expect(settled.penaltyShootout).toEqual({ home: 3, away: 5 });
    expect(settled.winnerId).toBe(RIVAL);
  });
});

describe('the Super Cup in the live game loop', () => {
  const tick = () => new Promise<void>(r => setTimeout(r, 0));

  beforeEach(() => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    localStorage.clear();
    useGameStore.getState().initGame(CLUB);
  });

  it('resolvesExactlyOnce: a caught-up tie is settled and never re-selected', { timeout: 180_000 }, async () => {
    useGameStore.setState({ domesticSuperCup: tie() });

    let selections = 0;
    for (let w = 0; w < 14; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
      if (useGameStore.getState().lastMatchCompetition === 'Super Cup') selections++;
      if (w % 10 === 9) await tick();
    }

    const sc = useGameStore.getState().domesticSuperCup!;
    // Pre-fix: played stayed false and `selections` reached double digits.
    expect(sc.played, 'the Super Cup was never marked played').toBe(true);
    expect(sc.winnerId, 'no winner was recorded').toBeTruthy();
    expect([CLUB, RIVAL]).toContain(sc.winnerId);
    expect(sc.playedWeek, 'the played week was not stamped').toBeGreaterThanOrEqual(sc.week);
    expect(selections, `Super Cup was selected ${selections} times`).toBeLessThanOrEqual(1);
  });

  it('does not offer a Super Cup the club is not in', { timeout: 120_000 }, async () => {
    useGameStore.setState({ domesticSuperCup: tie({ homeClubId: 'arsenal', awayClubId: RIVAL }) });
    for (let w = 0; w < 6; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
      expect(useGameStore.getState().lastMatchCompetition).not.toBe('Super Cup');
    }
  });
});
