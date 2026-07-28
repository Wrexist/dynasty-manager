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
    'Highlight: Play a full World Cup — from the group-stage draw ceremony through to the final.',
    'Highlight: Watch your matches play out live on a beautiful 2.5D pitch.',
    'New: World Cup group-stage draw ceremony at the start of every run.',
    'New: Tournament awards on the result screen — Golden Boot and Young Star.',
    'New: Share your World Cup run straight from the result screen.',
    'New: Redeem codes in Settings for in-game rewards.',
    'Improved: Champions now get a trophy-lift celebration when they win it all.',
    'Improved: Real country flags now fly across World Cup match, dashboard, and result screens.',
    'Fixed: Live match HUD bar was mislabelled "Possession" when it shows momentum.',
    'Fixed: The live match event log no longer auto-scrolls the screen down — read events at your own pace.',
    'Improved: The full-time card now shows the Player of the Match instead of repeating the scoreline.',
    'Fixed: The Continue button on the World Cup full-time screen now works.',
    'Add game design & UX review report (IDEAS.md).',
    'Interactive penalty shootouts: swipe to aim at five target zones, hold to power up, and pick your takers — with a broadcast scoreboard, curved ball flight, sound, slow-mo decisive kicks and keeper mind games.',
    'Capture Studio in Settings: teleport into staged World Cup finals (Messi vs Ronaldo, Mbappé rematch, England penalties, Yamal, Haaland) for recording promo footage without touching your save.',
    'G1–G7: Cold-open paywall removal, board teeth, audio/visual polish.',
    'Add App Store screenshot generator with 3D device rendering.',
    'Resize App Store screenshots to 1284x2778, output to /marketing.',
    'Add Terms of Use (EULA) link to App Description metadata.',
    'Consolidate competitions & add Rivalries Hub, Game Plans, Mastery Ranks.',
    'Improve purchase resilience and error boundary recovery.',
    'The Dynasty Pro screen now centres properly on iPad.',
    'Stop treating StoreKit cancels as failures; gate paywall on real store availability.',
    'Free daily Gold packs are no longer a shortcut to a squad of 80-rated players, and the pity bonus now scales to the pack you opened instead of ignoring its ceiling. Paid pack odds are unchanged.',
    'Lower leagues no longer rot over long saves: clubs now rebuild toward their own stature, so the pyramid keeps its shape and elite AI sides stay elite across decades.',
    'Close free-Pro holes and the title-screen hydration hang.',
  ],
  fixed: [
    'Cancelling a purchase no longer shows a purchase-failed error.',
    'Dynasty Pro plans now load reliably at checkout, with a clear retry if the App Store can\'t be reached.',
  ],
  headline: null,
  summary: null,
};

export const PENDING_CATEGORIES: ReleaseCategory[] = ['highlights', 'new', 'improved', 'fixed'];
