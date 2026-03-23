# Game Longevity & Stress Testing Prompt

> Copy-paste this entire prompt into a Claude Code session to perform deep game-breaking bug hunting and long-term playability testing.

---

You are performing an exhaustive longevity and stress test of Dynasty Manager. Your goal is to ensure the game can be played for **20+ seasons** (1,000+ in-game weeks) without encountering game-breaking bugs, content drought, or state corruption. Every system must hold up under extended play.

Read `CLAUDE.md` first, then proceed phase by phase.

---

## Phase 1: Write Multi-Season Simulation Tests

Create integration tests in `src/test/` that simulate many consecutive seasons of gameplay. These tests are the backbone of longevity validation.

### 1A. Season Lifecycle Stress Test

Write a test that programmatically runs through **10+ full seasons** by calling `initGame()` then repeatedly calling `advanceWeek()` 46 times + `endSeason()` in a loop. After each season, assert:

- `state.season` incremented correctly
- `state.week` reset to 1
- Every club in every division has a valid squad (`club.playerIds.length >= 18`)
- Every player ID in `club.playerIds` resolves to a real `Player` object in `state.players`
- Every player in `club.lineup` and `club.subs` exists in `club.playerIds`
- No duplicate player IDs across different clubs
- `state.divisionClubs` for each division has the correct number of clubs (20 for div-1, 24 for div-2/3/4)
- Total club count across all divisions is exactly 92
- `state.fixtures` and `state.divisionFixtures` are regenerated and non-empty
- `state.leagueTable` and `state.divisionTables` have correct row counts
- No `NaN`, `undefined`, or `null` values in any player's `overall`, `potential`, `age`, `wage`, or `value`

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
- **Player count bounds**: Total player count across all clubs stays within reasonable range (2,000–4,000). Flag if it grows unbounded (memory leak) or shrinks too low (content drought)
- **Stat integrity**: No player has negative goals, assists, or appearances. No `NaN` in any stat field

### 1D. Financial Sustainability Test

Simulate 15 seasons and after each:

- No club has `budget` of `NaN`, `Infinity`, or `undefined`
- Player club budgets don't spiral to extreme values (e.g., >500M or <-100M without board action)
- `wageBill` is recalculated correctly after transfers and contract changes
- `financeHistory` array grows by exactly 1 entry per season (or per week if tracked weekly). Flag unbounded growth
- FFP warnings trigger when wage-to-revenue ratio exceeds thresholds
- Transfer income/expenses balance correctly (buyer loses money, seller gains it)

### 1E. Cup Competition Integrity Test

For each simulated season:

- Cup draw generates correct bracket (92 clubs enter, byes assigned properly)
- Each round halves the remaining teams
- Cup winner is determined by season end (week 42)
- Cup state resets cleanly for next season
- No club appears twice in the same round
- Eliminated clubs don't appear in later rounds
- If player's club is eliminated, `cup.eliminated === true` persists correctly

---

## Phase 2: Edge Case & Boundary Testing

Write targeted tests for known dangerous scenarios.

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
- Injured/suspended players don't appear in match events
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
- Loaned player's club gets relegated: verify loan continues correctly
- Multiple simultaneous outgoing loans: all tracked independently

### 2E. Playoff Bracket Corruption

- Simulate a season where the player's club finishes in playoff position
- Verify bracket has exactly 4 clubs from correct positions (3rd-6th)
- Simulate semi-finals (two-legged): verify aggregate scores calculated correctly
- Verify away goals rule applied correctly
- Verify final is single-legged
- Verify playoff winner is promoted and appears in higher division next season

### 2F. Division Boundary Integrity

- Club promoted from div-4 to div-3: verify removed from div-4, added to div-3
- Club relegated from div-1 to div-2: verify fixtures regenerated for both divisions
- New replacement clubs in div-4: verify they have full squads, valid budgets, and fresh player IDs

---

## Phase 3: Content Longevity Audit

Analyze how much unique content exists and whether it dries up.

### 3A. Storyline Chain Exhaustion

- Read `src/data/storylineChains.ts` and count total unique chains
- Determine: After how many seasons will the player have seen every chain?
- Check if chains can repeat. If yes, is there any variation on repeat?
- **Flag if fewer than 8 unique chains exist** — recommend adding more

### 3B. Press Conference Repetition

- Read `src/data/pressConferences.ts` and count unique question/context combos
- Calculate: How many press conferences per season × how many unique ones exist?
- **Flag if content repeats within a single season**

### 3C. Weekly Objective Variety

- Read `src/utils/weeklyObjectives.ts` and count objective templates
- Verify objectives are contextually selected (not purely random)
- Check if the same objective can appear two weeks in a row
- **Flag if fewer than 12 unique templates exist**

### 3D. Challenge Replayability

- Read `src/data/challenges.ts` and count scenarios
- Can challenges be replayed? Are there difficulty variants?
- **Flag if fewer than 6 unique challenges exist**

### 3E. Fixture Determinism

