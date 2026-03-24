# Dynasty Manager — Comprehensive Codebase Improvement Prompt

> **Usage:** Copy this entire prompt into a new Claude Code session (or any AI coding assistant) pointed at this repository. It will systematically audit the codebase and produce a prioritized, actionable list of improvements. You can also run individual sections by copying just that section.

---

## Your Task

You are an expert software engineer and game designer. Perform a **comprehensive audit** of the Dynasty Manager codebase — a mobile-first football management simulation built with React, TypeScript, Zustand, Tailwind, and Capacitor.

Read `CLAUDE.md` first for full project context, then systematically work through **every section below**. For each section, search the actual code — do not guess or assume. Produce findings in the **exact output format** specified at the end.

---

## Section 1: Incomplete Features & Stub Code

**Goal:** Find every feature that was started but not finished.

**Search for:**
- `TODO`, `FIXME`, `HACK`, `XXX`, `TEMP`, `PLACEHOLDER`, `STUB` comments (case-insensitive)
- Functions that return hardcoded values, `null`, `[]`, `{}`, `undefined`, `false`, or `0` without real logic
- Empty function bodies or functions with only a `console.log`
- Commented-out code blocks (more than 3 consecutive commented lines)
- Unused imports or exports (symbols imported but never referenced)
- Features referenced in types (`src/types/game.ts`) or state (`src/store/storeTypes.ts`) that have no corresponding UI page or logic
- Config sections (`src/config/`) that define parameters for systems with no implementation
- Pages or components that render placeholder text like "Coming Soon", "TBD", "WIP", "Not Implemented"
- Event handlers that are empty or only call `e.preventDefault()`

**Inspect specifically:**
- `src/utils/purchases.ts` — IAP integration completeness
- `src/utils/ads.ts` — ad integration completeness
- `src/store/slices/monetizationSlice.ts` — are all actions wired to real logic?
- Every page in `src/pages/` — does each page fully implement its intended functionality?
- `src/data/storylineChains.ts` — how many storyline chains exist? Are there enough for 20+ seasons?
- `src/data/pressConferences.ts` — how many unique questions? Will they repeat within a season?
- `src/utils/weeklyObjectives.ts` — how many objective templates? Enough variety for long campaigns?

---

## Section 2: Bug Hunting & Logic Errors

**Goal:** Find logic bugs, edge cases, and incorrect behavior.

**Search for:**
- **State mutation:** Any place where Zustand state is modified without spreading (`state.x.y = z` instead of `set({ x: { ...state.x, y: z } })`)
- **Missing filter(Boolean):** Mapping player IDs to Player objects without filtering out `undefined` (deleted players)
- **Off-by-one errors:** Array indexing, week/season boundaries, fixture scheduling
- **Division arithmetic:** Promotion/relegation edge cases — what happens when a club is in both playoff and auto-promotion slots?
- **Transfer window logic:** Can transfers happen outside the window? Are edge cases at window boundaries handled?
- **Season end:** Does `endSeason()` properly handle all state resets? Are there dangling references to old players/fixtures?
- **Cup competition:** What happens if a cup match is a draw? Extra time/penalties handled correctly?
- **Match simulation:** Are player stats (goals, assists, clean sheets) correctly attributed to the right players?
- **Loan system:** What happens when a loaned player's parent club is relegated? When a loan expires mid-season?
- **Save/Load:** Does the save migration handle all edge cases? What happens loading a save from 3+ versions ago?
- **Numeric overflows:** Budget going negative, stats overflowing, percentages exceeding 100
- **Empty arrays:** What happens when a club has 0 players? When all players are injured?
- **Race conditions:** Can `advanceWeek()` be called while a match is in progress?
- **Duplicate IDs:** Can two players or clubs end up with the same ID?

