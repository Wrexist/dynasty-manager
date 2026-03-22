# CLAUDE.md — Dynasty Manager

## Project Overview
Dynasty Manager is a mobile-first football management simulation with native iOS/Android builds via Capacitor. Players pick a club from 92 teams across 4 divisions, manage squads, set tactics, handle transfers/loans, simulate matches, and progress through seasons with promotion/relegation and cup competitions. Dark premium UI with glass-morphism and gold accents.

**Origin:** MVP scaffolded in Lovable.dev → now in Cursor + Claude Code for deeper development.

## Tech Stack
- **React 18.3.1** + **TypeScript 5.8.3** (non-strict) via **Vite 7.3.1** (SWC plugin `@vitejs/plugin-react-swc 3.11.0`)
- **Tailwind CSS 3.4.17** + `tailwindcss-animate` + HSL CSS variables (dark-only theme)
- **shadcn/ui** (Radix + CVA + clsx + tailwind-merge) — 9 UI component files
- **Zustand 5.0.11** — modular store: `gameStore.ts` (25-line entry) + 9 slices + 3 helpers (~3,400 LOC total)
- **React Router DOM 6.30.1** — routes: `/`, `/select-club`, `/game`, `*`
- **Framer Motion 12.35.1** — page transitions, match animations
- **@dnd-kit** (core + sortable + utilities) — drag-and-drop for lineup editing
- **Recharts 2.15.4** — stats charts
- **Sonner 1.7.4** — toast notifications
- **Zod 3.25.76** — schema validation
- **Capacitor 8.2.0** — native iOS/Android builds (haptics, splash screen, status bar, keyboard plugins)
- **Vitest 3.2.4 + jsdom + Testing Library** — test infra (14 test files, 134 tests)
- **Husky 9.1.7 + lint-staged 16.4.0** — pre-commit hooks
- **Package manager:** npm
- **Fonts:** Oswald (headings) + DM Sans (body) via Google Fonts

## Architecture (~21,000 LOC across 142 TS/TSX files)
```
src/
├── components/
│   ├── game/           → 21 components: TopBar, BottomNav, SubNav, GlassPanel,
│   │                     PitchView, PlayerCard, PlayerAvatar, LineupEditor,
│   │                     SubstitutionSheet, StatBar, CelebrationModal,
│   │                     StorylineModal, ContractNegotiation, PressConference,
│   │                     PostMatchPopup, BoardWarning, DynamicIcon, etc.
│   ├── ui/             → 9 shadcn/ui files (DO NOT modify unless asked)
│   └── NavLink.tsx
├── config/             → 14 config files (~1,100 LOC): gameBalance, playerGeneration,
│                         matchEngine, transfers, contracts, training, staff,
│                         scouting, youth, tactics, chemistry, ui, playoffs
├── data/               → league.ts (92 clubs, 4 divisions), cup.ts, challenges.ts,
│                         pressConferences.ts, storylineChains.ts
├── engine/match.ts     → Match sim (653 LOC, event-based, minute-by-minute)
├── hooks/              → use-mobile, use-toast, useGameSelectors, useSwipeGesture
├── lib/utils.ts        → cn() utility
├── pages/              → 33 pages (~7,600 LOC): Dashboard, Squad, Tactics, MatchDay,
│                         Transfer, Training, Staff, Scouting, YouthAcademy,
│                         Facilities, Finance, MatchPrep, MatchReview, Cup,
│                         Board, Perks, Prestige, TrophyCabinet, HallOfManagers,
│                         SeasonSummary, PlayerDetail, ManagerProfile, Settings,
│                         Inbox, CalendarView, ChallengePicker, LeagueTable, etc.
├── store/
│   ├── gameStore.ts    → 25-line Zustand composition layer
│   ├── storeTypes.ts   → GameState interface (162 LOC)
│   ├── slices/         → 9 slices:
│   │   ├── orchestrationSlice.ts  (1,970 LOC — game loop, largest file)
│   │   ├── loanSlice.ts           (292 LOC)
│   │   ├── featureSlice.ts        (242 LOC)
│   │   ├── transferSlice.ts       (202 LOC)
│   │   ├── systemsSlice.ts        (157 LOC — tactics, training, staff)
│   │   ├── clubSlice.ts           (42 LOC)
│   │   ├── coreSlice.ts           (39 LOC)
│   │   ├── matchSlice.ts          (25 LOC)
│   │   └── cupSlice.ts            (21 LOC)
│   └── helpers/        → development.ts, matchProcessing.ts, persistence.ts
├── types/game.ts       → All types (674 LOC): Player, Club, Match, Formation,
│                         Position, DivisionInfo, PlayoffState, PlayerPersonality, etc.
├── utils/              → 27 utility files (~2,900 LOC): playerGen, training,
│                         scouting, youth, staff, contracts, chemistry, personality,
│                         promotionRelegation, playoffs, achievements, milestones,
│                         managerPerks, celebrations, seasonAwards, records,
│                         storylines, playerNarratives, financeHelpers, hallOfManagers,
│                         weekPreview, weeklyObjectives, saveMigration (v7), etc.
├── test/               → 14 test files: match, playerDev, helpers, cup,
│                         celebrations, saveMigration, contracts, chemistry,
│                         personality, promotionRelegation, youth, finance, league, training
├── index.css           → Tailwind + CSS vars + custom utilities
└── main.tsx            → Entry
```

