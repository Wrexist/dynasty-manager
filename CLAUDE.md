# CLAUDE.md — Dynasty Manager

> Last verified against the codebase 2026-07-29 (app v1.3.0, save schema v86).
> If the numbers below disagree with the code, trust the code — and update this file.
> `npm run docs:check` verifies the countable claims (schema version, file counts,
> LOC of the named files) and `-- --fix` updates them. It runs in preflight, so this
> file cannot silently drift again.

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
1. Run `npm run preflight` — lint + typecheck + docs drift + i18n ceiling + fast tests + build + eager-bundle size budget. Fix any failures before proceeding.
   *Before a release, run `npm run preflight:full`.* The full suite takes ~28 min
   (`fileParallelism: false`, so file time is wall-clock time); the per-commit gate
   excludes the long-running season/longevity suites and runs in ~6 min, so that
   it actually gets run.
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
| `npm run preflight` | Lint + typecheck + docs:check + i18n:check + **fast** tests + build + size:check — run this per commit |
| `npm run preflight:full` | Same, with the long-running season/longevity suites. What CI enforces |
| `npm run test:fast` | Vitest minus the slow suites (see `SLOW_SUITES` in `vitest.config.ts`) |
| `npm run docs:check` | Verify the countable claims in this file against the code (`-- --fix` to update) |
| `npm run i18n:check` | Count player-facing strings still hardcoded in English; fails above the ceiling in `package.json` |
| `npm run ship -- "msg"` | Preflight + stage + commit + push with retry |
| `npm run branch -- name` | Create feature branch from latest origin/main |
| `npm run typecheck` | Standalone TypeScript check |
| `npm run size:check` | Eager-bundle budget check (`scripts/check-eager-bundle.mjs`) |

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
  Whole mode lives in `state.sunday` + `src/store/slices/sunday/` +
  `src/utils/sunday/` + `src/config/sundayLeague.ts`; implementation is
  dynamic-imported so it stays off the eager bundle.
- **Online** — `comingSoon: true`, not implemented.
- **Challenges** (`/challenge`) — scenario starts from `src/data/challenges.ts`.

## Tech Stack
- **React 18.3.1** + **TypeScript 5.9.3** (non-strict) via **Vite 7.3.2** (SWC plugin)
- **Tailwind CSS 3.4.19** + `tailwindcss-animate` + HSL CSS variables (dark-only theme)
- **shadcn/ui** (Radix + CVA + clsx + tailwind-merge) — 8 files in `src/components/ui/`
- **Zustand 5.0.12** — modular store: `gameStore.ts` composition + **16 slices** + 5 helpers
- **React Router DOM 6.30.3** — **HashRouter** (`#/` URLs). Routes: `/`, `/mode-select`,
  `/select-club`, `/create-manager`, `/challenge`, `/whats-new`, `/subscribe`, `/game`, `*`.
  In-game navigation is a separate system: 45 `GameScreen` ids rendered inside
  `GameShell` (`src/config/navigation.ts`).
- **Framer Motion 12.38** — transitions, match + pack animations (`MotionConfig` honours reduced-motion/perf mode)
- **Recharts 2.15.4** — stats charts · **Sonner 1.7.4** — toasts
- **Capacitor 8.3.1** — iOS/Android (app, browser, haptics, keyboard, splash-screen,
  status-bar, `@capacitor-community/in-app-review`)
- **RevenueCat** `@revenuecat/purchases-capacitor` 12.3.2 (+ `-ui`) — all IAP/subscriptions
- **Sentry** `@sentry/react` 10.49 — crash reporting + game breadcrumbs (`src/utils/sentry.ts`)
- **Vitest 3.2.4 + jsdom + Testing Library** — 206 test files in `src/test/`
- **Husky 9.1.7 + lint-staged 16.4.0** — pre-commit hooks
- **Fonts:** Oswald (headings) + DM Sans (body), self-hosted via `@fontsource/*`
- **Package manager:** npm

## Architecture (~139K LOC hand-written across ~490 files, plus ~410K LOC generated data)