**Inspect specifically:**
- `src/store/slices/orchestrationSlice.ts` — the game loop (largest file, most complex logic)
- `src/engine/match.ts` — match simulation correctness
- `src/utils/promotionRelegation.ts` — edge cases in multi-division system
- `src/store/slices/transferSlice.ts` — transfer offer/acceptance/rejection flow
- `src/store/slices/loanSlice.ts` — loan lifecycle edge cases
- `src/store/helpers/matchProcessing.ts` — stat attribution correctness

---

## Section 3: Code Quality & Maintainability

**Goal:** Find code smells, duplication, and maintainability issues.

**Search for:**
- **Duplicated functions:** `getSuffix()`, `pick()`, `clamp()`, `shuffle()`, `formatCurrency()` or similar utilities that appear in multiple files
- **God files:** Any file over 500 LOC that should be split (especially `orchestrationSlice.ts` at ~2,800+ LOC)
- **Dead code:** Functions/components/types that are defined but never imported or used anywhere
- **console.log/warn/error statements** left in production code (not in test files)
- **Magic numbers:** Hardcoded numeric values in logic files that should be in `src/config/`
- **Inconsistent patterns:** Different files handling the same concern differently (e.g., some use early returns, others use if/else chains)
- **Long functions:** Functions over 100 lines that could be decomposed
- **Deep nesting:** More than 4 levels of indentation in logic (complex conditionals)
- **Type safety issues:** Use of `any`, type assertions (`as`), non-null assertions (`!`), or `@ts-ignore`/`@ts-expect-error`
- **Prop drilling:** Components passing props through 3+ levels instead of using store selectors
- **Unused dependencies:** npm packages in `package.json` that aren't imported anywhere

**Inspect specifically:**
- All files in `src/utils/` — check for duplication across files
- All files in `src/store/slices/` — check for consistent patterns
- All files in `src/pages/` — check for logic that should be in store/utils instead of components
- `package.json` — check every dependency is actually used

---

## Section 4: Performance & Bundle Size

**Goal:** Find performance bottlenecks and optimization opportunities.

**Search for:**
- **Missing memoization:** Components that re-render on every state change because they subscribe to too much store state. Look for `useGameStore(state => state)` or broad selectors
- **Missing React.memo:** Components that receive stable props but re-render due to parent re-renders
- **Missing useMemo/useCallback:** Expensive computations or callbacks recreated every render inside components
- **Large inline objects/arrays:** Objects or arrays created inside JSX (causes re-renders): `style={{...}}`, `options={[...]}` inside render
- **Unoptimized list rendering:** Large lists without virtualization (squad lists with 30+ players, league tables with 24 teams, transfer market)
- **Bundle size:** Are there lighter alternatives to heavy dependencies? Is tree-shaking working?
- **Lazy loading:** Are all route-level pages code-split with `React.lazy`? Are heavy components (charts, modals) lazy-loaded?
- **Image optimization:** Are there unoptimized images or SVGs that could be smaller?
- **Expensive re-computations:** League table sorting, fixture generation, transfer market filtering — are these cached?
- **Animation performance:** Are Framer Motion animations using `transform` and `opacity` (GPU-accelerated) or triggering layout thrashing?

**Inspect specifically:**
- `src/hooks/useGameSelectors.ts` — are selectors properly memoized?
- `src/pages/MatchDay.tsx` — live match updates, potential re-render storm
- `src/pages/TransferPage.tsx` — large list rendering
- `src/pages/LeagueTable.tsx` — table sorting/filtering
- `src/pages/Dashboard.tsx` — largest page, many data subscriptions
- `vite.config.ts` — chunk splitting configuration

---

## Section 5: Game Balance & Gameplay Quality

**Goal:** Find gameplay issues that hurt the player experience.