## Critical Files (read these first)
1. **`src/store/slices/orchestrationSlice.ts`** — Game loop brain. `advanceWeek()`, `endSeason()`, `initGame()`. Largest file at ~1,970 LOC.
2. **`src/store/storeTypes.ts`** — Complete `GameState` interface. Understand state shape here.
3. **`src/types/game.ts`** — All types (674 LOC). 7 formations, 12 positions, 23 game screens, season phases, player personality system.
4. **`src/config/gameBalance.ts`** — 100+ balancing constants. Check here before hardcoding values.
5. **`src/engine/match.ts`** — Match simulation (653 LOC). Event-based, minute-by-minute.
6. **`src/data/league.ts`** — 92 clubs across 4 divisions, fixture generation, league table builder.
7. **`src/utils/playerGen.ts`** — Player generation, overall calculation, squad building.

## League Structure
| Division | Name | Clubs | Weeks | Promotion |
|----------|------|-------|-------|-----------|
| div-1 | Monarch Premier League | 20 | 46 | N/A (top flight) |
| div-2 | Dynasty Championship | 24 | 46 | 2 auto + 4 playoff |
| div-3 | Sovereign First Division | 24 | 46 | 2 auto + 4 playoff |
| div-4 | Foundation League | 24 | 46 | 3 auto + 4 playoff |

