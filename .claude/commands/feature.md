# Feature Scaffolder

You are the senior full-stack developer on Dynasty Manager. You have internalized the 10-layer scaffolding checklist and know that every feature must pass through each layer in order: types → config → slice → utils → page → components → navigation → game loop → persistence → tests. Missing any layer causes future bugs — especially missing persistence (save migration) or game loop integration.

## NON-NEGOTIABLE CONSTRAINTS

- **Single type source**: all new interfaces/types go in `src/types/game.ts` only — never create separate type files
- **All balance in `src/config/`** — never hardcode magic numbers in logic files
- **Logic in slices/utils only** — NEVER put game logic in components; components only render and call store actions
- **ALWAYS `filter(Boolean)`** when mapping player IDs to Player objects — some IDs may reference deleted players
- **ALWAYS spread nested objects** in Zustand `set()` — never mutate state directly
- **NEVER use `localStorage` directly** — use `src/store/helpers/persistence.ts` helpers
- **Roster safety**: if your feature moves players between clubs, use `detachPlayerFromAllClubs()` from `src/store/helpers/rosterOps.ts` before attaching to a new club — prevents a player appearing in two clubs simultaneously
- **Run `npm run preflight`** after scaffolding to verify everything compiles

## User Request

$ARGUMENTS

## Reference Files — Read Before Scaffolding

If any file doesn't exist at the stated path, say so rather than proceeding.

1. **`src/store/storeTypes.ts`** — Full `GameState` shape. Understand existing surface area before adding fields.
2. **`src/store/gameStore.ts`** — How slices compose (~37-line composition layer). Understand the pattern before adding a new slice.
3. **`src/types/game.ts`** — All type definitions. Check `GameScreen` union before adding a new screen.
4. **`src/utils/saveMigration.ts`** — Read `CURRENT_VERSION` (the live value — do NOT hardcode it). New state fields require bumping this.
5. **An existing slice similar to what you're building** — check `src/store/slices/`. The project has 15 slices; pick the closest match as a structural reference.
6. **An existing page similar to what you're building** — check `src/pages/`.

## Planning Checkpoint (Complete Before Writing Any Code)

Think through which of the 10 layers your feature touches. For each layer, ask: could this feature create or read persistent data? Does it happen on a schedule? Does it affect player objects?

State before beginning implementation:
```
Planning checkpoint:
- Applicable layers: [list which of the 10 apply]
- Approximate file change order: [list]
- Save migration needed: [yes (v[N] → v[N+1]) / no]
- New GameState fields: [list with default values for old saves]
- Player objects touched: [yes/no — if yes, rosterOps.ts needed?]
```

---

## Scaffolding Checklist

When adding a new feature, touch these layers in order. Check which apply:

### 1. Types (`src/types/game.ts`)
- Add new interfaces/types to the **single type file** (`src/types/game.ts`)
- Use `interface` over `type` for object shapes
- If the feature has a screen, add it to the `GameScreen` union type
- If it introduces new enums/unions, add them here

### 2. Config (`src/config/`)
- Create a new config file or extend an existing one for balance constants
- Export as `UPPER_SNAKE_CASE`
- Never hardcode magic numbers in logic files

### 3. Store Slice (`src/store/slices/`)
- Create a new slice file following the pattern of existing slices
- Define the slice interface and creator function
- Wire it into `src/store/gameStore.ts`
- Add new state fields to `GameState` in `src/store/storeTypes.ts`
- **Critical:** Always spread nested objects in `set()` — never mutate directly
- **If this feature moves players between clubs**: call `detachPlayerFromAllClubs()` from `src/store/helpers/rosterOps.ts` before adding a player to any club's `playerIds`. This is the only safe way to transfer players.

### 4. Utility Functions (`src/utils/`)
- Put game logic in utils, not components
- Follow existing naming patterns (camelCase files, named exports)

### 5. Page Component (`src/pages/`)
- Default export for pages
- Mobile-first layout: `max-w-lg mx-auto`, safe-area padding
- Use glass-morphism: `bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl`
- Import order: external → `@/components/ui` → `@/components/game` → local
- Use `cn()` from `@/lib/utils` for conditional classes

### 6. Game Components (`src/components/game/`)
- Named exports for shared components
- No game logic in components — call store actions or utils

### 7. Navigation
- Add route in `src/App.tsx`
- Add nav entry if it belongs in bottom nav or sub-nav
- Add screen to `GameScreen` type if not already done

### 8. Game Loop Integration
- If the feature needs per-week processing, add it to `advanceWeek()` in `orchestrationSlice.ts`
- If it needs season-end processing, add it to `endSeason()`

### 9. Persistence
- New state must be included in save/load via `src/store/helpers/persistence.ts`
- Bump save version: read `CURRENT_VERSION` from `src/utils/saveMigration.ts` first, then increment to the next number
- Add a migration step that assigns the default value to the new fields for all existing saves
- Set sensible defaults for saves that don't have the new fields

### 10. Tests (`src/test/`)
- Create `src/test/<featureName>.test.ts`
- Follow existing test patterns (Vitest + Testing Library)
- Test the utility/logic layer, not just UI
- Use `filter(Boolean)` in test setup just like production code

---

## Rules

- **Read existing similar features first** to match patterns exactly
- **Never create type files** outside `src/types/game.ts`
- **Never put game logic** in components
- **Never modify** `src/components/ui/*` unless explicitly asked
- **Always `filter(Boolean)`** when mapping player IDs to Player objects
- Run `npm run preflight` after scaffolding to verify everything compiles

## Cross-References

- See `CLAUDE.md` → "Code Conventions" and "Hard Rules" for all project constraints
- See `CLAUDE.md` → "Key Gotchas" for common pitfalls when wiring features
- Use `/project:balance` if the feature needs new config constants
- Use `/project:test` after scaffolding to generate tests
- Use `/project:review` before committing to verify conventions

## Plugin-Enhanced Workflow

- Use `/brainstorming` (superpowers) BEFORE this command to explore the design space
- Append "use context7" when looking up React/Zustand/Tailwind API patterns
- Use `/execute-plan` (superpowers) for TDD red-green-refactor after scaffolding
- Use `/code-review` after implementation for multi-perspective confidence scoring
