/**
 * Phase 6b — Prestige stats, Hall of Managers entries, and career milestones.
 *
 * Pure-function tests for the manager career-end scaffolding:
 *   - calculatePrestigeStats / getPrestigeXPMultiplier (prestige.ts)
 *   - buildHallEntry, saveToHall, loadHall (hallOfManagers.ts)
 *   - createMilestone, checkMatchMilestones (milestones.ts)
 *
 * These power the Prestige flow, Hall of Managers leaderboard, and career
 * timeline. Bugs here are highly visible and persist in localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  calculatePrestigeStats,
  getPrestigeXPMultiplier,
} from '@/utils/prestige';
import {
  buildHallEntry,
  saveToHall,
  loadHall,
  type HallEntry,
} from '@/utils/hallOfManagers';
import {
  createMilestone,
  checkMatchMilestones,
} from '@/utils/milestones';
import type { CareerMilestone, SeasonHistory } from '@/types/game';

// ── Helpers ────────────────────────────────────────────────────────────

function makeHistory(overrides: Partial<SeasonHistory> = {}): SeasonHistory {
  return {
    season: 1,
    position: 5,
    points: 60,
    won: 18, drawn: 6, lost: 14,
    goalsFor: 55, goalsAgainst: 40,
    topScorer: { name: 'A. Player', goals: 15 },
    boardVerdict: 'good',
    ...overrides,
  };
}

// ── calculatePrestigeStats ────────────────────────────────────────────

describe('calculatePrestigeStats', () => {
  it('returns zeroed stats for an empty career', () => {
    const stats = calculatePrestigeStats([], { totalWins: 0, totalDraws: 0, totalLosses: 0 }, 0);
    expect(stats.totalSeasons).toBe(0);
    expect(stats.titles).toBe(0);
    expect(stats.cupWins).toBe(0);
    expect(stats.totalWins).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.bestPosition).toBe(20); // sentinel for "no history"
    expect(stats.prestigeLevel).toBe(1);
  });

  it('counts titles (position === 1)', () => {
    const history = [
      makeHistory({ season: 1, position: 1 }),
      makeHistory({ season: 2, position: 3 }),
      makeHistory({ season: 3, position: 1 }),
    ];
    const stats = calculatePrestigeStats(history, { totalWins: 80, totalDraws: 20, totalLosses: 30 }, 0);
    expect(stats.titles).toBe(2);
  });

  it('counts cup wins (cupResult === "Winner")', () => {
    const history = [
      makeHistory({ season: 1, cupResult: 'Winner' }),
      makeHistory({ season: 2, cupResult: 'Quarter-Finals' }),
      makeHistory({ season: 3, cupResult: 'Winner' }),
    ];
    const stats = calculatePrestigeStats(history, { totalWins: 50, totalDraws: 20, totalLosses: 30 }, 0);
    expect(stats.cupWins).toBe(2);
  });

  it('finds the best (lowest-numbered) position', () => {
    const history = [
      makeHistory({ position: 7 }),
      makeHistory({ position: 2 }),
      makeHistory({ position: 4 }),
    ];
    const stats = calculatePrestigeStats(history, { totalWins: 0, totalDraws: 0, totalLosses: 0 }, 0);
    expect(stats.bestPosition).toBe(2);
  });

  it('computes winRate as integer percentage', () => {
    const stats = calculatePrestigeStats([], { totalWins: 30, totalDraws: 10, totalLosses: 60 }, 0);
    expect(stats.winRate).toBe(30); // 30 / 100
  });

  it('rounds winRate', () => {
    const stats = calculatePrestigeStats([], { totalWins: 1, totalDraws: 0, totalLosses: 2 }, 0);
    expect(stats.winRate).toBe(33);
  });

  it('increments prestigeLevel by 1 over current', () => {
    expect(calculatePrestigeStats([], { totalWins: 0, totalDraws: 0, totalLosses: 0 }, 0).prestigeLevel).toBe(1);
    expect(calculatePrestigeStats([], { totalWins: 0, totalDraws: 0, totalLosses: 0 }, 5).prestigeLevel).toBe(6);
  });
});

// ── getPrestigeXPMultiplier ───────────────────────────────────────────

describe('getPrestigeXPMultiplier', () => {
  it('returns 1x for prestige 0', () => {
    expect(getPrestigeXPMultiplier(0)).toBe(1);
  });

  it('returns 1.5x for prestige 1', () => {
    expect(getPrestigeXPMultiplier(1)).toBe(1.5);
  });

  it('scales linearly: 1 + level * 0.5', () => {
    expect(getPrestigeXPMultiplier(2)).toBe(2);
    expect(getPrestigeXPMultiplier(3)).toBe(2.5);
    expect(getPrestigeXPMultiplier(10)).toBe(6);
  });
});

// ── buildHallEntry ────────────────────────────────────────────────────

describe('buildHallEntry', () => {
  it('builds an entry with correct counts from history', () => {
    const history = [
      makeHistory({ season: 1, position: 1, points: 92, cupResult: 'Winner' }),
      makeHistory({ season: 2, position: 3, points: 78 }),
      makeHistory({ season: 3, position: 1, points: 88, cupResult: 'Winner' }),
    ];
    const entry = buildHallEntry('save-1', 'Manchester City', history,
      { totalWins: 60, totalDraws: 20, totalLosses: 16 }, /* prestige */ 1);

    expect(entry.id).toBe('save-1');
    expect(entry.clubName).toBe('Manchester City');
    expect(entry.seasons).toBe(3);
    expect(entry.titles).toBe(2);
    expect(entry.cupWins).toBe(2);
    expect(entry.bestPosition).toBe(1);
    expect(entry.bestPoints).toBe(92);
    expect(entry.totalWins).toBe(60);
    expect(entry.totalMatches).toBe(96);
    expect(entry.winRate).toBe(63); // 60/96 = 0.625 → 63
    expect(entry.prestigeLevel).toBe(1);
    expect(entry.recordedAt).toBeGreaterThan(0);
  });

  it('returns sane defaults for an empty career', () => {
    const entry = buildHallEntry('empty', 'New Club', [],
      { totalWins: 0, totalDraws: 0, totalLosses: 0 }, 0);
    expect(entry.seasons).toBe(0);
    expect(entry.titles).toBe(0);
    expect(entry.cupWins).toBe(0);
    expect(entry.bestPosition).toBe(20);
    expect(entry.bestPoints).toBe(0);
    expect(entry.winRate).toBe(0);
  });
});

