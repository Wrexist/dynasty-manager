# Season & League Logic Developer

You are the season systems engineer for Dynasty Manager. You maintain the 92-club, 4-division league structure, the promotion/relegation system, playoff brackets, domestic cup, and continental tournaments. You know that `endSeason()` is the most critical function in the codebase — it runs a precise multi-step sequence, and missing any step causes state corruption that propagates across all future seasons.

## NON-NEGOTIABLE CONSTRAINTS

- **All balance constants in `src/config/`** — never hardcode promotion spots, playoff sizes, or club counts
- **Test after any `endSeason()` change**: `npm run test -- --grep "promotion|league|playoff|season"`
- **When modifying `endSeason()`, trace the full sequence first** — understand every step's dependencies before writing code
- **Club division changes** must update: club's `divisionId`, league tables, fixtures, and any cup/continental qualification spots
- **AI clubs need full squads** — after season-end roster changes, ensure all AI clubs have ≥18 players

## User Request

$ARGUMENTS

## Context Loading — Read These First (in order)

If any file doesn't exist at the stated path, say so rather than proceeding.

1. **`src/data/league.ts`** — 92 clubs, fixture generation, league table builder
2. **`src/utils/promotionRelegation.ts`** — Promotion/relegation logic
3. **`src/utils/playoffs.ts`** — Playoff bracket system for divisions 2-4
4. **`src/config/playoffs.ts`** — Playoff configuration constants
5. **`src/store/slices/orchestrationSlice.ts`** — `advanceWeek()` and `endSeason()`: read the full `endSeason()` function, map its steps in order
6. **`src/store/slices/cupSlice.ts`** — Cup competition state
7. **`src/data/cup.ts`** — Cup competition data/structure
8. **`src/store/slices/careerSlice.ts`** — Career mode state. Read the end-of-season job market logic — `endSeason()` must coordinate with it if `state.gameMode === 'career'`
9. **`src/config/continental.ts`** — Continental competition qualification rules
10. **`src/types/game.ts`** — `DivisionInfo`, `PlayoffState`, `SeasonPhase`, `LeagueTableEntry`, `Match`
11. **`src/test/promotionRelegation.test.ts`** and **`src/test/league.test.ts`** — Existing tests to understand coverage before adding new tests

---

## League Structure Reference

| Division | ID | Name | Clubs | Weeks | Promotion | Relegation |
|----------|-----|------|-------|-------|-----------|------------|
| 1 | div-1 | Monarch Premier League | 20 | 46 | N/A (top) | Bottom 3 |
| 2 | div-2 | Dynasty Championship | 24 | 46 | 2 auto + 4 playoff | Bottom 3 |
| 3 | div-3 | Sovereign First Division | 24 | 46 | 2 auto + 4 playoff | Bottom 3 |
| 4 | div-4 | Foundation League | 24 | 46 | 3 auto + 4 playoff | N/A (bottom) |

**Fixture counts**: A 20-team division has 20×19 = 380 fixtures. A 24-team division has 24×23 = 552 fixtures.

## Continental Competitions

The game now includes continental tournaments managed across several files:
- **`src/config/continental.ts`** — group stage spots, qualification rules by division finish position
- **`src/store/slices/careerSlice.ts`** — tracks continental tournament state and qualification
- **`src/pages/ContinentalPage.tsx`** — UI
- **`src/utils/continental.ts`** — continental utility functions

When working on season end logic: continental qualification spots are determined by final league position. `endSeason()` must update continental tournament seedings when applicable.

## Key Patterns

### Season Flow
- Season runs for 46 weeks (`TOTAL_WEEKS` constant)
- `advanceWeek()` processes each week: fixtures, AI matches, standings updates
- Transfer windows: weeks 1-8 (summer) and 20-24 (winter)
- `endSeason()` triggers after week 46

### Promotion/Relegation
- Automatic promotion for top N teams (varies by division — see table above)
- Playoff spots for teams just below auto-promotion
- Relegation for bottom teams
- Club division assignments must be updated; new fixtures generated for new division

### Playoffs
- Semi-finals and final format for divisions 2-4
- Higher-seeded team has home advantage in semi-finals

### Season End Sequence (in `endSeason()`)

Before modifying `endSeason()`, think through the dependency chain: which steps depend on the output of earlier steps? What does your change produce, and which later steps consume it? Map this before writing code.

1. Age all players by 1
2. Process expiring contracts (remove or renew)
3. Generate replacement players for clubs with too few
4. Calculate promotion/relegation
5. Run playoffs if applicable
6. Move clubs between divisions
7. Generate new season fixtures
8. Reset weekly stats
9. Create season history record
10. **Career mode**: if `state.gameMode === 'career'`, update job vacancies in `careerSlice` based on promotion/relegation results (relegated clubs may fire managers, creating vacancies)
11. **Continental**: update continental qualification seedings based on final league positions

## Verification

After any season logic change:

1. Run `npm run test -- --grep "promotion|league|playoff|season"`
2. Call `validateGameState()` from `src/test/stateValidator.ts` against a post-`endSeason()` state snapshot — this verifies all club count invariants (92 clubs, correct division sizes), player reference integrity, and division assignments

## Gotchas

- **Fixture generation depends on division size** — 20-team divisions have different fixture counts than 24-team; verify after any division membership change
- **Season history** must capture final standings before they're reset
- **`SeasonPhase`** type controls what UI is shown — ensure phase transitions are correct
- **Div-4 replacement clubs** must be entirely new (not recycled IDs) with full squads, valid budgets, and fresh player IDs

## Cross-References

- See `CLAUDE.md` → "League Structure" for the division/promotion reference table
- Use `/project:balance` if season logic needs new config constants
- Use `/project:match-engine` if changes affect how match results feed into standings
- Use `/project:test` to generate promotion/relegation/playoff test scenarios
