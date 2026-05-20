import "@testing-library/jest-dom";
import { beforeAll } from "vitest";

// In production the national player pool is lazy-loaded so it stays off the
// initial app bundle. Tests don't run that boot sequence and many of them
// (squad generation, real-player picker, national team pool) rely on the
// pool being populated synchronously. Prime it once for every test file.
beforeAll(async () => {
  const { loadNationalPool } = await import("@/data/nationalPlayerPoolAccess");
  await loadNationalPool();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