**Analyze:**
- **Difficulty curve:** Is Division 4 easy enough for new players? Is Division 1 challenging enough for experienced ones? Check `src/config/gameBalance.ts` and `src/config/aiManager.ts`
- **Economic balance:** Do player wages, transfer fees, prize money, and facility costs scale correctly across divisions? Can the player accumulate infinite money?
- **Player development:** Are growth/decline rates realistic? Can a player's overall exceed 99 or go below 1? Check `src/config/playerGeneration.ts` and `src/store/helpers/development.ts`
- **Match engine fairness:** Does home advantage work? Is the match engine too random or too predictable? Is there a dominant tactic? Check `src/config/matchEngine.ts` and `src/engine/match.ts`
- **Transfer AI:** Do AI clubs make reasonable offers? Can the player exploit the transfer market trivially? Check `src/config/aiManager.ts` and `src/utils/aiSimulation.ts`
- **Content longevity:** How many seasons before content repeats? Count unique: storyline chains, press conference questions, weekly objectives, challenges, season awards, narrative events
- **Board expectations:** Are board objectives achievable? Do they scale with division? Check `src/config/gameBalance.ts` board section
- **Injury system:** Are injury rates realistic? Can a team be completely wiped by injuries? Is there recovery balance?
- **Youth academy:** Do youth prospects generate at appropriate quality levels per division?
- **Chemistry system:** Does chemistry provide meaningful but not overpowering bonuses?
- **Prestige/Perks:** Is the progression system balanced for long campaigns?

---

## Section 6: UX, Accessibility & Mobile Compliance

**Goal:** Find UX issues, especially for mobile-first experience.

**Search for:**
- **Touch targets:** Buttons or interactive elements smaller than 44x44px (iOS) / 48x48dp (Android)
- **Missing loading states:** Async operations without loading indicators
- **Missing empty states:** Pages that show nothing when data is empty (no players, no messages, no offers)
- **Missing error boundaries:** Components that could crash without graceful degradation
- **Scroll issues:** Long content without proper scrolling, or scroll within scroll (nested scrollable areas)
- **Text truncation:** Long player names, club names, or values that overflow containers
- **Color contrast:** Text that may be hard to read against the dark background (check muted text)
- **Missing feedback:** User actions without visual/haptic confirmation
- **Navigation dead ends:** Pages with no back button or clear exit path
- **Form validation:** Input fields without validation feedback (contract offers, transfer bids)
- **Keyboard handling:** Does the virtual keyboard push content up correctly? (Capacitor keyboard plugin usage)
- **Safe area:** Is `safe-area-inset-*` properly applied for notched devices?
- **Orientation:** What happens in landscape mode?
- **Gesture conflicts:** Do swipe gestures conflict with system gestures or scrolling?

