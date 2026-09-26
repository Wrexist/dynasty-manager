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
    'Manager Pass: a season-long reward track with a free row and a Pro row of cosmetic rewards.',
    'A cleaner Home screen: one Continue button, then only what needs your attention.',
    'Skip to full time from half-time, free for everyone.',
  ],
  new: [
    'Quick Start suggests a strong club and picks your nationality from your device.',
    'Derby Days: derby wins count double on the event reward track.',
    '11 new storylines, new random events, and press questions that name your opponents and players.',
    'The Hall of Managers now records each career separately instead of one row per save slot.',
  ],
  improved: [
    'Made the free-play option clearer on the Pro welcome screen.',
    'More realistic results across every league: more goals and fewer draws.',
    'Veterans at your club now age at the same pace as everywhere else.',
    'Back always returns to where you came from, and Android\'s back button works.',
    'Free trials are shown on every plan that offers one.',
    'Youth intake previews now show exactly who joins.',
    'Cup finals, Super Cups and playoff finals are played at neutral venues.',
    'Every simulated league now plays all its fixtures within the season.',
    'A cleaner inbox: routine news arrives read and AI transfers come as one weekly round-up.',
    'Finance and the Weekly Digest now show the same numbers.',
    'Text is easier to read, and buttons are easier to tap across the game.',
  ],
  fixed: [
    'Fixed an interrupted pack purchase that could block later pack purchases.',
    'Fixed Ballon d\'Or top-10 finishes lowering a star\'s rating.',
    'Fixed players you loan in never getting picked.',
    'Fixed a slow launch that could make a saved career look empty.',
    'Fixed the season stalling for an out-of-work manager who still runs a national team.',
    'Fixed storylines repeating the very next season.',
    'Fixed a save that could roll back after the app was closed.',
    'Fixed free pack players being lost if the app closed during the reveal.',
    'Fixed reloading mid-match giving a different result.',
    'Fixed unattached players being listed with transfer fees.',
  ],
  headline: 'Manager Pass, a cleaner Home screen, and free Skip to full time.',
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
