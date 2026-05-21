/**
 * Lazy accessor for the per-club FC26 squad roster data (`ALL_SQUAD_TEMPLATES`).
 *
 * The aggregated squad module (`@/data/squads`) is ~2.1MB of roster data. It
 * is only needed when generating squads — new-game init, season-end
 * replacements, Ballon d'Or elite seeding — never for the title screen or
 * any boot-critical path. Going through this accessor (instead of a static
 * import) keeps the squad data out of the initial app bundle; Rollup only
 * fetches the chunk when `loadClubTemplates()` is first called.
 *
 * The load is triggered (1) fire-and-forget from the TitleScreen mount and
 * (2) fire-and-forget from `initGame()` as a safety net. Until it resolves,
 * `getClubTemplatesSync()` returns an empty map — every consumer already
 * falls back to procedural generation (`templates || []`), so the worst case
 * on a cold race is generated player names rather than a crash.
 *
 * This mirrors `nationalPlayerPoolAccess.ts` exactly.
 */
import type { PlayerTemplate } from '@/data/playerTemplates';

type Templates = Record<string, PlayerTemplate[]>;

const EMPTY: Templates = Object.freeze({}) as Templates;

let cached: Templates | null = null;
let loadPromise: Promise<Templates> | null = null;

export function isClubTemplatesLoaded(): boolean {
  return cached !== null;
}

export function getClubTemplatesSync(): Templates {
  return cached ?? EMPTY;
}

export function loadClubTemplates(): Promise<Templates> {
  if (cached) return Promise.resolve(cached);
  if (!loadPromise) {
    loadPromise = import('@/data/squads').then((m) => {
      cached = m.ALL_SQUAD_TEMPLATES;
      return cached;
    });
  }
  return loadPromise;
}

/**
 * Test-only: clear the cache so unit tests that import the squad data
 * directly are not affected by load state leaking between suites.
 */
export function __resetClubTemplatesForTests(): void {
  cached = null;
  loadPromise = null;
}