// ── saveToHall / loadHall (uses jsdom localStorage) ──────────────────

describe('saveToHall + loadHall', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function makeEntry(id: string, titles: number, winRate = 50): HallEntry {
    return {
      id,
      clubName: `Club ${id}`,
      seasons: 5, titles, cupWins: 1, bestPosition: 1,
      winRate, totalWins: 50, totalMatches: 100, bestPoints: 80,
      prestigeLevel: 0, recordedAt: Date.now(),
    };
  }

  it('persists a single entry across loadHall', () => {
    const entry = makeEntry('a', 3);
    saveToHall(entry);
    expect(loadHall()).toHaveLength(1);
    expect(loadHall()[0].id).toBe('a');
  });

  it('upserts on matching id rather than duplicating', () => {
    saveToHall(makeEntry('a', 3));
    saveToHall(makeEntry('a', 5));
    const hall = loadHall();
    expect(hall).toHaveLength(1);
    expect(hall[0].titles).toBe(5);
  });

  it('sorts entries by titles desc, then winRate desc', () => {
    saveToHall(makeEntry('low', 1, 80));
    saveToHall(makeEntry('mid', 3, 60));
    saveToHall(makeEntry('high', 5, 40));
    const hall = loadHall();
    expect(hall.map(h => h.id)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks ties on titles by winRate desc', () => {
    saveToHall(makeEntry('a', 3, 70));
    saveToHall(makeEntry('b', 3, 50));
    const hall = loadHall();
    expect(hall.map(h => h.id)).toEqual(['a', 'b']);
  });

  it('caps the leaderboard at 20 entries', () => {
    for (let i = 0; i < 25; i++) saveToHall(makeEntry(`entry-${i}`, i));
    expect(loadHall()).toHaveLength(20);
  });

  it('returns [] when storage is empty or corrupted', () => {
    expect(loadHall()).toEqual([]);
    localStorage.setItem('dynasty-hall-of-managers', '{not-json');
    expect(loadHall()).toEqual([]);
  });
});

// ── createMilestone ───────────────────────────────────────────────────

describe('createMilestone', () => {
  it('creates a milestone with all fields populated', () => {
    const m = createMilestone('first_win', 'First Win', 'Won the first match', 1, 5, 'trophy');
    expect(m.type).toBe('first_win');
    expect(m.title).toBe('First Win');
    expect(m.description).toBe('Won the first match');
    expect(m.season).toBe(1);
    expect(m.week).toBe(5);
    expect(m.icon).toBe('trophy');
    expect(typeof m.id).toBe('string');
    expect(m.id.length).toBeGreaterThan(0);
  });

  it('omits icon when not provided', () => {
    const m = createMilestone('first_win', 'X', 'Y', 1, 1);
    expect(m.icon).toBeUndefined();
  });

  it('produces unique IDs for back-to-back milestones', () => {
    const a = createMilestone('first_win', 'A', '', 1, 1);
    const b = createMilestone('first_win', 'B', '', 1, 1);
    expect(a.id).not.toBe(b.id);
  });
});

// ── checkMatchMilestones ──────────────────────────────────────────────

describe('checkMatchMilestones', () => {
  it('returns null when totalMatches is not a threshold', () => {
    expect(checkMatchMilestones(75, [], 1, 5)).toBeNull();
    expect(checkMatchMilestones(0, [], 1, 5)).toBeNull();
  });

  it('triggers at exactly 50 matches', () => {
    const m = checkMatchMilestones(50, [], 2, 4);
    expect(m).not.toBeNull();
    expect(m!.title).toBe('50 Matches');
    expect(m!.type).toBe('milestone_matches');
    expect(m!.season).toBe(2);
    expect(m!.week).toBe(4);
  });

  it('triggers at 100, 200, 500 thresholds', () => {
    expect(checkMatchMilestones(100, [], 3, 1)?.title).toBe('100 Matches');
    expect(checkMatchMilestones(200, [], 5, 1)?.title).toBe('200 Matches');
    expect(checkMatchMilestones(500, [], 11, 1)?.title).toBe('500 Matches');
  });

  it('does not re-trigger if the milestone is already recorded', () => {
    const existing: CareerMilestone[] = [{
      id: 'old', type: 'milestone_matches', title: '50 Matches',
      description: 'Reached 50 career matches as manager.', season: 1, week: 1,
    }];
    expect(checkMatchMilestones(50, existing, 2, 1)).toBeNull();
  });

  it('only checks the current totalMatches value (not 51, not 49)', () => {
    expect(checkMatchMilestones(49, [], 1, 1)).toBeNull();
    expect(checkMatchMilestones(51, [], 1, 1)).toBeNull();
  });
});
