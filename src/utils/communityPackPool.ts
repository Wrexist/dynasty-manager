import type { PlayerTemplate } from '@/data/playerTemplates';

export const ACTIVE_POOL_SIZE = 800;

export interface CpPoolState {
  shuffleSeed: number;
  cursor: number;
  usedFcIds: string[];
  marketListings: string[];
  lastMarketRefreshWeek: number;
  /** Last season we ran the Phase E.7 CP→FA-pool seed injection for. Guards
   *  the advanceWeek week-1 check against re-seeding on save/reload. */
  lastSeedSeason: number;
}

/** Config for drawForFaPoolSeed — tier/age bands for the game-start FA injection. */
export interface FaSeedBands {
  minAge: number;
  maxAge: number;
  eliteMinOvr: number;  // OVR >= this is elite
  topMinOvr: number;    // OVR >= this but < eliteMinOvr is top
  midMinOvr: number;    // OVR >= this but < topMinOvr is mid; below this isn't seeded
  eliteCount: number;   // requested elite picks per wave
  topCount: number;     // requested top picks per wave
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = array.slice();
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getActivePool(
  freeAgents: PlayerTemplate[],
  cpPool: CpPoolState,
): PlayerTemplate[] {
  const shuffled = seededShuffle(freeAgents, cpPool.shuffleSeed);
  const slice = shuffled.slice(cpPool.cursor, cpPool.cursor + ACTIVE_POOL_SIZE);
  const used = new Set(cpPool.usedFcIds);
  return slice.filter((t) => !t.fcId || !used.has(t.fcId));
}

export function drawForMarket(
  activePool: PlayerTemplate[],
  count: number,
  excludeIds: string[],
  seed: number,
): PlayerTemplate[] {
  const excluded = new Set(excludeIds);
  const available = activePool.filter((t) => !t.fcId || !excluded.has(t.fcId));

  const top = available.filter((t) => t.ovr >= 80);
  const mid = available.filter((t) => t.ovr >= 65 && t.ovr < 80);
  const low = available.filter((t) => t.ovr < 65);

  const rand = mulberry32(seed);
  const result: PlayerTemplate[] = [];
  const used = new Set<string>();
  const notUsed = (t: PlayerTemplate) => !t.fcId || !used.has(t.fcId);

  for (let i = 0; i < count; i++) {
    const roll = rand();
    const preferred = roll < 0.2 ? top : roll < 0.7 ? mid : low;

    let candidates = preferred.filter(notUsed);
    if (candidates.length === 0) candidates = available.filter(notUsed);
    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(rand() * candidates.length)];
    result.push(pick);
    if (pick.fcId) used.add(pick.fcId);
  }

  return result;
}

// NOTE: `drawForScouting`, `drawForAISquadFill` and `drawForYouth` used to live
// here. All three were written, tested and never called, and they are now
// redundant by construction: every real identity in the game — club squads,
// free agents, community-pack rosters and (since scouting was wired up) scout
// reports — is drawn through `pickUnclaimedRealPlayer` against ONE claim
// registry, which `initGame` seeds with the community-pack templates before any
// squad is built. A second, unclaimed draw path is exactly how the same person
// ends up in two places at once.

export function advanceCursor(
  cpPool: CpPoolState,
  advanceBy: number,
): Partial<CpPoolState> {
  return { cursor: cpPool.cursor + advanceBy };
}

export function needsRefill(activePoolLength: number): boolean {
  return activePoolLength < 200;
}

/**
 * Draw a game-start FA wave from the CP pool. Partitions the active pool by
 * OVR tier (elite / top / mid), applies the released-veteran age band, and
 * picks up to `count` templates — elite first, then top, then mid — so the
 * first few seats reliably go to recognizable names. Returns fewer than
 * `count` if any tier runs dry; callers should treat a short result as "that
 * was everything we could surface" and carry on.
 *
 * Distinct from `drawForMarket` (which randomizes by weighted tier roll per
 * pick and has no age filter) because the FA-pool seed wants a predictable
 * elite-heavy shape, not a market-shelf distribution.
 */
export function drawForFaPoolSeed(
  activePool: PlayerTemplate[],
  count: number,
  excludeIds: string[],
  seed: number,
  bands: FaSeedBands,
): PlayerTemplate[] {
  if (count <= 0) return [];
  const excluded = new Set(excludeIds);
  const inAgeBand = (t: PlayerTemplate) => t.age >= bands.minAge && t.age <= bands.maxAge;
  const available = activePool
    .filter((t) => !t.fcId || !excluded.has(t.fcId))
    .filter(inAgeBand);

  const elite = available.filter((t) => t.ovr >= bands.eliteMinOvr);
  const top = available.filter((t) => t.ovr >= bands.topMinOvr && t.ovr < bands.eliteMinOvr);
  const mid = available.filter((t) => t.ovr >= bands.midMinOvr && t.ovr < bands.topMinOvr);

  const rand = mulberry32(seed);
  const result: PlayerTemplate[] = [];
  const used = new Set<string>();

  const drawFrom = (pool: PlayerTemplate[], n: number) => {
    for (let i = 0; i < n; i++) {
      const candidates = pool.filter((t) => !t.fcId || !used.has(t.fcId));
      if (candidates.length === 0) return;
      const pick = candidates[Math.floor(rand() * candidates.length)];
      result.push(pick);
      if (pick.fcId) used.add(pick.fcId);
    }
  };

  drawFrom(elite, Math.min(bands.eliteCount, count));
  drawFrom(top, Math.min(bands.topCount, Math.max(0, count - result.length)));
  drawFrom(mid, Math.max(0, count - result.length));

  return result;
}
