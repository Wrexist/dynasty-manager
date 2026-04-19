# CLAUDE.md — Dynasty Manager

## ⚠️ MANDATORY: Read This First — Git & Shipping Workflow

**These are NON-NEGOTIABLE rules. Every Claude session MUST follow them.**

### When the user asks you to commit, push, ship, or create a PR:
1. Run `npm run preflight` — validates lint + test + build. Fix any failures before proceeding.
2. Stage specific changed files with `git add <files>` (NEVER blind `git add -A`).
3. Commit with a clear message: `git commit -m "descriptive message"`.
4. Push: `git push -u origin <branch-name>` — retry up to 4x with exponential backoff on network failure.
5. **Output the PR link** to the user: `https://github.com/Wrexist/dynasty-manager/pull/new/<branch-name>`

**Or use the one-liner:** `npm run ship -- "commit message"` — does ALL of the above automatically.

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
| `npm run preflight` | Lint + test + build (local CI mirror) |
| `npm run ship -- "msg"` | Preflight + stage + commit + push with retry |
| `npm run branch -- name` | Create feature branch from latest origin/main |
| `npm run typecheck` | Standalone TypeScript check |

---

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
.claude/
├── commands/           → 7 slash commands: balance, feature, match-engine,
│                         test, review, refactor, season
├── settings.json       → Project-level Claude Code settings (deny rules)
src/
├── components/
│   ├── game/           → Components: TopBar, BottomNav, SubNav, GlassPanel,
│   │                     PlayerAvatar, LineupEditor, SubstitutionSheet, StatBar,
│   │                     CelebrationModal, StorylineModal, ContractNegotiation,
│   │                     PressConference, PostMatchPopup, BoardWarning, DynamicIcon, etc.
│   ├── ui/             → 9 shadcn/ui files (DO NOT modify unless asked)
├── config/             → 14 config files (~1,100 LOC): gameBalance, playerGeneration,
│                         matchEngine, transfers, contracts, training, staff,
│                         scouting, youth, tactics, chemistry, ui, playoffs
├── data/               → league.ts (92 clubs, 4 divisions), cup.ts, challenges.ts,
│                         pressConferences.ts, storylineChains.ts
├── engine/match.ts     → Match sim (653 LOC, event-based, minute-by-minute)
├── hooks/              → use-toast, useGameSelectors, useSwipeGesture, useFlash
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
- **Persistence:** `saveGame()`/`loadGame()` via localStorage key `'dynasty-save'` (save version: **20**, migration in `utils/saveMigration.ts`).
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

# Data scraping (planned for future pack-opening system)
npm run scrape:icons                 # full SoFIFA Icons scrape (~3 min, ~150 rows)
npm run scrape:icons -- --limit 5    # smoke test (5 icons)
npm run scrape:icons -- --resume     # continue from cache
npm run scrape:icons -- --retry-failed --debug
# Outputs: fc25_icons.csv (58-col schema) + fc25_icons_meta.json (image URLs)
# Runs locally only — Claude Code sandbox blocks sofifa.com.
# Or trigger from GitHub Actions: Actions tab → "Scrape SoFIFA Icons" →
# "Run workflow" → outputs come back as a downloadable artifact.
```

## Git Workflow for Claude Sessions

**See the MANDATORY section at the top of this file. The rules there override everything.**

Quick reference:
- `npm run ship -- "msg"` = preflight + commit + push (preferred one-liner)
- `npm run branch -- name` = new branch from origin/main
- `npm run preflight` = lint + test + build
- After push → always give the user: `https://github.com/Wrexist/dynasty-manager/pull/new/<branch>`
- `gh pr create` is FORBIDDEN — no GitHub API auth available

## Claude Code Slash Commands

