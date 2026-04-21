import { describe, it, expect } from 'vitest';
import type { PlayerTemplate } from '@/data/playerTemplates';
import {
  ACTIVE_POOL_SIZE,
  advanceCursor,
  drawForAISquadFill,
  drawForMarket,
  drawForScouting,
  drawForYouth,
  getActivePool,
  mulberry32,
  needsRefill,
  seededShuffle,
  type CpPoolState,
} from '@/utils/communityPackPool';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { cpLeagueSquads } from '@/data/communityPack/cpLeagueSquads';

/** Small synthetic pool so tests run fast and stay deterministic without
 *  pulling the real ~1.8MB freeAgents dataset into test memory. */
function makeTemplate(overrides: Partial<PlayerTemplate> & { fcId: string }): PlayerTemplate {
  return {
    fn: 'Test',
    ln: 'Player',
    pos: 'CM',
    age: 25,
    nat: 'Testland',
    ovr: 70,
    pot: 75,
    ...overrides,
  };
}

function emptyPool(overrides: Partial<CpPoolState> = {}): CpPoolState {
  return { shuffleSeed: 1, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0, ...overrides };
}

describe('communityPack: mulberry32 PRNG', () => {
  it('is deterministic — same seed produces same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('emits values in [0, 1)', () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge within 5 draws', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let diverged = false;
    for (let i = 0; i < 5; i++) {
      if (a() !== b()) { diverged = true; break; }
    }
    expect(diverged).toBe(true);
  });
});