**Inspect specifically:**
- `src/components/game/BottomNav.tsx` — navigation accessibility
- `src/components/game/TopBar.tsx` — status bar area handling
- `src/pages/MatchDay.tsx` — live match UX (is it clear what's happening?)
- `src/index.css` — safe area padding, scrolling behavior
- All modal/sheet components — can they be dismissed? Do they trap focus?

---

## Section 7: Test Coverage Gaps

**Goal:** Find critical untested code paths.

**Analyze:**
- List every file in `src/utils/`, `src/store/slices/`, `src/engine/`, and `src/store/helpers/` that does NOT have a corresponding test file in `src/test/`
- For files that DO have tests, identify major functions or branches that aren't covered
- Check for edge case tests: empty inputs, boundary values, null/undefined handling
- Check for integration-level tests: does any test verify a full `advanceWeek()` → match → stats update flow?
- Check for regression tests: are previously fixed bugs covered by tests?

**Priority areas that MUST have tests:**
- `orchestrationSlice.ts` — `advanceWeek()`, `endSeason()`, `initGame()` (most critical game logic)
- `match.ts` — `simulateMatch()` correctness
- `promotionRelegation.ts` — all promotion/relegation/playoff paths
- `transferSlice.ts` — full offer/accept/reject flow
- `loanSlice.ts` — loan lifecycle
- `saveMigration.ts` — migration from every previous save version
- `playerGen.ts` — player generation correctness, overall calculation

---

## Section 8: Architecture & Scalability

**Goal:** Find structural issues that will compound as the codebase grows.

**Analyze:**
- **File decomposition:** Which files are too large and should be split? What's the logical split?
- **Circular dependencies:** Are there circular import chains? (Check with tooling or trace imports)
- **Store design:** Are Zustand slices properly scoped? Is any slice doing too much?
- **Config sprawl:** Are config files well-organized or becoming a dumping ground?
- **Type completeness:** Are there `any` types in the store or critical paths that should be typed?
- **Error handling strategy:** Is there a consistent approach to error handling, or is it ad-hoc?
- **Data flow clarity:** Can you trace how data flows from user action → store → UI without confusion?
- **Migration strategy:** Is the save migration system robust enough for continued development?

---

## Section 9: Security & Data Integrity

**Goal:** Find security vulnerabilities and data integrity risks.

**Search for:**
- **XSS vectors:** `dangerouslySetInnerHTML`, unescaped user input rendered in JSX
- **localStorage abuse:** Direct `localStorage` access outside persistence helpers, sensitive data stored unencrypted
- **Input validation:** Are transfer bid amounts, contract values, and other numeric inputs validated with Zod or similar?
- **State integrity:** Can the game state become internally inconsistent? (e.g., player references a club that doesn't exist)
- **Save tampering:** Can a user edit localStorage to cheat? Does it matter for a single-player game? Are there integrity checks?
- **Dependency vulnerabilities:** Run `npm audit` mentally — are there known-vulnerable packages?
- **eval/Function constructor:** Any dynamic code execution?

---

## Section 10: Quick Wins & Low-Hanging Fruit

**Goal:** Find improvements that are easy to implement but high-impact.

**Look for:**
- `console.log` statements to remove
- Duplicate utility functions to consolidate
- Missing `key` props in `.map()` renders
- Unnecessary re-renders fixable with a single `useMemo` or `React.memo`
- Config values that seem obviously wrong (e.g., a player declining at age 25)
- Typos in user-facing strings
- Broken or missing icons
- CSS classes that don't exist or conflict

---

## Output Format

For each finding, produce a structured entry in this exact format:

```markdown
### [CATEGORY] Finding Title
- **Severity:** Critical | High | Medium | Low
- **Effort:** Trivial (< 30 min) | Small (1-2 hours) | Medium (half day) | Large (1+ days)
- **File(s):** `path/to/file.ts:line_number`
- **Problem:** One-sentence description of what's wrong
- **Evidence:** The specific code, pattern, or search result that proves this
- **Fix:** Concrete steps to resolve (not vague — actual code changes or approach)
```

**Categories:** `BUG`, `INCOMPLETE`, `PERFORMANCE`, `UX`, `BALANCE`, `CODE-QUALITY`, `TEST-GAP`, `ARCHITECTURE`, `SECURITY`, `QUICK-WIN`

## Sorting

Sort all findings by:
1. **Critical** bugs and security issues first
2. **High-severity** items grouped by effort (trivial first)
3. Then **Medium**, then **Low**

## Summary Table

At the end, produce a summary table:

```markdown
| Category      | Critical | High | Medium | Low | Total |
|---------------|----------|------|--------|-----|-------|
| BUG           |          |      |        |     |       |
| INCOMPLETE    |          |      |        |     |       |
| PERFORMANCE   |          |      |        |     |       |
| UX            |          |      |        |     |       |
| BALANCE       |          |      |        |     |       |
| CODE-QUALITY  |          |      |        |     |       |
| TEST-GAP      |          |      |        |     |       |
| ARCHITECTURE  |          |      |        |     |       |
| SECURITY      |          |      |        |     |       |
| QUICK-WIN     |          |      |        |     |       |
| **TOTAL**     |          |      |        |     |       |
```

## Final Deliverable

End with a **"Top 10 Recommended Actions"** list — the 10 highest-impact improvements considering both severity and effort, forming a practical improvement roadmap.

---

> **Note:** This prompt is designed to be reusable. Run it periodically (e.g., every sprint or after major features) to maintain codebase health. Each run should find fewer issues as improvements are implemented.
