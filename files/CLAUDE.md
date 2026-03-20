# CLAUDE.md — Dynasty Manager

## Project Overview
Dynasty Manager is a mobile-first football management simulation built as a single-page web app. Players pick a club, manage squads, set tactics, handle transfers, and simulate matches across seasons. Dark premium UI with glass-morphism and gold accents.

**Origin:** MVP scaffolded in Lovable.dev → now in Cursor + Claude Code for deeper development.

## Tech Stack
- **React 18.3** + **TypeScript** (non-strict) via **Vite 5** (SWC plugin)
- **Tailwind CSS 3.4** + `tailwindcss-animate` + HSL CSS variables (dark-only theme)
- **shadcn/ui** (Radix + CVA + clsx + tailwind-merge) — 30+ UI components
- **Zustand 5** — single `gameStore.ts` (~600 lines, the brain of the app)
- **React Router DOM 6** — routes: `/`, `/select-club`, `/game`, `*`
- **Framer Motion 12** — page transitions, match animations
- **Recharts** — for stats (future use)
- **Vitest + jsdom + Testing Library** — test infra
- **Package manager:** npm
- **Fonts:** Oswald (headings) + DM Sans (body) via Google Fonts

## Architecture
```
src/
├── components/game/  → BottomNav, TopBar, GlassPanel, PitchView, PlayerCard, StatBar
├── components/ui/    → shadcn/ui (30+ files — DO NOT modify unless asked)
├── data/league.ts    → 20 clubs, fixture gen, league table calc
├── engine/match.ts   → Match sim (event-based, minute-by-minute)
├── hooks/            → use-mobile, use-toast
├── lib/utils.ts      → cn() utility
├── pages/            → Dashboard, SquadPage, TacticsPage, MatchDay, TransferPage, etc.
├── store/gameStore.ts → ALL game state + logic lives here
├── types/game.ts     → Every type, formations, position compatibility
├── utils/playerGen.ts → Player gen, overall calc, squad building, lineup selection
├── test/             → Vitest setup
├── index.css         → Tailwind + CSS vars + custom utilities
└── main.tsx          → Entry
```

## Critical Files (read these first)
1. **`src/store/gameStore.ts`** — Entire state machine. All actions.
2. **`src/types/game.ts`** — All types. Formations, positions, compatibility maps.
3. **`src/utils/playerGen.ts`** — Player attributes, overall calc, squad gen, lineup auto-select.
4. **`src/engine/match.ts`** — Match simulation. Produces minute-by-minute events.
5. **`src/data/league.ts`** — 20 fictional clubs, round-robin fixtures, table builder.

## Code Conventions
- **TS non-strict** (`strict: false`, `noImplicitAny: false`). Use `interface` > `type` for objects.
- **Components:** Functional + hooks. Default export for pages, named for shared.
- **Styling:** Tailwind only. Use `cn()` for conditionals. Glass = `bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl`.
- **State:** All game logic → Zustand actions in `gameStore.ts`. Never in components.
- **Imports:** `@/` alias. Order: external → `@/components/ui` → `@/components/game` → local.
- **Naming:** camelCase vars, PascalCase components/types, UPPER_SNAKE constants.

## Design Language
- Dark theme only, HSL CSS vars (see `src/index.css`)
- Primary/Gold: `43 96% 46%` | Background: `222 30% 7%`
- Mobile-first: `max-w-lg mx-auto`, bottom nav, safe-area padding
- Rating colors: ≥80 emerald, ≥70 primary, ≥60 amber, <60 muted

## Key Patterns
- **Game loop:** `advanceWeek()` — training, development, AI sims, injuries, income, messages
- **Match sim:** `simulateMatch()` → Match with events. MatchDay renders live.
- **Player dev:** Young (<24) grow toward potential, vets (≥31) decline. Per-attribute probability.
- **Transfers:** Buy `makeOffer()`, sell `listPlayerForSale()`, respond `respondToOffer()`
- **Season end:** `endSeason()` — age, contracts, replacements, new fixtures, reset stats

## Commands
```bash
npm run dev          # Dev server (port 8080)
npm run build        # Production build
npm run test         # Vitest
npm run lint         # ESLint
```

## Known Tech Debt
- gameStore.ts needs splitting into slices (~600 lines)
- Match engine ignores formation/tactics in results
- No save migration system
- TS strict mode OFF
- Minimal tests
- `lovable-tagger` dep should be removed
- No PWA manifest
- framer-motion v12 is heavy

## Hard Rules
- NEVER modify `src/components/ui/*` unless asked
- NEVER change HSL color variable system
- NEVER add npm deps without discussing tradeoffs
- NEVER put game logic in components — store or utils only
- NEVER use localStorage directly — go through store actions
- NEVER break mobile-first layout — test at 375px
- ALWAYS run `npm run build` before marking done
- ALWAYS keep `game.ts` types as single source of truth
