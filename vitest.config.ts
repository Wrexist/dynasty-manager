import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";

const pkgVersion = createRequire(import.meta.url)("./package.json").version;

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
