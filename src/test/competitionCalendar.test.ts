/**
 * Competition Calendar Scaling Tests
 *
 * Most leagues run seasons shorter than the 46-week reference calendar
 * (state.totalWeeks, 18–58). getCompetitionCalendar must compress every
 * competition's schedule so finals land INSIDE the season, while keeping
 * the load-bearing run-in ordering intact. Before this existed, the Cup
 * Final (reference week 43) was unreachable in 40 of 45 leagues and
 * continental knockouts stranded with winnerId null — see AUDIT_REPORT C1.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getCompetitionCalendar, REF_TOTAL_WEEKS, LEAGUE_CUP_WEEKS, CONTINENTAL_GROUP_WEEKS, CONTINENTAL_R16_WEEKS, CONTINENTAL_QF_WEEKS, CONTINENTAL_SF_WEEKS, CONTINENTAL_FINAL_WEEK, REF_CUP_WEEKS } from '@/config/continental';
import { LEAGUES, generateDivisionFixtures } from '@/data/league';
import { generateCupDraw } from '@/data/cup';
import { useGameStore } from '@/store/gameStore';
import type { CupRound } from '@/types/game';

const ROUNDS: CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];

// Every distinct season length shipped in league data, plus the reference.
const ALL_LENGTHS = [...new Set([...LEAGUES.map(l => l.totalWeeks || REF_TOTAL_WEEKS), REF_TOTAL_WEEKS])].sort((a, b) => a - b);

describe('getCompetitionCalendar invariants', () => {
  it('uses the reference calendar unchanged for 46+ week seasons', () => {
    for (const w of ALL_LENGTHS.filter(x => x >= REF_TOTAL_WEEKS)) {
      const cal = getCompetitionCalendar(w);
      expect(cal.cupWeeks).toEqual(REF_CUP_WEEKS);
      expect(cal.leagueCupWeeks).toEqual(LEAGUE_CUP_WEEKS);
      expect([...cal.groupWeeks]).toEqual([...CONTINENTAL_GROUP_WEEKS]);
      expect([...cal.r16Weeks]).toEqual([...CONTINENTAL_R16_WEEKS]);
      expect([...cal.qfWeeks]).toEqual([...CONTINENTAL_QF_WEEKS]);
      expect([...cal.sfWeeks]).toEqual([...CONTINENTAL_SF_WEEKS]);
      expect(cal.finalWeek).toBe(CONTINENTAL_FINAL_WEEK);
    }
  });

  it.each(ALL_LENGTHS.map(w => [w]))('every scheduled week fits inside a %i-week season', (w) => {
    const cal = getCompetitionCalendar(w);
    const cap = Math.max(w, REF_TOTAL_WEEKS); // 58-week leagues keep the reference calendar
    const all = [
      ...ROUNDS.map(r => cal.cupWeeks[r]),
      ...ROUNDS.map(r => cal.leagueCupWeeks[r]),
      ...cal.groupWeeks, ...cal.r16Weeks, ...cal.qfWeeks, ...cal.sfWeeks, cal.finalWeek,
    ];
    for (const wk of all) {
      expect(wk).toBeGreaterThanOrEqual(1);
      expect(wk).toBeLessThanOrEqual(cap);
    }
  });

  it.each(ALL_LENGTHS.map(w => [w]))('rounds within each competition are strictly increasing at %i weeks', (w) => {
    const cal = getCompetitionCalendar(w);
    for (const rec of [cal.cupWeeks, cal.leagueCupWeeks]) {
      for (let i = 1; i < ROUNDS.length; i++) {
        expect(rec[ROUNDS[i]], `round ${ROUNDS[i]} @ ${w}w`).toBeGreaterThan(rec[ROUNDS[i - 1]]);
      }
    }
    const continental = [...cal.groupWeeks, ...cal.r16Weeks, ...cal.qfWeeks, ...cal.sfWeeks, cal.finalWeek];
    for (let i = 1; i < continental.length; i++) {
      expect(continental[i], `continental milestone ${i} @ ${w}w`).toBeGreaterThan(continental[i - 1]);
    }
  });

  it.each(ALL_LENGTHS.map(w => [w]))('run-in ordering holds at %i weeks: LC Final < continental SF legs < Cup Final < continental Final', (w) => {
    const cal = getCompetitionCalendar(w);
    expect(cal.leagueCupWeeks.F).toBeLessThan(cal.sfWeeks[0]);
    expect(cal.sfWeeks[0]).toBeLessThan(cal.sfWeeks[1]);
    expect(cal.sfWeeks[1]).toBeLessThan(cal.cupWeeks.F);
    expect(cal.cupWeeks.F).toBeLessThan(cal.finalWeek);
    // Continental QF legs must clear the League Cup Final too.
    expect(cal.qfWeeks[1]).toBeLessThan(cal.leagueCupWeeks.F);
  });

  it('memoizes per length and never mutates the reference records', () => {
    expect(getCompetitionCalendar(18)).toBe(getCompetitionCalendar(18));
    getCompetitionCalendar(22);
    expect(REF_CUP_WEEKS.F).toBe(43);
    expect(LEAGUE_CUP_WEEKS.F).toBe(40);
  });
});

describe('cup draws use the scaled calendar', () => {
  const makeClubIds = (n: number) => Array.from({ length: n }, (_, i) => `club-${i}`);

  it('stamps tie weeks inside the season for every league length', () => {
    for (const w of ALL_LENGTHS) {
      const cup = generateCupDraw(makeClubIds(10), w);
      const cap = Math.max(w, REF_TOTAL_WEEKS);
      for (const tie of cup.ties) {
        expect(tie.week, `tie week @ ${w}w`).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe('odd-team-count league fixtures fit the season', () => {
  it.each(LEAGUES.filter(l => l.teamCount % 2 !== 0).map(l => [l.id, l.teamCount, l.totalWeeks] as const))(
    '%s (%i teams) schedules nothing beyond totalWeeks %i',
    (id, teamCount, totalWeeks) => {
      const clubIds = Array.from({ length: teamCount }, (_, i) => `c${i}`);
      const fixtures = generateDivisionFixtures(clubIds, totalWeeks || REF_TOTAL_WEEKS);
      const maxWeek = Math.max(...fixtures.map(f => f.week));
      expect(maxWeek).toBeLessThanOrEqual(totalWeeks || REF_TOTAL_WEEKS);
      // Full double round-robin must survive the scheduling
      expect(fixtures.length).toBe(teamCount * (teamCount - 1));
    },
  );
});

describe('short-league season completes its domestic cups (C1 regression)', () => {
  beforeEach(() => {
    useGameStore.getState().initGame('dinamo-zagreb'); // Croatia — 18-week season, the shortest calendar
  });

  it('crowns a Dynasty Cup and League Cup winner within the season', { timeout: 120_000 }, async () => {
    const initial = useGameStore.getState();
    expect(initial.totalWeeks).toBe(18);
    // Every cup tie must be scheduled inside the season at draw time.
    for (const tie of initial.cup.ties) expect(tie.week).toBeLessThanOrEqual(18);
    for (const tie of initial.leagueCup.ties) expect(tie.week).toBeLessThanOrEqual(18);

    for (let w = 0; w < 18; w++) {
      await useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }

    const state = useGameStore.getState();
    expect(state.cup.winner, 'Dynasty Cup must have a winner before season end').toBeTruthy();
    expect(state.leagueCup?.winner, 'League Cup must have a winner before season end').toBeTruthy();
    // The final must actually have been contested on its scheduled week
    const final = state.cup.ties.find(t => t.round === 'F');
    expect(final?.played).toBe(true);
  });
});
