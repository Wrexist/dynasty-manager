// Native App Store / Google Play in-app review prompt.
//
// Wraps `SKStoreReviewController.requestReview` (iOS) and the Google Play
// In-App Review API (Android) via `@capacitor-community/in-app-review`. The
// OS shows a one-tap 5-star sheet without leaving the game, but Apple
// already throttles to ~3 prompts per 365 days and silently drops calls
// that exceed that cap — we can't tell whether the sheet actually appeared.
//
// Apple shows the sheet at most 3 times per 365 days, so the job is to spend
// those 3 on the best moments, not to ask often. Our gating on top:
//   • Min 30 days between requests
//   • At most 3 requests in any rolling 365 days — Apple's own budget. There
//     is no lifetime cap: the quota renews, and a player in their second year
//     is the most likely 5-star review we have.
//   • Native platforms only (web no-ops cleanly)
//   • Caller is responsible for picking a high-emotion moment — see
//     `isReviewWorthyMatchWin` and `isCelebratorySeason`.
//
// Guideline 5.6.1: the request must be the system sheet. No custom pre-prompt
// ("Enjoying the game?") that routes only happy players to it — that is review
// gating, and Apple rejects for it. Timing is the only lever, and it is legal.

import { Capacitor } from '@capacitor/core';
import type { PackTierKey } from '@/types/game';
import { readAppReviewState, writeAppReviewState } from '@/store/helpers/persistence';
import type { AppReviewState } from '@/store/helpers/persistence';

export const MIN_DAYS_BETWEEN_PROMPTS = 30;
export const MAX_PROMPTS_PER_YEAR = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365 * MS_PER_DAY;

export type ReviewTrigger =
  | 'season-end-title'
  | 'season-end-promotion'
  | 'season-end-trophy'
  | 'season-end-celebratory'
  | 'pack-elite-open'
  | 'match-win';

/** Any win from this career win on is worth asking after. The season-end and
 *  paid-pack moments alone reached almost nobody (5 ratings in the store as of
 *  2026-10-11): most players never finish a season. */
export const REVIEW_MIN_CAREER_WINS = 3;
/** A standout win — by this margin, or a cup tie — qualifies one win earlier. */
export const REVIEW_STANDOUT_WIN_MARGIN = 2;

export interface MatchReviewContext {
  won: boolean;
  /** Career wins including this one (`managerStats.totalWins`). */
  totalWins: number;
  /** Goals for minus goals against (0 for a shootout win). */
  margin: number;
  /** Cup, continental or other non-league match. */
  isCupMatch: boolean;
}

/** True iff this result is a good moment to ask. Never the first win: that
 *  moment belongs to the notification ask, and two system sheets back to back
 *  read as nagging. A standout second win (big margin or a cup tie) qualifies;
 *  from the third win on, any win does. Throttling is `maybeRequestReview`'s
 *  job, so this may fire on every qualifying win. */
export function isReviewWorthyMatchWin(ctx: MatchReviewContext): boolean {
  if (!ctx.won || ctx.totalWins < 2) return false;
  if (ctx.totalWins >= REVIEW_MIN_CAREER_WINS) return true;
  return ctx.margin >= REVIEW_STANDOUT_WIN_MARGIN || ctx.isCupMatch;
}

/** Requests inside the last year, oldest first. Pre-2026-10 states recorded
 *  only `lastShownAt`; it counts as one request. */
function recentRequests(state: AppReviewState, now: number): number[] {
  const all = state.shownAt ?? (state.lastShownAt > 0 ? [state.lastShownAt] : []);
  return all.filter(t => now - t < MS_PER_YEAR).sort((a, b) => a - b);
}

/** Pure gate: may we call the OS right now? */
export function canRequestReview(state: AppReviewState, now: number): boolean {
  const recent = recentRequests(state, now);
  if (recent.length >= MAX_PROMPTS_PER_YEAR) return false;
  const last = recent[recent.length - 1] ?? 0;
  return last === 0 || (now - last) / MS_PER_DAY >= MIN_DAYS_BETWEEN_PROMPTS;
}

/** Pack tiers high-emotion enough to be worth a review prompt: the PAID tiers,
 *  which are 5-card reveals with a 78+ floor and walkout odds. `daily` is the
 *  free pack a player opens every single day — never prompt on it, or we burn
 *  Apple's 3-per-365 quota on the most routine moment in the game. (Bronze and
 *  Silver are archived and unobtainable; they stay out for the same reason.) */
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
  const now = Date.now();
  if (!canRequestReview(state, now)) return false;

  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    writeAppReviewState({
      count: state.count + 1,
      lastShownAt: now,
      lastReason: reason,
      shownAt: [...recentRequests(state, now), now],
    });
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[appReview] requestReview failed', err);
    }
    return false;
  }
}
