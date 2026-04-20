# Game Longevity & Stress Testing Prompt

> Copy-paste this entire prompt into a Claude Code session to perform deep game-breaking bug hunting and long-term playability testing.

---

You are performing an exhaustive longevity and stress test of Dynasty Manager — a TypeScript/Zustand mobile football management sim with 92 clubs, 4 divisions, 15 Zustand slices, and a 46-week season loop. Your goal is to ensure the game survives **20+ seasons** (1,000+ in-game weeks) without game-breaking bugs, content drought, or state corruption.

## NON-NEGOTIABLE CONSTRAINTS

- **TS non-strict** is intentional — do NOT flag missing type annotations as bugs. Only report runtime failures.
- **Test only runtime behavior** — not type compliance
- **Extend existing tests — do not recreate** infrastructure that already exists
- Run `npm run preflight` before marking any phase complete

---

## Pre-Flight: Read Existing Test Infrastructure First

**Before writing a single new test**, read these files:

1. **`src/test/stateValidator.ts`** — Exports `validateGameState(state)`. This is your core invariant checker. Import and call it throughout your tests — do NOT rewrite the checks it contains.
2. **`src/test/longevity.test.ts`** — Existing multi-season stress tests with `advanceFullSeason()` helper. Identify what's already covered and what gaps remain.
3. **`src/test/` directory** — List all files. There are 50+ test files. Before writing any test, confirm no existing file already covers your scenario.

State what's already covered in `longevity.test.ts` before proposing new test scenarios.

---

Read `CLAUDE.md` first, then proceed phase by phase.

---

## Phase 1: Write Multi-Season Simulation Tests

Extend or supplement the existing longevity tests. Focus on gaps not already covered.

### 1A. Season Lifecycle Stress Test

Write (or verify it already exists in `longevity.test.ts`) a test that programmatically runs through **10+ full seasons** by calling `initGame()` then repeatedly calling `advanceWeek()` 46 times + `endSeason()` in a loop. After each season, assert and call `validateGameState(state)` plus:

- `state.season` incremented correctly
- `state.week` reset to 1
- Every club in every division has a valid squad (`club.playerIds.length >= 18`)
- Every player ID in `club.playerIds` resolves to a real `Player` object in `state.players`
- Every player in `club.lineup` and `club.subs` exists in `club.playerIds`
- No duplicate player IDs across different clubs
- `state.divisionClubs` sizes: div-1=20, div-2=24, div-3=24, div-4=24
- Total club count across all divisions is exactly 92
- `state.fixtures` and `state.divisionFixtures` are regenerated and non-empty
- No `NaN`, `undefined`, or `null` in any player's `overall`, `potential`, `age`, `wage`, or `value`

### 1B. Promotion/Relegation Integrity Test

After each simulated season:

- Verify clubs that were auto-promoted appear in the higher division's `divisionClubs`
- Verify clubs that were auto-relegated appear in the lower division's `divisionClubs`
- Verify playoff winners moved up correctly
- Verify div-4 replacement clubs are brand new (not recycled IDs)
- Verify no club appears in two divisions simultaneously
- Verify no club is orphaned (missing from all divisions)
- Run this for **15+ seasons** and confirm the 92-club invariant never breaks

### 1C. Player Lifecycle Test Over Many Seasons

Simulate 20 seasons and track:

- **Youth intake**: At least 2-4 new youth prospects generated per club per season
- **Aging**: All players age by exactly 1 per season. No player should be age 0, negative, or >45
- **Retirement/removal**: Players aged 36+ with low overall should eventually leave the game
- **Contract expiry**: Players whose `contractEnd <= season` become free agents. No ghost contracts
- **Squad replenishment**: After retirements and sales, every club still has ≥18 players
- **Player count bounds**: Total player count stays within reasonable range (2,000–4,000). Flag unbounded growth or dangerous depletion
- **Stat integrity**: No negative goals, assists, or appearances. No `NaN` in any stat field

### 1D. Financial Sustainability Test

Simulate 15 seasons and after each:

