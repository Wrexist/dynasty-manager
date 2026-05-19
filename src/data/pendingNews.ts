/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dynasty Manager — Pending "What's New" bullets (next, unshipped version)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bullets accumulate here during development of the *next* version. When
 * `package.json.version` advances past the top entry of `whatsNew.ts`,
 * `scripts/seal-whats-new.mjs` folds these bullets into a fresh top entry on
 * `whatsNew.ts` and resets this file back to empty arrays.
 *
 * Authoring paths:
 *   • Manual:  npm run whats-new -- improved "Match engine runs 30% faster."
 *   • Auto:    .github/workflows/append-pending-news.yml runs on PR merge,
 *              parses the PR's `## What's New` body section (or PR title) and
 *              appends to the right category here, then commits back.
 *
 * Headline / summary are optional manual overrides. When `null`, the seal
 * script auto-generates them from the lead bullets (same logic that was in
 * the old `build-whats-new.mjs`).
 *
 * This file is the source of truth for bullets that have not yet been sealed
 * into a shipped release. It is NOT imported by app code — only by the
 * release-notes tooling. Keep its shape narrow and its parser-friendly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ReleaseCategory } from '@/types/game';

export interface PendingRelease {
  /** Marquee changes — surface at the top of the card. */
  highlights: string[];
  /** Brand-new features. */
  new: string[];
  /** Improvements to existing features. */
  improved: string[];
  /** User-visible bug fixes. */
  fixed: string[];
  /** Optional manual override. `null` ⇒ seal-time auto-generation. */
  headline: string | null;
  /** Optional manual override. `null` ⇒ seal-time auto-generation. */
  summary: string | null;
}

export const PENDING_NEWS: PendingRelease = {
  highlights: [],
  new: [
    'Dynasty Pro annual plan added, with localized pricing.',
  ],
  improved: [
    'Pack opening summary now has bulk keep and bulk sell actions.',
    'Resigning your job and the manager job market are easier to find from the menus.',
    'Reorganize pending news and release notes for clarity.',
    'Add marketing version regression guard for TestFlight builds.',
    'Add Apple App Review response for Guideline 2.1 information request.',
    'Apple-compliant in-app paywall with all required subscription disclosures visible in the purchase flow.',
    'Restore Purchases entry point integrated into the paywall.',
    'Ability to purchase Yearly or Lifetime plans in addition to the free-trial Monthly plan.',
    'Clear, non-misleading billing information with billed amount as the most prominent element.',
    'Fix external URL navigation and iOS keyboard handling in sheets.',
  ],
  fixed: [
    'Fixed rare launch crashes related to ads.',
    'Loaded clubs from other divisions are no longer wiped during cleanup.',
    'Fixed an issue where the welcome tour could fail mid-step.',
    'Saved games now correctly persist season finance totals, transfer history, tactical presets, contract negotiation cooldowns, club power rankings, and Community Pack opt-in — previously these silently reset on every reload.',
    'Continental ties now take priority over league fixtures on the same week — previously you could be silently eliminated from a continental group stage if your league had a match the same week.',
    'Penalty shootouts now stop the moment the result is decided, instead of always firing all 10 kicks.',
    'AI cup penalty shootouts now use the same goalkeeper-weighted formula as the ones you play, so identical teams meeting in different paths roll the same odds.',
    'Pack quick-release and quick-sell now respect the minimum squad size — you can no longer drop your squad below 22 players via the pack summary.',
    'If a paid pack purchase is ever blocked by an eligibility issue, you now get a clear "purchase succeeded but pack was blocked" message that points to support, instead of a generic error.',
    'Player development cards now show the COMBINED training + growth gain, instead of just the development portion.',
    'Unhappiness no longer snowballs through the dressing room — contagion now fires once per spell when a player first crosses the threshold, instead of every week thereafter.',
    'Training streaks no longer reset when you briefly switch focus — an accidental mid-week swap will no longer wipe a 6-week streak you built up.',
    'Loan counter-offers now appear in the Transfer page and are tracked properly — you can no longer accidentally spam the same loan request, and counter-offers no longer vanish the moment you close the dialog.',
    'Modal close buttons across the app now meet Apple\'s 44pt hit-target guideline — accidentally tapping just outside the X is gone.',
    'Tactical preset Delete is now a two-tap confirm instead of one mistap — and the Load/Delete buttons themselves are bigger.',
    'Welcome tutorial now has a Skip button so returning users don\'t have to click through every panel on a new save.',
    'In-app crashes are now reported to triage so we can fix them faster — the in-game error boundary was previously silent.',
    'Long-running campaigns are leaner: career timeline is now capped at 100 entries (was unbounded across match-day spreads), and pair-familiarity records are GC\'d at season end (was accumulating stale keys forever).',
    'Mid-match Load Game / Reset Game now safely abandons the in-flight match instead of crashing on the next animation frame.',
    'Match abandonment now clears every match-scoped state field (team talk, shouts, penalty kicks, ratings) so the next match starts clean.',
    'Save Failed warning now actually fires when both localStorage and IndexedDB reject the write — previously it was dead code.',
    'Failed in-app purchases now retry safely: if you were charged but the entitlement didn\'t grant, the next purchase attempt or Restore Purchases picks it up automatically.',
    'Weekly objectives (Goal Fest, Get the Win, Clean Sheet, etc.) now count goals and results from EVERY competition — friendlies, cup ties, continental matches, super cups. Previously only league fixtures moved the progress bars, so a 5-goal pre-season friendly never updated the "Score 3 or more goals" objective.',
    'Packs page is more mobile-friendly: the redundant "Player Packs" title and tagline are gone, the squad-cap + budget + reset chips share a single dense row, so the featured pack image is visible above the fold on a 375px phone.',
    'Top bar no longer drifts mid-page on iOS after certain state mutations (e.g. accepting a loan offer then scrolling) — fixed with GPU-composited layer pinning matching the bottom-nav pattern.',
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
