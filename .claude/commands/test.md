# Test Generator

You are the QA specialist for Dynasty Manager. Your goal is to generate or enhance tests that catch real game logic bugs — not just boilerplate coverage.

## User Request

$ARGUMENTS

## Test Infrastructure

- **Framework:** Vitest 3.2.4 + jsdom + @testing-library/react
- **Config:** `vitest.config.ts` at project root
- **Test location:** `src/test/*.test.ts`
- **Setup file:** `src/test/setup.ts`
- **Run tests:** `npm run test` (single run) or `npm run test:watch` (watch mode)
- **Run specific:** `npm run test -- --grep "pattern"`

## Existing Test Files

Read 2-3 of these to match patterns before writing new tests:
- `src/test/match.test.ts` — Match engine tests
- `src/test/playerDev.test.ts` — Player development/growth tests
- `src/test/helpers.test.ts` — Utility function tests
- `src/test/cup.test.ts` — Cup competition tests
- `src/test/celebrations.test.ts` — Celebration/achievement tests
- `src/test/saveMigration.test.ts` — Save migration tests
- `src/test/contracts.test.ts` — Contract system tests
- `src/test/chemistry.test.ts` — Team chemistry tests
- `src/test/personality.test.ts` — Player personality tests
- `src/test/promotionRelegation.test.ts` — Promotion/relegation tests
- `src/test/youth.test.ts` — Youth academy tests
- `src/test/finance.test.ts` — Finance system tests
- `src/test/league.test.ts` — League/fixture tests
- `src/test/training.test.ts` — Training system tests

## What to Test

Focus on **game logic**, not UI rendering:
- **Store slices** — State transitions, edge cases in game loop
- **Utils** — Player generation, training calculations, transfer pricing, stat calculations
- **Engine** — Match simulation outcomes, event generation, edge cases
- **Config interactions** — Verify balance constants produce expected outcomes
- **Data integrity** — Player ID references stay valid after transfers, season end, etc.

## Test Patterns to Follow

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('FeatureName', () => {
  // Setup shared state/fixtures
  beforeEach(() => { /* reset state */ });

  it('should handle the happy path', () => {
    // Arrange → Act → Assert
  });

  it('should handle edge case: empty input', () => { });
  it('should handle edge case: boundary values', () => { });
});
```

## Key Testing Gotchas

- **Player IDs** — When testing anything with player references, ensure IDs exist in the test state. Use `filter(Boolean)` patterns like production code.
- **Zustand store** — Don't test the store directly in unit tests. Test the slice logic or utility functions that the store calls.
- **Match simulation** — Results are probabilistic. Test ranges/distributions, not exact scores.
- **Season boundaries** — Test week 46 → season end transitions carefully.
- **Save migration** — Each migration version needs a test with fixture data from the previous version.

## When Asked for "Coverage Gaps"

1. Read all existing test files
2. Read all util files in `src/utils/` and slice files in `src/store/slices/`
3. Identify untested or under-tested modules
4. Prioritize by risk: match engine > game loop > transfers > player gen > UI utils
5. Report findings with specific file:function recommendations

## Cross-References

- See `CLAUDE.md` → "Key Gotchas" for common bugs to test against
- Use `/project:review` after writing tests to verify they follow conventions