- No club has `budget` of `NaN`, `Infinity`, or `undefined`
- Club budgets don't spiral to extreme values (>500M or <-100M without board action)
- `wageBill` recalculated correctly after transfers and contract changes
- `financeHistory` array grows by exactly 1 entry per season. Flag unbounded growth
- Transfer income/expenses balance correctly (buyer loses money, seller gains it)

### 1E. Cup Competition Integrity Test

For each simulated season:

- Cup draw generates correct bracket (92 clubs enter, byes assigned properly)
- Each round halves the remaining teams
- Cup winner determined by season end
- Cup state resets cleanly for next season
- No club appears twice in the same round
- Eliminated clubs don't appear in later rounds

---

## Phase 1 Checkpoint

> State: "Phase 1 complete. Tests written/extended: [list]. Tests that already existed and were not duplicated: [list]. All pass: [yes/no]. Proceeding to Phase 2."

---

## Phase 2: Edge Case & Boundary Testing

### 2A. Mass Contract Expiry

Set up a state where 8+ players on the player's club have `contractEnd === state.season`. Run `endSeason()` and verify:

- All expired players become free agents or are re-signed
- Club still has a valid lineup (11 players) and subs
- `wageBill` updates after mass departures
- No orphaned player references in `lineup`, `subs`, or `playerIds`

### 2B. Simultaneous Injuries + Suspensions

Set up a state where 5+ players are injured and 2+ are suspended. Advance a week and verify:

- Match can still be played (enough fit players for starting 11)
- If not enough fit players, graceful fallback (not a crash)
- Recovery timers decrement correctly

### 2C. Transfer Window Boundary

Test transfers at exact window boundaries:

- Week 8 (last summer window week): transfer should succeed
- Week 9 (window closed): transfer should be rejected
- Week 20 (winter window opens): transfer should succeed
- Week 24 (last winter week): transfer should succeed
- Week 25 (window closed): transfer should be rejected

### 2D. Loan Edge Cases

- Loan with obligatory buy: verify purchase triggers at loan end
- Loan recall before minimum 4 weeks: should fail
- Loan recall after 4 weeks: should succeed, player returns
- Multiple simultaneous outgoing loans: all tracked independently

### 2E. Playoff Bracket Corruption

- Simulate a season where the player's club finishes in playoff position
- Verify bracket has exactly 4 clubs from correct positions (3rd-6th)
- Verify semi-finals and final produce exactly one winner
- Verify playoff winner is promoted and appears in higher division next season

### 2F. Division Boundary Integrity

- Club promoted from div-4 to div-3: verify removed from div-4, added to div-3
- Club relegated from div-1 to div-2: verify fixtures regenerated for both divisions
- New replacement clubs in div-4: verify they have full squads, valid budgets, and fresh player IDs

### 2G. Continental Competition Integrity

If `state.continentalState` or equivalent exists (check `src/store/slices/careerSlice.ts` and `src/config/continental.ts`):

- Verify clubs are correctly qualified based on final league position
- Verify group stage generates correct match counts per group
- Verify knockout bracket eliminates teams correctly across seasons
- Verify continental state resets cleanly at season end

---

## Phase 2 Checkpoint

> State: "Phase 2 complete. Edge case tests written: [list]. All pass: [yes/no]. Proceeding to Phase 3."

---

## Phase 3: Content Longevity Audit

### 3A. Storyline Chain Exhaustion

- Read `src/data/storylineChains.ts` and count total unique chains
- Determine: after how many seasons will the player have seen every chain?
- Check if chains can repeat with variation
- **Flag if fewer than 8 unique chains exist**

### 3B. Press Conference Repetition

- Read `src/data/pressConferences.ts` and count unique question/context combos
- Calculate: how many press conferences per season × how many unique ones exist?
- **Flag if content repeats within a single season**

### 3C. Weekly Objective Variety

- Read `src/utils/weeklyObjectives.ts` and count objective templates
- Verify objectives are contextually selected (not purely random)
- **Flag if fewer than 12 unique templates exist**

### 3D. Challenge Replayability

- Read `src/data/challenges.ts` and count scenarios
- **Flag if fewer than 6 unique challenges exist**

