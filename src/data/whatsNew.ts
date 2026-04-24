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

export type ReleaseCategory = 'highlights' | 'new' | 'improved' | 'fixed';

export interface ReleaseNote {
  /** Semver marketing version, e.g. "1.0.1". Must match package.json on ship. */
  version: string;
  /** iOS CFBundleVersion / Android versionCode. Injected by CI if null. */
  build: number | null;
  /** ISO calendar date the TestFlight build was shipped (YYYY-MM-DD). */
  date: string;
  /** Short headline, App Store style. 3–8 words. */
  headline: string;
  /** 1–3 sentence player-facing summary. */
  summary: string;
  /** Marquee changes worth calling out at the top of the card. */
  highlights?: string[];
  /** Brand-new features. */
  new?: string[];
  /** Improvements to existing features. */
  improved?: string[];
  /** Bug fixes. */
  fixed?: string[];
}

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
    summary:
      'Every TestFlight build from here on ships with a proper App Store–style changelog, so you always know what changed, when it shipped, and what to try first.',
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
    ],
    fixed: [],
  },
];

/** The current/topmost release — used for the badge on the menu tile. */
export const LATEST_RELEASE: ReleaseNote = RELEASE_NOTES[0];

/* ──────────────────────────────────────────────────────────────────────────
 * "Seen" tracking — persistence helpers live in persistence.ts (ESLint's
 * no-restricted-globals rule keeps all localStorage access routed there).
 * Re-exported here so menu tiles can check the badge state without pulling
 * the full WhatsNewPage chunk into the Settings / TitleScreen bundle.
 * ────────────────────────────────────────────────────────────────────────── */

import { readWhatsNewSeenVersion, writeWhatsNewSeenVersion } from '@/store/helpers/persistence';

export { readWhatsNewSeenVersion, writeWhatsNewSeenVersion };

/** True when the latest release hasn't been opened yet. Drives the "NEW" badge. */
export function hasUnseenWhatsNew(): boolean {
  return readWhatsNewSeenVersion() !== LATEST_RELEASE.version;
}
