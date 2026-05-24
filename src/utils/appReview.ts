// Native App Store / Google Play in-app review prompt.
//
// Wraps `SKStoreReviewController.requestReview` (iOS) and the Google Play
// In-App Review API (Android) via `@capacitor-community/in-app-review`. The
// OS shows a one-tap 5-star sheet without leaving the game, but Apple
// already throttles to ~3 prompts per 365 days and silently drops calls
// that exceed that cap — we can't tell whether the sheet actually appeared.
//
// To avoid burning Apple's 3-per-year quota on mediocre moments, we layer
// our own gating on top:
//   • Min 60 days between requests
//   • Hard ceiling of 4 lifetime requests per install
//   • Native platforms only (web no-ops cleanly)
//   • Caller is responsible for picking a high-emotion moment — see
//     `isCelebratorySeason` for the canonical "good moment" check.

import { Capacitor } from '@capacitor/core';
import type { PackTierKey } from '@/types/game';
import { readAppReviewState, writeAppReviewState } from '@/store/helpers/persistence';

const MIN_DAYS_BETWEEN_PROMPTS = 60;
const MAX_LIFETIME_PROMPTS = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReviewTrigger =
  | 'season-end-title'
  | 'season-end-promotion'
  | 'season-end-trophy'
  | 'season-end-celebratory'
  | 'pack-elite-open';

/** Pack tiers high-emotion enough to be worth a review prompt: Gold and
 *  above are 5-card reveals with a 78+ guarantee, and the paid tiers carry
 *  walkout odds. Bronze/Silver are low-stakes free dailies — never prompt
 *  on those, or we'd burn Apple's 3-per-365 quota on a routine moment. */
const REVIEW_WORTHY_PACK_TIERS: ReadonlySet<PackTierKey> = new Set<PackTierKey>([
  'gold', 'premium', 'rare', 'icon',
]);

/** True iff opening a pack of this tier is a good moment to ask for a review. */
export function isReviewWorthyPackTier(tier: PackTierKey): boolean {
  return REVIEW_WORTHY_PACK_TIERS.has(tier);
}

/** Subset of SeasonHistoryEntry fields we need to decide if it's a good moment. */
export interface SeasonReviewContext {
  position: number;
  promoted?: boolean;
  cupResult?: string;
  leagueCupResult?: string;
  championsCupResult?: string;
  shieldCupResult?: string;
  conferenceCupResult?: string;
}

/** True iff the player just had a season worth celebrating: won the league,
 *  earned promotion, or lifted any cup. Mediocre or bad seasons return
 *  false so we don't ask for a review at the wrong time. */
export function isCelebratorySeason(ctx: SeasonReviewContext): boolean {
  if (ctx.position === 1) return true;
  if (ctx.promoted) return true;
  const cups = [
    ctx.cupResult,
    ctx.leagueCupResult,
    ctx.championsCupResult,
    ctx.shieldCupResult,
    ctx.conferenceCupResult,
  ];
  return cups.some(r => r === 'Winner');
}

/** Map a season context to the most specific trigger label for analytics. */
export function pickSeasonReviewTrigger(ctx: SeasonReviewContext): ReviewTrigger {
  if (ctx.position === 1) return 'season-end-title';
  if (ctx.promoted) return 'season-end-promotion';
  return 'season-end-trophy';
}

/** Request the native review sheet if all gating conditions are met. The
 *  promise resolves to `true` if the call was actually dispatched to the OS
 *  (the OS may still suppress it), or `false` if we self-throttled or are
 *  on a non-native platform. Never throws — a broken plugin never breaks
 *  the surrounding flow. */
export async function maybeRequestReview(reason: ReviewTrigger): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const state = readAppReviewState();
  if (state.count >= MAX_LIFETIME_PROMPTS) return false;

  const now = Date.now();
  if (state.lastShownAt > 0) {
    const daysSinceLast = (now - state.lastShownAt) / MS_PER_DAY;
    if (daysSinceLast < MIN_DAYS_BETWEEN_PROMPTS) return false;
  }

  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    writeAppReviewState({
      count: state.count + 1,
      lastShownAt: now,
      lastReason: reason,
    });
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[appReview] requestReview failed', err);
    }
    return false;
  }
}
