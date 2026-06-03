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
  highlights: [
    'Walkout cinematics now run longer with a stats-tick reveal, ambient particles and a clear Skip pill so the moment really lands.',
    'Walkout reveals now build like a real moment — held-breath pause, giant OVR ticker, popping stats, and a confetti crescendo when the last stat lands.',
    'Pack summary now badges each pull with +X OVR vs your current best at the position — instantly see which pulls are real squad upgrades.',
  ],
  new: [
    'Dynasty Pro annual plan added, with localized pricing.',
  ],
  improved: [
    'New careers now start with a kit-sleeve sponsor offer waiting in the Finance page on day 1, with a six-week review window — so the sponsorship system is visible from your very first session instead of staying empty until you upgrade your stadium.',
    'Two new starter inbox messages on new careers nudge you toward Tactics and Scouting — two screens that previously had no day-1 visibility.',
    'Brand-new "Getting Started" checklist now sits at the top of your Dashboard during the first week of a new career — tap any row for an over-explicit step-by-step walkthrough (with the exact buttons to press), then "Take me there" to navigate. Auto-dismisses once you advance the week. Skips entirely for prestige restarts, and can be globally disabled via Settings → "New-career walkthrough".',
    'The checklist now uses the same Liquid Glass treatment as the rest of the app — backdrop blur, inset highlights, gold accent rail at the top — instead of the flat gold tint of the first draft.',
    'Checklist swaps the "Send a scout" row for a "Hire a scout from Staff" row when you have no scout on your books — no more rows that can never tick.',
    'Every starter inbox message now spells out the exact navigation path ("tap More, then Finance, scroll to Pending Offers, tap the row") instead of assuming you already know where things live.',
    'Pack opening is more cinematic: a cosmic parallax starfield drifts behind the pack for real depth, the pack now has a gentle idle float while it waits for your tap, and the reveal lands on a radial white bloom instead of a flat flash.',
    'Pack opening summary now has bulk keep and bulk sell actions.',
    'Resigning your job and the manager job market are easier to find from the menus.',
    'Apple-compliant in-app paywall with all required subscription disclosures visible in the purchase flow.',
    'Restore Purchases entry point integrated into the paywall.',
    'Ability to purchase Yearly or Lifetime plans in addition to the free-trial Monthly plan.',
    'Clear, non-misleading billing information with billed amount as the most prominent element.',
    'Fix external URL navigation and iOS keyboard handling in sheets.',
    'Keep release notes strictly player-facing.',
    'Audit bug fixes + UX polish.',
    'Pack-opening remake — Phase 1: cinematic stadium + loading open.',
    'Harden error handling and lifecycle safety across iOS/native.',
    'Enable iPad support by adding device family 2.',
    'Pack results now scroll cleanly with the Sell All / Keep All buttons always reachable.',
    'Guarantee Tracker now glows gold when your next pack pulls 80+ — clearer reward moment, premium polish.',
    'Pack opening loading state now glows in tier colour and shows the pack name immediately — premium first second instead of a plain spinner.',
    'Dashboard packs tile now shows a live count badge — see exactly how close you are to a guaranteed gold pull from any screen.',
    'Icon double-reveal + scrollable summary with safe-area pins.',
    'Make walkout cards tappable to start the walkout on demand.',
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
    'Packs page now shows a clear "Processing…" overlay during the 1-3s ad-watch / IAP-confirm gap — previously the tap looked unresponsive.',
    'League table rows are now keyboard-accessible (Enter / Space opens the club) and announce the club name to screen readers.',
    'Pack opening now announces each revealed player to screen readers via an aria-live region — the cinematic reveal is no longer silent for VoiceOver users.',
    'Packs page countdown ticker no longer re-renders the whole page once per second — bumped to 30s intervals (the displayed format only changes per-minute anyway).',
    'Save slots on the title screen now show a brief loading shimmer while saves hydrate — previously the rows flashed as empty "New Game" placeholders for a few hundred ms on mobile, risking an accidental tap that would have created a new save over your existing one.',
    'Post-match, mid-season, session-recap, and gem-reveal popups now announce themselves to screen readers as dialogs.',
    'Match Prep "Ready to Play" / "Sim" buttons now sit clearly above the bottom navigation on notched iPhones — they were partially clipped by the home-indicator gesture area.',
    'First app launch is meaningfully faster on cellular: the 2.5MB real-player roster bundle (~400KB gzipped) no longer downloads up-front — it now streams in the background while you read the title screen, and is fully cached by the time you tap "New Game".',
    'Corrupt-save detection: if a save slot, session snapshot, or hall-of-managers record fails to parse, the event is now reported to our triage pipeline (anonymised) so we can find and fix the cause instead of guessing.',
    'Modal popups (welcome tour, post-match summary, mid-season report, session recap, weekly digest, gem reveal, talent-tree perk details) now properly trap keyboard focus and dismiss on Escape, instead of letting Tab drift to buttons hidden behind the backdrop.',
    'Icon walkouts no longer flash twice — the card stays sealed until the cinematic plays.',
    'Negotiation sliders no longer flash NaN markers when an offer\'s asking price or demanded wage is zero.',
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
