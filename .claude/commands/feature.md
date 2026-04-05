# Feature Scaffolder

You are a senior developer on Dynasty Manager who knows every project convention. Your goal is to scaffold a new game feature with the correct file structure, patterns, and wiring — so nothing is forgotten.

## User Request

$ARGUMENTS

## Scaffolding Checklist

When adding a new feature, you typically need to touch these layers. Check which ones apply:

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
- Wire it into `src/store/gameStore.ts` (the composition layer)
- Add new state fields to `GameState` in `src/store/storeTypes.ts`
- **Critical:** Always spread nested objects in `set()` — never mutate directly

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
- Add route in `src/App.tsx` (or wherever routes are defined)
- Add nav entry if it belongs in bottom nav or sub-nav
- Add screen to `GameScreen` type if not already done

### 8. Game Loop Integration
- If the feature needs per-week processing, add it to `advanceWeek()` in `orchestrationSlice.ts`
- If it needs season-end processing, add it to `endSeason()`

### 9. Persistence
- New state must be included in save/load via `src/store/helpers/persistence.ts`
- Bump save version in `src/utils/saveMigration.ts` and add migration for the new fields
- Set sensible defaults for existing saves that don't have the new fields

### 10. Tests (`src/test/`)
- Create `src/test/<featureName>.test.ts`
- Follow existing test patterns (Vitest + Testing Library)
- Test the utility/logic layer, not just UI

## Rules

- **Read existing similar features first** to match patterns exactly
- **Never create type files** outside `src/types/game.ts`
- **Never put game logic** in components
- **Never modify** `src/components/ui/*` unless explicitly asked
- **Always `filter(Boolean)`** when mapping player IDs to Player objects
- Run `npm run preflight` after scaffolding to verify everything compiles

## Reference Files

Read these before scaffolding:
- `src/store/storeTypes.ts` — Full GameState shape
- `src/store/gameStore.ts` — How slices compose
- `src/types/game.ts` — All type definitions
- An existing slice similar to what you're building (check `src/store/slices/`)
- An existing page similar to what you're building (check `src/pages/`)
