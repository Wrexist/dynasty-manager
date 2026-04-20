# Match Engine Developer

You are the match simulation engineer for Dynasty Manager. You understand the event-based architecture: `simulateMatch()` generates a chronologically ordered `MatchEvent[]` that the MatchDay UI renders sequentially. You know the performance constraint (up to ~20 AI matches per week must complete quickly), the late drama mechanics (post-minute 85 probability modifiers), and that all tuning constants belong in `src/config/matchEngine.ts` or `src/config/gameBalance.ts`.

## NON-NEGOTIABLE CONSTRAINTS

- **NEVER hardcode** values in `match.ts` — all constants go in `src/config/matchEngine.ts` or `src/config/gameBalance.ts`
- **NEVER break chronological event ordering** — MatchDay renders events sequentially; any event with `minute < previous event's minute` breaks the UI
- **Run `npm run test -- --grep match`** after every change — before marking anything done
- **Performance**: avoid expensive operations in the hot loop — the engine runs for all AI clubs (~20 per week)
- **New event types require ALL five steps**: types → generation → rendering → stat tracking → tests (see checklist below)

## User Request

$ARGUMENTS

## Context Loading — Read These First (in order)

If any file doesn't exist at the stated path, say so rather than proceeding.

1. **`src/engine/match.ts`** — Read the full file. Note its actual current size (do NOT assume any particular LOC count). Extract: `simulateMatch()` signature, event generation structure, late drama mechanics (post-minute 85), `HalfState` type usage.
2. **`src/config/matchEngine.ts`** — All engine tuning constants: attack/defense multipliers, event probability weights, goal chance calculations, formation and tactical modifiers.
3. **`src/config/gameBalance.ts`** — Related balance constants: fitness effects, injury rates, first-match boosts.
4. **`src/config/tactics.ts`** — How tactical instructions modify match calculations.
5. **`src/store/helpers/matchProcessing.ts`** — Post-match state updates: player stats (goals, assists, appearances, ratings), fixture result recording, league table updates. This is where stats propagation happens — NOT in the match engine itself.
6. **`src/store/slices/matchSlice.ts`** — Match-related store state.
7. **`src/store/slices/orchestrationSlice.ts`** (grep for `playCurrentMatch`) — How matches integrate into the game loop.
8. **`src/test/match.test.ts`** — Existing match tests. Read to understand test patterns before adding new tests.

---

## Key Gotchas

- **Match results must update TWO things**: the `fixtures` array AND individual player stats (goals, assists, appearances, ratings). Missing either causes data inconsistency.
- **`advanceWeek()` resets `matchSubsUsed`** to 0. Player match handling is in `playCurrentMatch()`, not `advanceWeek()`.
- **Late drama** (after minute 85) has special probability modifiers — verify you haven't nerfed this when changing event probabilities.
- **Formation bonuses** come from `src/config/tactics.ts` and are applied in the engine.
- **Player fitness** affects match performance and is reduced after matches.
- **Injuries** can occur during matches — check `gameBalance.ts` for injury probability constants.

## Verification Sequence (Run After Every Change)

1. `npm run test -- --grep match` — all match tests must pass
2. Verify the `MatchEvent[]` returned by `simulateMatch()` is still chronologically ordered — no `event.minute < previousEvent.minute`
3. Spot-check statistical plausibility: simulate 100+ matches and verify goals per team follow a plausible distribution (0-5 per team per match is the expected range for a balanced game). Flag if average goals per match has shifted more than 0.5 from baseline.

State test results before marking the change complete.

---

## When Adding New Event Types

> **Before writing any generation logic**, think through the statistical impact: How many times per match should this event trigger (per 90 minutes)? What is the probability per minute? Does adding this event require renormalizing existing event probabilities so the total doesn't exceed 1.0? Reason through this before writing code.

Then follow all five steps — missing any step causes inconsistency:

1. Add the event type to `src/types/game.ts` (`MatchEvent` type union)
2. Add generation logic in `src/engine/match.ts`
3. Add rendering in the MatchDay page component
4. Add stat tracking in `src/store/helpers/matchProcessing.ts`
5. Add test coverage in `src/test/match.test.ts`

---

## Rules

- **All engine constants** go in `src/config/matchEngine.ts` or `src/config/gameBalance.ts` — never hardcode in the engine
- **Test edge cases**: 0-0 draws, high-scoring games (5+), red cards, injury-time goals, matches with injuries
- **Don't break the event system** — UI renders events sequentially; the array must be chronologically ordered
- **Performance matters** — avoid expensive operations in the per-minute loop. The engine runs for ~20 AI matches per week.

## Cross-References

- See `CLAUDE.md` → "Key Patterns" → "Match sim" for high-level match flow
- Use `/project:balance` if engine changes require new config constants
- Use `/project:test` to generate comprehensive match test scenarios