### 3E. Fixture Determinism

- Read `src/data/league.ts` fixture generation logic
- **Critical check**: Are fixtures randomized each season or deterministic?
- If deterministic (same schedule every season), **flag as high-priority** — players face the exact same fixture list every year
- Recommend shuffled fixture generation if not already present

### 3F. Achievement Completability

- Read `src/utils/achievements.ts` and **count achievements by scanning for `id:` entries** (do NOT hardcode an assumed count)
- Verify every achievement is actually achievable — no impossible conditions
- Verify achievements persist across seasons (not reset)
- Calculate: how many seasons to reasonably unlock all achievements?

### 3G. Manager Perk Progression Timeline

- Read `src/utils/managerPerks.ts` and **count perks by scanning for `id:` entries** (do NOT hardcode an assumed count)
- Calculate XP required for all perks
- Estimate seasons to max out the perk tree based on average XP per season
- **Flag if perk tree is exhausted before season 8**

### 3H. Career Mode Progression

- Read `src/store/slices/careerSlice.ts` — career mode job market and reputation system
- Verify job vacancy generation remains fresh across 10+ seasons (not exhausted)
- Verify the interview/offer system has enough variety to feel different each time
- **Flag if the same job offer can repeat within 3 seasons**

---

## Phase 3 Checkpoint

> State: "Phase 3 complete. Content audit findings: [summary]. Critical flags: [list or 'none']. Proceeding to Phase 4."

---

## Phase 4: State Corruption & Save Integrity

### 4A. Save Size Projection

- After simulating 10 seasons, measure: `JSON.stringify(state).length`
- Project growth rate per season
- **Flag if projected save exceeds 4MB by season 20** (localStorage limit is ~5-10MB)
- Identify the largest state fields

### 4B. Save/Load Round-Trip

- After each simulated season, serialize state → deserialize → compare
- Verify no data loss (especially nested objects, arrays)
- Verify save migration from older versions to current works without data loss
- The current save version is available via `import { CURRENT_VERSION } from '@/utils/saveMigration'` — do NOT hardcode a version number

### 4C. State Invariant Validation

Use `validateGameState(state)` from `src/test/stateValidator.ts` throughout all tests. If you find it's missing any critical invariants, extend it (don't duplicate its checks elsewhere).

---

## Phase 5: Performance & Memory

### 5A. advanceWeek() Performance

- Time 100 consecutive `advanceWeek()` calls
- **Flag if average exceeds 200ms per call**
- Identify the slowest subsystem

### 5B. State Size Growth

- Measure `Object.keys(state.players).length` after each season
- Verify retired players are cleaned up, not accumulating
- Check `state.messages` — does it grow unbounded?
- Check `state.seasonHistory`, `state.financeHistory` — same concern
- **Recommend max-length caps** for any unbounded collections

---

## Phase 6: Fix Everything

Fix issues in this priority order:

### Priority 1 — Game-Breaking (fix immediately)
- State corruption that crashes the game
- Infinite loops or hangs in `advanceWeek()`/`endSeason()`
- Save corruption or data loss
- Squad depletion below playable threshold (< 11 players)
- Division count invariant violations (clubs lost or duplicated)

### Priority 2 — Gameplay-Breaking (fix before shipping)
- Financial exploits
- Transfer/loan logic errors
- Promotion/relegation bugs (wrong clubs promoted)
- Playoff bracket errors
- Player stats going negative or NaN

### Priority 3 — Content & Longevity
- Fixture determinism (same schedule every season)
- Storyline content exhaustion
- Achievement impossibilities
- Unbounded state growth (save bloat)

### Priority 4 — Performance
- Slow `advanceWeek()` calls
- Memory growth patterns

---

## Deliverables

1. **Test file(s)** added/extended in `src/test/` covering all Phase 1-2 scenarios
2. **Bug list** with severity, file location, and fix description for each issue found
3. **Content audit report** summarizing Phase 3 findings
4. **All fixes applied** with clean commits following project conventions

Run `npm run preflight` to verify everything passes before marking done.
