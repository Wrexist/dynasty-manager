/**
 * Rewarded-ad prompt pacing.
 *
 * Pure functions only — no store access, no side effects — so the escalation
 * rules are testable in isolation and can be reasoned about without running
 * the app. The slice owns the state transitions; this file owns the decisions.
 *
 * See `config/ads.ts` for the pacing philosophy and why the caps exist.
 */

import type { AdEngagementState, MonetizationState } from '@/types/game';
import { AD_PACING, dailyPromptAllowance, promptGapMs } from '@/config/ads';
import { DEFAULT_AD_ENGAGEMENT } from '@/config/monetization';
import { isPro } from '@/utils/monetization';

/** Local calendar day key. Local, not UTC: "today" must mean the player's
 *  today, or counters roll mid-evening for anyone east of Greenwich. */
export function dayKeyFor(now: number): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Normalise a possibly-missing / malformed engagement block. */
export function safeEngagement(e: AdEngagementState | undefined | null): AdEngagementState {
  if (!e || typeof e !== 'object') return { ...DEFAULT_AD_ENGAGEMENT };
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    dayKey: typeof e.dayKey === 'string' ? e.dayKey : '',
    watchedToday: num(e.watchedToday),
    promptsToday: num(e.promptsToday),
    consecutiveDismissals: num(e.consecutiveDismissals),
    lastPromptAt: num(e.lastPromptAt),
    totalWatched: num(e.totalWatched),
  };
}

/**
 * Roll the daily counters if the calendar day changed.
 *
 * `consecutiveDismissals` deliberately SURVIVES the rollover. It measures
 * sustained disinterest, not today's mood — a player who dismissed five times
 * yesterday should not be greeted by a full-strength allowance this morning.
 * A completed watch is the only thing that clears it.
 *
 * `totalWatched` is lifetime and never rolls.
 */
export function rollDay(e: AdEngagementState, now: number): AdEngagementState {
  const key = dayKeyFor(now);
  if (e.dayKey === key) return e;
  return { ...e, dayKey: key, watchedToday: 0, promptsToday: 0 };
}

export interface PromptDecision {
  allowed: boolean;
  /** Why not, for diagnostics and tests. */
  reason?: 'ads_unavailable' | 'daily_cap' | 'cooldown';
  /** Today's allowance after escalation/decay — useful for debug surfaces. */
  allowance: number;
}

/**
 * May we raise an ad prompt right now?
 *
 * `adsUsable` is passed in rather than imported so this stays pure and the
 * caller owns the SDK-readiness question (see `REWARDED_ADS_USABLE`).
 */
export function canPrompt(
  monetization: MonetizationState,
  now: number,
  adsUsable: boolean,
): PromptDecision {
  const pro = isPro(monetization);
  const e = rollDay(safeEngagement(monetization.adEngagement), now);
  const allowance = dailyPromptAllowance(e.watchedToday, e.consecutiveDismissals, pro);

  // The reward economy is gated for BOTH cohorts on the ad SDK being real.
  //
  // It is tempting to let Pro through here — they never watch a video, so the
  // SDK is not technically required for them. That would be a hard-rule
  // violation: `transfer_budget` grants in-game money, so shipping it to Pro
  // while free users can earn nothing is a paid economic advantage, i.e.
  // pay-to-win, which the header contracts in config/monetization.ts and
  // utils/monetization.ts forbid. It is the exact failure that made the
  // rewards Pro-only the last time ads were half-wired.
  //
  // Pro's entitlement is SKIPPING THE VIDEO, not getting rewards nobody else
  // can reach. Both cohorts unlock together the moment a real showRewardedAd()
  // ships.
  if (!adsUsable) return { allowed: false, reason: 'ads_unavailable', allowance };

  if (e.promptsToday >= allowance) return { allowed: false, reason: 'daily_cap', allowance };

  const gap = promptGapMs(pro);
  if (e.lastPromptAt > 0 && now - e.lastPromptAt < gap) {
    return { allowed: false, reason: 'cooldown', allowance };
  }

  return { allowed: true, allowance };
}

/** Record that a prompt was shown. */
export function withPromptShown(e: AdEngagementState, now: number): AdEngagementState {
  const rolled = rollDay(safeEngagement(e), now);
  return { ...rolled, promptsToday: rolled.promptsToday + 1, lastPromptAt: now };
}

/** Record a completed watch (or a Pro direct claim). Clears the dismissal
 *  streak — engagement is the signal that resets the decay. */
export function withWatchCompleted(e: AdEngagementState, now: number): AdEngagementState {
  const rolled = rollDay(safeEngagement(e), now);
  return {
    ...rolled,
    watchedToday: rolled.watchedToday + 1,
    totalWatched: rolled.totalWatched + 1,
    consecutiveDismissals: 0,
  };
}

/** Record a dismissal. Raises the decay counter so the next allowance is
 *  smaller — a player who keeps saying no is asked less often. */
export function withPromptDismissed(e: AdEngagementState, now: number): AdEngagementState {
  const rolled = rollDay(safeEngagement(e), now);
  return { ...rolled, consecutiveDismissals: rolled.consecutiveDismissals + 1 };
}

/** Prompts left today. Debug/settings surfaces only. */
export function promptsRemainingToday(monetization: MonetizationState, now: number): number {
  const pro = isPro(monetization);
  const e = rollDay(safeEngagement(monetization.adEngagement), now);
  const allowance = dailyPromptAllowance(e.watchedToday, e.consecutiveDismissals, pro);
  return Math.max(0, allowance - e.promptsToday);
}

export { AD_PACING };
