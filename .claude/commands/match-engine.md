# Match Engine Developer

You are the match simulation specialist for Dynasty Manager. Your goal is to modify, enhance, or debug the event-based, minute-by-minute match engine — ensuring changes maintain statistical realism, gameplay excitement, and correct state propagation.

## User Request

$ARGUMENTS

## Critical Context Files — Read These First

1. **`src/engine/match.ts`** (~653 LOC) — The engine itself. Understand:
   - `simulateMatch()` — Main entry point, returns a `Match` with events
   - Minute-by-minute event generation
   - Attack/defense strength calculations
   - Late drama mechanics (after minute 85)
   - The `HalfState` type for half-time tracking

2. **`src/config/matchEngine.ts`** — All engine tuning constants:
   - Attack/defense multipliers
   - Event probability weights
   - Goal chance calculations
   - Formation and tactical modifiers

3. **`src/config/gameBalance.ts`** — Related balance constants (fitness, injuries, first-match boosts)

4. **`src/config/tactics.ts`** — How tactical instructions modify match calculations

5. **`src/store/helpers/matchProcessing.ts`** — Post-match state updates:
   - Player stats (goals, assists, appearances, ratings)
   - Fixture result recording
   - League table updates

6. **`src/store/slices/matchSlice.ts`** — Match-related store state

7. **`src/store/slices/orchestrationSlice.ts`** — How matches integrate into the game loop:
   - `playCurrentMatch()` — triggers the match
   - `advanceWeek()` — resets `matchSubsUsed` to 0
   - Match results must update BOTH fixtures AND individual player stats

8. **`src/test/match.test.ts`** — Existing match tests

## Key Gotchas

- **Match results must update TWO things:** the `fixtures` array AND individual player stats (goals, assists, appearances, ratings). Missing either causes data inconsistency.
- **`advanceWeek()` resets `matchSubsUsed`** to 0. Player match handling is in `playCurrentMatch()`, not `advanceWeek()`.
- **Late drama** (after minute 85) has special probability modifiers — don't accidentally nerf this.
- **Formation bonuses** come from `src/config/tactics.ts` and are applied in the engine.
- **Player fitness** affects match performance and is reduced after matches.
- **Injuries** can occur during matches — check `gameBalance.ts` for injury rates.

## Rules

- **All engine constants** go in `src/config/matchEngine.ts` or `src/config/gameBalance.ts` — never hardcode in the engine
- **Run match tests** after any change: `npm run test -- --grep match`
- **Test edge cases:** 0-0 draws, high-scoring games, red cards, injury-time goals
- **Don't break the event system** — UI components render match events sequentially; the event array must be chronologically ordered
- **Performance matters** — the engine runs for all AI matches too (up to ~20 per week). Avoid expensive operations in the hot loop.

## When Adding New Event Types

1. Add the event type to `src/types/game.ts` (MatchEvent type)
2. Add generation logic in `src/engine/match.ts`
3. Add rendering in the MatchDay page component
4. Add stat tracking in `src/store/helpers/matchProcessing.ts`
5. Add test coverage in `src/test/match.test.ts`

## Cross-References

- See `CLAUDE.md` → "Key Patterns" → "Match sim" for high-level match flow
- Use `/project:balance` if engine changes require new config constants
- Use `/project:test` to generate comprehensive match test scenarios
