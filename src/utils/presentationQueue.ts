/**
 * Post-advance presentation queue (G3).
 *
 * One Advance Week can make many independent overlays eligible at once
 * (weekly digest, celebrations, achievements, press conference, transfer
 * talk, board warning, …). Historically the Dashboard rendered all of them
 * simultaneously — a stack of dismiss-tap modals with haptics firing for
 * ones the player couldn't even see.
 *
 * This module owns the ORDERING and the per-advance CAP. Overlays register
 * their "I want to show" intent with the coordinator (see
 * `usePresentationQueue`); the coordinator asks `planPresentation` which
 * single one wins and which ones went past the cap. Because
 * eligibility is derived from live state, dismissing the active overlay
 * (which clears its pending flag / closes it) reactively promotes the next
 * one — no explicit queue-advance bookkeeping, no persisted state.
 *
 * Priority order rationale (front = shown first):
 *   1. nationalTeamOffer / pressConference / storyline / transferTalk —
 *      DECISIONS. They go first because the per-advance cap (below) spends its
 *      budget front to back: a decision is the one thing that cannot be turned
 *      into an inbox message without silently choosing for the player, so it
 *      must never be the item squeezed out. (They used to sit after the reward
 *      beats "so the player sees what happened first"; the digest is still one
 *      tap away in the inbox if it overflows.)
 *   2. sessionRecap   — "welcome back" context for a returning player.
 *   3. weeklyDigest   — the factual summary of the week that just advanced.
 *   4. midSeason      — the once-per-season mid-season report.
 *   5. trophyLift     — a confirmed trophy (league title / domestic cup): the
 *      biggest positive beat, ahead of the generic celebration modal.
 *   6. celebration    — positive reinforcement, AFTER the digest facts.
 *   7. achievement    — same, stacked behind celebrations.
 *   8. gemReveal      — a scouting reveal the player will act on.
 *   9. farewell       — departures; informational, low urgency.
 *  10. notifPrompt / dailyReward — meta, after in-fiction beats.
 *  11. adOffer / packOffer — commercial, dead last: they may fill a gap but
 *      must never interrupt a beat the player cares about.
 *
 * Per-advance cap. Showing one popup at a time was not enough: after a match
 * the chain could still run press conference → celebration → achievement →
 * digest → storyline → pack offer, six dismiss-taps before the player could
 * play. `planPresentation` spends a budget of `BLOCKING_POPUPS_PER_ADVANCE`
 * per advance (the coordinator keys the ledger on season + week). What
 * happens to an overlay past the budget is its `OVERLAY_OVERFLOW` policy:
 *   - 'never' — always shown (decisions, trophy lifts, the once-a-session
 *               recap, the daily streak reward whose modal is its only claim
 *               point). It still spends budget.
 *   - 'inbox' — filed as an inbox message and cleared. Nothing is lost, only
 *               the interruption. Needs a converter registered by whoever owns
 *               the overlay's state; without one it is shown instead.
 *   - 'defer' — skipped for this advance and reconsidered after the next one
 *               (permission asks and offers: an inbox message would be spam).
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
  | 'adOffer'
  | 'packOffer';

export const PRESENTATION_ORDER: OverlayId[] = [
  // Decisions — first, so the cap can never squeeze one out (see header).
  'nationalTeamOffer',
  'pressConference',
  'storyline',
  'transferTalk',
  'sessionRecap',
  'weeklyDigest',
  'midSeason',
  'trophyLift',
  'celebration',
  'achievement',
  'gemReveal',
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
  'packOffer',
];

export type OverflowPolicy = 'never' | 'inbox' | 'defer';

/** What happens to an overlay that would take the advance past its cap. */
export const OVERLAY_OVERFLOW: Record<OverlayId, OverflowPolicy> = {
  nationalTeamOffer: 'never',
  pressConference: 'never',
  storyline: 'never',
  transferTalk: 'never',
  // At most once a session, on launch — context for a returning player, not
  // something one advance piles on.
  sessionRecap: 'never',
  weeklyDigest: 'inbox',
  midSeason: 'inbox',
  // Once or twice a season, and the ceremony IS the reward.
  trophyLift: 'never',
  celebration: 'inbox',
  achievement: 'inbox',
  gemReveal: 'inbox',
  farewell: 'inbox',
  // Fires once per career, on the first win, from a flag held only in memory:
  // deferring it past a busy advance lost the ask on the next relaunch, or
  // showed its "Great win!" copy weeks later. Low priority, never suppressed.
  notifPrompt: 'never',
  // The modal is the only place the streak reward can be claimed; suppressing
  // it could cost the player a streak day.
  dailyReward: 'never',
  adOffer: 'defer',
  packOffer: 'defer',
};

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

// ── Per-advance cap ──

export interface PresentationLedger {
  /** Overlays that have been on screen during the current advance. */
  shown: ReadonlySet<string>;
  /** Overlays pushed past the cap during the current advance. */
  suppressed: ReadonlySet<string>;
}

export interface PresentationPlan {
  /** The single overlay to show now, or null. */
  active: OverlayId | null;
  /** Overlays that just went past the cap, in priority order. The caller files
   *  the 'inbox' ones and marks all of them suppressed for this advance. */
  overflow: OverlayId[];
}

function rankOf(id: string): number {
  const rank = PRESENTATION_ORDER.indexOf(id as OverlayId);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

/**
 * Pick the overlay to show under a per-advance cap of `cap` distinct overlays.
 *
 * Walks the registrants in priority order. An overlay already shown this
 * advance keeps its slot (it is on screen, or a second instance of one that
 * was); a 'never' overlay always gets one; anything else gets one only while
 * fewer than `cap` overlays have been shown. The rest are overflow — reported
 * once, so the caller can file or defer them. An 'inbox' overlay nobody can
 * file (`canFile` false) is treated as 'never': shown rather than lost.
 *
 * Pure: the caller owns the ledger and records the result.
 */
export function planPresentation(
  registered: Iterable<string>,
  ledger: PresentationLedger,
  cap: number,
  canFile: (id: OverlayId) => boolean,
): PresentationPlan {
  const candidates = [...new Set(registered)]
    .filter(id => rankOf(id) !== Number.MAX_SAFE_INTEGER && !ledger.suppressed.has(id))
    .sort((a, b) => rankOf(a) - rankOf(b)) as OverlayId[];
  const overflow: OverlayId[] = [];
  for (const id of candidates) {
    if (ledger.shown.has(id)) return { active: id, overflow };
    let policy = OVERLAY_OVERFLOW[id];
    if (policy === 'inbox' && !canFile(id)) policy = 'never';
    if (policy === 'never' || ledger.shown.size < cap) return { active: id, overflow };
    overflow.push(id);
  }
  return { active: null, overflow };
}