describe('communityPack: seededShuffle', () => {
  const source = Array.from({ length: 50 }, (_, i) => i);

  it('returns a new array with the same elements', () => {
    const shuffled = seededShuffle(source, 7);
    expect(shuffled).toHaveLength(source.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
    expect(shuffled).not.toBe(source); // new reference
  });

  it('is deterministic for a given seed', () => {
    expect(seededShuffle(source, 123)).toEqual(seededShuffle(source, 123));
  });

  it('produces different orders for different seeds', () => {
    expect(seededShuffle(source, 1)).not.toEqual(seededShuffle(source, 2));
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    seededShuffle(input, 9);
    expect(input).toEqual(snapshot);
  });
});

describe('communityPack: getActivePool', () => {
  it('returns up to ACTIVE_POOL_SIZE templates sliced at the cursor', () => {
    const pool = Array.from({ length: ACTIVE_POOL_SIZE * 2 }, (_, i) =>
      makeTemplate({ fcId: `fc-${i}` }),
    );
    const active = getActivePool(pool, emptyPool({ shuffleSeed: 5, cursor: 0 }));
    expect(active).toHaveLength(ACTIVE_POOL_SIZE);
  });

  it('filters out players whose fcId is in usedFcIds', () => {
    const pool = Array.from({ length: 50 }, (_, i) => makeTemplate({ fcId: `fc-${i}` }));
    const used = ['fc-1', 'fc-2', 'fc-3'];
    const active = getActivePool(pool, emptyPool({ shuffleSeed: 1, usedFcIds: used }));
    const activeIds = active.map(t => t.fcId);
    for (const u of used) expect(activeIds).not.toContain(u);
  });

  it('returns an empty slice when cursor exceeds pool length', () => {
    const pool = Array.from({ length: 10 }, (_, i) => makeTemplate({ fcId: `fc-${i}` }));
    const active = getActivePool(pool, emptyPool({ cursor: 500 }));
    expect(active).toHaveLength(0);
  });
});

describe('communityPack: drawForMarket', () => {
  const activePool: PlayerTemplate[] = [
    ...Array.from({ length: 5 }, (_, i) => makeTemplate({ fcId: `elite-${i}`, ovr: 85 })),
    ...Array.from({ length: 20 }, (_, i) => makeTemplate({ fcId: `mid-${i}`, ovr: 70 })),
    ...Array.from({ length: 30 }, (_, i) => makeTemplate({ fcId: `low-${i}`, ovr: 55 })),
  ];

  it('returns at most the requested count', () => {
    const draws = drawForMarket(activePool, 10, [], 42);
    expect(draws.length).toBeLessThanOrEqual(10);
  });

  it('returns unique players (no duplicate fcIds within one draw)', () => {
    const draws = drawForMarket(activePool, 20, [], 99);
    const ids = draws.map(d => d.fcId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('excludes ids passed in excludeIds', () => {
    const exclude = activePool.slice(0, 5).map(t => t.fcId!);
    const draws = drawForMarket(activePool, 20, exclude, 7);
    for (const d of draws) expect(exclude).not.toContain(d.fcId);
  });

  it('is deterministic given the same seed and inputs', () => {
    const a = drawForMarket(activePool, 5, [], 2026);
    const b = drawForMarket(activePool, 5, [], 2026);
    expect(a.map(t => t.fcId)).toEqual(b.map(t => t.fcId));
  });
});

describe('communityPack: drawForScouting', () => {
  const activePool: PlayerTemplate[] = [
    makeTemplate({ fcId: 'st-1', pos: 'ST', ovr: 80 }),
    makeTemplate({ fcId: 'st-2', pos: 'ST', ovr: 81 }),
    makeTemplate({ fcId: 'cm-1', pos: 'CM', ovr: 80 }),
    makeTemplate({ fcId: 'lw-alt-st', pos: 'LW', altPos: ['ST'], ovr: 79 }),
    makeTemplate({ fcId: 'st-far', pos: 'ST', ovr: 70 }), // >2 gap, should be filtered
  ];

  it('returns a player at the target position within OVR ±2', () => {
    const pick = drawForScouting(activePool, 80, 'ST', [], 1);
    expect(pick).not.toBeNull();
    expect(['ST', 'LW']).toContain(pick!.pos);
    expect(Math.abs(pick!.ovr - 80)).toBeLessThanOrEqual(2);
  });

  it('accepts altPos matches', () => {
    // With only LW-alt-ST + too-far pool, should still return the alt-ST
    const narrowPool = [
      makeTemplate({ fcId: 'lw-alt-st', pos: 'LW', altPos: ['ST'], ovr: 80 }),
    ];
    const pick = drawForScouting(narrowPool, 80, 'ST', [], 1);
    expect(pick?.fcId).toBe('lw-alt-st');
  });

  it('returns null when no candidate fits OVR window', () => {
    const pick = drawForScouting(activePool, 40, 'ST', [], 1);
    expect(pick).toBeNull();
  });

  it('respects excludeIds', () => {
    const pick = drawForScouting(activePool, 80, 'ST', ['st-1', 'st-2', 'lw-alt-st'], 1);
    // Remaining ST candidates at 80 OVR: none — st-far is >2 away, cm-1 is wrong pos
    expect(pick).toBeNull();
  });
});

describe('communityPack: drawForAISquadFill', () => {
  const pool: PlayerTemplate[] = [
    makeTemplate({ fcId: 'elite-gk', pos: 'GK', ovr: 85 }),
    makeTemplate({ fcId: 'top-gk', pos: 'GK', ovr: 72 }),
    makeTemplate({ fcId: 'mid-gk', pos: 'GK', ovr: 65 }),
    makeTemplate({ fcId: 'low-gk', pos: 'GK', ovr: 55 }),
  ];

  it.each([
    ['elite', 'elite-gk'],
    ['top', 'top-gk'],
    ['mid', 'mid-gk'],
    ['low', 'low-gk'],
  ] as const)('draws a %s tier GK', (tier, expectedId) => {
    const pick = drawForAISquadFill(pool, 'GK', tier, [], 1);
    expect(pick?.fcId).toBe(expectedId);
  });

  it('returns null when no player matches tier + position', () => {
    const pick = drawForAISquadFill(pool, 'ST', 'elite', [], 1);
    expect(pick).toBeNull();
  });
});

describe('communityPack: drawForYouth', () => {
  const pool: PlayerTemplate[] = [
    makeTemplate({ fcId: 'y1', age: 17, ovr: 65 }),
    makeTemplate({ fcId: 'y2', age: 20, ovr: 68 }),
    makeTemplate({ fcId: 'too-old', age: 22, ovr: 65 }),
    makeTemplate({ fcId: 'too-young', age: 15, ovr: 65 }),
    makeTemplate({ fcId: 'too-good', age: 18, ovr: 80 }),
  ];

  it('returns a player aged 16-21 with ovr ≤ 70', () => {
    const pick = drawForYouth(pool, [], 1);
    expect(pick).not.toBeNull();
    expect(pick!.age).toBeGreaterThanOrEqual(16);
    expect(pick!.age).toBeLessThanOrEqual(21);
    expect(pick!.ovr).toBeLessThanOrEqual(70);
  });

  it('returns null when pool has no eligible youth', () => {
    const noYouth = pool.filter(t => !['y1', 'y2'].includes(t.fcId!));
    const pick = drawForYouth(noYouth, [], 1);
    expect(pick).toBeNull();
  });
});

describe('communityPack: advanceCursor', () => {
  it('adds the step to the current cursor', () => {
    const state = emptyPool({ cursor: 120 });
    expect(advanceCursor(state, 30)).toEqual({ cursor: 150 });
  });

  it('does not mutate the input state', () => {
    const state = emptyPool({ cursor: 10 });
    advanceCursor(state, 5);
    expect(state.cursor).toBe(10);
  });
});

describe('communityPack: needsRefill', () => {
  it('is true below the 200-template refill threshold', () => {
    expect(needsRefill(emptyPool(), 150)).toBe(true);
    expect(needsRefill(emptyPool(), 199)).toBe(true);
  });

  it('is false at or above the threshold', () => {
    expect(needsRefill(emptyPool(), 200)).toBe(false);
    expect(needsRefill(emptyPool(), 800)).toBe(false);
  });
});

describe(`communityPack: save migration v59 → v${CURRENT_VERSION}`, () => {
  it('adds default communityPackEnabled=false on a v59 save', () => {
    const v59: Record<string, unknown> = { version: 59 };
    const migrated = migrateSaveData(v59) as Record<string, unknown>;
    expect(migrated.version).toBe(CURRENT_VERSION);
    expect(migrated.communityPackEnabled).toBe(false);
  });

  it('adds a well-formed default cpPool on a v59 save', () => {
    const v59: Record<string, unknown> = { version: 59 };
    const migrated = migrateSaveData(v59) as Record<string, unknown>;
    expect(migrated.cpPool).toEqual({
      shuffleSeed: 0,
      cursor: 0,
      usedFcIds: [],
      marketListings: [],
      lastMarketRefreshWeek: 0,
    });
  });

  it('preserves existing cpPool if a v59 save already carries one', () => {
    const existing = { shuffleSeed: 42, cursor: 100, usedFcIds: ['fc-x'], marketListings: ['fc-y'], lastMarketRefreshWeek: 8 };
    const v59: Record<string, unknown> = { version: 59, cpPool: existing, communityPackEnabled: true };
    const migrated = migrateSaveData(v59) as Record<string, unknown>;
    expect(migrated.cpPool).toEqual(existing);
    expect(migrated.communityPackEnabled).toBe(true);
  });
});

describe('communityPack: cpLeagueSquads registry', () => {
  it('exposes squad templates keyed by club id', () => {
    expect(typeof cpLeagueSquads).toBe('object');
    const keys = Object.keys(cpLeagueSquads);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('every club\'s squad is a non-empty array of PlayerTemplate-shaped entries', () => {
    for (const [clubId, players] of Object.entries(cpLeagueSquads)) {
      expect(Array.isArray(players), `${clubId} should be array`).toBe(true);
      expect(players.length, `${clubId} should have players`).toBeGreaterThan(0);
      // Spot-check the first player's schema
      const p = players[0];
      expect(typeof p.fn).toBe('string');
      expect(typeof p.ln).toBe('string');
      expect(typeof p.pos).toBe('string');
      expect(typeof p.ovr).toBe('number');
      expect(typeof p.age).toBe('number');
    }
  });
});
