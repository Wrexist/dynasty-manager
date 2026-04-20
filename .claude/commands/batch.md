# Batch Work — Iterative Autonomous Loop

You are running a disciplined autonomous batch loop for Dynasty Manager. You apply the project's non-negotiable constraints to every iteration without reminders. Each iteration is atomic: plan → implement → test → checkpoint.

## NON-NEGOTIABLE CONSTRAINTS (Apply Every Iteration)

- NEVER modify `src/components/ui/*`
- ALWAYS run `npm run test` between iterations — a failing test means fix before continuing
- ALWAYS spread nested objects in Zustand `set()` — direct mutation is a bug
- ALWAYS `filter(Boolean)` when mapping player IDs to Player objects
- NEVER put game logic in components — slices and utils only
- NEVER hardcode balance values — use `src/config/` constants

## User Request

$ARGUMENTS

## Before Starting

Define these three things explicitly before iteration 1:

1. **Scope** — Exactly which files/modules are targeted. Name them.
2. **Limit** — Default 5 iterations. Use 10+ only for test generation. State the limit upfront.
3. **Success criteria** — What does "done" look like? Be specific (e.g., "every file in src/utils/ has a corresponding test file" or "orchestrationSlice.ts is below N LOC").

## Each Iteration

1. **Assess** — State current progress vs. remaining work
2. **Pick** — Select the highest-value next item from the scope
3. **Implement** — Follow dynasty-manager conventions (pattern match against similar existing code)
4. **Test** — Run `npm run test`. If fail → fix before proceeding to step 5
5. **Verify** — Does this iteration's output advance the stated success criteria? State: `Iteration N complete. Progress: [state]. Remaining: [what's left].`
6. **Continue or stop** — Proceed to next iteration, or pause per termination conditions below

## Termination Conditions — STOP and surface to user if:

- An architectural decision requires human input (don't guess — ask)
- A test fails and the fix is non-obvious after one attempt
- You have completed 3+ iterations without measurable progress toward the success criteria
- You reach the stated iteration limit

When stopping: state `Batch paused: [reason]. Recommend: [action].`

## Common Tasks

**Test coverage:** Target `src/utils/` files without a `src/test/` counterpart. Read existing tests in `src/test/match.test.ts` (range assertions for probabilistic outcomes) and `src/test/longevity.test.ts` (multi-season loop helper) as pattern references. One new test file per iteration.

**Refactoring:** Target `orchestrationSlice.ts` — read it first to understand its actual current size. One logical block extraction per iteration. Use `/project:refactor` for the extraction template and checkpoint format.

**Documentation:** Target `src/utils/` exported functions missing JSDoc. One file per iteration. Write only when the WHY is non-obvious — skip self-explanatory function names.

**Type/config cleanup:** Find hardcoded magic numbers in `src/store/` or `src/engine/` that should be in `src/config/`. One constant move per iteration.
