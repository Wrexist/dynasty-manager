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
    'Hall of Legends: retired greats can now appear as Legend cards in Elite, World Class and Legends packs — including stars who retire in your own save.',
  ],
  improved: [
    'FC27 player database + Hall of Legends.',
    'Fixed player cards showing a doubled name for suffix-only surnames (e.g. "VINI / Vini" for Vini Jr.).',
    'Fixed two clubs fielding a team with no goalkeeper.',
    'Players now show their full names — Alisson Becker, Gabriel Magalhães, Vinícius Júnior.',
    'Card backs, the walkout OVR beat, and the App Store preview rig.',
  ],
  fixed: [],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
