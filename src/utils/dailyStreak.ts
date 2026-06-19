/**
 * Pure daily login-streak logic.
 *
 * Kept free of storage/store/DOM dependencies so it can be unit-tested with an
 * injected `now`. The store reads/writes the persisted `DailyStreakRecord`
 * (see `store/helpers/persistence.ts`); this module only computes what today's
 * claim looks like and what the record becomes after a claim.
 *
 * "A day" is the player's LOCAL calendar day, not UTC — opening the app after
 * local midnight is a new day even if it's still "yesterday" in UTC.
 */
import { DAILY_STREAK_CYCLE, DAILY_REWARD_XP } from '@/config/gameBalance';
import type { DailyStreakRecord } from '@/store/helpers/persistence';

/** Local calendar-day key (YYYY-MM-DD) for the given instant. */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole-day difference between two YYYY-MM-DD keys (b − a). Parsed at local
 *  midday so DST transitions can't push the delta off by a day. Returns null
 *  if either key is malformed. */
export function daysBetween(a: string, b: string): number | null {
  const pa = parseKey(a);
  const pb = parseKey(b);
  if (pa === null || pb === null) return null;
  return Math.round((pb - pa) / 86_400_000);
}

function parseKey(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
}

/** 1-based position within the reward cycle for a given streak length. */
function cycleDay(streak: number): number {
  if (streak <= 0) return 1;
  return ((streak - 1) % DAILY_STREAK_CYCLE) + 1;
}

function rewardForDay(dayInCycle: number): number {
  return DAILY_REWARD_XP[dayInCycle - 1] ?? DAILY_REWARD_XP[DAILY_REWARD_XP.length - 1];
}

export interface DailyStreakStatus {
  /** True when today's reward has not yet been claimed. */
  canClaim: boolean;
  /** Consecutive-day count for today (the value the streak WILL hold once
   *  today is claimed). 1 on a fresh start or immediately after a lapse. */
  current: number;
  /** Best run ever, including a claim made today. */
  longest: number;
  /** 1-based position in the reward cycle for today (1..DAILY_STREAK_CYCLE). */
  dayInCycle: number;
  /** Manager XP today's claim grants. */
  rewardXP: number;
  /** True when the previous streak lapsed (one or more days missed). */
  streakBroken: boolean;
}

/** Evaluate the streak for `now` WITHOUT mutating storage. Safe to call on
 *  every render — it's a pure function of the record and the clock. */
export function evaluateDailyStreak(
  record: DailyStreakRecord | null,
  now: Date = new Date(),
): DailyStreakStatus {
  const today = localDateKey(now);

  // Already claimed today — surface the run as-is, nothing left to claim.
  if (record && record.lastClaimDate === today) {
    const dayInCycle = cycleDay(record.current);
    return {
      canClaim: false,
      current: record.current,
      longest: record.longest,
      dayInCycle,
      rewardXP: rewardForDay(dayInCycle),
      streakBroken: false,
    };
  }

  let current: number;
  let streakBroken = false;
  if (!record) {
    current = 1;
  } else {
    const gap = daysBetween(record.lastClaimDate, today);
    if (gap === 1) {
      current = record.current + 1; // consecutive day → extend
    } else {
      // Missed a day (gap > 1), corrupt key (null), or a clock rewind
      // (gap <= 0 but a different day) all reset the run to 1.
      current = 1;
      streakBroken = gap !== null && gap > 1;
    }
  }

  const dayInCycle = cycleDay(current);
  return {
    canClaim: true,
    current,
    longest: Math.max(record?.longest ?? 0, current),
    dayInCycle,
    rewardXP: rewardForDay(dayInCycle),
    streakBroken,
  };
}

/** Produce the persisted record after a successful claim at `now`, alongside
 *  the status describing that claim. If today is already claimed, the record
 *  is returned unchanged and `status.canClaim` is false. */
export function applyDailyClaim(
  record: DailyStreakRecord | null,
  now: Date = new Date(),
): { record: DailyStreakRecord; status: DailyStreakStatus } {
  const status = evaluateDailyStreak(record, now);
  if (!status.canClaim) {
    return {
      record: record ?? { lastClaimDate: localDateKey(now), current: status.current, longest: status.longest },
      status,
    };
  }
  return {
    record: { lastClaimDate: localDateKey(now), current: status.current, longest: status.longest },
    status,
  };
}