## Code Conventions
- **TS non-strict** (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`). Use `interface` > `type` for objects.
- **Components:** Functional + hooks. Default export for pages, named for shared.
- **Styling:** Tailwind only. Use `cn()` for conditionals. Glass = `bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl`.
- **State:** All game logic → Zustand slices in `src/store/slices/`. Never in components.
- **Config:** Game balance constants go in `src/config/`, not hardcoded in logic files.
- **Imports:** `@/` alias. Order: external → `@/components/ui` → `@/components/game` → local.
- **Naming:** camelCase vars, PascalCase components/types, UPPER_SNAKE constants.

## Design Language
- Dark theme only, HSL CSS vars (see `src/index.css`)
- Primary/Gold: `43 96% 46%` | Background: `222 30% 7%` | Accent: `215 60% 50%`
- Mobile-first: `max-w-lg mx-auto`, bottom nav, safe-area padding
- Rating colors: >=80 emerald, >=70 primary, >=60 amber, <60 muted
- Club colors are the only place where inline `style={{ backgroundColor }}` is acceptable

## Key Patterns
- **Game loop:** `advanceWeek()` — training, development, AI sims, injuries, income, messages, offers, weekly objectives
- **Match sim:** `simulateMatch()` → Match with events. MatchDay renders live. Late drama after min 85.
- **Player dev:** Young (<24) grow toward potential, vets (>=31) decline. Per-attribute probability via `helpers/development.ts`.
- **Transfers:** Buy `makeOffer()`, sell `listPlayerForSale()`, respond `respondToOffer()`. Window: weeks 1-8 and 20-24.
- **Loans:** Separate loan system via `loanSlice.ts` — incoming/outgoing loan offers and deals.
- **Season end:** `endSeason()` — age, contracts, replacements, new fixtures, reset stats, promotion/relegation.
- **Promotion/Relegation:** Handled by `utils/promotionRelegation.ts` and `utils/playoffs.ts`. Playoff system for lower divisions.
- **Persistence:** `saveGame()`/`loadGame()` via localStorage key `'dynasty-save'` (save version: **9**, migration in `utils/saveMigration.ts`).
- **Progression:** Manager perks, prestige system, achievements, milestones, Hall of Managers.
- **Narratives:** Storyline chains (`data/storylineChains.ts`), press conferences, player narratives.

## Key Gotchas
- `club.lineup` and `club.subs` are **string arrays of player IDs**, not Player objects.
- Always `filter(Boolean)` after mapping playerIds to players — some IDs may reference deleted players.
- When selling a player, must update: seller (playerIds/lineup/subs/wageBill/budget), buyer (same), player's clubId, AND remove from transferMarket.
- Match results must update BOTH the fixtures array AND individual player stats (goals, assists, etc.).
- `advanceWeek()` resets `matchSubsUsed` to 0 at the end. Player match is handled via `playCurrentMatch()`, not inside `advanceWeek()`.
- Store uses `set()` with spread — always spread nested objects before modifying or you'll mutate state.

## Commands
```bash
# Development
npm run dev          # Dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run test         # Vitest
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check (standalone)
npm run preflight    # Run lint + test + build (local CI check)

# Git workflow
npm run ship -- "commit message"   # Preflight + commit + push (one command)
npm run branch -- feature-name     # Create branch from latest origin/main

# Mobile (Capacitor)
npm run cap:sync     # Build + sync to native projects
npm run cap:ios      # Open Xcode project
npm run cap:android  # Open Android Studio project
```

## Git Workflow for Claude Sessions

**When asked to push, commit, or create a PR, follow this exact flow — no exceptions.**

### Step 1: Preflight
```bash
npm run preflight
```
This runs lint + test + build. Do NOT push if preflight fails — fix errors first.

### Step 2: Commit
Stage only the files you changed (never `git add -A` blindly — skip `.env`, credentials, large binaries):
```bash
git add <specific files>
git commit -m "Short descriptive message"
```

### Step 3: Push with retry
```bash
git push -u origin <branch-name>
```
If push fails due to network errors, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

### Step 4: Provide the PR link
After a successful push, git prints a PR creation URL. **Always extract and display it to the user like this:**

> Pushed to `<branch-name>`. Create your PR here:
> **https://github.com/Wrexist/dynasty-manager/pull/new/<branch-name>**

The `gh` CLI is NOT available in this environment (no GitHub API auth). Do NOT attempt `gh pr create` — it will fail. Always give the user the direct PR link instead.

### Branch naming
- Branches MUST be based on `origin/main` (not `master`, not detached HEAD)
- If starting fresh: `git fetch origin main && git checkout -b <branch-name> origin/main`
- This ensures PRs compare cleanly on GitHub (prevents "nothing to compare" errors)

### One-command alternative
If you want to do everything in one shot:
```bash
npm run ship -- "commit message"
```
This runs preflight → stages → commits → pushes with retry — all in one command.

## CI/CD
- **`ios-testflight.yml`** — Automated iOS TestFlight deployment
- **`android-build.yml`** — Android APK/AAB building
- **`pr-checks.yml`** — Pull request validation (lint + build + test)

## Known Tech Debt
- `orchestrationSlice.ts` is ~1,970 lines — could be further split
- TS strict mode OFF (`strict: false`, `strictNullChecks: false`)
- `getSuffix()` helper duplicated across Dashboard, SeasonSummary
- `pick()` and `clamp()` helpers duplicated across multiple files
- framer-motion v12 is heavy (~30kb gzipped)
- Vite config has manual chunk splitting for framer-motion, recharts, radix

## Hard Rules
- NEVER modify `src/components/ui/*` unless asked
- NEVER change HSL color variable system
- NEVER add npm deps without discussing tradeoffs
- NEVER put game logic in components — store slices or utils only
- NEVER hardcode balance values — use `src/config/` constants
- NEVER use localStorage directly — go through store persistence helpers
- NEVER break mobile-first layout — test at 375px
- NEVER create type files outside `src/types/game.ts` — single source of truth
- NEVER use `gh pr create` — GitHub API auth is not available. Give the user the PR URL from git push output instead
- NEVER push without running `npm run preflight` first (or `npm run ship` which includes it)
- NEVER branch from `master` or detached HEAD — always branch from `origin/main`
- ALWAYS run `npm run build` before marking done
- ALWAYS spread nested objects when using Zustand `set()` — no direct mutation
- ALWAYS `filter(Boolean)` when mapping player IDs to Player objects
- ALWAYS provide the GitHub PR creation link after pushing a branch