```
.claude/
├── commands/            → 12 slash commands (see "Claude Code Slash Commands")
├── settings.json        → permission allow/deny rails (see "Project Settings")
src/
├── App.tsx              → HashRouter, lazy routes, ErrorBoundary scopes,
│                          analytics-consent gate, SaveRecoveryDialog
├── components/
│   ├── game/            → 86 components: TopBar, BottomNav, SubNav, GlassPanel,
│   │                      LineupEditor, SubstitutionSheet, PenaltyShootout,
│   │                      KnockoutBracket, GroupTable, ContractNegotiation,
│   │                      TransferNegotiation, LoanNegotiation, PressConference,
│   │                      PostMatchPopup, ProUpsell, PurchaseModal, TalentTree,
│   │                      StadiumView, WeeklyDigest, OnboardingChecklist, …
│   │   ├── pack/        → 12 files: pack-opening overlay, walkout reveal, confetti
│   │   └── icons/       → 3 premium icon components
│   ├── ui/              → 8 shadcn/ui files (DO NOT modify unless asked)
│   ├── ErrorBoundary, SaveRecoveryDialog, AnalyticsConsentModal
├── config/              → 33 files: gameBalance, matchEngine, matchSpeed, tactics,
│                          transfers, contracts, training, staff, scouting, youth,
│                          chemistry, personality, playoffs, continental, packs,
│                          monetization, legal, sponsorship, merchandise, managerCareer,
│                          aiManager, aiSimulation, lineupOptimization, navigation,
│                          namePool, playerGeneration, playerAppearance,
│                          managerAppearance, halftimeAnalysis, keyMoments, teamTalk, ui
├── data/                → 16 files + 2 generated dirs:
│   ├── leagues/         → 45 league files, 37 countries, 756 clubs (real clubs)
│   ├── communityPack/   → GENERATED real-player data (~395K LOC): freeAgents,
│   │                      byClub, newLeagues — never hand-edit, loaded lazily
│   ├── nationalPlayerPool.ts → GENERATED FC26-derived national rosters (11K LOC)
│   ├── league.ts        → fixture generation, table builder, derbies, country helpers
│   ├── cup.ts           → domestic cup draw/sim (round weeks choreographed, see Gotchas)
│   ├── continentalDraw.ts, nations.ts (51 national teams), challenges.ts,
│   │   pressConferences.ts, storylineChains.ts, boardPitches.ts,
│   │   clubTemplateAliases.ts, whatsNew.ts, pendingNews.ts
├── engine/
│   ├── match.ts         → match sim (1,828 LOC, event-based, minute-by-minute)
│   └── match/helpers.ts
├── hooks/               → 11 hooks: useGameSelectors, useLineupOptimizer,
│                          useSwipeGesture, useKeyboardInset, useFocusTrap, …
├── pages/               → 52 pages: Dashboard (2,192 LOC), MatchDay, GameShell,
│                          SquadPage, TacticsPage, TransferPage, TrainingPage,
│                          StaffPage, ScoutingPage, YouthAcademy, FacilitiesPage,
│                          FinancePage, MerchandisePage, BoardPage, CupPage,
│                          LeagueCupPage, ContinentalPage, SuperCupPage,
│                          NationalTeamPage, NationalSquadPicker, InternationalTournament,
│                          BallonDor, JobMarket, CareerOverview, ManagerCreation,
│                          ModeSelect, PacksPage, ShopPage, SubscribeOnboarding,
│                          WhatsNewPage, SettingsPage, HelpPage, ClubSelection, …
├── store/
│   ├── gameStore.ts     → Zustand composition of 15 slices
│   ├── storeTypes.ts    → GameState interface (492 LOC)
│   ├── slices/          → core, club, transfer, match, systems, orchestration,
│   │                      loan, cup, feature, sponsor, merchandise, monetization,
│   │                      nationalTeam, career, packs
│   │   ├── orchestrationSlice.ts (1,201 LOC — façade) delegating to:
│   │   └── orchestration/ → weekAdvance.ts (3382 LOC — THE game loop),
│   │                        seasonEnd.ts (1,651), matchActions.ts (1,611),
│   │                        initGame.ts (587), tournaments.ts, helpers.ts
│   └── helpers/         → persistence.ts, idbStorage.ts, matchProcessing.ts,
│                          development.ts, rosterOps.ts
├── types/game.ts        → ALL types (2,083 LOC): Player, Club, Match, LeagueInfo,
│                          10 formations, 45 GameScreens, MonetizationState,
│                          CareerManager, NationalTeamState, PackTierDefinition, …
├── utils/               → 74+ files: playerGen, saveMigration (v78),
│                          purchases (RevenueCat wrapper), monetization, ads (stub),
│                          packGeneration, communityPackPool, international,
│                          managerCareer, continental, continentalCoefficients,
│                          ballonDor, penaltyShootout, substitutionLogic, analytics,
│                          sentry, appReview, haptics, promotionRelegation, …
├── test/                → 136 test files incl. longevity/stress suites, adversarial
│                          season tests, release-readiness, render hygiene,
│                          launch-crash guardrails, balance reports, perf
├── index.css            → Tailwind + CSS vars (incl. pack tier palettes, perf-mode)
└── main.tsx             → entry: Sentry init, storage hydration, Capacitor setup
```

