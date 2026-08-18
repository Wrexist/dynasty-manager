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
    'Injuries across the rest of the world now heal. Previously only your own squad recovered, so by season three most of the league was permanently injured — which is also why your fixtures could quietly go unplayed.',
  ],
  new: [],
  improved: [
    'V1.4.0: Fix critical save, training, and monetization regressions.',
  ],
  fixed: [
    'Fan mood now reacts to results and league position instead of sitting at a flat 50 all game — matchday income finally rises with a winning run and dips during a slump.',
    'The Super Cup now actually finishes: if it gets bumped off its scheduled week it is played once, awards the trophy and the prize money, and stops reappearing every free week.',
    'Your assistant now fills gaps in the starting XI from the whole squad, not just the named bench, so a run of injuries can no longer leave a match unplayable.',
    'Rival clubs now recover fitness between matches like your own squad does. Previously only your players rested, so the rest of the world got quietly and permanently more tired every season.',
    'Starting a game with a club that no longer exists (an old deep link, a stale save) now fails cleanly instead of crashing part-way through building the world.',
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
