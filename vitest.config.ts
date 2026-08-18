import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";

const pkgVersion = createRequire(import.meta.url)("./package.json").version;

/**
 * Long-running suites, excluded from `npm run test:fast`.
 *
 * These simulate whole seasons (or many of them) and dominate the wall clock:
 * measured 28.6 minutes for the full suite, and these files alone account for
 * the bulk of it. The suite runs in parallel (see `fileParallelism` below), but
 * a 20-season simulation is still a 20-season simulation — parallelism cannot
 * shorten the longest single file, which is what these are.
 *
 * The split exists because a gate nobody runs is not a gate. `preflight` covers
 * every fast suite and is meant for each commit; `preflight:full` runs
 * everything and is what CI enforces. Nothing is deleted or skipped — the full
 * suite is still the source of truth before a release.
 */
const SLOW_SUITES = [
  // Multi-season simulations and balance sweeps. Measured wall clock per file
  // on a full run; together these are the bulk of the suite's runtime.
  "src/test/longevity.test.ts",
  "src/test/longevityStress.test.ts",
  "src/test/seasonAdversarial.test.ts",
  "src/test/economyBalance.test.ts",
  "src/test/freeAgentBalance.test.ts",
  "src/test/balanceReport.test.ts",
  "src/test/perf.test.ts",
  "src/test/edgeCases.test.ts",          // 47s — advances full seasons
  "src/test/leagueDivergence.test.ts",   // 43s — 9-season divergence audit
  "src/test/threeSeasonBallonDor.test.ts", // 26s
  "src/test/seasonIntegration.test.ts",  // 18s
  "src/test/seasonLifecycle.test.ts",    // 13s
  "src/test/boardUltimatum.test.ts",     // 12s
  "src/test/seasonRolloverState.test.ts", // 9s
  "src/test/sundayCampaign.test.ts",     // 32 careers × 3 seasons — the Sunday balance campaign
];

export default defineConfig({
  plugins: [react()],
  // Mirror the compile-time define from vite.config.ts so components that read
  // `__APP_VERSION__` (TitleScreen, SettingsPage, …) can be rendered in tests.
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // `npm run test:fast` sets VITEST_FAST=1. Unset, nothing is excluded
    // and the full suite runs exactly as before.
    exclude: process.env.VITEST_FAST ? [...configDefaults.exclude, ...SLOW_SUITES] : configDefaults.exclude,
    testTimeout: 120_000,
    // The global setup hook primes the generated national + club-template data
    // (~400K LOC). Vitest's 10s default is not enough for that on a cold or
    // slow runner, and every file in the suite fails the hook when it isn't.
    hookTimeout: 120_000,
    pool: "forks",
    // Files run in PARALLEL. Serial was the single largest cost in the suite:
    // it made file time equal wall-clock time, which is how the full run reached
    // 28.6 minutes.
    //
    // Two wrong assumptions were made on the way here, both recorded so they are
    // not made again:
    //
    //   1. That serial mode protected shared module-level state. It did not —
    //      `pool: 'forks'` already gives every test FILE its own process, so that
    //      state is isolated by construction.
    //   2. That the one failure which appeared when parallelism was first
    //      enabled was an unidentifiable flake. It was not. Hunted with
    //      `VITEST_PARALLEL=1 vitest run --reporter=verbose`, it is a single
    //      TIMEOUT: longevity.test.ts's 10-season case budgeted 120s and took
    //      124s once four forks compete for four cores. Nothing shared, nothing
    //      corrupted — the work is simply slower per file under contention. The
    //      budgets in that file are now sized for parallel execution.
    //
    // `VITEST_PARALLEL=0` forces serial if a future flake needs bisecting.
    fileParallelism: process.env.VITEST_PARALLEL !== "0",
    // Capped rather than left to default: each fork primes the ~400K LOC of
    // generated national + club-template data in `setup.ts`, so memory is the
    // binding constraint, not CPU. Raise only alongside a memory measurement —
    // and re-check the stress-suite timeouts, which scale with contention.
    maxForks: 4,
    // Low-chatter reporter by default.
    //
    // WHY. The full suite twice exited 1 with *every* test passing — 2422
    // passed, 0 failed — on `Error: [vitest-worker]: Timeout calling
    // "onTaskUpdate"`. That is the worker's progress RPC to the main process
    // timing out, not a product failure: four forks streaming per-test updates
    // while one of them sits inside a 200-second season simulation is enough to
    // stall the channel, and Vitest counts the stall as an unhandled error.
    //
    // A gate that reports failure on a green run is worse than no gate — it is
    // exactly the disease finding 18 was about, and I very nearly dismissed a
    // REAL failure as this same noise. `dot` emits a fraction of the traffic.
    // A CLI `--reporter=verbose` still overrides this, which is what a flake
    // hunt needs.
    reporters: ["dot"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
