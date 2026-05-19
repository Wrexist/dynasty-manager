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
    'New careers now start with a kit-sleeve sponsor offer waiting in the Finance page on day 1, with a six-week review window — so the sponsorship system is visible from your very first session instead of staying empty until you upgrade your stadium.',
    'Two new starter inbox messages on new careers nudge you toward Tactics and Scouting — two screens that previously had no day-1 visibility.',
    'Brand-new "Getting Started" checklist now sits at the top of your Dashboard during the first week of a new career — tap any row for an over-explicit step-by-step walkthrough (with the exact buttons to press), then "Take me there" to navigate. Auto-dismisses once you advance the week. Skips entirely for prestige restarts, and can be globally disabled via Settings → "New-career walkthrough".',
    'The checklist now uses the same Liquid Glass treatment as the rest of the app — backdrop blur, inset highlights, gold accent rail at the top — instead of the flat gold tint of the first draft.',
    'Checklist swaps the "Send a scout" row for a "Hire a scout from Staff" row when you have no scout on your books — no more rows that can never tick.',
    'Every starter inbox message now spells out the exact navigation path ("tap More, then Finance, scroll to Pending Offers, tap the row") instead of assuming you already know where things live.',
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
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
