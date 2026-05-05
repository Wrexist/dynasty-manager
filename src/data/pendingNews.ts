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
  new: [],
  improved: [
    'Rewrite all prompts to match the matured codebase.',
    'Fix WelcomeOverlay step bounds to prevent undefined access.',
    'Add privacy policy site for App Store submission.',
    'Add bulk keep/sell actions to pack opening summary.',
    'Turn /docs into a marketing + privacy + support site.',
    'Release hygiene: gate prod console, harden modals & splash.',
    'Make career resign / job-market path discoverable.',
    'Add annual subscription tier and localized pricing support.',
    'Disable ads + ATT for v1 to unblock App Review.',
    'Restore GADApplicationIdentifier — AdMob SDK crashes withou….',
    'Protect cross-division loaded clubs from cleanup.',
    'Add NSUserTrackingUsageDescription to fix App Store error 90683.',
  ],
  fixed: [],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
