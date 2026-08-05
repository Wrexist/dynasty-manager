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
 * the bulk of it. Note `fileParallelism: false` below — the suite runs strictly
 * serially by design, so file time IS wall-clock time and there is no
 * parallelism to win back.
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
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
