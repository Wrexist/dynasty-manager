# Dynasty Manager — Comprehensive Codebase Audit

**Date:** 2026-03-24
**Scope:** ~21,000 LOC across 142+ TS/TSX files
**Sections:** Incomplete features, bugs, code quality, performance, game balance, UX, test coverage, architecture, security, quick wins

---

## Audit Findings

### [BUG] National Team Slice is Stubbed — Game Loop References Non-Functional Code
- **Severity:** High
- **Effort:** Large (1+ days)
- **File(s):** `src/store/slices/nationalTeamSlice.ts:53-61`
- **Problem:** `advanceInternationalWeek()` and `playInternationalMatch()` are empty stubs marked "Phase 5", but the slice is composed into the store and NationalTeamPage exists
- **Evidence:** Lines 54/59: `// Stub — orchestration logic will call into internationalUtils` and `// Stub — will be implemented in Phase 5` — functions have empty bodies or return null
- **Fix:** Either implement the international tournament system fully or gate the NationalTeamPage behind a feature flag so players can't navigate to broken functionality

### [BUG] Direct localStorage Access Outside Persistence Helpers
- **Severity:** Medium
- **Effort:** Small (1-2 hours)
- **File(s):** `src/store/slices/orchestrationSlice.ts:2951,2974,3050`, `src/utils/hallOfManagers.ts:23,42`
- **Problem:** CLAUDE.md rule "NEVER use localStorage directly — go through store persistence helpers" is violated in 2 files
- **Evidence:** `localStorage.setItem('dynasty-save-${s}', ...)` in orchestrationSlice, `localStorage.getItem(HALL_KEY)` in hallOfManagers
- **Fix:** Refactor saveGame/loadGame/deleteSave to delegate to persistence.ts helper functions; move hallOfManagers storage through the same abstraction

### [BUG] matchSlice Inconsistent Array Spread Pattern
- **Severity:** Medium
- **Effort:** Trivial (< 30 min)
- **File(s):** `src/store/slices/matchSlice.ts:25`
- **Problem:** `club.lineup = club.lineup.map(...)` relies on `.map()` creating a new array, while line 26 explicitly spreads `club.subs = [...club.subs.filter(...), outId]`. Pattern is technically safe but inconsistent with the project's "always spread" convention
- **Evidence:** Line 22 spreads the club but `lineup` is the original array reference until `.map()` creates a new one
- **Fix:** Use explicit spread for consistency: `club.lineup = [...club.lineup.map(id => id === outId ? inId : id)]`

### [INCOMPLETE] Monetization System Uses Test Keys — Not Production Ready
- **Severity:** High
- **Effort:** Small (1-2 hours) when ready for production
- **File(s):** `src/utils/purchases.ts:17-18`, `src/utils/ads.ts:13-16`
- **Problem:** RevenueCat uses test API key; AdMob uses Google test ad unit IDs. `NATIVE_MONETIZATION_READY = false` in both files
- **Evidence:** TODO comments: "Replace with per-platform production keys before monetization launch"
- **Fix:** Replace with production keys and set `NATIVE_MONETIZATION_READY = true` before app store submission. Expected/by-design for dev phase

### [INCOMPLETE] Only 4 Storyline Chains — Insufficient for Long Campaigns
- **Severity:** High
- **Effort:** Medium (half day)
- **File(s):** `src/data/storylineChains.ts`
- **Problem:** Only 4 storyline chains exist (dressing-room-power-struggle, star-player-transfer-saga, youth-prodigy-breakthrough, financial-crisis). Content will repeat within 2-3 seasons
- **Evidence:** 4 chains x 3-5 steps = 12-20 total storyline events
- **Fix:** Add 8-12 more chains covering: media scandals, rivalry intensification, contract holdouts, injury crises, board takeover, fan protests, cup run momentum, foreign player integration, coaching staff conflicts, stadium expansion drama

