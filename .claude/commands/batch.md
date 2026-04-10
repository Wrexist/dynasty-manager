# Batch Work — Iterative Autonomous Loop

Run an iterative loop for batch mechanical work. Best for: test coverage, refactors, documentation.

## User Request

$ARGUMENTS

## Before Starting

1. **Scope** — Define exactly which files/modules are targeted
2. **Limit** — Default 5 iterations. 10+ only for test generation
3. **Success criteria** — What does "done" look like?

## Each Iteration

1. Assess current state (done vs. remaining)
2. Pick highest-value next item
3. Implement following dynasty-manager conventions
4. Run `npm run test` to verify
5. If pass → next iteration. If fail → fix first.

## Common Tasks

**Test coverage:** Target `src/utils/` without `src/test/` counterparts. Follow patterns in existing tests.

**Refactoring:** Target `orchestrationSlice.ts` (~1,970 LOC). One extraction per iteration.

## Rules

- NEVER modify `src/components/ui/*`
- ALWAYS run `npm run test` between iterations
- ALWAYS spread nested objects in Zustand `set()`
- Stop if you hit an architectural decision needing human input
