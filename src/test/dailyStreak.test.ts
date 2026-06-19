import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  daysBetween,
  evaluateDailyStreak,
  applyDailyClaim,
} from '@/utils/dailyStreak';
import { DAILY_REWARD_XP, DAILY_STREAK_CYCLE } from '@/config/gameBalance';
import type { DailyStreakRecord } from '@/store/helpers/persistence';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0);

describe('dailyStreak — date helpers', () => {
  it('localDateKey formats local Y-M-D with zero padding', () => {
    expect(localDateKey(at(2026, 6, 9))).toBe('2026-06-09');
    expect(localDateKey(at(2026, 12, 25))).toBe('2026-12-25');
  });

  it('daysBetween returns whole-day deltas across months and DST', () => {
    expect(daysBetween('2026-06-09', '2026-06-10')).toBe(1);
    expect(daysBetween('2026-06-09', '2026-06-09')).toBe(0);
    expect(daysBetween('2026-06-30', '2026-07-01')).toBe(1);
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1); // US spring-forward weekend
    expect(daysBetween('2026-06-10', '2026-06-09')).toBe(-1); // clock rewind
  });

  it('daysBetween returns null for malformed keys', () => {
    expect(daysBetween('nope', '2026-06-10')).toBeNull();
    expect(daysBetween('2026-06-10', '')).toBeNull();
  });
});

describe('evaluateDailyStreak', () => {
  it('treats a missing record as a fresh day-1 claim', () => {
    const s = evaluateDailyStreak(null, at(2026, 6, 9));
    expect(s.canClaim).toBe(true);
    expect(s.current).toBe(1);
    expect(s.dayInCycle).toBe(1);
    expect(s.rewardXP).toBe(DAILY_REWARD_XP[0]);
    expect(s.streakBroken).toBe(false);
  });

  it('blocks a second claim on the same day', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-09', current: 3, longest: 5 };
    const s = evaluateDailyStreak(rec, at(2026, 6, 9));
    expect(s.canClaim).toBe(false);
    expect(s.current).toBe(3);
    expect(s.longest).toBe(5);
  });

  it('extends the run on a consecutive day', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-09', current: 3, longest: 5 };
    const s = evaluateDailyStreak(rec, at(2026, 6, 10));
    expect(s.canClaim).toBe(true);
    expect(s.current).toBe(4);
    expect(s.dayInCycle).toBe(4);
    expect(s.rewardXP).toBe(DAILY_REWARD_XP[3]);
    expect(s.streakBroken).toBe(false);
  });

  it('resets and flags a break when a day is missed', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-09', current: 6, longest: 6 };
    const s = evaluateDailyStreak(rec, at(2026, 6, 12)); // 3-day gap
    expect(s.canClaim).toBe(true);
    expect(s.current).toBe(1);
    expect(s.streakBroken).toBe(true);
    expect(s.longest).toBe(6); // best run preserved
  });

  it('wraps the reward cycle while the streak keeps climbing', () => {
    const rec: DailyStreakRecord = {
      lastClaimDate: '2026-06-09',
      current: DAILY_STREAK_CYCLE, // day 7 of the cycle
      longest: DAILY_STREAK_CYCLE,
    };
    const s = evaluateDailyStreak(rec, at(2026, 6, 10));
    expect(s.current).toBe(DAILY_STREAK_CYCLE + 1); // streak = 8
    expect(s.dayInCycle).toBe(1); // cycle wrapped back to day 1
    expect(s.rewardXP).toBe(DAILY_REWARD_XP[0]);
  });

  it('does not flag a break on a clock rewind to a different prior day', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-10', current: 4, longest: 4 };
    const s = evaluateDailyStreak(rec, at(2026, 6, 9)); // gap = -1
    expect(s.canClaim).toBe(true);
    expect(s.current).toBe(1);
    expect(s.streakBroken).toBe(false);
  });
});

describe('applyDailyClaim', () => {
  it('produces an advanced record stamped with today', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-09', current: 3, longest: 5 };
    const { record, status } = applyDailyClaim(rec, at(2026, 6, 10));
    expect(status.canClaim).toBe(true);
    expect(record.lastClaimDate).toBe('2026-06-10');
    expect(record.current).toBe(4);
    expect(record.longest).toBe(5); // unchanged — 4 < 5
  });

  it('raises longest when the new run exceeds the prior best', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-09', current: 5, longest: 5 };
    const { record } = applyDailyClaim(rec, at(2026, 6, 10));
    expect(record.current).toBe(6);
    expect(record.longest).toBe(6);
  });

  it('is a no-op when today is already claimed', () => {
    const rec: DailyStreakRecord = { lastClaimDate: '2026-06-10', current: 6, longest: 6 };
    const { record, status } = applyDailyClaim(rec, at(2026, 6, 10));
    expect(status.canClaim).toBe(false);
    expect(record).toEqual(rec);
  });

  it('starts a fresh record from null', () => {
    const { record, status } = applyDailyClaim(null, at(2026, 6, 9));
    expect(status.canClaim).toBe(true);
    expect(record).toEqual({ lastClaimDate: '2026-06-09', current: 1, longest: 1 });
  });
});