### [INCOMPLETE] Only 12 Press Conference Questions
- **Severity:** Medium
- **Effort:** Small (1-2 hours)
- **File(s):** `src/data/pressConferences.ts`
- **Problem:** 12 unique questions x 3 tones = 36 responses. Questions will repeat within a single 46-week season
- **Evidence:** Count of `question:` entries = 12
- **Fix:** Expand to 25-30 unique questions with context-aware triggering (post-loss, post-win, transfer deadline, derby week)

### [INCOMPLETE] 16 Weekly Objective Templates — Adequate but Thin
- **Severity:** Low
- **Effort:** Small (1-2 hours)
- **File(s):** `src/utils/weeklyObjectives.ts`
- **Problem:** 16 templates (10 common, 5 rare, 1 legendary). 3 objectives per week means ~5 weeks before common objectives cycle
- **Evidence:** Count of objective definitions = 16
- **Fix:** Add 10-15 more objectives, especially conditional ones (derby wins, cup progression, youth debut, financial targets)

### [PERFORMANCE] Zero React.memo Usage Across All Components
- **Severity:** Medium
- **Effort:** Small (1-2 hours)
- **File(s):** `src/components/game/*.tsx` (all 21+ components)
- **Problem:** No component uses React.memo, meaning all child components re-render when parent state changes
- **Evidence:** `grep -r "React.memo" src/components/` returns no results
- **Fix:** Add React.memo to frequently-rendered list item components: PlayerCard, PlayerAvatar, StatBar

### [PERFORMANCE] No List Virtualization for Large Lists
- **Severity:** Medium
- **Effort:** Medium (half day)
- **File(s):** `src/pages/TransferPage.tsx`, `src/pages/SquadPage.tsx`
- **Problem:** Transfer market can have 50+ listings rendered in full DOM; no react-virtual dependency
- **Evidence:** TransferPage renders full `listings` array via `.map()` without virtualization
- **Fix:** Add `@tanstack/react-virtual` for transfer market list (biggest list)

### [CODE-QUALITY] orchestrationSlice.ts is 3,171 LOC — Needs Splitting
- **Severity:** High
- **Effort:** Large (1+ days)
- **File(s):** `src/store/slices/orchestrationSlice.ts`
- **Problem:** Single file handles game loop, season management, match playing, cup progression, injuries, AI simulation, save/load, and more. `advanceWeek()` alone is ~800 lines
- **Evidence:** `wc -l` = 3,171 lines
- **Fix:** Split into: `seasonSlice.ts` (endSeason, finalizeSeason), `gameLoopSlice.ts` (advanceWeek core), `saveSlice.ts` (save/load/delete), `injurySlice.ts` (injury processing). Keep orchestrationSlice as thin coordinator

### [CODE-QUALITY] Dashboard.tsx is 1,279 LOC
- **Severity:** Medium
- **Effort:** Medium (half day)
- **File(s):** `src/pages/Dashboard.tsx`
- **Problem:** Main page component is too large with many inline sections
- **Evidence:** `wc -l` = 1,279
- **Fix:** Extract into sub-components: DashboardHeader, RecentResults, UpcomingFixtures, QuickLinks, ObjectivesPanel, BoardPanel, InjuryPanel

### [CODE-QUALITY] aiSimulation.ts is 784 LOC
- **Severity:** Low
- **Effort:** Medium (half day)
- **File(s):** `src/utils/aiSimulation.ts`
- **Problem:** Large AI logic file handling transfers, lineup management, and weekly processing
- **Evidence:** `wc -l` = 784
- **Fix:** Could split by concern (AI transfers, AI lineup, AI weekly) but not urgent

