import type { Position } from '@/types/game';
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

export function drawForScouting(
  activePool: PlayerTemplate[],
  targetOvr: number,
  position: Position,
  excludeIds: string[],
  seed: number,
): PlayerTemplate | null {
  const excluded = new Set(excludeIds);
  const candidates = activePool.filter((t) => {
    if (t.fcId && excluded.has(t.fcId)) return false;
    if (Math.abs(t.ovr - targetOvr) > 2) return false;
    if (t.pos === position) return true;
    if (t.altPos?.includes(position)) return true;
    return false;
  });
  if (candidates.length === 0) return null;
  const rand = mulberry32(seed);
  return candidates[Math.floor(rand() * candidates.length)];
}
