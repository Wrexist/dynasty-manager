/**
 * Yield to the macrotask queue from inside a long test.
 *
 * WHY THIS EXISTS — and why `await Promise.resolve()` is not a substitute.
 *
 * Vitest's worker answers the main process over birpc. After every test it
 * calls `onTaskUpdate`, and birpc arms a `setTimeout` for that call with a
 * HARDCODED 60-second deadline (`DEFAULT_TIMEOUT = 6e4` in
 * `vitest/dist/chunks/index.B521nVV-.js`; the forks pool passes no `timeout`,
 * so it is not configurable from `vitest.config.ts`).
 *
 * A simulation harness that runs `await store.getState().advanceWeek()` in a
 * loop never reaches the timer phase. `advanceWeek` is async, but once its
 * dynamic imports are cached the promise is already resolved, so the `await`
 * drains MICROTASKS only. The whole loop is one uninterrupted macrotask as far
 * as the event loop is concerned. Two things are then stuck behind it: the
 * main process's reply to the pending `onTaskUpdate`, and the 60s timer that
 * would cancel it. When the block finally ends, Node runs the timers phase
 * BEFORE the poll phase — so the expired timer fires first and rejects, even
 * though the reply was sitting in the queue all along.
 *
 * Vitest surfaces that as an unhandled error and exits 1 with every test
 * green. It is how this suite last broke CI: 230 files, 3,129 tests, 0 failed,
 * exit 1 on `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`.
 *
 * MEASURED, not assumed. A two-test probe — one trivial test to leave an
 * `onTaskUpdate` in flight, then one test looping 70 s on
 * `await Promise.resolve()` — reproduces the error every time, in a
 * single-file run with no parallelism at all. Swapping that one line for
 * `await new Promise(r => setTimeout(r, 0))` and changing nothing else clears
 * it: 2 passed, 0 errors, same 70 s of work. That is the whole bug and the
 * whole fix.
 *
 * SO: any test whose body can run longer than ~60 seconds must call this
 * inside its loop. One `tick()` per simulated week or per simulated career is
 * plenty — it costs ~1 ms against work measured in seconds.
 */
export const tick = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0));
