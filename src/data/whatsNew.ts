/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dynasty Manager — "What's New" release notes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file is the source of truth for in-app release notes. It surfaces in:
 *   • Main menu → "What's New" tile (TitleScreen)
 *   • In-game Settings → Help → "What's New"
 *
 * ⚠️  MANDATORY — UPDATE WITH EVERY TESTFLIGHT BUILD
 *
 * Before triggering `iOS TestFlight Deploy` (GitHub Actions) or shipping a
 * native build, **prepend a new entry to `RELEASE_NOTES` below**. The CI
 * workflow runs `scripts/check-whats-new.mjs` and will fail if the top entry
 * does not match `package.json.version` or is missing required fields.
 *
 *   1. Bump `package.json` version (semver).
 *   2. Prepend a new entry to the array (newest first).
 *   3. Fill every field — treat this like an App Store release note that
 *      real players will read.
 *
 * Write like an App Store "What's New" announcement:
 *   • `headline` — a short, human hook ("Cup glory, smarter AI, faster matches.")
 *   • `summary`  — one paragraph, 1–3 sentences, player-facing tone.
 *   • Categorize changes into `highlights`, `new`, `improved`, `fixed`.
 *   • Each bullet is a complete sentence with a capital letter and a period.
 *   • Never mention internal refactors, lint, tests, or file names.
 *
 * The `build` number is the iOS CFBundleVersion / GitHub Actions `run_number`.
 * If you don't know it yet at commit time, set `build: null` and the CI step
 * will inject `run_number` into the shipped bundle. Historical entries must
 * keep the real build number that went out to TestFlight.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ReleaseNote } from '@/types/game';
import { readWhatsNewSeenVersion, writeWhatsNewSeenVersion } from '@/store/helpers/persistence';

export type { ReleaseCategory, ReleaseNote } from '@/types/game';
export { readWhatsNewSeenVersion, writeWhatsNewSeenVersion };

/**
 * Release notes, newest first. Index 0 is always the latest TestFlight build.
 *
 * ── TEMPLATE FOR NEW ENTRIES ──
 *
 *   {
 *     version: '1.0.2',
 *     build: null,               // CI injects github.run_number
 *     date: 'YYYY-MM-DD',        // date you ship to TestFlight
 *     headline: 'Short hook.',
 *     summary: 'One to three sentences written for players, not devs.',
 *     highlights: ['Big headline change.'],
 *     new: ['Describe each new feature as a complete sentence.'],
 *     improved: ['Describe each meaningful improvement.'],
 *     fixed: ['Describe each user-visible bug fix.'],
 *   },
 */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.0',
    build: null,
    date: '2026-04-24',
    headline: 'Introducing the What\'s New centre.',
    summary: 'Every TestFlight build from here on ships with a proper App Store–style changelog, so you always know what changed, when it shipped, and what to try first.',
    highlights: [
      'Brand-new "What\'s New" page, available from the main menu and in-game Settings.',
    ],
    new: [
      'Added a What\'s New tile on the title screen that surfaces the latest release notes the moment you launch the game.',
      'Added a "What\'s New" shortcut in the Settings → Help section so you can revisit any past update without leaving your save.',
      'Every release now records its build number and ship date so historical notes stay traceable across versions.',
    ],
    improved: [
      'Release notes are now grouped into Highlights, New, Improved, and Fixed sections for quicker scanning.',
      'The latest version is marked with a "NEW" badge until you open the page, so you never miss a meaningful update.',
      'Press Escape to close the contract, transfer, loan, and list-for-sale modals.',
      'Modals and form inputs now expose proper accessibility labels for screen readers.',
      'Tactics pitch and bench player cards now stack the flag above the surname, show the first name underneath, and label each stat (PAC, SHO, DEF…) right above its value.',
      'Starting lineup cards colour each player\'s position label green when they\'re in their natural slot, amber when compatible, and red when out of position.',
      'Removed the club-colour stripe from bench and reserve cards for a cleaner shield look.',
      'Hardened internal button handling so the menu buttons across the app can never accidentally trigger a future form submission.',
      'Player cards now show the position label on the right, mirroring the overall rating on the left.',
      'Cleared the dark halo behind tactics-pitch player cards so the pitch reads cleaner.',
      'Tactics pitch spreads players further apart so cards no longer overlap, and formation switches now smoothly slide each tile to its new slot.',
      'Transfer modals (Buy/List/Loan/Approach/Deal Complete) now show the proper FIFA-style player shield instead of the placeholder rating square.',
      'Hero player UIs (Ballon d\'Or winner, Man of the Match, season-summary winner) now show the proper FIFA-style shield instead of a plain trophy/rating tile.',
    ],
    fixed: [
      'Position label now lights up green when a player is slotted into one of their listed alternate positions, matching FUT chemistry.',
      'Hid the duplicated first-name line for mononym players (Savinho, Rodri, Ederson, …) so cards stop showing the same name twice.',
    ],
  },
];

// Defensive — RELEASE_NOTES must never be empty in a built bundle. Both the
// PR-check and TestFlight CI guards block that, but this throws early during
// dev / SSR / tests if someone clears the array by mistake. Without it,
// LATEST_RELEASE.version below would be a runtime "cannot read of undefined".
if (RELEASE_NOTES.length === 0) {
  throw new Error('RELEASE_NOTES must contain at least one entry. See src/data/whatsNew.ts header.');
}

/** The current/topmost release — used for the badge on the menu tile. */
export const LATEST_RELEASE: ReleaseNote = RELEASE_NOTES[0];

/** True when the latest release hasn't been opened yet. Drives the "NEW" badge. */
export function hasUnseenWhatsNew(): boolean {
  return readWhatsNewSeenVersion() !== LATEST_RELEASE.version;
}
