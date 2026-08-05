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
 * the bulk of it. Note that only the fast set runs in parallel (see
 * `fileParallelism` below), so for the full suite file time is wall-clock time.
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
    // Parallel for the PER-COMMIT gate only; the full suite stays serial.
    //
    // Serial was not, as an earlier version of this comment claimed, protecting
    // shared module-level state — `pool: 'forks'` already gives every test file
    // its own process, so that state is isolated by construction. Parallelism
    // works, and it is a large win: the fast suite goes 6m00s -> 2m28s.
    //
    // But it is not yet trustworthy for the WHOLE suite. Evidence gathered:
    //   fast suite, parallel      2 runs, 157 files green, 146.8s / 146.6s
    //   slow suites alone, parallel  1 run, 12 files green
    //   FULL suite, parallel      run 1: 1 file FAILED, run 2: 169 green
    //
    // That one failure did not reproduce and was not captured by name, so there
    // is an intermittent, unidentified flake that only appears when all 172
    // files run concurrently — most likely timing or memory pressure in the
    // multi-season suites, which are excluded from the fast set. The suite was
    // deterministic before; a gate that goes green on the second try teaches
    // people to re-run rather than to read, which is worse than a slow gate.
    //
    // So: the fast gate takes the win where the evidence supports it, and
    // `preflight:full` keeps the determinism it had. To lift this, run the full
    // suite parallel repeatedly with `--reporter=verbose`, identify the flake,
    // fix it, and then flip this to `true` unconditionally.
    fileParallelism: !!process.env.VITEST_FAST,
    // Only meaningful when parallel. Capped rather than left to default because
    // each fork primes the ~400K LOC of generated data in `setup.ts`, making
    // memory the binding constraint rather than CPU.
    maxForks: 4,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