Custom project commands available via `/project:<name>` in Claude Code sessions. These encode dynasty-manager-specific knowledge, patterns, and context so every session starts with deep project understanding.

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/project:balance` | Game balance tuning | Adjusting config constants, analyzing cascading effects across 27 config files |
| `/project:feature` | Feature scaffolding | Adding new game features (walks through types → config → slice → page → tests) |
| `/project:match-engine` | Match engine dev | Modifying the 653-LOC match sim, event system, stats propagation |
| `/project:test` | Test generation | Writing new tests or finding coverage gaps (follows existing Vitest patterns) |
| `/project:review` | Code review | Reviewing changes against 20+ project-specific gotchas and conventions |
| `/project:refactor` | Safe refactoring | Extracting logic from large files (especially orchestrationSlice at ~1,970 LOC) |
| `/project:season` | Season & league logic | Working on promotion/relegation, playoffs, cup competitions, end-of-season |

**How they work:** Each command is a markdown file in `.claude/commands/` that preloads context files, project rules, and domain knowledge. When invoked, Claude reads the relevant source files and applies project-specific patterns automatically.

**Adding new commands:** Create a new `.md` file in `.claude/commands/`. It becomes available as `/project:<filename>`. Include `$ARGUMENTS` placeholder for user input.

## Plugin Integration (Opus 4.6)

11 plugins are active. They enhance every Claude session automatically or via commands.

### Automatic Plugins (no commands needed)
| Plugin | What it does | Dynasty Manager benefit |
|--------|-------------|------------------------|
| **security-guidance** | Scans Write/Edit for vulnerabilities (XSS, eval, injection) | Catches unsafe patterns in match engine, store slices, player input |
| **frontend-design** | Applies production-grade design judgment to UI work | Ensures new pages match dark glass-morphism aesthetic |
| **context7** | Fetches real-time library docs via MCP (`.mcp.json`) | Prevents deprecated API usage — append "use context7" to any prompt |

### Command Plugins
| Plugin | Command | When to use |
|--------|---------|-------------|
| **code-review** | `/code-review` | Multi-perspective PR review with confidence scoring — use AFTER `/project:review` |
| **commit-commands** | `/commit` | AI-powered commit messages — alternative to `npm run ship` for message generation |
| **feature-dev** | *(7-phase workflow)* | Complex multi-file features with agent-driven architecture — complements `/project:feature` |
| **superpowers** | `/brainstorming`, `/execute-plan` | TDD enforcement with red-green-refactor — use for test-first development |
| **ralph-wiggum** | `/ralph-loop "prompt" --max-iterations N` | Autonomous batch loops for refactors, test coverage, documentation |
| **hookify** | `/hookify`, `/hookify:list` | Create behavioral guardrails on the fly |
| **plugin-dev** | `/plugin-dev:create-plugin` | Build new Claude Code plugins for this project |
| **github** | *(MCP tools)* | Read PRs, issues, CI status via `mcp__github__*` — replaces `gh` CLI |

### Plugin Workflow Patterns

**New feature (large, multi-file):**
1. `/brainstorming` (superpowers) — explore design space
2. `/project:feature` — scaffold with dynasty-manager conventions
3. Append "use context7" when unsure about library APIs
4. `/project:review` → `/code-review` — dual-layer review
5. `npm run ship -- "msg"` — ship it

**Code review (enhanced):**
1. `/project:review` — dynasty-manager-specific (Zustand patterns, player ID safety, mobile layout)
2. `/code-review` — 5 independent reviewers with confidence score (threshold: 80)

**Batch mechanical work:**
- `/ralph-loop "Add tests for untested utils" --max-iterations 10`
- `/ralph-loop "Extract helpers from orchestrationSlice" --max-iterations 5`
- Always set `--max-iterations` to a reasonable limit

**TDD workflow:**
- `/brainstorming` → `/execute-plan` (enforces red-green-refactor cycles)

### Plugin + Slash Command Synergy
| Existing Command | Enhanced By | How |
|-----------------|------------|-----|
| `/project:review` | code-review | Adds generic multi-perspective analysis after project-specific review |
| `/project:feature` | feature-dev, superpowers | Adds agent-driven architecture + TDD execution |
| `/project:refactor` | ralph-wiggum | Automates repetitive extraction steps |
| `/project:test` | ralph-wiggum, superpowers | Batch test generation + TDD enforcement |
| `/project:balance` | context7 | Real-time docs for config patterns |

### Plugin Conflict Notes
- **commit-commands vs `npm run ship`:** `npm run ship` remains the preferred workflow (includes preflight). Use `/commit` only for smart message generation.
- **feature-dev vs `/project:feature`:** `/project:feature` has dynasty-manager-specific scaffolding knowledge. feature-dev adds architectural analysis. Use both for complex features.
- **GitHub MCP vs `gh` CLI:** `gh pr create` remains FORBIDDEN (no CLI auth). The GitHub MCP tools (`mcp__github__*`) use separate auth and ARE available for PR/issue operations.

## Claude Code Project Settings

`.claude/settings.json` enforces safety rails at the project level:
- **Denied operations:** `git add -A`, `git push --force`, `git reset --hard`, `gh pr create` — blocked to prevent destructive actions
- **Auto-allowed MCP:** Read-only GitHub operations (PR reads, issue reads, code search, commit history)
- **MCP servers:** context7 configured in `.mcp.json` for real-time documentation lookup
- Settings are version-controlled and apply to all Claude Code sessions on this repo

## CI/CD
- **`ios-testflight.yml`** — Automated iOS TestFlight deployment
- **`android-build.yml`** — Android APK/AAB building
- **`pr-checks.yml`** — Pull request validation (lint + build + test)

## Known Tech Debt
- `orchestrationSlice.ts` is ~1,970 lines — could be further split (use `/project:refactor` for guided extraction)
- TS strict mode OFF (`strict: false`, `strictNullChecks: false`)
- `getSuffix()`, `pick()`, `clamp()` are centralized in `src/utils/helpers.ts` (previously duplicated, now resolved)
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
