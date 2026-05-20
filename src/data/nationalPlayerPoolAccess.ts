/**
 * Lazy accessor for `NATIONAL_PLAYER_POOL`.
 *
 * The raw pool module (`nationalPlayerPool.ts`) is ~2.5MB of FC26-derived
 * roster data — useful for real-name squad filling, national-team pool
 * generation, and the "top 3 stars" preview on the nation-selection screen,
 * but NOT needed for the title screen or any boot-critical path.
 *
 * By going through this accessor (instead of a static import), the pool
 * stays out of the initial app bundle. Vite/Rollup tree-shakes the static
 * import chain — the pool chunk is only fetched when something actually
 * calls `loadNationalPool()`. We trigger that load:
 *
 *   1. From the TitleScreen mount, fire-and-forget, so by the time the user
 *      taps "New Game" or "Continue" the pool is usually already cached.
 *   2. Explicitly awaited inside `initGame()` so the very first squad
 *      generation has access to real player templates even on slow networks.
 *
 * Until the pool resolves, `getNationalPoolSync()` returns an empty object.
 * Consumers must already be null-tolerant — `pickUnclaimedRealPlayer()`
 * documents a "returns null → caller generates synthetic" contract, and
 * `getNationStarPlayers()` simply renders no stars in the preview. So the
 * worst-case if someone bypasses the prefetch is a fully-procedural squad
 * with no real names — not a crash.
 */
import type { PlayerTemplate } from '@/data/playerTemplates';

type Pool = Record<string, PlayerTemplate[]>;

const EMPTY_POOL: Pool = Object.freeze({}) as Pool;

let cachedPool: Pool | null = null;
let loadPromise: Promise<Pool> | null = null;

/**
 * Listeners that depend on derived data from the pool (memoised dedupe lists,
 * fcId → first-name lookup maps, etc). They need to invalidate the moment the
 * real pool lands so subsequent reads see the real data, not the empty
 * placeholder that was current when their cache was first built.
 */
const onLoadedListeners: Array<() => void> = [];
export function onNationalPoolLoaded(listener: () => void): void {
  if (cachedPool) {
    listener();
    return;
  }
  onLoadedListeners.push(listener);
}

export function isNationalPoolLoaded(): boolean {
  return cachedPool !== null;
}

export function getNationalPoolSync(): Pool {
  return cachedPool ?? EMPTY_POOL;
}

export function loadNationalPool(): Promise<Pool> {
  if (cachedPool) return Promise.resolve(cachedPool);
  if (!loadPromise) {
    loadPromise = import('@/data/nationalPlayerPool').then((m) => {
      cachedPool = m.NATIONAL_PLAYER_POOL;
      for (const fn of onLoadedListeners.splice(0)) {
        try { fn(); } catch { /* listener failures must not block the load */ }
      }
      return cachedPool;
    });
  }
  return loadPromise;
}

/**
 * Test-only: clear the cached pool so unit tests that mutate
 * `NATIONAL_PLAYER_POOL` directly see the fresh data on the next access.
 * Production code should never need this.
 */
export function __resetNationalPoolForTests(): void {
  cachedPool = null;
  loadPromise = null;
}
