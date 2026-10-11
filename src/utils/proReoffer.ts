// Dynasty Pro re-offer at high points, and a free Optimize Lineup after a loss.
//
// The full paywall auto-presents once per device, on the first New Game,
// before any gameplay. A player who taps "Continue Free" there only meets it
// again by tapping a Pro feature. These two levers push harder at better moments:
//
//  • Re-offer: the in-app paywall again, at a high point (a league win streak,
//    or a season worth celebrating), never in the first day, at most once per
//    `PRO_REOFFER_MIN_GAP_DAYS` and `PRO_REOFFER_MAX_TOTAL` times per device, and
//    only while no subscription record exists (the store still decides the
//    trial on the paywall itself).
//  • After a loss: never a paywall. Pro does not change results, so selling it
//    to a frustrated player implies a promise it cannot keep. Instead the player
//    gets one free use of Optimize Lineup, so they see what Pro does.
//
// Monetization contract: nothing here reads or writes a sim parameter.
// Optimize Lineup only picks a lineup the player could pick by hand.

import type { MonetizationState } from '@/types/game';
import { isPro } from '@/utils/monetization';
import {
  getFlag, setFlag, STORAGE_KEYS, readProReofferState, writeProReofferState,
} from '@/store/helpers/persistence';
import {
  PRO_REOFFER_MIN_GAP_DAYS, PRO_REOFFER_MAX_TOTAL, PRO_REOFFER_MIN_ACCOUNT_AGE_HOURS, PRO_REOFFER_WIN_STREAK,
} from '@/config/monetization';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** True iff the last `PRO_REOFFER_WIN_STREAK` league results are all wins.
 *  `form` is the league table's, oldest first. */
export function isWinStreak(form: readonly ('W' | 'D' | 'L')[] | undefined): boolean {
  if (!form || form.length < PRO_REOFFER_WIN_STREAK) return false;
  return form.slice(-PRO_REOFFER_WIN_STREAK).every(r => r === 'W');
}

/** May the paywall be re-offered right now? Pure apart from device storage. */
export function canReofferPro(monetization: MonetizationState, now: number = Date.now()): boolean {
  if (isPro(monetization)) return false;
  // Any subscription record means the intro trial is spent or running.
  if (monetization.subscription != null) return false;
  // The cold-open must have happened: the re-offer is the second ask, not the first.
  if (!getFlag(STORAGE_KEYS.SUBSCRIBE_ONBOARDING_SEEN)) return false;
  // Not on day one: the player has only just said "Continue Free".
  const firstLaunch = monetization.firstLaunchTimestamp ?? 0;
  if (firstLaunch <= 0 || now - firstLaunch < PRO_REOFFER_MIN_ACCOUNT_AGE_HOURS * MS_PER_HOUR) return false;
  const state = readProReofferState();
  if (state.count >= PRO_REOFFER_MAX_TOTAL) return false;
  return state.lastAt <= 0 || now - state.lastAt >= PRO_REOFFER_MIN_GAP_DAYS * MS_PER_DAY;
}

export function recordProReoffer(now: number = Date.now()): void {
  const state = readProReofferState();
  writeProReofferState({ count: state.count + 1, lastAt: now });
}

// ── Free Optimize Lineup after a loss ──

/** Grant the one free Optimize Lineup try, after a loss, to a non-Pro player
 *  who has never had it. Idempotent. */
export function grantFreeOptimizeTry(monetization: MonetizationState): void {
  if (isPro(monetization)) return;
  if (getFlag(STORAGE_KEYS.FREE_OPTIMIZE_GRANTED)) return;
  setFlag(STORAGE_KEYS.FREE_OPTIMIZE_GRANTED);
}

/** True while the granted try has not been used. */
export function hasFreeOptimizeTry(): boolean {
  return getFlag(STORAGE_KEYS.FREE_OPTIMIZE_GRANTED) && !getFlag(STORAGE_KEYS.FREE_OPTIMIZE_USED);
}

export function consumeFreeOptimizeTry(): void {
  setFlag(STORAGE_KEYS.FREE_OPTIMIZE_USED);
}