## Critical Files (read these first)
1. **`src/store/slices/orchestration/weekAdvance.ts`** — THE game loop (3,094 LOC). `advanceWeek()`: training, development, AI sims, injuries, finances, offers, cups, continental, international windows, objectives.
2. **`src/store/storeTypes.ts`** — complete `GameState` interface (686 LOC).
3. **`src/types/game.ts`** — all types (2,083 LOC). Single source of truth.
4. **`src/config/gameBalance.ts`** — central balancing constants. Check here before hardcoding values.
5. **`src/engine/match.ts`** — match simulation (2243 LOC).
6. **`src/data/leagues/index.ts`** — aggregates 45 leagues / 756 clubs; `src/data/league.ts` for fixtures/tables/derbies.
7. **`src/utils/playerGen.ts`** — player generation, overall calc, squad building.
8. **`src/utils/saveMigration.ts`** — save schema `CURRENT_VERSION = 78` + migration chain. Every state-shape change bumps it.
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

**International:** 51 national teams (`src/data/nations.ts`) across 5
confederations with FC26-derived player pools. The manager can receive
national-team job offers and run 23-man squads through international
tournaments alongside the club job (`nationalTeamSlice`, `utils/international.ts`).

**Individual awards:** Ballon d'Or ceremony each season (`utils/ballonDor.ts`).

## Monetization (Dynasty Pro + packs) — READ BEFORE TOUCHING PAYWALL CODE

All IAP goes through RevenueCat (`src/utils/purchases.ts`). Product catalog
and Pro feature list live in `src/config/monetization.ts`; entitlement checks
in `src/utils/monetization.ts`; state in `monetizationSlice`.

- **Dynasty Pro SKUs:** one-time `com.dynastymanager.pro`, subscriptions
  `.pro.monthly` / `.pro.annual`, one-time `.pro.lifetime`, and the
  `bundle.all` "Dynasty Edition" (Pro + all cosmetic packs). USD prices in
  config are fallbacks — real prices come localized from the store.
- **Pro features:** `ad_free`, `advanced_analytics`, `custom_tactics`,
  `expanded_press`, `historical_records`, `instant_sim` (see
  `config/matchSpeed.ts`), `optimize_lineup`, `pro_badge`.
- **Cosmetic packs:** manager identity / stadium atmosphere / legends —
  permanent entitlements with an in-game cosmetics catalog.
- **Consumable player-pack IAPs:** gold / premium_gold / rare_gold / icon —
  consumed per open, NEVER stored as entitlements, NEVER restorable.
- **Free trial:** `FREE_TRIAL_DAYS` intro trial (currently 7) → monthly plan
  (`startFreeTrial` is a no-op if ANY subscription record exists — prevents
  trial-restart abuse).
  **Starter Kit** is a 7-day-from-first-launch offer.

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