### [TEST-GAP] 28 of 39 Utility Files Have No Tests
- **Severity:** High
- **Effort:** Large (1+ days)
- **File(s):** `src/utils/` — 28 files without corresponding tests
- **Problem:** Critical game logic files lack test coverage: `aiSimulation.ts` (784 LOC), `playerGen.ts` (267 LOC), `achievements.ts`, `autoFillLineup.ts`, `international.ts`, `storylines.ts`, `scouting.ts`, `staff.ts`, `weeklyObjectives.ts`, `weekPreview.ts`, `records.ts`, and 17 more
- **Evidence:** Cross-referencing `src/utils/*.ts` with `src/test/*.test.ts` shows only 11 of 39 utils have tests
- **Fix:** Priority: (1) playerGen.ts, (2) aiSimulation.ts, (3) autoFillLineup.ts, (4) weeklyObjectives.ts, (5) achievements.ts

### [TEST-GAP] Store Slices Lack Direct Tests
- **Severity:** High
- **Effort:** Large (1+ days)
- **File(s):** `src/store/slices/transferSlice.ts`, `src/store/slices/loanSlice.ts`, `src/store/slices/orchestrationSlice.ts`
- **Problem:** No test file directly tests store slice actions. Edge case tests exist but no systematic slice testing
- **Evidence:** No files matching `transfer*.test.ts`, `loan*.test.ts`, or `orchestration*.test.ts` in test directory
- **Fix:** Add: `transferSlice.test.ts`, `loanSlice.test.ts`, `orchestrationSlice.test.ts`

### [TEST-GAP] No Integration Tests for Full Game Loop
- **Severity:** Medium
- **Effort:** Medium (half day)
- **File(s):** `src/test/`
- **Problem:** No test verifies a full advanceWeek() -> match -> stats update -> season end flow
- **Evidence:** Existing tests cover individual utils but not end-to-end game loop integrity
- **Fix:** Add `gameLoop.test.ts` that initializes game, advances through multiple weeks, verifies stats and season transition

### [BALANCE] Only 4 Storyline Chains for 20+ Season Longevity
- **Severity:** High
- **Effort:** Medium (half day)
- **File(s):** `src/data/storylineChains.ts`
- **Problem:** Game targets long campaigns but has only 4 multi-week storyline chains. At ~1 chain per 10 weeks, chains repeat within 1 season
- **Evidence:** 4 chains x 3-5 steps each = 12-20 total storyline events
- **Fix:** Add 8-12 new chains with division-specific triggers

### [ARCHITECTURE] Save/Load Logic in orchestrationSlice Instead of Persistence Helper
- **Severity:** Medium
- **Effort:** Small (1-2 hours)
- **File(s):** `src/store/slices/orchestrationSlice.ts:2950-3050`, `src/store/helpers/persistence.ts`
- **Problem:** saveGame/loadGame/deleteSave use direct localStorage calls instead of persistence helpers
- **Evidence:** Lines 2951, 2974, 3050 use raw `localStorage.setItem/getItem/removeItem`
- **Fix:** Extract save/load/delete to persistence.ts functions; call from orchestrationSlice

### [ARCHITECTURE] hallOfManagers.ts Bypasses Store Pattern
- **Severity:** Low
- **Effort:** Small (1-2 hours)
- **File(s):** `src/utils/hallOfManagers.ts:23,42`
- **Problem:** Uses direct localStorage for Hall of Managers data outside the Zustand store pattern
- **Evidence:** `localStorage.getItem(HALL_KEY)` and `localStorage.setItem(HALL_KEY, ...)` called directly
- **Fix:** Move to persistence helpers or integrate into store state

### [SECURITY] No Save Data Integrity Validation
- **Severity:** Low
- **Effort:** Small (1-2 hours)
- **File(s):** `src/store/slices/orchestrationSlice.ts:2971-2999`
- **Problem:** loadGame() parses raw JSON from localStorage without validating structure. Corrupted saves could crash the game
- **Evidence:** Line 2977: `const parsed = JSON.parse(raw)` with no schema validation
- **Fix:** Add Zod schema validation for critical save fields before applying. Low priority for single-player game

