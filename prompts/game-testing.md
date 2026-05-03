# Longevity & Stress Testing Prompt

> Copy-paste this entire prompt into a Claude Code session to perform deep game-breaking bug hunting and long-term playability testing on Dynasty Manager.

---

You are running an exhaustive longevity & stress test of Dynasty Manager — a TypeScript/Zustand mobile football management sim with 92 clubs across 4 divisions, 15 Zustand slices, save schema **v67**, a 1,816-LOC match engine, and a 6-file orchestration submodule (~7,977 LOC) covering week advance, season end, match actions, init, tournaments, and helpers. The test goal: **20+ in-game seasons (1,000+ weeks)** without state corruption, content drought, save-size blowup, or perf regression.

The test infrastructure is mature — 93 test files including `longevity.test.ts`, `longevityStress.test.ts`, `stateValidator.ts` (the canonical invariant checker), `seasonAdversarial.test.ts`, `seasonEdgeCases.test.ts`, `seasonRolloverState.test.ts`, `releaseReadiness.test.ts`, `perf.test.ts`. **Extend, don't recreate.**

## NON-NEGOTIABLE CONSTRAINTS

- **TS non-strict** is intentional — never flag missing type annotations as bugs. Only test runtime behaviour.
- **Use `validateGameState(state)`** from `src/test/stateValidator.ts` as your invariant checker — never re-implement its checks
- **Save-version awareness** — import `CURRENT_VERSION` from `@/utils/saveMigration`; never hardcode a version number
- **Existing tests are canonical** — read them before writing one. Duplicate scenarios are a code-review blocker.
- **Long tests are gated behind `VITEST_AUDIT=1`** — match that pattern for new diagnostic-heavy tests
- **Run `npm run preflight`** before marking any phase complete; never `--no-verify`

---

## Phase 0: Inventory the Existing Test Stack

Before writing any test, list and read:

### Canonical infrastructure (read fully)
1. **`src/test/stateValidator.ts`** — `validateGameState(state)` and helpers; understand every invariant it already checks
2. **`src/test/setup.ts`** — global vitest setup; respect any timer/mock conventions

### Multi-season / longevity (read fully)
3. **`src/test/longevity.test.ts`** — multi-season runs, the `advanceFullSeason` helper, audit-mode logging
4. **`src/test/longevityStress.test.ts`** — extreme scenarios; what's covered?
5. **`src/test/seasonProgression.test.ts`**, **`seasonLifecycle.test.ts`**, **`seasonLifecycleHelpers.test.ts`**, **`seasonRolloverState.test.ts`**, **`seasonIntegration.test.ts`** — different cuts of the season transition
6. **`src/test/seasonEdgeCases.test.ts`**, **`seasonAdversarial.test.ts`** — boundary and adversarial inputs
7. **`src/test/seasonPromotionCascade.test.ts`**, **`promotionRelegation.test.ts`** — division integrity over time

### Specific systems
8. **`src/test/saveMigration.test.ts`** + **`seasonSaveMigration.test.ts`** + **`saveStorageFallback.test.ts`** + **`saveProtection.test.ts`** — save layer
9. **`src/test/orchestrationSlice.test.ts`** — orchestration unit-level
10. **`src/test/match.test.ts`** + **`matchBalance.test.ts`** + **`matchInteractivity.test.ts`** — match engine
11. **`src/test/cup.test.ts`** + **`continental.test.ts`** + **`seasonContinentalResult.test.ts`** + **`seasonCupProgression.test.ts`** — cup competitions
12. **`src/test/transferOffers.test.ts`** + **`transferSlice.test.ts`** + **`transferMarketGen.test.ts`** + **`freeAgentBalance.test.ts`** — transfers
13. **`src/test/finance.test.ts`** + **`sponsorship.test.ts`** + **`merchandise.test.ts`** — economy
14. **`src/test/managerCareer.test.ts`** + **`managerPerks.test.ts`** + **`seasonManagerPerks.test.ts`** — career & progression
15. **`src/test/nationalTeamFlow.test.ts`** + **`nationalTeamPool.test.ts`** + **`seasonBallonDor.test.ts`** + **`threeSeasonBallonDor.test.ts`** — international
16. **`src/test/packs.test.ts`** + **`packsSlice.test.ts`** + **`playerRarity.test.ts`** + **`communityPack.test.ts`** — collectibles
17. **`src/test/contentAudit.test.ts`** — existing content-drought detector — extend rather than duplicate
18. **`src/test/perf.test.ts`** — perf budget tests
19. **`src/test/balanceReport.test.ts`** + **`releaseReadiness.test.ts`** — release gates
20. **`src/test/edgeCases.test.ts`**, **`renderHygiene.test.ts`**

