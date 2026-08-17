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
    'Release(1.3.0): seal the What\'s New card and bump the marketing version.',
    'Hero-cluster App Store screenshots for iPhone 6.9/6.5 + iPad 13.',
    'Rewarded-ad offer system with escalating, capped popups.',
    'Critical review of v1.3.0 — 22 findings, and the fixes for 21 of them.',
    'Damaged saves are now offered for recovery instead of showing as an empty slot.',
    'Free daily packs are now a true daily limit shared across all save slots.',
    'Lower-division clubs earn prize money that matches their level.',
  ],
  fixed: [
    'Fixed a save bug that could permanently stall the season for clubs in a promotion playoff.',
    'Fixed retirement not sticking, so a new career could refuse to start.',
    'Your squad no longer loses overall rating after a normal training week.',
    'The Competitions screen now shows the European competition you actually qualified for.',
    'A sent-off player can no longer be replaced, so a red card costs you a man.',
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
