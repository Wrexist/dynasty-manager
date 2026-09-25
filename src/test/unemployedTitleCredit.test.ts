/**
 * Item 9 — a league title the ex-club won while the manager was out of work is
 * not the manager's.
 *
 * An unemployed career manager keeps `playerClubId` pointing at the club that
 * let them go, and season end still writes a season-history row from that
 * club's table. Every title count read `position === 1` off those rows, so the
 * ex-club's title landed in achievements, prestige, the Hall of Managers, the
 * Trophy Cabinet, the Manager Profile and the Manager Pass. The row now
 * carries `managed` (schema v94) and every count reads it through
 * `isManagersLeagueTitle`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { isManagersLeagueTitle, calculatePrestigeStats } from '@/utils/prestige';
import { buildHallEntry } from '@/utils/hallOfManagers';
import { seasonTrophyCount } from '@/utils/managerPassObserver';
import { checkAchievements } from '@/utils/achievements';
import { createDefaultManager } from '@/utils/managerCareer';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type { SeasonHistory } from '@/types/game';

const CLUB = 'manchester-city';

function row(position: number, managed?: boolean): SeasonHistory {
  return {
    season: 1, position, points: 90, won: 28, drawn: 6, lost: 4, goalsFor: 90, goalsAgainst: 30,
    topScorer: { name: 'X', goals: 30 }, boardVerdict: 'excellent',
    ...(managed === undefined ? {} : { managed }),
  };
}

const STATS = { totalWins: 28, totalDraws: 6, totalLosses: 4 };

describe('isManagersLeagueTitle', () => {
  it('counts first place in a managed season, and in a row older than the marker', () => {
    expect(isManagersLeagueTitle(row(1, true))).toBe(true);
    expect(isManagersLeagueTitle(row(1))).toBe(true);
    expect(isManagersLeagueTitle(row(2, true))).toBe(false);
  });

  it('does not count first place in a season the manager was out of work for', () => {
    expect(isManagersLeagueTitle(row(1, false))).toBe(false);
  });
});

describe('every title count reads the marker', () => {
  const history = [row(3, true), row(1, false)];

  it('prestige', () => {
    expect(calculatePrestigeStats(history, STATS, 0).titles).toBe(0);
    expect(calculatePrestigeStats([row(1, true)], STATS, 0).titles).toBe(1);
  });

  it('Hall of Managers', () => {
    expect(buildHallEntry('c', 'City', history, STATS, 0).titles).toBe(0);
  });

  it('Manager Pass trophy count', () => {
    expect(seasonTrophyCount(row(1, false))).toBe(0);
    expect(seasonTrophyCount(row(1, true))).toBe(1);
  });

  it('achievements', () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(CLUB);
    const s = useGameStore.getState();
    const unmanaged = checkAchievements({ ...s, seasonHistory: [row(1, false), row(1, false)] }, []);
    expect(unmanaged).not.toContain('league-champion');
    expect(unmanaged).not.toContain('back-to-back');
    const managed = checkAchievements({ ...s, seasonHistory: [row(1, true), row(1, true)] }, []);
    expect(managed).toContain('league-champion');
    expect(managed).toContain('back-to-back');
  });
});

describe('season end records whether the manager was in charge', () => {
  beforeEach(async () => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    useGameStore.getState().resetGame();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB);
  });

  /** Put the ex-club top of the table and close the season. */
  function closeSeasonTop(contract: boolean) {
    const s = useGameStore.getState();
    const cm = createDefaultManager('Title Tester', 'England', 45, []);
    const leagueTable = [...s.leagueTable].sort((a, b) => (a.clubId === CLUB ? -1 : b.clubId === CLUB ? 1 : 0));
    useGameStore.setState({
      gameMode: 'career',
      careerManager: {
        ...cm,
        contract: contract ? { clubId: CLUB, salary: 5000, startSeason: 1, endSeason: 3, bonuses: [] } : null,
        unemployedWeeks: contract ? 0 : 10,
      },
      leagueTable,
    });
    useGameStore.getState().endSeason();
    const after = useGameStore.getState();
    return after.seasonHistory[after.seasonHistory.length - 1];
  }

  it('out of work: the row is the ex-club\'s title, not the manager\'s', { timeout: 60_000 }, () => {
    const latest = closeSeasonTop(false);
    expect(latest.position).toBe(1);
    expect(latest.managed).toBe(false);
    expect(isManagersLeagueTitle(latest)).toBe(false);
    expect(useGameStore.getState().unlockedAchievements).not.toContain('league-champion');
  });

  it('in charge: the title is theirs', { timeout: 60_000 }, () => {
    const latest = closeSeasonTop(true);
    expect(latest.position).toBe(1);
    expect(latest.managed).toBe(true);
    expect(isManagersLeagueTitle(latest)).toBe(true);
  });
});
