# CLAUDE.md — Dynasty Manager

> Last verified against the codebase 2026-09-25 (latest shipped v1.6.0, save schema v93).
> If the numbers below disagree with the code, trust the code — and update this file.
> `npm run docs:check` verifies the countable claims (schema and shipped versions,
> file counts, LOC of the named files, Tech Stack versions) at EVERY occurrence and
> `-- --fix` updates them. It runs in preflight, so this file cannot silently drift again.

## TestFlight Release Notes ("What's New")

**Players see in-app release notes that accumulate automatically as PRs merge.**
Two files live in `src/data/`:

- `pendingNews.ts` — staging area for the *next, unshipped* version. Bullets
  pile up here as work happens.
- `whatsNew.ts` — append-only history of every shipped TestFlight build. The
  top entry is the build players currently see in-app.

The lifecycle is simple: **append → seal → ship**.

### 1. Append (during development)

Bullets land in `pendingNews.ts` two ways:

**A. Automatically on PR merge.** The `Append Pending News` workflow
(`.github/workflows/append-pending-news.yml`) runs whenever a PR closes as
merged on `main`. It parses the PR's labels + body and commits the bullets
back to `pendingNews.ts` with a `[skip ci]` message.

- **Categorise via labels** (one per PR):
  `type:highlight` · `type:new` · `type:improved` · `type:fixed`.
  Default if no label = `improved`.
- **Bullet text** — by default, the PR title (with conventional-commit prefix
  stripped) is used. To control the wording, add a `## What's New` section to
  the PR body:
  ```markdown
  ## What's New
  - Smart Optimize Lineup result now opens in a polished glass popup.
  ```
- **Skip a PR entirely** — apply any of:
  `skip-changelog`, `no-changelog`, `dependencies`, `infra`, `ci`.
  (Dependabot PRs are auto-labelled `dependencies`.)

**B. Manually anytime.**

```bash
npm run whats-new -- new       "Added adaptive AI tactics."
npm run whats-new -- improved  "Match engine runs 30% faster."
npm run whats-new -- fixed     "Fixed crash on Cup Final."
npm run whats-new -- highlight "Rival managers now adapt to scoreline."

# Optional manual overrides — leave unset for auto-generation at seal time.
npm run whats-new -- headline  "Faster matches, sharper AI."
npm run whats-new -- summary   "One to three sentence player-facing summary."

npm run whats-new -- show      # inspect pending state
npm run whats-new -- clear     # wipe pending bullets (rarely needed)
```

Both paths are idempotent — re-running the same PR or the same
`whats-new -- improved "..."` command twice is a no-op.

### 2. Seal (when version is bumped)

When `package.json.version` advances past the top of `whatsNew.ts`,
`scripts/seal-whats-new.mjs` folds the pending bullets into a fresh top
entry and resets `pendingNews.ts`. The seal:

- Stamps the new entry with `version` from `package.json`, today's date,
  `build: null` (CI injects the real number).
- Uses manual `headline`/`summary` overrides if set; otherwise auto-generates
  them from the lead bullets (priority: highlights → new → improved → fixed).
- Falls back to a `Stability and polish improvements.` bullet if pending is
  empty (so empty version bumps still produce a valid card).

The seal is **idempotent**: if the current version is already the top entry,
it's a no-op.

```bash
npm run whats-new:plan      # dry-run preview of what seal would do
npm run whats-new:seal      # actually seal (writes whatsNew.ts + resets pending)
npm run whats-new:check     # validate the top entry of whatsNew.ts
```

### 3. Ship (TestFlight workflow)

`iOS TestFlight Deploy` (`.github/workflows/ios-testflight.yml`) runs the
seal automatically before the build:

| Input | Required | Notes |
|-------|----------|-------|
| `marketing_version` | no | Override `package.json.version` for this build only. Leave blank to use whatever's currently in `package.json`. |
| `dev_tools` | no | Boolean, default `false`. Includes the in-app Developer section (Reset Pro & open paywall, etc.) for internal testing. **Leave OFF for a real App Store release; turn ON only when the build is for IAP testing.** |

Steps the workflow performs:

1. Optional `npm version <input>` — bumps `package.json` (runner-only).
2. `npm ci`.
3. **Echo resolved version + build** — prints `marketing_version` and
   `build_number` as a `::notice::` annotation at the top of the run summary.
   Sanity-check this matches what you intended *before* the upload step runs.
4. **Marketing version regression guard** —
   `node scripts/check-marketing-version.mjs` fails the build if
   `package.json.version` is lower than the top entry of `src/data/whatsNew.ts`.
   This blocks the silent-regression bug where TestFlight uploads land on an
   older version train and disappear from the user's TestFlight view.
   Locally: `npm run version:check`.
5. `npm run whats-new:seal` — folds pending into `whatsNew.ts`.
6. `node scripts/check-whats-new.mjs --inject-build ${{ github.run_number }}`
   — validates the top entry and stamps the real CFBundleVersion.
7. `npm run build`, `cap sync ios`, `fastlane ios beta`.

`Android Build` (`android-build.yml`) runs the same seal and check after its
release gates, stamping the input `version_code` instead of the run number.

**Runner-only mutations are NOT committed back to `main`.** The pending file
on `main` keeps whatever bullets were there. If you want a sealed entry to
live in git after a successful deploy, run `npm run whats-new:seal` locally,
commit the result, and push.