- Read `src/data/league.ts` fixture generation logic
- **Critical check**: Are fixtures randomized each season or deterministic?
- If deterministic (same pattern every season), **flag as high-priority content issue** — players face the exact same schedule every year
- Recommend implementing shuffled fixture generation if not already present

### 3F. Achievement Completability

- Read `src/utils/achievements.ts` and verify every achievement is actually achievable
- Check for impossible conditions (e.g., achievement requires a feature that doesn't exist)
- Verify achievements persist across seasons (not reset)
- Calculate: How many seasons to reasonably unlock all 26 achievements?

### 3G. Manager Perk Progression Timeline

- Read `src/utils/managerPerks.ts` and calculate XP required for all perks
- Based on average XP gain per season (wins × 15 + draws × 5 + season end 30 + potential cup/title), estimate how many seasons to max out the perk tree
- **Flag if perk tree is exhausted before season 8** — recommend adding prestige tiers or new perks
- Verify prestige system extends progression beyond initial perk tree

---

## Phase 4: State Corruption & Save Integrity

### 4A. Save Size Projection

- After simulating 10 seasons, measure the serialized state size (`JSON.stringify(state).length`)
- Project growth rate per season
- **Flag if projected save exceeds 4MB by season 20** (localStorage limit is ~5-10MB)
- Identify the largest state fields and recommend pruning strategies if needed

### 4B. Save/Load Round-Trip

- After each simulated season, serialize state → deserialize → compare
- Verify no data loss through serialization (especially `Map`, `Set`, `Date` objects if any)
- Verify save migration from older versions to current (v16) works without data loss

### 4C. State Invariant Checks

Write a reusable `validateGameState(state)` function that checks ALL of these invariants and can be called at any point:

- Every `club.playerIds` entry exists in `state.players`
- Every `player.clubId` matches the club that contains them
- No player exists in multiple clubs
- `club.lineup` is a subset of `club.playerIds` with exactly 11 entries (or fewer if squad depleted)
- `club.subs` is a subset of `club.playerIds`, no overlap with `lineup`
- `state.season >= 1` and `state.week >= 1 && state.week <= 46`
- `state.divisionClubs` sizes: div-1=20, div-2=24, div-3=24, div-4=24
- Sum of all division clubs = 92
- Every player has: `age > 0`, `overall > 0 && overall <= 99`, `potential >= overall`
- No `NaN` in any numeric field across all players and clubs
- `leagueTable` row count matches division club count
- `fixtures` count matches expected for division size (n*(n-1) matches for n clubs)

---

## Phase 5: Performance & Memory

### 5A. advanceWeek() Performance

- Time 100 consecutive `advanceWeek()` calls
- **Flag if average exceeds 200ms per call** — will cause UI jank
- Identify the slowest subsystem (match sim, player dev, finance, AI transfers)

### 5B. State Size Growth

- Measure `Object.keys(state.players).length` after each season
- Verify old/retired players are cleaned up, not accumulating indefinitely
- Check `state.messages` array length — does it grow unbounded?
- Check `state.seasonHistory` — does it accumulate without limit?
- Check `state.financeHistory` — same concern

### 5C. Memory Leak Patterns

- Look for arrays or objects that grow every week/season but are never pruned:
  - `state.messages` (inbox)
  - `state.careerTimeline`
  - `state.clubRecords`
  - `state.seasonHistory`
  - Player stat history if tracked per-season
- **Recommend max-length caps** for any unbounded collections

---

## Phase 6: Fix Everything

After completing Phases 1-5, you will have a comprehensive list of issues. Fix them in this priority order:

### Priority 1 — Game-Breaking (fix immediately)
- State corruption that crashes the game
- Infinite loops or hangs in `advanceWeek()`/`endSeason()`
- Save corruption or data loss
- Squad depletion below playable threshold (< 11 players)
- Division count invariant violations (clubs lost or duplicated)

### Priority 2 — Gameplay-Breaking (fix before shipping)
- Financial exploits (infinite money, bankrupt without consequence)
- Transfer/loan logic errors
- Promotion/relegation bugs (wrong clubs promoted)
- Playoff bracket errors
- Contract system failures
- Player stats going negative or NaN

### Priority 3 — Content & Longevity (fix for retention)
- Fixture determinism (same schedule every season)
- Storyline content exhaustion
- Press conference repetition
- Achievement impossibilities
- Perk tree progression pacing
- Unbounded state growth (save bloat)

### Priority 4 — Performance (fix for polish)
- Slow `advanceWeek()` calls
- Memory growth patterns
- Large save file optimization

---

## Deliverables

When complete, provide:

1. **Test file(s)** added to `src/test/` covering all Phase 1-2 scenarios
2. **Bug list** with severity, file location, and fix description for each issue found
3. **Content audit report** summarizing findings from Phase 3
4. **State validator utility** (`validateGameState()`) that can be reused in future testing
5. **All fixes applied** with clean commits following project conventions

Run `npm run preflight` to verify everything passes before marking done.