After loading, output:
```xml
<existing-coverage>
  <multi-season>What longevity tests cover, max season count, what they assert.</multi-season>
  <save-layer>Migration round-trip status, fallback handling, slot integrity.</save-layer>
  <match>Coverage of match outcomes, balance, interactivity.</match>
  <transfers-loans>Coverage; gaps if any.</transfers-loans>
  <career-mode>Job market, vacancies, interview, reputation coverage.</career-mode>
  <continental-national>Tournament integrity, qualification, knockout.</continental-national>
  <packs>Pull rates, dupes, walkout reveals, quick-sell.</packs>
  <perf>What budgets are enforced.</perf>
  <gaps>The 5 biggest gaps in priority order.</gaps>
</existing-coverage>
```

---

## Phase 1: Multi-Season Simulation Stress

> Before writing, **state which file you'll extend** vs. which you'll create. Default to extending; only create if the scenario doesn't fit any existing file.

### 1A. Season Lifecycle Stress (15+ seasons)
Extend `longevity.test.ts` if not covered. Use `validateGameState(state)` after each season plus assert:
- `state.season` increments correctly; `state.week` resets to 1
- Every club has a valid squad (`playerIds.length >= 18`)
- Every ID in `club.playerIds` resolves to a real `Player` in `state.players`
- Every ID in `club.lineup` and `club.subs` exists in `club.playerIds`
- No duplicate player IDs across clubs
- Division sizes: 20 / 24 / 24 / 24 = 92 (always)
- `state.fixtures` and `state.divisionFixtures` regenerated and non-empty
- No `NaN`, `undefined`, or `null` in any player's `overall`, `potential`, `age`, `wage`, or `value`

### 1B. Promotion / Relegation Integrity (15+ seasons)
- Auto-promoted clubs appear in higher division next season
- Auto-relegated clubs appear in lower division
- Playoff winners promoted correctly
- Div-4 replacement clubs: brand new IDs, not recycled, with full squads + reasonable budgets
- No club in two divisions
- No club orphaned (missing from all divisions)
- 92-club invariant never breaks across all 15 seasons

### 1C. Player Lifecycle (20 seasons)
- Youth intake: 2–4 prospects per club per season minimum
- Aging: every player ages by exactly 1 per season; no age 0, negative, or >45
- Retirement: players 36+ with low overall eventually leave
- Contract expiry: `contractEnd <= season` → free agent or re-signed; no ghost contracts
- Squad replenishment: every club ≥18 after retirements + sales
- Total player count stays in 2,000–4,000 band; flag unbounded growth or depletion
- Stat integrity: no negative goals/assists/appearances; no NaN

### 1D. Financial Sustainability (15 seasons)
- No `budget` is `NaN`, `Infinity`, or `undefined`
- Budgets stay in plausible range (>500M is suspicious without explicit board windfall, <-100M needs board action)
- `wageBill` recomputed correctly after every transfer / contract change / loan
- `financeHistory` grows by ≤1 entry per season (flag unbounded growth or duplicates)
- Buyer−seller transfer ledger balances exactly

### 1E. Cup + Continental + National Integrity
- **Domestic Cup**: 92 enter, byes correct, each round halves remaining, exactly one winner per season, state resets clean. (`src/data/cup.ts`, `src/store/slices/cupSlice.ts`, `seasonCupProgression.test.ts`)
- **League Cup**: similar invariants for `LeagueCupState` (`LeagueCupPage.tsx`)
- **Continental** (Champions / Europa equivalents): qualification by final league position correct; group-stage match counts correct; knockout eliminates correctly; coefficient updates valid across seasons. (`src/config/continental.ts`, `src/data/continentalDraw.ts`, `src/utils/continentalCoefficients.ts`)
- **Super Cup**: triggered when expected; participants correct (`SuperCupPage.tsx`)
- **International Tournament**: triggered on its cycle; squad picker + group + knockout integrity (`src/pages/InternationalTournament.tsx`, `src/store/slices/nationalTeamSlice.ts`, `nationalTeamFlow.test.ts`)