> **Why the regression guard exists (TestFlight build #142 saga):** The
> TestFlight binary on the device was 1.0.11/136 (the AdMob-crash build).
> Someone triggered the workflow with a blank `marketing_version` while
> `package.json` still read 1.0.10, so the workflow built and uploaded
> 1.0.10/142. Apple accepted the upload but parked it under a separate older
> version train, which is invisible from the user's TestFlight view of 1.0.11.
> The fix was to bump `package.json` to 1.0.12 and re-trigger. The guard now
> refuses to ship when `package.json.version` < the latest sealed
> `whatsNew.ts` entry, which catches the common case of "blank input + stale
> package.json + a more-recent version was shipped via override".

### Authoring tone (auto-generated voice)

- **Headline** → first bullet from the highest-priority non-empty category
  (highlight > new > improved > fixed). Bullets are already capitalised and
  period-terminated by the helper, so they read as a complete sentence.
- **Summary** → first 1–2 lead bullets joined as prose, plus a tail
  enumerating the rest by category count. Always passes the `>=20` char
  validation in `check-whats-new.mjs`.
- **Override anytime** with `npm run whats-new -- headline "..."` /
  `summary "..."` before sealing.

### Recovering from a failed TestFlight deploy

The seal step never commits back, so the pending file on `main` stays intact
and you can re-run safely:

| Scenario | What happens | What you do |
|---|---|---|
| Build failed at the same version (e.g. v1.0.10 attempt #2) | `whatsNew.ts` on `main` still shows the previous shipped version, and `pendingNews.ts` still holds the bullets. Re-running the workflow re-seals the same content. | Re-trigger the workflow as-is. |
| You bumped past the failure (v1.0.10 failed → v1.0.11) | Pending still holds everything that was meant for v1.0.10 — nothing was lost. The seal at v1.0.11 picks it all up plus anything merged since. | Trigger at v1.0.11. |
| No bullets in pending when version is bumped | Seal emits a `Stability and polish improvements.` placeholder so the build still passes `check-whats-new.mjs`. | Either accept the placeholder or run `npm run whats-new -- improved "..."` first. |

**Don't bump the version unnecessarily.** Re-running with the same
`package.json.version` is supported and is a no-op once already sealed.

### Where players see it:

- **Main menu (TitleScreen)** — "What's New" tile with a green "NEW" dot until opened.
- **In-game Settings → Help → "What's New"** — persistent entry point.
- Latest entry is badged `Latest` and `NEW`; older entries stay with full build + date.

### Example entry:

```ts
{
  version: '1.0.1',
  build: null,                 // CI fills this with github.run_number
  date: '2026-04-28',
  headline: 'Faster matches and sharper AI.',
  summary:
    'Match simulation is 30% faster, rival managers adapt their tactics, and three blocking match-day bugs are fixed.',
  highlights: ['Rival managers now adjust tactics based on the scoreline.'],
  new: ['Added adaptive AI tactics that respond to the scoreline.'],
  improved: ['Match engine runs 30% faster on older devices.'],
  fixed: ['Fixed a crash when loading a save from the League Cup final.'],
},
```

---

## ⚠️ MANDATORY: Read This First — Git & Shipping Workflow

**These are NON-NEGOTIABLE rules. Every Claude session MUST follow them.**

### When the user asks you to commit, push, ship, or create a PR:
1. Run `npm run preflight` — lint + typecheck + docs drift + i18n ceiling + pack supply + fast tests + build + bundle budgets. Fix any failures before proceeding.
   *Before a release, run `npm run preflight:full`* — the same gate with the
   long-running season/longevity suites (`SLOW_SUITES` in `vitest.config.ts`),
   which the per-commit gate skips so that it actually gets run. Test files run
   in parallel (`fileParallelism` is on; `VITEST_PARALLEL=0` forces serial —
   serial, the full suite measured 28.6 min).
2. Stage specific changed files with `git add <files>` (NEVER blind `git add -A`).
3. Commit with a clear message: `git commit -m "descriptive message"`.
4. Push: `git push -u origin <branch-name>` — retry up to 4x with exponential backoff on network failure.
5. **Output the PR link** to the user: `https://github.com/Wrexist/dynasty-manager/pull/new/<branch-name>`

**Or use the one-liner:** `npm run ship -- "commit message"` — does ALL of the above automatically.

> **ship.sh staging contract:** `npm run ship` stages *tracked changes only*
> (`git add -u`). **Untracked files are never auto-staged** — if you created a
> new file and want it in the commit, `git add <file>` first, then ship. The
> script prints any untracked files for visibility and fails fast if nothing
> ends up staged.

### When the user asks you to start a new feature/branch:
```bash
npm run branch -- <branch-name>
```
This fetches latest `origin/main` and creates a clean branch. NEVER branch from `master` or detached HEAD.

### What NOT to do:
- **NEVER** use `gh pr create` — GitHub API auth is not available in this environment. It WILL fail.
- **NEVER** push without running preflight first.
- **NEVER** skip giving the user the PR creation link after pushing.

### Available workflow commands:
| Command | What it does |
|---------|-------------|
| `npm run preflight` | Lint + typecheck + docs:check + i18n:check + packs:supply + **fast** tests + build + size:check — run this per commit |
| `npm run preflight:full` | Same, with the long-running season/longevity suites. What CI enforces (`pr-checks.yml` runs it by name) |
| `npm run test:fast` | Vitest minus the slow suites (see `SLOW_SUITES` in `vitest.config.ts`) |
| `npm run docs:check` | Verify the countable claims in this file against the code (`-- --fix` to update) |
| `npm run i18n:check` | Count player-facing strings still hardcoded in English; fails above the ceiling in `package.json` |
| `npm run ship -- "msg"` | Preflight + stage + commit + push with retry |
| `npm run branch -- name` | Create feature branch from latest origin/main |
| `npm run typecheck` | Standalone TypeScript check |
| `npm run size:check` | Every bundle budget in `.github/bundle-budget.json` — eager first-load gz, main chunk, core JS, community pack (`scripts/check-eager-bundle.mjs`) |

### ⚠️ Merging ≠ Shipping to TestFlight

**The iOS TestFlight workflow is `workflow_dispatch` only — it does NOT run on `push` to `main`.** Merging a fix into `main` does **not** put it on the user's phone. The TestFlight binary on their device only changes when someone manually triggers `iOS TestFlight Deploy` and waits for the build (~15 min) and TestFlight propagation.

**This bit users hard during the AdMob crash saga (PR #523 → #527 → #528 → #529):** Claude said "the fix is shipped" after merging, but TestFlight build 136 was still on the phone with the crash, because no new build had been triggered.

**When you fix a crash or any user-visible bug, after merging always tell the user:**

> The fix is on `main`, but your TestFlight phone is still running the previous build. To actually deploy:
>
> 1. Open https://github.com/Wrexist/dynasty-manager/actions/workflows/ios-testflight.yml
> 2. Click **"Run workflow"** (top right) → leave `marketing_version` blank → green button
> 3. Wait ~15 min for the build, then update from TestFlight on your phone
> 4. The new build's CFBundleVersion will be the GitHub Actions `run_number` (so e.g. 137, 138, …)

**To verify a crash is actually fixed for the user, ask for a new crash report and confirm the version/build number is HIGHER than the last crashing build.** Same build number = same binary = same bug.

---

## Project Overview

Dynasty Manager: Football is a mobile-first football management simulation,
live on the iOS App Store (id 6760918006), built as a React web app wrapped
with Capacitor for native iOS/Android. Players manage real clubs across
**45 leagues in 37 countries (756 clubs)**, run squads/tactics/transfers,
play minute-by-minute matches, chase continental trophies, take national-team
jobs, open player packs, and build a multi-season managerial career. Dark
premium UI with glass-morphism and gold accents. Monetised via the
**Dynasty Pro** subscription/one-time IAP family plus cosmetic packs and
consumable player-pack IAPs (RevenueCat).

**Origin:** MVP scaffolded in Lovable.dev → now developed in Cursor + Claude Code.

### Game modes (`/mode-select`)
- **Sandbox** — pick any club, manage forever.
- **Manager Career** — create a manager, interview for jobs via board pitches,
  earn contracts/bonuses, get sacked, climb the job market, retire.
- **Sunday League** (`/sunday-league`) — run a local park team: seeded RNG,
  weekly availability crises, pound-scale finances, a 5-division local pyramid.
  Whole mode lives in `state.sunday` + `src/store/slices/sunday/` (6 files) +
  `src/utils/sunday/` (18 files) + `src/config/sundayLeague.ts`; implementation
  is dynamic-imported so it stays off the eager bundle.
  - **Its own component system**, `src/components/game/sunday/` (19 files):
    `SundayFace` (procedural faces), `SundayKit`, `SundayCrest`, `SundayGround`
    (the clubhouse drawn as a ground — every mark is a real upgrade level),
    `SundayPitch`/`SundayPitchToken`/`SundayXiCount`, `SundayFixtureHero`,
    `SundayBriefing`, `SundayTimeline` (the match sheet), `SundayStory`,
    `SundayPlayerCard`, `SundayRecruitCard`, `SundaySeasonCard`,
    `SundayTacticCard`/`SundayTacticDiagram`, `SundayNewsList`,
    `SundayPersonalityCard`, `SundayAdjustments`, `SundayBits`.
  - **Icons come from `src/config/sundayIcons.ts`, never from lucide directly.**
    A Sunday screen importing `lucide-react` is a review failure.
  - **View helpers** turn state into what a screen draws, so components stay
    dumb: `utils/sunday/view.ts` (the big one — squad rows, club summary,
    league buzz, upgrade scene, sponsor boards), `visuals.ts` (crest/kit specs
    from a club's own colours), `teamsheet.ts`, `timeline.ts`.
  - `PitchBoard` (`src/components/game/PitchBoard.tsx`) is the shared
    half-pitch, extracted from `LineupEditor` and used by both games. It reads
    `useReducedMotionPref()` itself — it is the only thing on the board that
    moves.
  - **Measuring the mode's copy: `scripts/measure-sunday-chrome.mjs`.** Two
    modes, and the distinction is the whole point.
    `--dom <beforeURL> <afterURL>` drives real Chromium at 390x844 against two
    running dev servers and reports what is ON THE GLASS — this is the
    headline. `npm run sunday:chrome -- --static <beforeRev> [afterRev]`
    reports what the FILES CAN SAY plus the authored-voice floor, and exits
    non-zero if voice falls.
    **Never let a source-derived number stand in for a rendered one.** An
    earlier version counted config prose from the pool — all eight
    `SUNDAY_PERSONALITIES` descriptions — when `SundayPersonalityCard` renders
    one, and scored a screen +1% that the browser measures at -47%. A screen's
    share of a catalogue is not knowable from source, so the static mode does
    not look at config records at all. A report, not a preflight gate.
- **Online** — `comingSoon: true`, not implemented; its tile is hidden while
  `SHOW_COMING_SOON_MODES` (`config/ui.ts`) is false.
- **Challenges** (`/challenge`) — scenario starts from `src/data/challenges.ts`.

## Tech Stack
- **React 18.3.1** + **TypeScript 5.9.3** (non-strict) via **Vite 7.3.2** (SWC plugin)
- **Tailwind CSS 3.4.19** + `tailwindcss-animate` + HSL CSS variables (dark-only theme)
- **shadcn/ui** (Radix + CVA + clsx + tailwind-merge) — 5 files in `src/components/ui/`
- **Zustand 5.0.12** — modular store: `gameStore.ts` composition + **17 slices** + 5 helpers
- **React Router DOM 7.18.3** — **HashRouter** (`#/` URLs). Routes: `/`, `/mode-select`,
  `/select-club`, `/create-manager`, `/challenge`, `/whats-new`, `/subscribe`, `/game`, `*`.
  In-game navigation is a separate system: 60 `GameScreen` ids rendered inside
  `GameShell` (`src/config/navigation.ts`).
- **Framer Motion 12.38** — transitions, match + pack animations (`MotionConfig` honours reduced-motion/perf mode)
- **Recharts 2.15.4** — stats charts · **Sonner 1.7.4** — toasts
- **Capacitor 8.3.1** — iOS/Android (app, browser, haptics, keyboard, splash-screen,
  status-bar, `@capacitor-community/in-app-review`)
- **RevenueCat** `@revenuecat/purchases-capacitor` 12.3.2 (+ `-ui`) — all IAP/subscriptions
- **Sentry** `@sentry/react` 10.49 — crash reporting + game breadcrumbs (`src/utils/sentry.ts`)
- **Vitest 4.1.11 + jsdom + Testing Library** — 304 test files in `src/test/`
- **Husky 9.1.7 + lint-staged 16.4.0** — pre-commit hooks
- **Fonts:** Oswald (headings) + DM Sans (body), self-hosted via `@fontsource/*`
- **Package manager:** npm

## Architecture (~170K LOC hand-written across ~530 files excluding tests, plus ~380K LOC generated data)

```
.claude/
├── commands/            → 13 slash commands (see "Claude Code Slash Commands")
├── settings.json        → permission allow/deny rails (see "Project Settings")
src/
├── App.tsx              → HashRouter, lazy routes, ErrorBoundary scopes,
│                          SaveRecoveryDialog
├── components/
│   ├── game/            → 100 components: TopBar, BottomNav, SubNav, GlassPanel,
│   │                      LineupEditor, SubstitutionSheet, PenaltyShootout,
│   │                      KnockoutBracket, GroupTable, ContractNegotiation,
│   │                      TransferNegotiation, LoanNegotiation, PressConference,
│   │                      PostMatchPopup, ProUpsell, PurchaseModal, TalentTree,
│   │                      StadiumView, WeeklyDigest, OnboardingChecklist, …
│   │   ├── sunday/      → 19 files: the Sunday League component system (above)
│   │   ├── dashboard/   → DashboardMore (the collapsed "More"), DashboardPassRow
│   │   ├── pack/        → 16 files: pack-opening overlay, walkout reveal, deal cards
│   │   └── icons/       → 4 premium icon components
│   ├── ui/              → 5 shadcn/ui files (DO NOT modify unless asked)
│   ├── ErrorBoundary, SaveRecoveryDialog, LoadingOverlay, EmptyState, Skeleton
├── config/              → 45 files: gameBalance, matchEngine, matchSpeed, tactics,
│                          transfers, contracts, training, staff, scouting, youth,
│                          chemistry, personality, playoffs, continental, packs,
│                          monetization, legal, sponsorship, merchandise, managerCareer,
│                          aiManager, aiSimulation, lineupOptimization, navigation,
│                          namePool, playerGeneration, playerAppearance,
│                          sundayLeague, sundayIcons,
│                          managerAppearance, halftimeAnalysis, keyMoments, teamTalk, ui
├── data/                → 19 files + 3 dirs:
│   ├── leagues/         → 45 league files, 37 countries, 756 clubs (real clubs)
│   ├── communityPack/   → GENERATED real-player data (~350K LOC): freeAgents,
│   │                      byClub, cpLeagueSquads — never hand-edit, loaded lazily
│   ├── squads/          → GENERATED per-country club squad templates (FC26)
│   ├── nationalPlayerPool.ts → GENERATED FC26-derived national rosters (~10K LOC)
│   ├── playerPortraits.ts → GENERATED portrait catalog (written by
│   │                      scripts/portrait-batch.mjs)
│   ├── league.ts        → fixture generation, table builder, derbies, country helpers
│   ├── cup.ts           → domestic cup draw/sim (round weeks choreographed, see Gotchas)
│   ├── continentalDraw.ts, nations.ts (65 national teams), challenges.ts,
│   │   pressConferences.ts, storylineChains.ts, boardPitches.ts,
│   │   clubTemplateAliases.ts, whatsNew.ts, pendingNews.ts
├── engine/
│   ├── match.ts         → match sim (2,258 LOC, event-based, minute-by-minute)
│   └── match/helpers.ts
├── hooks/               → 15 hooks: useGameSelectors, useLineupOptimizer,
│                          useSwipeGesture, useKeyboardInset, useFocusTrap,
│                          useReducedMotionPref (the single source of truth for
│                          "should this animate?"), …
├── pages/               → 70 pages: Dashboard (825 LOC), MatchDay, GameShell,
│                          SquadPage, TacticsPage, TransferPage, TrainingPage,
│                          StaffPage, ScoutingPage, YouthAcademy, FacilitiesPage,
│                          FinancePage, MerchandisePage, BoardPage, CupPage,
│                          LeagueCupPage, ContinentalPage, SuperCupPage,
│                          NationalTeamPage, NationalSquadPicker, InternationalTournament,
│                          BallonDor, JobMarket, CareerOverview, ManagerCreation,
│                          ModeSelect, PacksPage, ShopPage, SubscribeOnboarding,
│                          WhatsNewPage, SettingsPage, HelpPage, ClubSelection, …
├── store/
│   ├── gameStore.ts     → Zustand composition of 17 slices
│   ├── storeTypes.ts    → GameState interface (744 LOC)
│   ├── slices/          → core, club, transfer, match, systems, orchestration,
│   │                      loan, cup, feature, sponsor, merchandise, monetization,
│   │                      nationalTeam, career, packs, sunday, managerPass
│   │   ├── orchestrationSlice.ts (1,546 LOC — façade) delegating to:
│   │   └── orchestration/ → weekAdvance.ts (3,181 LOC — THE game loop),
│   │                        seasonEnd.ts (2,240 LOC), matchActions.ts (2,160 LOC),
│   │                        initGame.ts (742 LOC), tournaments.ts, playoff.ts,
│   │                        worldCupMatchActions.ts, communityPackRuntime.ts, helpers.ts
│   └── helpers/         → persistence.ts, idbStorage.ts, matchProcessing.ts,
│                          development.ts, rosterOps.ts
├── types/game.ts        → ALL types (3,832 LOC): Player, Club, Match, LeagueInfo,
│                          10 formations, 60 GameScreens, MonetizationState,
│                          CareerManager, NationalTeamState, PackTierDefinition, …
├── utils/               → 106 files + `sunday/` (18): playerGen, saveMigration (v93),
│                          purchases (RevenueCat wrapper), monetization, ads (stub),
│                          packGeneration, communityPackPool, international,
│                          managerCareer, continental, continentalCoefficients,
│                          ballonDor, penaltyShootout, substitutionLogic, analytics,
│                          sentry, appReview, haptics, promotionRelegation, …
├── test/                → 304 test files incl. longevity/stress suites, adversarial
│                          season tests, release-readiness, render hygiene,
│                          launch-crash guardrails, balance reports, perf
├── index.css            → Tailwind + CSS vars (incl. pack tier palettes, perf-mode,
│                          the reduce-motion kill switch)
└── main.tsx             → entry: Sentry init, storage hydration, Capacitor setup
```

## Critical Files (read these first)
1. **`src/store/slices/orchestration/weekAdvance.ts`** — THE game loop (3,181 LOC). `advanceWeek()`: training, development, AI sims, injuries, finances, offers, cups, continental, international windows, objectives.
2. **`src/store/storeTypes.ts`** — complete `GameState` interface (744 LOC).
3. **`src/types/game.ts`** — all types (3,832 LOC). Single source of truth.
4. **`src/config/gameBalance.ts`** — central balancing constants. Check here before hardcoding values.
5. **`src/engine/match.ts`** — match simulation (2258 LOC).
6. **`src/data/leagues/index.ts`** — aggregates 45 leagues / 756 clubs; `src/data/league.ts` for fixtures/tables/derbies.
7. **`src/utils/playerGen.ts`** — player generation, overall calc, squad building.
- **Pack pulls sign on a discount (`PACK_WAGE_FACTOR`, 0.55)** that lives on the
  player as `Player.wageFactor` and is re-applied by `recomputeDerivedEconomics`
  on every development tick. It has to be a property of the player, not a
  signing-time adjustment, or the discount evaporates on the first recompute and
  the wage silently doubles between seasons. It applies to FREE pulls too — that
  keeps it a property of "arrived via a pack" rather than of "was paid for", and
  therefore clear of the rule that monetization never moves a sim parameter.
  Measured reason it exists: one $6.99 Rare Gold used to add ~£920k/week, 58% of
  a mid-table club's entire wage bill, so buying a pack made your club worse off.

8. **`src/utils/saveMigration.ts`** — save schema `CURRENT_VERSION = 93` + migration chain. Every state-shape change bumps it.
9. **`src/config/monetization.ts` + `src/utils/purchases.ts` + `src/utils/monetization.ts`** — product catalog, RevenueCat wrapper, entitlement checks (see Monetization).
10. **`src/store/slices/orchestration/seasonEnd.ts`** — end-of-season: aging, contracts, promotion/relegation cascade, awards, fixtures.

## League & Competition Structure

**Real-world football.** `src/data/leagues/` defines 45 leagues across 37
countries with 756 real clubs (Arsenal, Barcelona, Bayern…), each with its own
`LeagueInfo`: `tier`, `teamCount`, `totalWeeks` (e.g. Premier League = 20 teams /
38 weeks), `promotionSpots` / `relegationSpots` / `playoffSpots`, prize money,
average wage, difficulty. Multi-tier pyramids with promotion/relegation +
playoffs: **England (4 tiers), Germany (3), Spain/Italy/France (2)**; the other
32 countries are single-tier. `leagueConstants.ts` groups the 30 European
leagues into selection regions; the rest (Argentina, Brazil, MLS, Saudi
Arabia, South Korea, Australia, India) ship as additional league data. Real
derbies carry match intensity (`DERBIES` in `league.ts`).

**Domestic cups:** main knockout Cup (R1 week 4 → Final week 43) + League Cup
(final week 40) per `src/data/cup.ts`.

**Continental:** Champions Cup, Shield Cup, Conference Cup (32 teams each;
Champions Cup = 8 groups of 4 then knockout) + Super Cup. Qualification spots
are allocated by league rank (1–30) from coefficients
(`src/config/continental.ts`, `src/utils/continentalCoefficients.ts`).

**International:** 65 national teams (`src/data/nations.ts`) across 5
confederations with FC26-derived player pools. The manager can receive
national-team job offers and run 23-man squads through international
tournaments alongside the club job (`nationalTeamSlice`, `utils/international.ts`).

**Individual awards:** Ballon d'Or ceremony each season (`utils/ballonDor.ts`).

## Monetization (Dynasty Pro + packs) — READ BEFORE TOUCHING PAYWALL CODE

All IAP goes through RevenueCat (`src/utils/purchases.ts`). Product catalog
and Pro feature list live in `src/config/monetization.ts`; entitlement checks
in `src/utils/monetization.ts`; state in `monetizationSlice`.

- **Dynasty Pro SKUs:** one-time `com.dynastymanager.pro`, subscriptions
  `.pro.monthly` / `.pro.yearly` (⚠ the real ASC/RevenueCat product ID is
  `.yearly`, not `.annual` — see the entitlement invariants below; `annual`
  only survives as the internal `SubscriptionTier` label), one-time
  `.pro.lifetime`, and the
  `bundle.all` "Dynasty Edition" (Pro + all cosmetic packs). USD prices in
  config are fallbacks — real prices come localized from the store.
- **Pro features:** `ad_free` (listed only while ads exist), `advanced_analytics`,
  `custom_tactics`, `expanded_press`, `historical_records`, `instant_sim` (see
  `config/matchSpeed.ts`), `optimize_lineup`, `pro_badge`, `manager_pass_pro`
  (the Manager Pass Pro row — cosmetic, see below). The paywall's bullet list
  (`PRO_FEATURE_BULLETS` in `SubscribeOnboarding`) is hand-kept in step.
- **Cosmetic packs:** manager identity / stadium atmosphere / legends —
  permanent entitlements with an in-game cosmetics catalog.
- **Consumable player-pack IAPs:** gold / premium_gold / rare_gold / icon —
  consumed per open, NEVER stored as entitlements, NEVER restorable.
- **Free trial:** `FREE_TRIAL_DAYS` intro trial (currently 7) → **Yearly**
  plan (`TRIAL_TARGET_PRODUCT_ID`; retargeted from Monthly by #610 — a trial
  converting to $24.99/yr is worth multiples of one converting to $4.99/mo).
  Both Monthly and Annual are in `SUB_TRIAL_PRODUCT_IDS` and must stay in the
  same ASC subscription group, or the eligibility probe misdescribes one of
  them. (`startFreeTrial` is a no-op if ANY subscription record exists —
  prevents trial-restart abuse.) **Trials are per plan, from the store:**
  `resolvePaywallTrials` (`utils/monetization.ts`) offers a trial on a plan
  only when its store product has a free intro offer (length read via
  `freeIntroOfferDays` in `utils/purchases.ts`) AND the store confirms this
  Apple ID is eligible; unknown eligibility shows nothing, and
  `FREE_TRIAL_DAYS` is only the off-device default. The paywall preselects the
  trial plan (`preferredPaywallPlan`); the Shop and the in-game Pro banners
  share one time-boxed probe (`probePaywallTrials` / `probeTrialOfferDays` in
  `utils/trialOffer.ts`), so no surface names a trial the paywall withholds.
  Owner confirmed 2026-09-25: Pro Yearly and Pro Monthly both carry one in ASC.
  **Starter Kit** is a 7-day-from-first-launch offer.
- **One purchase + restore path:** `utils/purchaseSync.ts` (`purchaseAndSync`,
  `restoreAndSync`, `syncStoreState`) is the only purchase → grant → sync code
  for non-consumables — the paywall, the Shop and Settings → Restore all call
  it (pinned by `iapLifecycle.test.ts`). Do not add a surface-local copy.
  Consumable packs prove payment through the pending-credit marker in
  `utils/packCreditRecovery.ts` instead.
- **Verification:** `docs/iap-verification.md` — the ASC/RevenueCat
  configuration the code assumes, the SKU × flow matrix with the test pinning
  each cell, and the device checklist to run on a TestFlight build.
- **Redeem codes** (`utils/redeemCodes.ts`, offline HMAC-signed money/XP
  codes): a production build redeems nothing — and hides Settings → Redeem
  Code — unless `VITE_REDEEM_SECRET` (at least `MIN_REDEEM_SECRET_LENGTH`
  chars, never the public dev secret) was set at build time. Both release
  workflows pass it from an OPTIONAL repo secret; unset means disabled. Every
  code is capped by `REDEEM_CODE_MAX_REWARD` (`config/gameBalance.ts`). Codes
  never grant Pro — comp Pro through RevenueCat promotional entitlements.

### Manager Pass + Legacy (cosmetic meta layer)

- **Manager Pass** (`config/managerPass.ts`, `utils/managerPass.ts`,
  `managerPassSlice`, `ManagerPassPage`): a real-calendar season of two
  months, 30 tiers, a free reward every third tier and a Pro reward on every
  tier (`isPro()`-gated). Every reward is a cosmetic (title, celebration line,
  banner); Pass XP is its own currency, never manager XP. XP comes from
  `utils/managerPassObserver.ts` (attached by GameShell), which reads
  monotonic career counters, so replaying a match after a reload pays nothing.
- **Device-level, never in a save:** the record lives in localStorage
  (`STORAGE_KEYS.MANAGER_PASS`) with a write-through IndexedDB copy under the
  same key, stamped with a write counter (`rev`); `hydratePassStorage`
  reconciles the two once at start-up (newer copy wins, collected cosmetics are
  the union). `state.managerPass` is only a render cache — every action
  re-reads storage, rolls the season and writes back. No save-schema bump.
- **Season rollover** collects reached rewards for the player (free always,
  Pro while `isPro()`). Pro rewards reached while the device read not-Pro
  (e.g. a renewal not yet synced) become `proCarry`, collectable once Pro is
  confirmed during the NEXT season only.
- **Surfaced** on the Dashboard (one row, collect count from
  `passHomeSummary`), with a badge on the More drawer row, and as
  `manager_pass_pro` on the paywall and in the Shop.
- **Dynasty Legacy** (`utils/managerLegacy.ts`): lifetime tier from Hall of
  Managers trophies; each tier unlocks cosmetics and a job-market reputation
  bonus in Manager Career (`LEGACY_TIER_UNLOCKS`) — never a match result.

### Entitlement invariants (violating these = revenue bugs)
1. `isPro()` in `utils/monetization.ts` is the ONLY source of truth for Pro.
2. Only `PRO_ONE_TIME_PRODUCT_IDS` may be checked against
   `monetization.entitlements`. Subscription status lives EXCLUSIVELY in
   `subscription.expiresAt` — RevenueCat keeps expired subs in
   `allPurchasedProductIdentifiers` forever, so checking sub SKUs against
   entitlements grants permanent Pro to lapsed subscribers.
3. The RevenueCat **hosted paywall is banned** — removed after App Store
   rejection (Guideline 3.1.2(c)). All Pro purchase flows go through the
   in-app `SubscribeOnboarding` page, which renders Apple's required
   disclosures. Do not reintroduce `presentPaywall`.
4. Monetization must NEVER modify match outcomes, training rates, transfer
   values, or any sim parameter (header contract in config + utils).
5. Off-device (web/dev), purchases are mocked to succeed
   (`purchaseProduct` → `[productId]`, `purchaseConsumable` → `true`).
   Real purchase paths only run on device.
6. Every `ProductId` string in code MUST byte-for-byte match the product
   identifier registered in App Store Connect / Google Play / RevenueCat —
   StoreKit and RevenueCat match by exact string, and a mismatch fails
   silently (product resolves as "not available," not an error). Apple does
   not allow renaming a product ID after creation, so if code and store ever
   disagree, **fix the code, never assume the console is wrong.** (This
   invariant exists because it was violated: the Yearly subscription shipped
   as `com.dynastymanager.pro.annual` in code against a store product actually
   registered as `com.dynastymanager.pro.yearly`, making Yearly unpurchasable
   on device until fixed 2026-08-23.)

### Observability: Sentry wired but inert until its secret is set; analytics has no transport by design

`VITE_SENTRY_DSN` is passed through in `ios-testflight.yml` /
`android-build.yml`. `sentry.ts` no-ops when the DSN is empty at build time,
so crash reporting stays silent until the `VITE_SENTRY_DSN` **repo secret**
is confirmed set (GitHub → Settings → Secrets and Variables → Actions — this
can't be verified from the repo itself). See `marketing/ads/RELEASE-READINESS.md`
§8 for the setup steps.

`src/utils/analytics.ts` has **no endpoint and no `VITE_ANALYTICS_ENDPOINT`
anywhere in this repo** — the sink is hardcoded local-only (dev builds
`console.info`; production is a silent no-op), by deliberate decision:
product analytics travel via RevenueCat + App Store Connect instead of a
first-party pipeline (`marketing/ads/RELEASE-READINESS.md` §1.3, decided:
delete). Don't reintroduce a transport without revisiting that decision, and
every conversion rate in `marketing/ads/unit-economics.mjs` stays unmeasurable
— and must be labelled an assumption, never a fact — until RevenueCat/ASC
data exists.

### Ads: disabled in V1
`@capacitor-community/admob` is fully removed (it crashed TestFlight builds —
see the saga above). `src/utils/ads.ts` is a stub with
`NATIVE_ADS_READY = false`; `AdRewardButton` and pack ad-slots gate off it.
The ad-reward config (budget boosts, double XP, limits per season) is retained
in `config/monetization.ts` for a future re-enable — re-enable steps are
documented in `ads.ts`.

## The Market (packs) — live feature

The Market tab is `transfers` → `scouting` → `packs`; `PacksPage` is the store.
`config/packs.ts` is the single source of truth for what is on sale, what it
contains, what it costs, and what its odds are.

**Structure (top to bottom): Limited deals → This Week → Free Today → Always available.**

| Slot | Tier key | Price | Contents |
|---|---|---|---|
| Free Today | `daily` — *Rise to Glory* | free, 1/day (+1 per ad when ads ship) | 3 players, floor rises with login streak: 66+ → 69+ → 72+ → 75+ at day 7 |
| Always available | `bronze` — *Bronze Pack* | free, 1/day | 3 players, 60+ guaranteed |
| Always available | `silver` — *Silver Pack* | free, 1/day | 3 players, 70+ guaranteed |
| Always available | `gold` — *Gold Pack* | $2.99 | 5 players, 78+ guaranteed |
| Always available | `premium` — *Elite Pack* | $4.99 | 5 players, 82+ guaranteed, 3% Hall of Legends chance — **BEST VALUE** |
| Always available | `rare` — *World Class Pack* | $6.99 | 5 players, 84+ guaranteed, walkout possible, 8% legend chance |
| Always available | `icon` — *Legends Pack* | $9.99 | 1 player, 88+ guaranteed, walkout guaranteed, 25% legend chance |

- **`PACK_STOREFRONT_ORDER` is what renders, not `PACK_TIERS`** — adding a tier
  to `PACK_TIERS` does not put it on sale. Today it holds every tier:
  `daily`, `bronze`, `silver`, `gold`, `premium`, `rare`, `icon`. Bronze and
  Silver came back on the permanent shelf (commit `7dcb69f`, see
  `docs/pack-store-rotation.md`) with ONE free daily open each and no IAP
  product; they are no longer archived. `OpenedPackRecord`s in shipped saves
  still resolve label/art through `PACK_TIER_MAP`, so a tier is never deletable.
- **Three free packs a day, one streak pack.** `FREE_PACK_TIER` (`daily`) is the
  streak-scaled free pack in Free Today; Bronze and Silver carry their own
  `freeDailyLimit: 1`. A test pins the free tiers to exactly
  `['daily', 'bronze', 'silver']`.
- **Limited deals.** `PACK_DEAL_SLOTS` run three epoch-aligned windows over the
  paid tiers in `PACK_DEAL_TIERS` (`weeklyEligible` only — never the one-card
  Legends pack): 4 h +3 cards, 12 h +2, 24 h +1 (`utils/packDeals.ts`). Windows
  use the persisted high-water clock, so reopening the store never resets one.
  Bonuses do not stack — a card sells the larger of its deal and weekly bonus.
- **Weekly featured offer.** `getFeaturedPackTier(currentWeekIndex())` rotates
  over `FEATURED_PACK_ROTATION` on the REAL week (it used to key on the in-game
  week, so the headline changed several times per sitting). The first purchase
  of the featured pack each week ships `WEEKLY_BONUS_CARDS` extra cards at its
  guaranteed floor; the claim is device-global (`readWeeklyPackBonus`), so it is
  not per-save and not re-rollable by force-quitting. **There is no weekly SKU
  and there cannot be one** — Apple will not let the client invent a product ID,
  so the weekly offer is a contents bonus on an existing consumable.
- **Weekly promo skins.** `WEEKLY_PACK_SKINS` gives the featured slot its own
  name and cover (The Dynasty / Golden Era / Royal Reserve). A skin changes
  `label` and `artSrc` ONLY — a test asserts contents and odds are untouched.
- **Published odds are mandatory, not optional.** `describePackOdds` derives the
  drop-rate table from the same config the generator rolls, and `PackOddsSheet`
  is linked from every pack card. App Store Guideline 3.1.1 requires randomized
  paid items to disclose odds before purchase; this app shipped four randomized
  consumable SKUs disclosing nothing until the Market redesign. Never
  hand-author an odds table.
- **`packEliteCardsPerDollar` decides who wears BEST VALUE**, and a test asserts
  the badged tier is its argmax. The badge is not a marketing decision.
- **Streak** comes from the existing login streak (`readDailyStreak` +
  `evaluateDailyStreak`) read INSIDE the slice — never passed in by the page, or
  a caller could hand itself the day-7 pack on day one.
- **Art chain** is `artSrc` → `artLegacySrc` → tier gradient, so new covers can
  be referenced before the files ship. Covers live in `public/packs/`; three
  tests pin that every referenced cover exists, nothing unreferenced ships, and
  everything is `.webp` (the source PNGs are ~3.2 MB each, the webp ~0.47 MB).
- **Pack card frames.** A card pulled AT OR ABOVE its pack's guaranteed floor
  keeps that pack's frame forever (`Player.packFrame`, art in
  `public/player-cards/`, registry `PACK_CARD_FRAMES`). Precedence in
  `getPlayerCardArt`: Ballon d'Or > pack frame > OVR tier shield. Two rules make
  it worth having and both are tested: the **floor gate** (sub-floor filler
  keeps its tier art, so a frame always means a good card and the squad-list
  tier read survives) and **weekly frames cannot be farmed** (Dynasty / Golden
  Era / Royal Reserve are awarded only while their week runs). Purely
  cosmetic — a frame never touches a sim parameter. An unknown frame id
  resolves to `null` and falls back to tier art, so a frame can be retired
  without breaking saves.
- ⚠ **ASC action item:** the four consumables' in-app display names are the
  `PACK_TIERS[].label`s — *Gold Pack / Elite Pack / World Class Pack / Legends
  Pack* (Gold is back from *Champions*, which survives as its card frame) — and
  the cosmetic pack became *Dynasty Legacy Pack*. Product IDs are frozen; the App
  Store Connect and Play Console **display names** must match or the purchase
  sheet names a different item than the card that opened it.

- **Pack pulls are REAL players, with duplicates allowed.** `rollPackPlayer`
  draws from `nationalPlayerPool.ts` via `pickRealPlayerForPack`, which
  deliberately does NOT claim: there are only 28 templates rated 88+ and 8 at
  90+, all already on clubs at kickoff, so a claiming Icon Pack would find
  nobody and silently deal an invented player. A pull is a *card of* a player —
  you can pull Haaland while Haaland plays for City. The band selects which
  real players are eligible; the template brings its own rating (a 74-rated
  Mbappé is worse than no Mbappé). Duplicates within ONE pack are prevented;
  duplicates across packs are the chase. Falls back to a generated player only
  when a band has nobody at a position.
- **Card versions.** Every card a paid pack deals is that pack's VERSION of the
  real player: +N to every attribute and overall (`versionBoost` — Champions +1,
  Elite +2, World Class +3, Legends +4; the free Daily deals base cards), priced
  from the boosted rating. Config band numbers are FINAL ratings; generation
  picks the template at (final − boost). This is also the top-end supply fix: an
  88+ guarantee draws on the 122 base players at 84+, not the 28 at 88+, and a
  Legends issue of the world's best (91) is honestly a 95. Weekly promo skins
  add `extraBoost: 1` for their week only — `packVersionBoostFor` mirrors
  `packFrameFor` and the two must never date apart (frame = the claim, boost =
  what the claim is worth). A promo may only make the pack BETTER: same price,
  cards, floor and odds weights, pinned by test.
- **`npm run packs:supply` guards that.** It reads the storefront bands out of
  `config/packs.ts` and the ratings out of the generated pool, and fails if a
  band cannot be filled or if a tier's `ovrMax` exceeds the best player alive.
  **Run it after any player-data import** (FC26/FC27/etc.) — it is in preflight
  precisely because a short band does not break anything visibly, it just turns
  the packs back into strangers.

Player identities draw from the **community pack** real-player dataset
(`src/data/communityPack/` — generated, lazily imported) with
`utils/communityPackPool.ts` + `npm run validate-cp` for integrity.

## Persistence & Saves

- **3 save slots + per-slot backups.** Two-layer storage: module memory cache
  for sync reads + **IndexedDB as the authoritative store** (localStorage is a
  best-effort mirror and the migration source for old installs — WKWebView
  caps localStorage at ~5MB, which full saves exceed).
  `hydrateSaveStorage()` runs at app start. Legacy `'dynasty-save'` key is
  migrated then removed.
- ALL storage access goes through `src/store/helpers/persistence.ts`
  (`readSaveSlot`, `getFlag`/`setFlag`, `readSessionJson`, …). New keys
  register in `STORAGE_KEYS`. Direct `localStorage` use is ESLint-banned.
- **Save schema version `93`** in `utils/saveMigration.ts`. Any change to
  persisted state shape bumps `CURRENT_VERSION` and adds a migration step.
  v93 added `careerId`: the Hall of Managers keys one row per career on it
  (`hallEntryId`; a career older than v93 keeps its `slot-N` row), keeps
  `HALL_MAX_STORED` (100) rows and shows `HALL_DISPLAY_MAX` (20).
- **Device-level records are not in any save** — daily streak, live-event
  progress, redeemed codes, the Hall of Managers and the Manager Pass live in
  device storage through `persistence.ts`, so a new career neither resets nor
  duplicates them. Don't add them to the save payload.
  `SaveRecoveryDialog` + backup slots handle corrupted saves; parse failures
  breadcrumb to Sentry.

## Code Conventions
- **TS non-strict** (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`). Use `interface` > `type` for objects.
- **Components:** Functional + hooks. Default export for pages, named for shared.
- **Styling:** Tailwind only. Use `cn()` for conditionals. Glass = `bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl`.
- **State:** All game logic → Zustand slices in `src/store/slices/`. Never in components.
- **Config:** Game balance constants go in `src/config/`, not hardcoded in logic files.
- **Imports:** `@/` alias. Order: external → `@/components/ui` → `@/components/game` → local.
- **Naming:** camelCase vars, PascalCase components/types, UPPER_SNAKE constants.
- **Heavy data stays behind dynamic `import()`** — `npm run size:check` enforces an eager-bundle budget; community-pack data must never be imported eagerly.

## Design Language
- Dark theme only, HSL CSS vars (see `src/index.css`) — includes pack-tier palettes (`--pack-<tier>-*`)
- Primary/Gold: `43 96% 46%` | Background: `222 30% 7%` | Accent: `215 60% 50%`
- Mobile-first: `max-w-lg mx-auto`, bottom nav, safe-area padding
- Rating colors: >=80 emerald, >=70 primary, >=60 amber, <60 muted
- **Player-card art is 2:3 and its alpha is the card's edge.** Every file in
  `public/player-cards/` is 1024x1536. `PlayerCard` renders `md`/`lg`/`xl` at
  `aspect-[2/3]` with NO rounded container, no cast shadow and the legibility
  scrim masked to the artwork — a box behind a scalloped shield or a pointed
  pack frame shows through the corners as a rectangle the card does not have.
  The two small tokens (`xs` tactics tile, `sm` bench strip) are chips, not
  cards: they keep `aspect-[3/4]`, crop the art to fill, and DO get the rounded
  box, because at 52px it is their edge. `PitchBoard`'s empty-slot placeholder
  is hardcoded `aspect-[3/4]` to match `xs` — change one and change both.
- Club colors are the only place where inline `style={{ backgroundColor }}` is acceptable
- **Performance mode** (`settings.performanceMode`) toggles a root `perf-mode`
  class that strips backdrop-blur/decorative layers and forces reduced motion.
  It strips `.glass-surface` specifically — a component that blurs through a
  bare `backdrop-blur-*` utility (LiquidButton does) is NOT covered.
- **Reduced motion** (the in-app setting, Performance mode, or the OS
  preference) reaches three layers: `MotionConfig` (framer-motion), and in
  `index.css` the `@media (prefers-reduced-motion)` block plus the root
  `.reduce-motion` class App.tsx sets from the setting / Performance mode.
  The CSS layers collapse every CSS `transition` and keyframe animation to
  ~0 ms (shortened, not removed, so `transitionend`/`animationend` still
  fire), stop the infinite `animate-pulse`/`bounce`/`ping` loops and slow
  `animate-spin`. **Nothing global reaches motion driven from JS** — rAF
  loops, timers, style updated over time (e.g. the walkout OVR count): that
  code must ask `useReducedMotionPref()`. Decorative layers return `null`;
  they do not merely freeze.

## Key Patterns
- **Game loop:** `advanceWeek()` in `orchestration/weekAdvance.ts` — training, development, AI sims, injuries, income, messages, offers, weekly objectives, cup/continental/international scheduling.
- **Match sim:** `simulateMatch()` → Match with events; MatchDay renders live with interactive subs, team talks, set pieces, penalty shootouts. Match speed tiers in `config/matchSpeed.ts` (instant sim = Pro). **Skip to full time** is free from half-time and Pro from kickoff (`SKIP_TO_FULL_TIME_PHASES`), on the live row and the Paused panel; it is playback-only (`utils/skipToFullTime.ts` makes the same store calls the clock would). **Neutral venues:** `Match.neutral` (optional; absent = home ground) is set on domestic and continental finals, both Super Cups, the promotion-playoff final and international-tournament matches; the engine then gives both sides the away factor (`homeAdvantageFactor`, `NEUTRAL_VENUE_ADVANTAGE`).
- **Home (Dashboard):** one Continue button (`selectPrimaryAction`) → "Needs your attention" (`selectAttentionItems`, actionable rows only) → the Getting Started checklist (first session, then coach tasks through `COACH_CHECKLIST_MAX_SEASON`) → the next match → live-event / starter-kit banners and the Manager Pass row → "More" (`DashboardMore`, collapsed, remembered per device). Rules live in `utils/dashboardSelectors.ts`.
- **Popup cap:** `utils/presentationQueue.ts` orders post-advance overlays and spends a budget of `BLOCKING_POPUPS_PER_ADVANCE` (2) per advance. Past it, each overlay follows its `OVERLAY_OVERFLOW` policy: decisions (press conference, storyline, transfer talk, national-team offer — ordered first), trophy lifts, the session recap and the daily reward always show; informational popups are filed to the inbox (`fileOverflowToInbox`, converters in `utils/overlayInbox.ts`); permission asks and offers wait for the next advance.
- **New game:** ClubSelection defaults the nationality from the device locale (`utils/localeNation.ts`) and offers a one-tap **Quick Start** club for it (`config/quickStart.ts`, `utils/quickStart.ts`); ManagerCreation defaults the manager's nationality the same way.
- **Player dev:** young (<24) grow toward potential, vets (>=31) decline. Per-attribute probability via `store/helpers/development.ts`.
- **Transfers:** buy `makeOffer()`, sell `listPlayerForSale()`, respond `respondToOffer()`. Windows: **weeks 1–8 and 20–24** (`config/transfers.ts`).
- **Loans:** separate system via `loanSlice.ts` — incoming/outgoing offers and deals.
- **Season end:** `orchestration/seasonEnd.ts` — aging, contracts, replacements, new fixtures, stat reset, promotion/relegation cascade across all 45 leagues, awards, Ballon d'Or.
- **Career mode:** `careerSlice` + `utils/managerCareer.ts` — vacancies, board-pitch interviews (`data/boardPitches.ts`), contract negotiation, bonuses, sackings, retirement.
- **Progression:** manager perks (TalentTree), prestige, achievements, milestones, records, Hall of Managers (one row per career), Dynasty Legacy, Manager Pass (see Monetization › Manager Pass + Legacy).
- **Narratives:** storyline chains, press conferences, player narratives, random events, weekly digest.
- **Observability:** Sentry with game breadcrumbs (`utils/sentry.ts`). `utils/analytics.ts` is local-only — no transport (see Monetization › Observability). Its consent gate is still in code, but nothing grants consent: the first-launch consent modal and the Settings toggle were removed with the transport.

## Key Gotchas
- `club.lineup` and `club.subs` are **string arrays of player IDs**, not Player objects.
- Always `filter(Boolean)` after mapping playerIds to players — some IDs may reference deleted players.
- When selling a player, must update: seller (playerIds/lineup/subs/wageBill/budget), buyer (same), player's clubId, AND remove from transferMarket.
- Match results must update BOTH the fixtures array AND individual player stats (goals, assists, etc.).
- `advanceWeek()` resets `matchSubsUsed`; the player's own match runs via `playCurrentMatch()`, not inside `advanceWeek()`.
- Store uses `set()` with spread — always spread nested objects before modifying or you'll mutate state.
- **Cup-week choreography is load-bearing:** domestic Cup Final sits at week 43 specifically to dodge the continental SF legs (41–42), continental Final (44), and League Cup Final (40). The player's continental knockout ties are NOT auto-simulated by `weekAdvance`, and a same-week collision can strand a tie unresolved and hang the tournament. Read the comment block in `src/data/cup.ts` before moving any round week.
- **Never check subscription SKUs against `monetization.entitlements`** — see Entitlement invariants above.
- **Generated data is not source code:** `src/data/communityPack/*`, `src/data/squads/*`, `src/data/nationalPlayerPool.ts` and `src/data/playerPortraits.ts` are tool-generated. Never hand-edit; regenerate via the fc26/scrape scripts (portraits: `scripts/portrait-batch.mjs`).
- HashRouter: deep links are `#/route`; route changes don't hit the server.
- `package.json.version` must never regress below the top `whatsNew.ts` entry (latest shipped v1.6.0) — the guard fails the TestFlight and Android builds.

## Commands
```bash
# Development
npm run dev          # Dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run test         # Vitest (304 test files)
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check (standalone)
npm run size:check   # Bundle budgets (eager gz, main chunk, core JS, community pack)
npm run sunday:chrome -- --static <before-rev> [after-rev]   # copy meter (source side + voice floor)
# headline copy measurement — two dev servers, real Chromium:
#   node scripts/measure-sunday-chrome.mjs --dom http://127.0.0.1:8086 http://127.0.0.1:8085
npm run preflight    # lint + typecheck + docs/i18n/packs checks + FAST tests + build + size:check (per commit)
npm run preflight:full # ...plus the long-running suites (what CI enforces)
npm run test:fast    # Vitest minus the slow season/longevity suites
npm run docs:check   # Check this file's numbers against the code (-- --fix to update)
npm run analyze      # Build with bundle visualizer

# Git workflow
npm run ship -- "commit message"   # Preflight + commit + push (one command)
npm run branch -- feature-name     # Create branch from latest origin/main

# Versioning / release notes
npm run version:check              # Marketing-version regression guard (local)
npm run version:sync               # Sync version across native projects
npm run whats-new -- <cmd> "..."   # Append release-note bullets (see top of file)
npm run whats-new:plan|seal|check

# Mobile (Capacitor)
npm run cap:sync     # Build + sync to native projects
npm run cap:ios      # Open Xcode project
npm run cap:android  # Open Android Studio project

# Player-data pipelines (community pack / icons)
npm run validate-cp                  # Validate community-pack data integrity
npm run analyze-fc26                 # Analyze FC26 source dataset
npm run process-fc26                 # Regenerate community-pack data files
npm run scrape:icons:setup           # one-time: download Chromium (~150MB)
npm run scrape:icons                 # SoFIFA Icons scrape (Playwright; also a GitHub Action)
```

## Git Workflow for Claude Sessions

**See the MANDATORY section at the top of this file. The rules there override everything.**

Quick reference:
- `npm run ship -- "msg"` = preflight + commit + push (preferred one-liner)
- `npm run branch -- name` = new branch from origin/main
- `npm run preflight` = lint + typecheck + docs:check + i18n:check + fast tests + build + size:check (per commit)
- `npm run preflight:full` = the same with the long-running suites — run before a release
- After push → always give the user: `https://github.com/Wrexist/dynasty-manager/pull/new/<branch>`
- `gh pr create` is FORBIDDEN — no GitHub API auth available. GitHub MCP tools (`mcp__github__*`) use separate auth and ARE available where configured.

## Claude Code Slash Commands

Project commands live in `.claude/commands/` (one markdown file each, available
as `/<filename>`; include `$ARGUMENTS` for user input):

| Command | Purpose |
|---------|---------|
| `/balance` | Game balance tuning across the 45 config files |
| `/feature` | Feature scaffolding (types → config → slice → page → tests) |
| `/match-engine` | Match engine development (engine/match.ts + helpers) |
| `/test` | Test generation following existing Vitest patterns |
| `/review` | Code review against project gotchas and conventions |
| `/refactor` | Safe extraction from large files (weekAdvance, Dashboard, …) |
| `/season` | Promotion/relegation, playoffs, cups, season-end logic |
| `/brainstorm` | Feature exploration for Dynasty Manager |
| `/batch` | Iterative autonomous work loop |
| `/ad-meta` | Meta/Instagram/Reels ad brief (reads `marketing/`) |
| `/ad-tiktok` | TikTok ad brief (reads `marketing/`) |
| `/marketing-playbook` | UA strategy reference (budgets, CPI, SKAN) |
| `/goals` | Pick up the next open item from `GOALS.md` (now: `docs/audit-2026-09-25.md`) |

## Claude Code Project Settings

- `.claude/settings.json` — permission rails, version-controlled:
  - **Allowed:** the npm workflow scripts, read-only git, `git add <paths>`,
    `git commit`, `git push -u origin*`, read-only GitHub MCP operations.
  - **Denied:** `gh pr create`, `git add -A`, `git add .`, `git push --force`,
    `git reset --hard`, `git clean -f`, `rm -rf`, `npm publish`.
- `.mcp.json` — context7 MCP server for real-time library docs.
- `.claude/CLAUDE.md` — the user's standing session rules (do not edit).

## Marketing Kit

User-acquisition creative lives in `marketing/` and is the canonical context
for the `/ad-meta`, `/ad-tiktok`, and `/marketing-playbook` commands:

```
marketing/
├── README.md              ← kit overview + ASO leak checklist
├── scripts/               ← frame-precise ad scripts (Meta + TikTok)
├── posters/               ← static HTML poster ads at 1080×1920 + render-all.sh
├── postproduction/        ← build-ad.sh ffmpeg pipeline + captions template
└── ai-prompts.md          ← Runway / Veo / Sora prompts for AI bookend footage
```

`CinematicCapturePage` (Rare-Gold walkout loop with synthetic players for 9:16
ad capture) still exists in `src/pages/`, but its route and Settings entry are
**currently disabled** — re-enable via the commented-out import + route in
`src/App.tsx` when footage is needed.

## CI/CD (`.github/workflows/`)
- **`pr-checks.yml`** — PR validation: runs `npm run preflight:full` by name (lint, typecheck, docs/i18n/pack-supply checks, full suite, build, bundle budgets); a new push cancels the superseded run
- **`ios-testflight.yml`** — manual-dispatch iOS TestFlight deploy (seal + version guard + fastlane)
- **`android-build.yml`** — manual-dispatch Android AAB build: `version_name` blank = package.json, marketing-version guard, `preflight:full`, What's New seal + stamp (`version_code`)
- Both release builds pass the optional `VITE_REDEEM_SECRET` repo secret to the web build (unset = redeem codes disabled)
- **`append-pending-news.yml`** — auto-appends release-note bullets on PR merge
- **`release.yml`** — version bump on `v*` tag push (stages only package.json, the lockfile and the two native version files)
- **`scrape-icons.yml`** — SoFIFA icon scrape as a manual Action

## Known Tech Debt
- **i18n is a started migration, not a finished one.** `src/i18n/` (hand-rolled
  `t()`, English always loaded as fallback) works and 114 of 217 files in
  `src/pages` + `src/components/game` use it, but **1,023 player-facing strings in
  117 files are still hardcoded English** (2026-09-25; `npm run i18n:check` prints
  the live count and fails above the ceiling in `package.json`). `sv.ts` covers
  77 of `en.ts`'s ~565 keys and **nothing calls `setLocale` outside tests** — there is
  deliberately no language picker, because shipping one today would give a
  mostly-English "Swedish" UI. Don't advertise localisation until the count is
  near zero. The meter itself lied for a while (it skipped every line containing
  `className=`, i.e. every JSX text node, and reported 0) — see the correction in
  `docs/CRITICAL-REVIEW-2026-08.md` §17.
  **Release-scope decision (2026-08-23, v1.5.0):** i18n is explicitly deferred
  for this release — not a goal, not on the roadmap for this cycle. The
  hardcoded-English strings are known debt, not a blocker; do not hold a
  release on this count, and do not advertise Swedish (or any) localisation
  in store copy or release notes until a future release explicitly commits to
  finishing the migration.
- `orchestration/weekAdvance.ts` (3,181 LOC) and `pages/Dashboard.tsx` (825 LOC) are the new oversized files — use `/refactor` for guided extraction.
- TS strict mode OFF (`strict: false`, `strictNullChecks: false`).
- Generated data dwarfs the code (~380K vs ~170K LOC) — keep it lazily imported; `size:check` is the guard.
- framer-motion v12 is heavy; Vite manual chunk-splitting for framer-motion, recharts, radix, and the big data files lives in `vite.config.ts` — respect its comments when adding imports.
- Ads are stubbed out (see Monetization) — re-enabling AdMob is a documented, multi-step job in `utils/ads.ts`.

## Hard Rules
- NEVER modify `src/components/ui/*` unless asked
- NEVER change HSL color variable system
- NEVER add npm deps without discussing tradeoffs
- NEVER put game logic in components — store slices or utils only
- NEVER hardcode balance values — use `src/config/` constants
- NEVER use `localStorage` or `sessionStorage` directly — go through the helpers in `src/store/helpers/persistence.ts` (`readSessionJson` / `writeSessionJson` / `removeSessionKey` / `getFlag` / `setFlag` / `readSaveSlot` / etc.). New storage keys register in `STORAGE_KEYS`. Enforced by ESLint `no-restricted-globals`
- NEVER check subscription SKUs against `monetization.entitlements`, persist consumable packs as entitlements, or reintroduce the RevenueCat hosted paywall (Apple 3.1.2(c))
- NEVER let monetization code touch sim parameters (match outcomes, training, transfer values)
- NEVER hand-edit generated data (`src/data/communityPack/*`, `src/data/squads/*`, `nationalPlayerPool.ts`, `playerPortraits.ts`) — regenerate via scripts
- NEVER import heavy data eagerly — `size:check` enforces the eager-bundle budget
- NEVER break mobile-first layout — test at 375px. Tap targets are 44px; the
  type floor is 11px (a crest monogram is a graphic, not copy)
- NEVER import `lucide-react` in a Sunday screen or Sunday component — icons
  come from `src/config/sundayIcons.ts`
- NEVER drive motion from JS (rAF, timers, style changed over time) without
  asking `useReducedMotionPref()` — the root `.reduce-motion` class and the OS
  media query collapse CSS transitions and animations, not JS
- NEVER create type files outside `src/types/game.ts` — single source of truth
- NEVER use `gh pr create` — GitHub API auth is not available. Give the user the PR URL from git push output instead
- NEVER push without running `npm run preflight` first (or `npm run ship` which includes it)
- NEVER branch from `master` or detached HEAD — always branch from `origin/main`
- NEVER change persisted state shape without bumping `CURRENT_VERSION` in `utils/saveMigration.ts` + adding a migration step
- ALWAYS run `npm run build` before marking done
- ALWAYS spread nested objects when using Zustand `set()` — no direct mutation
- ALWAYS `filter(Boolean)` when mapping player IDs to Player objects
- ALWAYS provide the GitHub PR creation link after pushing a branch
