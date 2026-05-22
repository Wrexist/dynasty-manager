import "@testing-library/jest-dom";
import { beforeAll } from "vitest";

// In production the national player pool and club squad templates are
// lazy-loaded so they stay off the initial app bundle. Tests don't run that
// boot sequence and many of them (squad generation, real-player picker,
// national team pool) rely on the data being populated synchronously. Prime
// both once for every test file.
beforeAll(async () => {
  const [{ loadNationalPool }, { loadClubTemplates }] = await Promise.all([
    import("@/data/nationalPlayerPoolAccess"),
    import("@/data/playerTemplatesAccess"),
  ]);
  await Promise.all([loadNationalPool(), loadClubTemplates()]);
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