### [QUICK-WIN] Add React.memo to PlayerCard and PlayerAvatar
- **Severity:** Medium
- **Effort:** Trivial (< 30 min)
- **File(s):** `src/components/game/PlayerCard.tsx`, `src/components/game/PlayerAvatar.tsx`
- **Problem:** These components render in every squad/transfer/lineup list without memoization
- **Evidence:** Zero React.memo usage in entire component tree
- **Fix:** Wrap exports with `React.memo()`

---

## Positive Findings (No Action Needed)

- **No security vulnerabilities**: No `dangerouslySetInnerHTML`, `eval()`, or `Function()` constructor
- **Zustand state discipline**: Proper spread operators, no direct mutations detected
- **`filter(Boolean)` consistency**: All player ID -> Player object mappings use `filter(Boolean)`
- **Utility function centralization**: `pick()`, `clamp()`, `shuffle()`, `getSuffix()`, `formatMoney()` all defined once in `src/utils/helpers.ts`
- **React.lazy code splitting**: All 24+ pages use dynamic imports via `React.lazy()`
- **Vite chunk splitting**: framer-motion, recharts, radix properly separated
- **All `.map()` renders have proper keys**: No index-based keys found
- **Console statements legitimate**: All are `console.warn`/`console.error` for error handling, no debug `console.log`
- **Safe area handling**: CSS utilities defined with `env(safe-area-inset-*)` fallbacks
- **Error boundary**: `PageErrorBoundary` wraps page content in GameShell
- **Save migration system**: 20 sequential migrations (v1-v21) with proper error handling
- **No circular dependencies**: Clean one-way import chains between slices, utils, config
- **No unused dependencies**: All npm packages are actively imported
- **No dead code**: All utility functions are imported and used

---

## Summary Table

| Category      | Critical | High | Medium | Low | Total |
|---------------|----------|------|--------|-----|-------|
| BUG           | 0        | 1    | 2      | 0   | 3     |
| INCOMPLETE    | 0        | 2    | 1      | 1   | 4     |
| PERFORMANCE   | 0        | 0    | 2      | 0   | 2     |
| UX            | 0        | 0    | 0      | 0   | 0     |
| BALANCE       | 0        | 1    | 0      | 0   | 1     |
| CODE-QUALITY  | 0        | 1    | 1      | 1   | 3     |
| TEST-GAP      | 0        | 2    | 1      | 0   | 3     |
| ARCHITECTURE  | 0        | 0    | 1      | 1   | 2     |
| SECURITY      | 0        | 0    | 0      | 1   | 1     |
| QUICK-WIN     | 0        | 0    | 1      | 0   | 1     |
| **TOTAL**     | **0**    | **7**| **9**  | **4**| **20**|

---

## Top 10 Recommended Actions

1. **Split orchestrationSlice.ts** (3,171 LOC) into 4-5 focused slices — biggest maintainability win. *(High severity, Large effort)*

2. **Add tests for untested utility files** — 28 of 39 utils lack tests. Prioritize: playerGen.ts, aiSimulation.ts, autoFillLineup.ts, weeklyObjectives.ts. *(High severity, Large effort)*

3. **Add store slice tests** — transferSlice, loanSlice, and orchestrationSlice have zero direct test coverage. *(High severity, Large effort)*

4. **Expand storyline chains from 4 to 12+** — Content will repeat within 2 seasons, hurting engagement. *(High severity, Medium effort)*

5. **Implement or gate National Team feature** — Stubbed functions are accessible via NationalTeamPage. *(High severity, varies)*

6. **Add React.memo to list item components** — PlayerCard, PlayerAvatar, StatBar render in loops without memoization. *(Medium severity, Trivial effort)*

7. **Expand press conference questions from 12 to 25+** — Questions repeat within a single 46-week season. *(Medium severity, Small effort)*

8. **Refactor save/load to use persistence helpers** — Direct localStorage calls violate project rules. *(Medium severity, Small effort)*

9. **Add list virtualization to TransferPage** — Market can have 50+ listings in full DOM. *(Medium severity, Medium effort)*

10. **Add save data validation** — loadGame() applies raw JSON without structure validation. *(Low severity, Small effort)*
