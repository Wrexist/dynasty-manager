/**
 * Pack open-limit accounting.
 *
 * Different pack tiers cap free / ad opens over different real-world
 * windows — bronze ad opens reset daily, the silver free pack resets
 * weekly, the gold ad pack resets monthly. Each window needs its own
 * auto-resetting bucket (a bucket has one period key, so one bucket can
 * only model one reset cadence).
 *
 * This module is the single source of truth for resolving which window a
 * tier+method uses, counting opens against it, and recording a new open.
 * Both `packsSlice` and `PacksPage` go through here so the eligibility
 * pre-flight and the UI always agree.
 */
import type { PackTierDefinition, PackTierKey } from '@/types/game';

export type PackPeriod = 'day' | 'week' | 'month';

/** Methods whose opens are counted against a cap. `iap` / `currency` are
 *  uncapped and never tracked here. */
type CountedMethod = 'free' | 'ad';

/** A per-tier open-count bucket for one period. `free` / `ad` count opens
 *  by tier; the bucket is considered empty once its key no longer matches
 *  the current period (implicit reset — no scheduled job needed). */
type TierCounts = Partial<Record<PackTierKey, number>>;

export interface PackOpenBuckets {
  /** Daily bucket — key is an ISO `YYYY-MM-DD` device-local date. */
  dailyPackOpens: { date: string; free: TierCounts; ad: TierCounts };
  /** Weekly bucket — key is `YYYY-Www` (ISO week of the device-local date). */
  weeklyPackOpens: { week: string; free: TierCounts; ad: TierCounts };
  /** Monthly bucket — key is `YYYY-MM` of the device-local date. */
  monthlyPackOpens: { month: string; free: TierCounts; ad: TierCounts };
}

/** Device-local `YYYY-MM-DD`. */
export function dayKey(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Device-local `YYYY-MM`. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** ISO-8601 week key, `YYYY-Www`, of the device-local calendar date. */
export function weekKey(d: Date = new Date()): string {
  // Treat the local calendar date as a UTC date for the ISO-week math so
  // DST shifts can't nudge a day into the wrong week.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // shift to the week's Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + firstDayNum) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function currentKey(period: PackPeriod, now: Date = new Date()): string {
  if (period === 'day') return dayKey(now);
  if (period === 'week') return weekKey(now);
  return monthKey(now);
}

/**
 * Resolve which cap + reset period applies to a free or ad open for this
 * tier. A weekly free limit takes precedence over a daily one (and a
 * monthly ad limit over a daily one) when both happen to be set. Returns
 * `null` when the tier does not support the method at all.
 */
export function resolvePackLimit(
  tier: PackTierDefinition,
  method: CountedMethod,
): { limit: number; period: PackPeriod } | null {
  if (method === 'free') {
    if ((tier.freeWeeklyLimit ?? 0) > 0) return { limit: tier.freeWeeklyLimit!, period: 'week' };
    if ((tier.freeDailyLimit ?? 0) > 0) return { limit: tier.freeDailyLimit!, period: 'day' };
    return null;
  }
  if ((tier.adMonthlyLimit ?? 0) > 0) return { limit: tier.adMonthlyLimit!, period: 'month' };
  if ((tier.adDailyLimit ?? 0) > 0) return { limit: tier.adDailyLimit!, period: 'day' };
  return null;
}

/** Human-readable name of a period, for user-facing cap messages. */
export function periodLabel(period: PackPeriod): string {
  return period === 'day' ? 'day' : period === 'week' ? 'week' : 'month';
}

function bucketState(buckets: PackOpenBuckets, period: PackPeriod) {
  if (period === 'day') {
    const b = buckets.dailyPackOpens;
    return { storedKey: b?.date ?? '', free: b?.free ?? {}, ad: b?.ad ?? {} };
  }
  if (period === 'week') {
    const b = buckets.weeklyPackOpens;
    return { storedKey: b?.week ?? '', free: b?.free ?? {}, ad: b?.ad ?? {} };
  }
  const b = buckets.monthlyPackOpens;
  return { storedKey: b?.month ?? '', free: b?.free ?? {}, ad: b?.ad ?? {} };
}

/** Opens already used for tier+method in the current (auto-resetting)
 *  window. Returns 0 if the method is unsupported or the bucket is stale. */
export function packOpensUsed(
  buckets: PackOpenBuckets,
  tier: PackTierDefinition,
  method: CountedMethod,
  now: Date = new Date(),
): number {
  const lim = resolvePackLimit(tier, method);
  if (!lim) return 0;
  const b = bucketState(buckets, lim.period);
  if (b.storedKey !== currentKey(lim.period, now)) return 0;
  return (method === 'free' ? b.free : b.ad)[tier.key] ?? 0;
}

/** Opens still available for tier+method in the current window. 0 when the
 *  tier does not support the method. */
export function packOpensRemaining(
  buckets: PackOpenBuckets,
  tier: PackTierDefinition,
  method: CountedMethod,
  now: Date = new Date(),
): number {
  const lim = resolvePackLimit(tier, method);
  if (!lim) return 0;
  return Math.max(0, lim.limit - packOpensUsed(buckets, tier, method, now));
}

/**
 * Record one free/ad open. Returns the bucket field(s) to spread into the
 * Zustand `set()` — only the affected period bucket changes. A no-op
 * (`{}`) when the method is uncapped. Stale buckets are reset as part of
 * the write so counts never leak across a period boundary.
 */
export function recordPackOpen(
  buckets: PackOpenBuckets,
  tier: PackTierDefinition,
  method: CountedMethod,
  now: Date = new Date(),
): Partial<PackOpenBuckets> {
  const lim = resolvePackLimit(tier, method);
  if (!lim) return {};
  const key = currentKey(lim.period, now);
  const b = bucketState(buckets, lim.period);
  const fresh = b.storedKey === key;
  const free: TierCounts = fresh ? { ...b.free } : {};
  const ad: TierCounts = fresh ? { ...b.ad } : {};
  const target = method === 'free' ? free : ad;
  target[tier.key] = (target[tier.key] ?? 0) + 1;

  if (lim.period === 'day') return { dailyPackOpens: { date: key, free, ad } };
  if (lim.period === 'week') return { weeklyPackOpens: { week: key, free, ad } };
  return { monthlyPackOpens: { month: key, free, ad } };
}

/** Fresh, empty bucket set — used by `initGame` and save defaults. */
export function emptyPackOpenBuckets(): PackOpenBuckets {
  return {
    dailyPackOpens: { date: '', free: {}, ad: {} },
    weeklyPackOpens: { week: '', free: {}, ad: {} },
    monthlyPackOpens: { month: '', free: {}, ad: {} },
  };
}
