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
    'New Release flow lets you terminate any player\'s contract for a one-off release clause — 35% of their remaining wages instead of paying out the full deal.',
  ],
  new: [
    'Dynasty Pro annual plan added, with localized pricing.',
    'Release Player button on the player detail screen with a premium confirmation modal that previews clause cost, squad impact, and fan/board backlash.',
    'Squad page surfaces release candidates — fringe and aging players who drain wages — with one-tap access to a Bulk Release Wizard.',
  ],
  improved: [
    'Pack opening summary now has bulk keep and bulk sell actions.',
    'Pack quick-sell rate rebalanced to 35% of market value so packs feel more like a luxury draw than a coin-flip.',
    'Releasing a fan favourite, club legend, or wasted-potential youngster now dents fan mood and board confidence — and the modal warns you up front.',
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
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
