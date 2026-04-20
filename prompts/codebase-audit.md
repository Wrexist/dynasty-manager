# Codebase Audit Prompt

> Copy-paste this entire prompt into a Claude Code session to perform a full codebase audit.

---

You are performing a full codebase audit of Dynasty Manager — a TypeScript/Zustand mobile football management sim. You have deep familiarity with its architecture: 15 Zustand slices, 92 clubs across 4 divisions, a minute-by-minute match engine, and a weekly game loop. You know its intentional quirks: TS non-strict mode (so absent type annotations are normal), Zustand spread-in-set pattern (mutations are bugs), and the filter(Boolean) requirement on all player ID maps.

## NON-NEGOTIABLE CONSTRAINTS

Read and internalize these before scanning a single file:

- **TS non-strict**: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`. Do NOT flag missing type annotations as bugs — they are intentional. Only flag type issues that cause actual runtime failures.
- **Zustand pattern**: Every `set()` call on nested state MUST spread the parent object. Direct mutation is a real bug. Watch for `set(state => { state.players[id].overall = X })` — that's wrong.
- **Player ID safety**: Any code mapping `club.playerIds` to `Player` objects MUST use `filter(Boolean)`. Missing this is a real bug.
- **Type source of truth**: All types/interfaces must be in `src/types/game.ts`. Any type defined elsewhere is a violation.
- **Balance constants**: All numeric game constants must be in `src/config/`. Hardcoded values in logic files are bugs.
- **Storage**: Never use `localStorage` directly — use helpers in `src/store/helpers/persistence.ts`.
- **shadcn/ui**: Never modify `src/components/ui/*` files.
- **Preflight**: After all fixes, run `npm run preflight` to verify lint + test + build pass.

## Context Loading Order

Read these files first, in this order, before scanning anything else. Extract the listed information. If a file doesn't exist at the stated path, say so explicitly rather than proceeding as if you read it.

1. **`CLAUDE.md`** — Extract: Hard Rules list, Key Gotchas list, Key Patterns section
2. **`src/store/storeTypes.ts`** — Extract: the full `GameState` interface shape (all top-level fields)
3. **`src/types/game.ts`** — Extract: `Player`, `Club`, `Match` interface shapes
4. **`src/store/slices/orchestrationSlice.ts`** (first 100 lines only) — Extract: function signatures for `advanceWeek()`, `endSeason()`, `initGame()`
5. **`src/config/gameBalance.ts`** — Extract: constant names only (not values), to know what's already a config constant

Only after reading these five files should you begin the systematic per-file scan.

---

## Phase 1: Discovery (DO NOT fix anything yet)

Scan the entire codebase systematically. For each file, check for:

### Critical (fix immediately)

- **Runtime errors**: null/undefined access that would throw, missing imports, broken references
- **Logic bugs**: wrong conditions, off-by-one errors, inverted booleans, unreachable code that blocks real paths
- **State mutations**: direct mutation of Zustand state objects — must spread nested objects in every `set()` call
- **Data integrity**: operations that forget to update related data (e.g., removing player from one list but not another)
- **Race conditions**: async operations that assume synchronous ordering
- **Missing error handling at system boundaries**: unhandled JSON parse errors on `localStorage` reads, quota exceeded

### High Priority

- **Incomplete implementations**: TODO/FIXME/HACK comments, stub functions returning hardcoded values, empty catch blocks
- **Type mismatches**: function calls with wrong argument types/counts, property access on wrong types (under non-strict, these still cause runtime errors)
- **Broken UI flows**: click handlers that don't work, navigation to nonexistent routes, forms that don't submit
- **Edge cases**: division by zero, empty arrays passed to `reduce` without initial value, negative indices

### Medium Priority

- **Dead code**: unused exports, unreachable branches, commented-out code blocks, unused imports
- **Duplicated logic**: same helper reimplemented in multiple files (DRY violations)
- **Performance issues**: expensive computations in render path without memoization, O(n²) loops on large datasets
- **Inconsistencies**: mixed patterns for the same task, naming convention violations

### Low Priority

- **Hardcoded values** that should be constants in `src/config/`
- **Missing validation** on user-facing inputs
- **Accessibility gaps**: missing aria labels on interactive controls
- **Stale comments** that no longer match the code

---

## Phase 2: Report

> **Think through each Critical issue carefully before classifying it.** Consider: is this actually a bug, or an intentional pattern? A missing `?.` under TS non-strict is often deliberate. For each Critical candidate, reason: what happens at runtime if this code path is hit? Only classify as Critical after this reasoning.

Before fixing anything, output every issue found using this structure:

```xml
<issue id="N" severity="critical|high|medium|low">
  <location>file/path.ts:line</location>
  <category>Runtime Error|Logic Bug|State Mutation|Data Integrity|Incomplete Impl|Type Mismatch|Dead Code|Performance|Hardcoded Value|Other</category>
  <problem>One sentence describing what's wrong.</problem>
  <fix>One sentence describing the minimal fix.</fix>
  <confidence>HIGH|MEDIUM|LOW</confidence>
</issue>
```

`[HIGH]` = verified by tracing the code path to a failure. `[MEDIUM]` = strong pattern match with a known failure mode. `[LOW]` = heuristic, needs verification.

**Phase 2 checkpoint**: Before proceeding to Phase 3, state:
> "Phase 2 complete. Found N critical, N high, N medium, N low issues. Proceeding to Phase 3."

If more than 30 issues are found, state this and fix only Critical + High first, then ask before continuing.

---

## Phase 3: Fix

Work through the issue list from Critical → Low. For each fix:

1. Read the relevant file(s) if not already read
2. Make the minimal, focused fix — do not refactor surrounding code
3. Mark the issue as resolved with its ID
4. If a fix would change behavior significantly or touches `advanceWeek()`/`endSeason()`, flag it and ask before proceeding

**Phase 3 checkpoint**: After all fixes, state:
> "Phase 3 complete. Fixed N issues. Running preflight to verify."

Then run `npm run preflight`. Report pass/fail. If any test fails, investigate and fix before marking done.

---

## Rules

- DO NOT refactor working code that has no bugs — this is a bug hunt, not a rewrite
- DO NOT add features, comments, or documentation
- DO NOT change formatting, style, or code organization unless it's hiding a bug
- DO NOT modify test files unless the test itself is buggy (wrong assertion, not a test that fails because of a real bug)
- DO NOT flag TS issues that are normal under non-strict mode (missing type annotations, implicit any)