### 1F. Career Mode Job Market (15 seasons)
- Job vacancies generate freshly each season
- Interview / offer system has variety (not the same offer twice within 3 seasons)
- Manager reputation climbs/falls coherently with results
- A fired manager can land on their feet (rebound flow exists)
- Multi-club career history persists across job changes

### 1G. Pack Economy Drift
- Pull rates remain within configured bands across thousands of opens
- Quick-sell payouts respect rarity floors
- Walkout-reveal triggers fire on the right rarities
- `OpenedPackRecord` history doesn't grow unbounded
- No save-bloat from accumulating pack history

> **Phase 1 checkpoint**: state `"Phase 1 complete. Tests written: [list]. Tests already covered: [list]. All pass: [yes/no]. Proceeding to Phase 2."`

---

## Phase 2: Edge Cases & Boundaries

### 2A. Mass Contract Expiry
8+ players with `contractEnd === season` on the player's club. Run `endSeason()` and verify:
- All expired players become FAs or are re-signed
- Lineup + subs still valid
- `wageBill` recomputed
- No orphaned IDs in `playerIds`/`lineup`/`subs`

### 2B. Injuries + Suspensions Pile-Up
5+ injured + 2+ suspended. Advance week and verify:
- Match plays with enough fit players for starting 11
- Graceful fallback if not (no crash)
- Recovery timers decrement correctly each week

### 2C. Transfer Window Boundaries
- Week 8 (last summer): success
- Week 9 (closed): rejected
- Week 20 (winter open): success
- Week 24 (last winter): success
- Week 25 (closed): rejected

### 2D. Loan Edge Cases
- Obligatory-buy loan: purchase triggers at loan end
- Recall before 4 weeks: fail
- Recall after 4 weeks: success
- Multiple simultaneous outgoing: tracked independently
- Wage-share split applied correctly during loan

### 2E. Playoff Bracket
- Player's club finishes in playoff zone
- Bracket has exactly 4 clubs from positions 3–6 (lower divisions)
- Semis + final produce one winner
- Winner appears in higher division next season

### 2F. Division Boundary Integrity
- Promoted club removed from old division, added to new
- Fixtures regenerated for both affected divisions
- Replacement clubs in div-4 have full squads + valid budgets + fresh player IDs

### 2G. Save-Slot Cross-Talk
- Two saves in different slots don't bleed state into each other
- Switching slots reads correct save
- Deleting one slot doesn't affect another

### 2H. Save Migration Stress
- For every prior save version (e.g., v50 → v67), a fixture roundtrips through the migration ladder
- A save with a missing optional field migrates without throwing
- A save with an unknown future version triggers the recovery banner cleanly

### 2I. Pack-Open Race
- Open pack while autosave is running — no state corruption
- Open pack while a transfer offer arrives — no UI deadlock
- Quick-sell during walkout reveal — graceful

> **Phase 2 checkpoint**: `"Phase 2 complete. Edge case tests: [list]. All pass: [yes/no]. Proceeding to Phase 3."`

---

## Phase 3: Content Longevity Audit

Already partly covered by `src/test/contentAudit.test.ts` — extend it.

### 3A. Storyline Chains
- Read `src/data/storylineChains.ts` — count unique chains
- After how many seasons does the player exhaust the catalogue?
- Do chains repeat with variation, or identical replay?
- **Flag if <8 unique chains**

### 3B. Press Conference Variety
- Read `src/data/pressConferences.ts` — count unique question/context combos
- How many press confs per season × unique catalogue size?
- **Flag if content repeats within a single season**

### 3C. Weekly Objective Variety
- Read `src/utils/weeklyObjectives.ts` — count templates (currently 21)
- Verify contextual selection (not pure random)
- **Flag if <12 unique templates**

### 3D. Challenge Replayability
- `src/data/challenges.ts` — count scenarios (currently 10)
- **Flag if <6 unique challenges**

### 3E. Fixture Determinism
- Read `src/data/league.ts` fixture generation
- **Critical**: are fixtures shuffled per season, or identical every year?
- If identical, **P0 flag** — players face the same schedule every season

### 3F. Achievement Completability
- Read `src/utils/achievements.ts` — count by `id:` (currently 39)
- Every achievement actually achievable — no impossible conditions
- Achievements persist across seasons (not reset)
- Estimate seasons to unlock all

