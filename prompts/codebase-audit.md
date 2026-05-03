# Codebase Audit Prompt

> Copy-paste this entire prompt into a Claude Code session to perform a full codebase audit of Dynasty Manager.

---

You are performing a runtime-correctness audit of Dynasty Manager — a TypeScript / Zustand mobile football management sim shipped to TestFlight. The codebase is now ~519 TS/TSX files, 15 Zustand slices, a 1,816-LOC minute-by-minute match engine, save schema **v67** with active migration ladder, and a six-file orchestration submodule totalling ~7,977 LOC. You know the intentional quirks: TS non-strict mode, Zustand spread-in-`set` pattern, `filter(Boolean)` after every player-ID lookup, single types source-of-truth, and persistence via `src/store/helpers/persistence.ts` (never raw `localStorage`).

This is a **bug hunt**, not a rewrite. Find runtime failures and fix them with minimal, surgical edits.

## NON-NEGOTIABLE CONSTRAINTS

- **TS non-strict** (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`). Missing annotations and implicit `any` are intentional — never flag them. Only flag type issues that produce a runtime crash.
- **Zustand spread**: Every `set()` on nested state MUST spread the parent. `set(state => { state.players[id].overall = X })` or `state.club.budget -= cost` are bugs.
- **Player-ID safety**: Any `playerIds.map(id => state.players[id])` MUST end in `.filter(Boolean)`. Same for `club.lineup` and `club.subs` (string-array player IDs, not Player objects).
- **Single source of truth**: All types/interfaces live in `src/types/game.ts` (~2,032 LOC). Types defined elsewhere are violations.
- **Balance constants**: Numeric tuning lives in `src/config/*` (33 files). Hardcoded magic numbers in slices/utils/components are bugs.
- **Storage**: Never `localStorage.*` directly. Use `readSessionJson` / `writeSessionJson` / `readSaveSlot` / `writeSaveSlot` / `getFlag` / `setFlag` from `src/store/helpers/persistence.ts`. Lint enforces this.
- **shadcn/ui**: Never modify `src/components/ui/*`.
- **Data integrity on transactions**: Sells/buys/loans must update BOTH sides (seller + buyer) AND the player's `clubId` AND remove from `transferMarket` AND recompute `wageBill`. Match results must update both the fixture entry AND every player's per-stat counters.
- **Preflight gate**: After fixes, run `npm run preflight` (lint + test + build).

---

## Context Loading (read these first, in this exact order — parallelise where the harness allows)

If a stated path is missing, say so explicitly rather than fabricating.

1. **`CLAUDE.md`** — Hard Rules, Key Gotchas, Key Patterns, store + orchestration topology
2. **`src/store/storeTypes.ts`** (~487 LOC) — full `GameState` shape; this is the inventory
3. **`src/types/game.ts`** (~2,032 LOC, line index only) — locate `Player`, `Club`, `Match`, `MonetizationState`, `CareerManager`, `NationalTeamState`, `OpenedPackRecord`, `ContinentalTournamentState`. Skim, don't read fully.
4. **`src/store/gameStore.ts`** (35 LOC) — confirm slice composition order
5. **Orchestration index** — list `src/store/slices/orchestration/`. Read entry points:
   - `weekAdvance.ts` (~2,954 LOC) — week loop
   - `seasonEnd.ts` (~1,590 LOC) — promotion/relegation, contracts, awards, history
   - `matchActions.ts` (~1,520 LOC) — pre/post match wiring
   - `initGame.ts` (~542 LOC) — bootstrap
6. **`src/engine/match.ts`** (~1,816 LOC) — first 200 lines for the `simulateMatch` signature + event types
7. **`src/utils/saveMigration.ts`** — note `CURRENT_VERSION` (currently 67) and migration count
8. **`src/test/stateValidator.ts`** — invariants you can call to verify findings
9. **`src/config/gameBalance.ts`** — list constant names (not values) so you don't propose moving things that already live there

After context load, state: **"Context loaded. CURRENT_VERSION=N. Slices loaded: [count]. Proceeding to Phase 1."**

---

## Phase 1: Discovery — DO NOT FIX YET

Scan systematically. Focus on the high-yield surfaces first (in this order): the `orchestration/` submodule → transferSlice + loanSlice → match engine → packsSlice + monetizationSlice → careerSlice + nationalTeamSlice → systemsSlice → pages that mutate state.

### Critical (game-breaking)

- **Direct Zustand mutations** — `state.x.y = z`, `state.arr.push(...)`, `state.players[id].overall++`, etc. inside `set(state => ...)`
- **Missing `filter(Boolean)`** after `playerIds`/`lineup`/`subs` mapping — produces `undefined.name` crashes
- **Half-completed transactions** — transfer/loan/sale that updates one side but not the other, or forgets `transferMarket` removal, `wageBill`, or player's `clubId`
- **Match-result desync** — fixture stored but per-player goals/assists/appearances/cleansheets not incremented, or vice versa
- **Save corruption risks** — direct `localStorage.*` calls bypassing persistence helpers, JSON parse without try/catch in load paths, missing migration step for fields added after `CURRENT_VERSION` bump
- **Promotion/relegation invariants** — clubs that disappear, duplicate across two divisions, or division size drift (must always be 20/24/24/24 = 92)
- **Race conditions** — async work in `advanceWeek`/`endSeason` that assumes synchronous ordering; pack-open or in-app-purchase callbacks that fire after state has moved on

### High Priority

- **Type mismatches that crash at runtime** — wrong arg count, accessing fields on the wrong shape, returning the wrong tuple from a destructure
- **Empty-array `reduce`** without an initial value (common in finance/awards code)
- **Off-by-one** in week boundaries (transfer windows, season-end triggers, contract expiry)
- **Inverted booleans** in match logic, AI decisions, or board verdicts
- **Stub/TODO/FIXME/HACK** in shipping code; empty `catch {}` swallowing real errors
- **Dead nav routes** — `setCurrentScreen('x')` where `'x'` isn't in `GameScreen` union
- **Continental + national team + career interactions** — these were added late; they touch `endSeason` and have the highest cross-system bug surface

### Medium Priority

- **Duplicated logic** — same helper reimplemented in 2+ files (check `src/utils/helpers.ts` first; that's the canonical home for `pick`, `clamp`, `getSuffix`)
- **Hot-path perf** — O(n²) inside `weekAdvance.ts`, unmemoised expensive selectors in render path
- **Dead exports** — exports nothing imports (run a quick grep)
- **Inconsistencies** — mixed patterns for the same task (e.g., two different wage-recalc strategies)

### Low Priority

- **Hardcoded values** that should be in `src/config/`
- **Missing form validation** at user-input boundaries
- **Stale comments** that no longer match the code
- **Accessibility** gaps on interactive controls

---

## Phase 2: Report

> **Reason before classifying.** For every Critical candidate, trace the failing path: what user action triggers it? Which line crashes? What state is corrupted? A nullable access is a bug *only if* the code path can reach it with the value undefined — non-strict TS means many such accesses are intentional and safe. Downgrade `[HIGH]` confidence if you can't trace a concrete path.

Output every finding as:

```xml
<issue id="N" severity="critical|high|medium|low">
  <location>relative/path.ts:line</location>
  <category>Mutation | PlayerID Safety | Tx Integrity | Save Migration | Promo/Releg | Type | Stub | Dead Code | Perf | Hardcoded | Other</category>
  <problem>One sentence: what's wrong.</problem>
  <repro>One sentence: the user action or state that triggers it.</repro>
  <fix>One sentence: minimal change.</fix>
  <confidence>HIGH | MEDIUM | LOW</confidence>
</issue>
```

`HIGH` = code path traced to failure. `MEDIUM` = strong pattern match with a known failure mode. `LOW` = heuristic, needs verification.

**Phase 2 checkpoint** — state: `"Phase 2 complete. Found N critical, N high, N medium, N low. Proceeding to Phase 3."`

If >30 issues, fix Critical + High first and ask before continuing.

---

## Phase 3: Fix

Work Critical → Low. For each:

1. Read the file (if not already loaded)
2. Make the **minimal** focused fix — never refactor surrounding code
3. Mark the issue resolved by ID
4. **Behavioural-change gate**: if the fix touches `weekAdvance.ts`, `seasonEnd.ts`, `match.ts`, `saveMigration.ts`, or any `Slice` file beyond a one-line correction → flag and ask before proceeding

Special-case for save-migration bugs: if the fix changes the persisted shape, you MUST bump `CURRENT_VERSION` and add a migration step. Never silently change the schema.

**Phase 3 checkpoint** — state: `"Phase 3 complete. Fixed N. Running preflight."`

Then run `npm run preflight`. If anything fails, investigate root cause — never `--no-verify` or skip hooks. Never `git add -A`; stage only the files you touched.

---

## Rules

- DO NOT refactor working code that has no bug — this is a bug hunt
- DO NOT add features, comments, or docs
- DO NOT reformat, restyle, or reorganise unless that's literally the bug
- DO NOT modify a test unless the test itself is wrong (wrong assertion, not a test failing because of a real bug)
- DO NOT flag missing type annotations or implicit `any` — those are intentional under non-strict
- DO NOT bypass `npm run preflight` — fix root causes
