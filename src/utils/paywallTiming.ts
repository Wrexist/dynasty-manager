import type { MonetizationState, Match } from '@/types/game';
import { isPro, isSubscriptionActive } from '@/utils/monetization';

/**
 * When does the Pro paywall appear?
 *
 * G1 killed the cold-open paywall: New Game routes straight into gameplay.
 * The subscription onboarding is now deferred to the first moment of
 * demonstrated value — the player is back on the Dashboard after completing
 * (and dismissing) their first-ever match. These pure helpers encode that
 * timing so the decision is unit-testable outside of GameShell.
 *
 * Callers ALSO gate on a once-per-mount ref and set the persisted
 * `SUBSCRIBE_ONBOARDING_SEEN` flag when firing, so the paywall auto-appears
 * exactly once, ever.
 */

export interface FirstMatchPaywallInput {
  /** The active in-game screen (`GameShell` currentScreen). */
  currentScreen: string;
  monetization: MonetizationState;
  fixtures: Match[];
  playerClubId: string;
  /** The last committed match result — set after any match (club or WC). */
  currentMatchResult: unknown | null;
  /** Whether the device has already seen the subscription onboarding. */
  onboardingSeen: boolean;
}

/** True once the player has completed at least one match, in any mode. Club
 *  modes surface it as a played fixture; World Cup mode has no `fixtures`
 *  entry for the tie, so a committed `currentMatchResult` counts too. */
export function hasCompletedFirstMatch(i: {
  fixtures: Match[];
  playerClubId: string;
  currentMatchResult: unknown | null;
}): boolean {
  if (i.currentMatchResult) return true;
  return (i.fixtures || []).some(
    m => m.played && (m.homeClubId === i.playerClubId || m.awayClubId === i.playerClubId),
  );
}

/** Decide whether to present the value-timed Pro paywall now. Only fires on
 *  the Dashboard, for non-Pro users who haven't seen it, once a first match
 *  is in the books. Never interrupts the match/post-match flow because those
 *  live on other screens (`match` / `match-review`). */
export function shouldFireFirstMatchPaywall(i: FirstMatchPaywallInput): boolean {
  if (i.currentScreen !== 'dashboard') return false;
  if (i.onboardingSeen) return false;
  if (isPro(i.monetization) || isSubscriptionActive(i.monetization)) return false;
  return hasCompletedFirstMatch(i);
}

export interface SubscribeNavState {
  slot?: number;
  returnTo?: string;
}

/**
 * True when `SubscribeOnboarding` was reached without a save slot AND without
 * an explicit in-app return context — i.e. a WKWebView reload / deep link on
 * `#/subscribe` that lost its navigation state. Proceeding would default the
 * slot to 1 and let the onboarding continuation (`returnTo: '/mode-select'`)
 * silently overwrite save slot 1, so the screen redirects to the title
 * instead. In-app upsells (Shop / Settings) pass an explicit `returnTo`
 * (`/game` or `/`) that never enters club setup, so they need no slot.
 */
export function subscribeSlotContextMissing(nav: SubscribeNavState): boolean {
  const returnTo = nav.returnTo || '/mode-select';
  return nav.slot == null && returnTo === '/mode-select';
}
