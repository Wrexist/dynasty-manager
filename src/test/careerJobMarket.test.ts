/**
 * Manager Career job market while unemployed — regressions from the 2026-09-25
 * audit.
 *
 * 1. **Refresh weeks assumed a 46-week calendar.** `JOB_MARKET_REFRESH_WEEKS`
 *    was `[1, 24, 46]`: week 1 is never ticked (a tick lands on week + 1),
 *    38-week leagues never reach 46, and 18/22-week leagues never reach 24 —
 *    so a manager out of work in those leagues saw the market refresh once or
 *    never. Refreshes are now fractions of the league's own season.
 *
 * 2. **Emergency vacancies only fired when the list was EMPTY.** Listings go
 *    down to half a club's minimum reputation, but applying needs the full
 *    minimum — so a list of out-of-reach jobs kept the desperation safety net
 *    off indefinitely. Only applicable listings count now.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { createDefaultManager, getJobMarketRefreshWeeks } from '@/utils/managerCareer';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type { CareerManager, JobVacancy } from '@/types/game';

const CLUB_ID = 'manchester-city'; // Premier League: 38 weeks

function unemployedManager(overrides: Partial<CareerManager> = {}): CareerManager {
  return {
    ...createDefaultManager('Market Tester', 'England', 40, []),
    contract: null,
    unemployedWeeks: 0,
    ...overrides,
  };
}

describe('getJobMarketRefreshWeeks', () => {
  it('spreads refreshes over the league\'s own season, all of them reachable', () => {
    for (const len of [18, 22, 26, 30, 34, 38, 42, 46, 58]) {
      const weeks = getJobMarketRefreshWeeks(len);
      expect(weeks.length, `len ${len}`).toBeGreaterThanOrEqual(3);
      for (const w of weeks) {
        expect(w, `len ${len}`).toBeGreaterThanOrEqual(2);
        expect(w, `len ${len}`).toBeLessThanOrEqual(len);
      }
      expect(weeks).toContain(len);
    }
    expect(getJobMarketRefreshWeeks(38)).toEqual([2, 19, 38]);
  });
});

describe('unemployed job market', () => {
  beforeEach(async () => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    useGameStore.getState().resetGame();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB_ID);
  });

  it('refreshes on the final week of a 38-week season', async () => {
    const total = useGameStore.getState().totalWeeks;
    expect(total).toBe(38);
    useGameStore.setState({
      gameMode: 'career',
      careerManager: unemployedManager({ reputationScore: 300 }),
      jobVacancies: [],
      week: total - 1,
    });

    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    expect(s.week).toBe(total);
    expect(s.jobVacancies.length, 'no refresh on the last week of a 38-week season').toBeGreaterThan(0);
    expect(s.jobVacancies.every(v => v.id.endsWith(`-${total}`))).toBe(true);
  });

  it('offers desperation jobs when every listing is out of reach', async () => {
    const s0 = useGameStore.getState();
    const unreachable = {
      id: 'vacancy-far', clubId: 'arsenal', clubName: 'Arsenal', divisionId: 'eng',
      minReputation: 500, salary: 50000, contractLength: 2, boardExpectations: 'Win the league',
      expiresWeek: 40, expiresSeason: s0.season, applied: false,
    } as JobVacancy;
    useGameStore.setState({
      gameMode: 'career',
      // 11 -> 12 on this tick: the desperation threshold.
      careerManager: unemployedManager({ reputationScore: 10, unemployedWeeks: 11 }),
      jobVacancies: [unreachable],
      week: 5, // not a refresh week in a 38-week season
    });

    await useGameStore.getState().advanceWeek();

    const s = useGameStore.getState();
    const cm = s.careerManager!;
    const applicable = s.jobVacancies.filter(v => v.minReputation <= cm.reputationScore);
    expect(applicable.length, 'no job the manager can apply for after 12 weeks out').toBeGreaterThan(0);
    // The out-of-reach listing is still shown.
    expect(s.jobVacancies.some(v => v.id === 'vacancy-far')).toBe(true);
  });
});
