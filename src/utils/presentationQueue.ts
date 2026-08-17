/**
 * Post-advance presentation queue (G3).
 *
 * One Advance Week can make many independent overlays eligible at once
 * (weekly digest, celebrations, achievements, press conference, transfer
 * talk, board warning, …). Historically the Dashboard rendered all of them
 * simultaneously — a stack of dismiss-tap modals with haptics firing for
 * ones the player couldn't even see.
 *
 * This module owns the ORDERING only. Overlays register their "I want to
 * show" intent with the coordinator (see `usePresentationQueue`); the
 * coordinator asks `resolveActiveOverlay` which single one wins. Because
 * eligibility is derived from live state, dismissing the active overlay
 * (which clears its pending flag / closes it) reactively promotes the next
 * one — no explicit queue-advance bookkeeping, no persisted state.
 *
 * Priority order rationale (front = shown first):
 *   1. sessionRecap   — "welcome back" context for a returning player.
 *   2. weeklyDigest   — the factual summary of the week that just advanced.
 *   3. midSeason      — the once-per-season mid-season report.
 *   4. trophyLift     — a confirmed trophy (league title / domestic cup): the
 *      biggest positive beat, ahead of the generic celebration modal.
 *   5. celebration    — positive reinforcement, AFTER the digest facts.
 *   6. achievement    — same, stacked behind celebrations.
 *   6. gemReveal      — a scouting reveal the player will act on.
 *   7. nationalTeamOffer / pressConference / storyline / transferTalk —
 *      blocking narrative/decision modals; grouped after the reward beats so
 *      the player sees what happened before being asked to decide.
 *   8. farewell       — departures; informational, low urgency.
 *   9. dailyReward    — the meta daily-login reward, after in-fiction beats.
 *  10. adOffer        — rewarded-ad offer, dead last: it may fill a gap but
 *      must never interrupt a beat the player cares about.
 */

export type OverlayId =
  | 'sessionRecap'
  | 'weeklyDigest'
  | 'midSeason'
  | 'trophyLift'
  | 'celebration'
  | 'achievement'
  | 'gemReveal'
  | 'nationalTeamOffer'
  | 'pressConference'
  | 'storyline'
  | 'transferTalk'
  | 'farewell'
  | 'notifPrompt'
  | 'dailyReward'
  | 'adOffer';

export const PRESENTATION_ORDER: OverlayId[] = [
  'sessionRecap',
  'weeklyDigest',
  'midSeason',
  'trophyLift',
  'celebration',
  'achievement',
  'gemReveal',
  'nationalTeamOffer',
  'pressConference',
  'storyline',
  'transferTalk',
  'farewell',
  // boardWarning is intentionally absent: it's an inline banner, and queueing
  // it starved lower-ranked overlays for entire low-confidence spells.
  // Notification permission ask — after in-fiction beats (incl. the first-win
  // celebration) so the player sees the win before being asked; before the
  // meta daily reward.
  'notifPrompt',
  'dailyReward',
  // Rewarded-ad offer — DEAD LAST, deliberately. An ad prompt must never
  // preempt a trophy lift, a sacking, a press conference or a daily reward.
  // It fills a gap when nothing in-fiction wants the screen; it never
  // interrupts. Moving this up the list trades D7 retention (a 2026 App Store
  // ranking input) for a few impressions — a bad trade at any ad rate.
  'adOffer',
];

/**
 * Given the set of currently-registered (wanting-to-show) overlay ids,
 * return the single highest-priority one, or null if none.
 *
 * Unknown ids (defensive — should never happen) sort last but never crash.
 * Pure + synchronous so the ordering is unit-testable in isolation.
 */
export function resolveActiveOverlay(registered: Iterable<string>): OverlayId | null {
  let best: OverlayId | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const id of registered) {
    const rank = PRESENTATION_ORDER.indexOf(id as OverlayId);
    const effectiveRank = rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
    if (effectiveRank < bestRank) {
      bestRank = effectiveRank;
      best = rank === -1 ? null : (id as OverlayId);
    }
  }
  return best;
}

// `buildQueue` / `nextOverlay` used to live here: two re-expressions of
// `resolveActiveOverlay`, self-described as "for previewing and tests", with no
// production caller. A second implementation of the ordering rule is a second
// place for it to be wrong.