### 3G. Manager Perk Progression
- Read `src/utils/managerPerks.ts` — count by `id:` (currently 34)
- Compute total XP required
- Estimate seasons to max based on average XP per season
- **Flag if perk tree exhausts before season 8**

### 3H. Career Mode Job Market Freshness
- Same job offer not repeating within 3 seasons
- Vacancy generation rate sustains across 15 seasons
- Reputation tiers reachable and meaningful

### 3I. Pack & Player Variety
- `src/utils/packGeneration.ts` + `src/data/playerTemplates.ts` + `src/data/communityPack/`
- Are packs producing duplicates at expected rates?
- Is the player pool large enough to sustain rare-card chasing for 20+ seasons?

> **Phase 3 checkpoint**: `"Phase 3 complete. Content findings: [summary]. Critical flags: [list or 'none']. Proceeding to Phase 4."`

---

## Phase 4: State Integrity & Save Safety

### 4A. Save-Size Projection
- After 10 simulated seasons: `JSON.stringify(state).length`
- Project growth rate per season
- **Flag if projected save >4MB by season 20** (localStorage cap is ~5–10MB; IDB fallback exists at `src/store/helpers/idbStorage.ts`)
- Identify the largest fields (likely: `seasonHistory`, `messages`, `players`, `financeHistory`, `openedPacks`)

### 4B. Save / Load Round-Trip
- After each simulated season: serialize → deserialize → compare
- No data loss in nested objects, arrays, Maps
- Round-trip across migrations: take a v55 fixture, migrate to v67, save, reload, validate

### 4C. Recovery Paths
- Corrupted save → recovery banner shown
- Future-version save → graceful degradation, no data nuke
- Quota-exceeded → IDB fallback engages

### 4D. Multi-Slot Isolation
- Concurrent autosave + manual save → no merge corruption
- Slot-switch during pack open → state coherent
- All this should already exist; document gaps

---

## Phase 5: Performance & Memory

### 5A. `advanceWeek()` Latency
- Time 100 consecutive `advanceWeek()` calls
- **Budget: average <200ms / call** (extend `perf.test.ts` if not enforced)
- Identify slowest subsystem (transfers, AI sims, training, finance, continental)

### 5B. `endSeason()` Latency
- Time 10 consecutive `endSeason()` calls
- **Budget: <2000ms / call** (this is heavier; promotions, contracts, awards, history all run)
- Profile the bottleneck

### 5C. State Size Growth
- `Object.keys(state.players).length` after each season
- Verify retired players actually exit the table
- `state.messages` — bound it (proposed cap: most recent 200)
- `state.seasonHistory` — bound it
- `state.financeHistory` — bound it
- `state.openedPacks` — bound it

### 5D. Render Hot-Paths (already audited in `renderHygiene.test.ts`)
- Confirm Dashboard, MatchDay, TransferPage, PacksPage have memoised expensive selectors
- Flag any new O(n²) loops in render

---

## Phase 6: Triage & Fix

### Priority 1 — Game-Breaking
- State corruption that crashes the game
- Infinite loops or hangs in `weekAdvance`/`seasonEnd`/`matchActions`
- Save corruption or data loss
- Squad depletion below playable threshold (<11)
- Division-count invariant violation
- Save migration that loses fields

### Priority 2 — Gameplay-Breaking
- Financial exploits
- Transfer / loan logic errors
- Promotion / relegation bugs (wrong club)
- Playoff bracket errors
- Continental / national / cup desync
- Player stats negative or NaN
- Pack pull-rate drift outside config bands

### Priority 3 — Content & Longevity
- Fixture determinism
- Content drought
- Achievement impossibilities
- Unbounded state growth (save bloat)

### Priority 4 — Performance
- Slow `advanceWeek`/`endSeason`
- Memory growth patterns
- Render-path regressions

For every fix:
1. Read the file
2. Make the surgical change
3. Add or extend the test
4. State the issue ID, fix, and test it now passes

Run `npm run preflight` before marking done.

---

## Deliverables

1. **Inventory** — what's already covered, top-5 gaps
2. **New test files / extensions** — listed by path
3. **Bug list** — severity, location, repro, fix
4. **Content audit report** — Phase 3 findings
5. **Perf budget enforcement** — added to `perf.test.ts` if missing
6. **All fixes applied** — preflight green
