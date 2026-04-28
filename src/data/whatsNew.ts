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
 *
 * iOS export compliance: `ITSAppUsesNonExemptEncryption` = false is correct
 * (HTTPS-only third-party SDKs — see comment above that key in Info.plist).
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
    version: '1.0.6',
    build: null,
    date: '2026-04-28',
    headline: 'Sharper icons, smoother menus.',
    summary: 'The What\'s New badge, pack \'Featured\' chip and the Hidden Gem reveal all get a fresh, hand-crafted gold sparkle. Completed objectives now sport a crisp tick instead of a stray emoji.',
    highlights: [],
    new: [],
    improved: [
      'Polished the sparkle and check icons across the menu, packs and gem reveal — no more cheap-looking glyphs.',
    ],
    fixed: [],
  },
  {
    version: '1.0.5',
    build: null,
    date: '2026-04-27',
    headline: 'Try Dynasty Pro free for three days.',
    summary: 'Every new game now opens with a fun, interactive tour of the full Pro toolkit — and you can unlock everything free for three days. Tactical presets, instant sim, advanced analytics, ad-free play and the gold Pro badge are all yours from the first kick-off.',
    highlights: [
      'Brand-new interactive Liquid Glass paywall walks through every Pro feature.',
    ],
    new: [
      'Three-day free trial of Dynasty Pro on every new game.',
      'Every press conference now has a Pro-only analytical or strategic response option — full coverage across all 88 questions.',
      'Backroom staff now have personality traits, morale, and contracts you can actively manage.',
      'Praise or criticise staff to lift their morale, then renew their contract before they walk.',
      'Youth Academy gets per-prospect training focus and limited Spotlight Sessions for big dev boosts.',
      'Merchandise gains player Signature Drops, derby-week buzz, and a win-streak revenue bonus.',
    ],
    improved: [
      'Subscription onboarding now auto-enrols you into the monthly plan after the trial — cancel anytime.',
      'Pro upsell on press conferences only appears on questions that genuinely have a Pro response — no more bait prompts.',
      'Pro subscription onboarding now describes the analytics you actually get — tactical match insights and a per-match performance summary.',
      'Inbox now shows an amber warning if your Pro payment fails so you can update billing before features lapse.',
      'Pack opening drops the cluttered title overlay for a tier-tinted caption — no more gold text on silver packs.',
      'Tap the pack itself during the build-up to rip it open immediately, with foil shreds bursting from the seam.',
      'Pack shop cards are now cleaner — the tier name sits up top and a single tap-friendly button replaces the cluttered text panel.',
      'Staff effectiveness now scales with morale — keep the backroom happy and they get more out of training, scouting, and youth.',
      'Star players can now headline limited-edition Signature Drops on the Merchandise tab for a multi-week revenue spike.',
      'Tighter validation of league and club data during long careers.',
    ],
    fixed: [
      'Hall of Managers no longer breaks if stored data is invalid.',
      'Picking \'Use Generated Players\' now keeps real-world ratings and squad shape but renames every player to a plausible alias from the same nationality — no more recognisable names if you opted out.',
    ],
  },
  {
    version: '1.0.4',
    build: null,
    date: '2026-04-26',
    headline: 'Real national teams, smarter rankings, fancy squad picker.',
    summary: 'Take charge of your country with real FC26 stars, accurate world rankings, and a brand-new squad selection screen. Tournaments now follow a clean three-year cycle — World Cup, continental cup, off year — and you pick your 23-man squad the week before the first match.',
    highlights: [
      'New pre-tournament squad picker lets you choose your final 23 from the top 50 nationally eligible players.',
      'Three-year tournament cycle: World Cup, then your continental cup (Euros, Copa America, AFCON, Asian Cup, Gold Cup), then a quiet year, then World Cup again.',
    ],
    new: [
      'National Team page now shows the next tournament tile with the exact start week and season — tap it to see the format, qualifying teams, and live group standings.',
      'Continental tournaments are now confederation-specific and named correctly (European Championship, Copa America, AFCON, Asian Cup, Gold Cup).',
      'International Tournament screen shows a pre-draw preview with all expected qualifiers when no tournament is active.',
    ],
    improved: [
      'Real FC26 player pool always seeds your national team candidates — no more random-name squads when you take a top nation like France.',
      'World ranking on the National Team page now reflects each nation\'s real FIFA-style ranking instead of a flat #25 placeholder.',
      'Tightened native bridge typing for in-app purchases and haptics.',
      'Hardened the matchday flow with new safety tests for penalty shootouts and prestige resets.',
      'Locked down transfer market behaviour with new tests for offers, releases, renewals, and free agents.',
      'Added safety net tests for the new quick-sell flow on packs.',
      'Locked down the Smart Sub recommender so injuries always trigger a swap and tactical context counts late in matches.',
      'Refactored the season game-loop module for cleaner internals.',
      'Continued tightening the season game-loop module for cleaner internals.',
      'Cleaner Transfer screen — News tab and Free Agent signing modal now load as their own components.',
      'Cleaner Dashboard internals — competition status and board objectives now load as their own components.',
      'Refactored the match engine for cleaner internals.',
      'Cleaner MatchDay screen — score header and match-speed picker now load as their own components.',
    ],
    fixed: [
      'Fixed France (and other top nations) appearing as #25 in the world rankings.',
      'Fixed Restore Purchases not working when tapped before the store finished initialising.',
    ],
  },
  {
    version: '1.0.3',
    build: null,
    date: '2026-04-26',
    headline: 'Rare Gold pack joins the in-app store.',
    summary: 'Rare Gold packs are now an in-app purchase, matching Premium Gold and Icon. The £80M in-game price is gone — pay $6.99 for a guaranteed 84+ rated player and a chance at a walkout reveal.',
    highlights: [],
    new: [],
    improved: [
      'Rare Gold pack is now an in-app purchase ($6.99) instead of an £80M in-game spend.',
    ],
    fixed: [],
  },
  {
    version: '1.0.2',
    build: null,
    date: '2026-04-26',
    headline: 'Daily free packs and a live reset countdown.',
    summary: 'Every day brings a free Bronze, Silver, and Gold pack — no ad, no cost. Watch a quick ad to grab three more Bronze or Silver opens, or instantly buy a Gold pack with an in-app purchase. A live countdown on the pack store shows exactly when your free packs come back.',
    highlights: [
      'Open one Bronze, Silver, AND Gold pack completely free, every day.',
    ],
    new: [
      'Bronze and Silver packs give 1 free open daily, then 3 more by watching a rewarded ad.',
      'Gold pack gives 1 free open daily, then unlimited opens via in-app purchase.',
      'Live countdown chip shows when your free daily packs reset.',
    ],
    improved: [
      'Pack store CTAs now reflect the active method per tier — Open Free, Watch ad, or Buy.',
    ],
    fixed: [],
  },
  {
    version: '1.0.1',
    build: null,
    date: '2026-04-26',
    headline: 'Free packs, fewer limits, premium drops.',
    summary: 'Open packs as often as you like — the once-per-week wait is gone. Bronze packs are now free with a quick rewarded ad, capped at three opens per day. Silver and Gold packs cost more, while Premium Gold and Icon packs are real-money in-app purchases for instant elite signings.',
    highlights: [
      'Removed the weekly pack cooldown — open as many packs as you can afford.',
    ],
    new: [
      'Bronze packs are now free with a rewarded ad, up to three opens per day.',
      'Premium Gold and Icon packs are now in-app purchases for guaranteed elite pulls.',
    ],
    improved: [
      'Silver and Gold packs cost more in-game money, matching their stronger guarantees.',
    ],
    fixed: [
      'Pack shop no longer locks you out of pack opens for the rest of the week.',
      'Pack shop now checks challenge restrictions before kicking off a real-money purchase, so you can never be charged for a pack you cannot open.',
    ],
  },
  {
    version: '1.0.0',
    build: null,
    date: '2026-04-24',
    headline: 'Introducing the What\'s New centre.',
    summary: 'A simple bullet-point changelog for every TestFlight build, so you can scan what changed at a glance.',
    highlights: [
      'New What\'s New page on the main menu and in Settings.',
      'Smart Optimize Lineup is now a Dynasty Pro feature that reads tactics, manager perks and opposition.',
    ],
    new: [
      'What\'s New tile on the title screen.',
      'What\'s New shortcut in Settings → Help.',
      'Build number and ship date saved for every release.',
      'Added a one-tap App Store review prompt that appears after a winning season — title, promotion, or cup victory.',
    ],
    improved: [
      'Update log now reads as a flat bullet list — no more long descriptions.',
      'Latest version shows a "NEW" badge until opened.',
      'Press Escape to close contract, transfer, loan, and list-for-sale modals.',
      'Better screen-reader labels on modals and form inputs.',
      'Player cards: flag above surname, first name below, stat labels above values.',
      'Position label glows green in natural slot, amber if compatible, red if out of position.',
      'Cleaner shield look on bench and reserve cards.',
      'Menu buttons can no longer trigger accidental form submissions.',
      'What\'s New moved to a small button on the title screen.',
      'Match commentary builds up to goals through passing, counters, and corners.',
      'Speculative long-range shots no longer spam the commentary feed.',
      'Substitutions now read with live commentary, with a distinct tone for injuries.',
      'Position label on the right of player cards, mirroring OVR on the left.',
      'Cleared the dark halo behind tactics-pitch cards.',
      'Tactics pitch spreads players out and animates formation switches.',
      'Transfer modals use the proper FIFA-style player shield.',
      'Ballon d\'Or, MOTM, and season-summary winners use the FIFA-style shield.',
      'Opponent rosters and recent pulls use the same mini player shield.',
      'Switching tabs is now instant — removed the blocking transition that delayed each page load.',
      'Match playback runs more smoothly at every speed, especially on older devices.',
      'League-position lookups in the top bar and dashboard are faster on every render.',
      'Player cards now show full first names instead of a bare initial.',
      'Position label moved under the OVR on the left so XI/SUB/LIST badges no longer overlap the top-right corner.',
      'More clearance above the bottom nav so the last row of cards always sits above the tab bar.',
      'Every club\'s starting squad now uses real FC26 names, ratings and stats.',
      'Goalkeepers are now picked using the same shot-stopping signals matches care about.',
      'Optimizer reads your tactics: high pressing benches tired players, wide play favours pacy wingers, a high line drops slow centre-backs.',
      'Optimizer rewards clutch traits in big matches and cup ties — leadership, mental, and cup experience.',
      'Optimizer surfaces specialist threats — long-range shooters, headers, skill-move soloists, and free-kick takers.',
      'Manager perks now bend lineup picks: Disciplinarian softens card risk, Fitness Guru forgives tired legs, Motivator picks low-morale players, Set-Piece Coach pushes your taker into the XI.',
      'Lineup optimizer now mirrors the match engine\'s defensive, shooting, assist, and wide-play formulas — pick stoppers for CB, finishers for ST, creators for CAM and pacy crossers for the wings.',
      'Attacking and defensive mentalities now bend the optimizer\'s role weights — attacking modes lift attackers, defensive modes lift defenders.',
    ],
    fixed: [
      'Alternate positions now glow green like FUT chemistry.',
      'Mononym players (Savinho, Rodri, Ederson) no longer show their name twice.',
      'Random squad fillers now use real FC26 players with their actual names, ratings and stats.',
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