### Observability: wired but INERT until secrets exist

`VITE_ANALYTICS_ENDPOINT` and `VITE_SENTRY_DSN` are now passed through in
`ios-testflight.yml` / `android-build.yml`, but **the GitHub secrets do not
exist yet**. Both consumers hard-return on an empty value
(`analytics.ts` `if (!endpoint) return`, `sentry.ts` `if (!dsn) return`), so
until those secrets are set: no analytics event and no crash report leaves a
production device, and every conversion rate in
`marketing/ads/unit-economics.mjs` is unmeasurable. See
`marketing/ads/RELEASE-READINESS.md` for the setup steps.

### Ads: disabled in V1
`@capacitor-community/admob` is fully removed (it crashed TestFlight builds —
see the saga above). `src/utils/ads.ts` is a stub with
`NATIVE_ADS_READY = false`; `AdRewardButton` and pack ad-slots gate off it.
The ad-reward config (budget boosts, double XP, limits per season) is retained
in `config/monetization.ts` for a future re-enable — re-enable steps are
documented in `ads.ts`.

## Pack Opening (live feature)

FUT-style pack system: `config/packs.ts` defines `PACK_TIERS` (bronze/silver
free — 1/day + ad-gated extras while ads are off — up through paid consumable
tiers) with rarity weights, guaranteed-OVR floors, and walkout reveals
(`components/game/pack/`, `utils/packGeneration.ts`, `packsSlice`). Player
identities draw from the **community pack** real-player dataset
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
- **Save schema version `86`** in `utils/saveMigration.ts`. Any change to
  persisted state shape bumps `CURRENT_VERSION` and adds a migration step.
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
- Club colors are the only place where inline `style={{ backgroundColor }}` is acceptable
- **Performance mode** (`settings.performanceMode`) toggles a root `perf-mode`
  class that strips backdrop-blur/decorative layers and forces reduced motion

## Key Patterns
- **Game loop:** `advanceWeek()` in `orchestration/weekAdvance.ts` — training, development, AI sims, injuries, income, messages, offers, weekly objectives, cup/continental/international scheduling.
- **Match sim:** `simulateMatch()` → Match with events; MatchDay renders live with interactive subs, team talks, set pieces, penalty shootouts. Match speed tiers in `config/matchSpeed.ts` (instant sim = Pro).
- **Player dev:** young (<24) grow toward potential, vets (>=31) decline. Per-attribute probability via `store/helpers/development.ts`.
- **Transfers:** buy `makeOffer()`, sell `listPlayerForSale()`, respond `respondToOffer()`. Windows: **weeks 1–8 and 20–24** (`config/transfers.ts`).
- **Loans:** separate system via `loanSlice.ts` — incoming/outgoing offers and deals.
- **Season end:** `orchestration/seasonEnd.ts` — aging, contracts, replacements, new fixtures, stat reset, promotion/relegation cascade across all 45 leagues, awards, Ballon d'Or.
- **Career mode:** `careerSlice` + `utils/managerCareer.ts` — vacancies, board-pitch interviews (`data/boardPitches.ts`), contract negotiation, bonuses, sackings, retirement.
- **Progression:** manager perks (TalentTree), prestige, achievements, milestones, records, Hall of Managers.
- **Narratives:** storyline chains, press conferences, player narratives, random events, weekly digest.
- **Observability:** Sentry with game breadcrumbs (`utils/sentry.ts`); analytics are consent-gated (first-launch `AnalyticsConsentModal`, `utils/analytics.ts`).

