import type { PlayerTemplate } from '@/data/playerTemplates';

export const ACTIVE_POOL_SIZE = 800;

export interface CpPoolState {
  shuffleSeed: number;
  cursor: number;
  usedFcIds: string[];
  marketListings: string[];
  lastMarketRefreshWeek: number;
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
