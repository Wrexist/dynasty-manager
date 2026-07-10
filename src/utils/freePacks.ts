/**
 * Free-daily-pack availability (G5).
 *
 * Pure helper so the Dashboard can surface an "unclaimed free pack today"
 * indicator without pulling the whole packs slice. Mirrors `packsSlice`'s
 * real-date bucketing: a free open resets when the device's local calendar day
 * rolls over.
 */
import { PACK_TIERS } from '@/config/packs';
import type { PackTierKey } from '@/types/game';
import { localDateKey } from '@/utils/dailyStreak';

export interface DailyPackOpensLike {
  date: string;
  free: Partial<Record<PackTierKey, number>>;
  ad?: Partial<Record<PackTierKey, number>>;
}

/** True when at least one free-daily pack tier still has a free open left today.
 *  A rolled-over (or missing) date bucket means every free tier is available. */
export function hasUnclaimedFreeDailyPack(
  dailyPackOpens: DailyPackOpensLike | null | undefined,
  now: Date = new Date(),
): boolean {
  const today = localDateKey(now);
  const free = dailyPackOpens && dailyPackOpens.date === today ? (dailyPackOpens.free || {}) : {};
  return PACK_TIERS.some(t => {
    const limit = t.freeDailyLimit ?? 0;
    if (limit <= 0) return false;
    return (free[t.key] || 0) < limit;
  });
}