## Key Gotchas
- `club.lineup` and `club.subs` are **string arrays of player IDs**, not Player objects.
- Always `filter(Boolean)` after mapping playerIds to players — some IDs may reference deleted players.
- When selling a player, must update: seller (playerIds/lineup/subs/wageBill/budget), buyer (same), player's clubId, AND remove from transferMarket.
- Match results must update BOTH the fixtures array AND individual player stats (goals, assists, etc.).
- `advanceWeek()` resets `matchSubsUsed`; the player's own match runs via `playCurrentMatch()`, not inside `advanceWeek()`.
- Store uses `set()` with spread — always spread nested objects before modifying or you'll mutate state.
- **Cup-week choreography is load-bearing:** domestic Cup Final sits at week 43 specifically to dodge the continental SF legs (41–42), continental Final (44), and League Cup Final (40). The player's continental knockout ties are NOT auto-simulated by `weekAdvance`, and a same-week collision can strand a tie unresolved and hang the tournament. Read the comment block in `src/data/cup.ts` before moving any round week.
- **Never check subscription SKUs against `monetization.entitlements`** — see Entitlement invariants above.
- **Generated data is not source code:** `src/data/communityPack/*`, `src/data/nationalPlayerPool.ts` are tool-generated. Never hand-edit; regenerate via the fc26/scrape scripts.
- HashRouter: deep links are `#/route`; route changes don't hit the server.
- `package.json.version` (1.3.0) must never regress below the top `whatsNew.ts` entry — CI guard will fail the TestFlight build.

## Commands
```bash
# Development
npm run dev          # Dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run test         # Vitest (206 test files)
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check (standalone)
npm run size:check   # Eager-bundle budget check
npm run preflight    # lint + typecheck + FAST tests + build + size:check (per commit)
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
| `/balance` | Game balance tuning across the 33 config files |
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
- **`pr-checks.yml`** — PR validation (lint + build + test)
- **`ios-testflight.yml`** — manual-dispatch iOS TestFlight deploy (seal + version guard + fastlane)
- **`android-build.yml`** — Android APK/AAB build
- **`append-pending-news.yml`** — auto-appends release-note bullets on PR merge
- **`release.yml`** — version bump on `v*` tag push
- **`scrape-icons.yml`** — SoFIFA icon scrape as a manual Action

## Known Tech Debt
- **i18n is a started migration, not a finished one.** `src/i18n/` (hand-rolled
  `t()`, English always loaded as fallback) works and 90 of 181 files in
  `src/pages` + `src/components/game` use it, but **998 player-facing strings in
  113 files are still hardcoded English** (`npm run i18n:check`). `sv.ts` covers
  76 of `en.ts`'s keys and **nothing calls `setLocale` outside tests** — there is
  deliberately no language picker, because shipping one today would give a
  mostly-English "Swedish" UI. Don't advertise localisation until the count is
  near zero. The meter itself lied for a while (it skipped every line containing
  `className=`, i.e. every JSX text node, and reported 0) — see the correction in
  `docs/CRITICAL-REVIEW-2026-08.md` §17.
- `orchestration/weekAdvance.ts` (3,094 LOC) and `pages/Dashboard.tsx` (2,192 LOC) are the new oversized files — use `/refactor` for guided extraction.
- TS strict mode OFF (`strict: false`, `strictNullChecks: false`).
- Generated data dwarfs the code (~410K vs ~139K LOC) — keep it lazily imported; `size:check` is the guard.
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
- NEVER hand-edit generated data (`src/data/communityPack/*`, `nationalPlayerPool.ts`) — regenerate via scripts
- NEVER import heavy data eagerly — `size:check` enforces the eager-bundle budget
- NEVER break mobile-first layout — test at 375px
- NEVER create type files outside `src/types/game.ts` — single source of truth
- NEVER use `gh pr create` — GitHub API auth is not available. Give the user the PR URL from git push output instead
- NEVER push without running `npm run preflight` first (or `npm run ship` which includes it)
- NEVER branch from `master` or detached HEAD — always branch from `origin/main`
- NEVER change persisted state shape without bumping `CURRENT_VERSION` in `utils/saveMigration.ts` + adding a migration step
- ALWAYS run `npm run build` before marking done
- ALWAYS spread nested objects when using Zustand `set()` — no direct mutation
- ALWAYS `filter(Boolean)` when mapping player IDs to Player objects
- ALWAYS provide the GitHub PR creation link after pushing a branch
