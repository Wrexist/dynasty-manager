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
    'Bump to 1.1.1 and seal What\'s New.',
    'Auto-dismiss Getting Started card when it starts already at 2/2.',
    'Make pack opening buttery smooth and unbreakable.',
    'Polish(ux): readable MatchDay log on landscape + money via formatMoney.',
    'Extract CP FA-pool seed + cover it with a test.',
    'Refreshed the improvement backlog to reflect the current state of `main`.',
    'Plan for 2.5D immersive match view (pitch visualization).',
    'Highlight: Watch your matches play out live on a beautiful 2.5D pitch — flowing passes, tactical shape, goal celebrations and more.',
    'Improved: Cleaner, more realistic 2.5D match view — goal nets, smart name labels, teams that push upfield, and instant goal replays.',
    'Highlight: Matches now play out like a real game on the pitch — pressing, flank play, set pieces, momentum that ebbs and flows, and a much smoother, slower pace.',
    'Improved: Pitch polish — goal nets ripple when you score, keepers dive at shots, and a wet/muddy pitch now looks the part.',
    'Highlight: Match-view glow-up — players now run with real weight, the ball has physics, the camera leads play, and goals hit with slow-mo + shake.',
    'Improved: Premium pitch look — players read as lit jerseys, keepers stand out, the pitch is floodlit, and the ball looks like a real ball.',
    'Fixed the live match HUD bar being mislabelled "Possession" when it actually shows momentum.',
    'Highlight: Goals now feel like a moment — a broadcast scoreline + scorer card, a stadium flash, and an instant slow-mo replay.',
    'Phase D: Interactive World Cup matches + retention features.',
  ],
  fixed: [],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
