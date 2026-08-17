import { describe, it, expect } from 'vitest';
import type { PlayerTemplate } from '@/data/playerTemplates';
import {
  ACTIVE_POOL_SIZE,
  advanceCursor,
  drawForFaPoolSeed,
  drawForMarket,
  getActivePool,
  mulberry32,
  needsRefill,
  seededShuffle,
  type CpPoolState,
  type FaSeedBands,
} from '@/utils/communityPackPool';
import { migrateSaveData, CURRENT_VERSION } from '@/utils/saveMigration';
import { cpLeagueSquads } from '@/data/communityPack/cpLeagueSquads';
import {
  readCommunityPackSlotPref,
  writeCommunityPackSlotPref,
  clearCommunityPackSlotPref,
} from '@/store/helpers/persistence';

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
  return { shuffleSeed: 1, cursor: 0, usedFcIds: [], marketListings: [], lastMarketRefreshWeek: 0, lastSeedSeason: 0, ...overrides };
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
    expect(needsRefill(150)).toBe(true);
    expect(needsRefill(199)).toBe(true);
  });

  it('is false at or above the threshold', () => {
    expect(needsRefill(200)).toBe(false);
    expect(needsRefill(800)).toBe(false);
  });
});

describe('communityPack: drawForFaPoolSeed', () => {
  const bands: FaSeedBands = {
    minAge: 26, maxAge: 33,
    eliteMinOvr: 83, topMinOvr: 78, midMinOvr: 68,
    eliteCount: 2, topCount: 8,
  };

  // A synthetic pool with known OVR/age shape so tier filtering is verifiable.
  const pool: PlayerTemplate[] = [
    // 3 elite (83+)
    makeTemplate({ fcId: 'e1', ovr: 89, age: 30 }),
    makeTemplate({ fcId: 'e2', ovr: 85, age: 28 }),
    makeTemplate({ fcId: 'e3', ovr: 84, age: 32 }),
    // 10 top (78-82)
    ...Array.from({ length: 10 }, (_, i) => makeTemplate({ fcId: `t${i}`, ovr: 78 + (i % 5), age: 27 + (i % 7) })),
    // 20 mid (68-77)
    ...Array.from({ length: 20 }, (_, i) => makeTemplate({ fcId: `m${i}`, ovr: 68 + (i % 10), age: 26 + (i % 8) })),
    // noise: age out of band (should never be picked)
    makeTemplate({ fcId: 'young1', ovr: 85, age: 22 }),
    makeTemplate({ fcId: 'old1', ovr: 85, age: 36 }),
    // noise: OVR below midMinOvr (should never be picked)
    makeTemplate({ fcId: 'low1', ovr: 60, age: 28 }),
  ];

  it('returns up to `count` templates, elite first, then top, then mid', () => {
    const drawn = drawForFaPoolSeed(pool, 15, [], 42, bands);
    expect(drawn).toHaveLength(15);
    // First 2 should be elite (eliteCount cap), next 8 top, then 5 mid to reach 15
    const ovrs = drawn.map(t => t.ovr);
    expect(ovrs.slice(0, 2).every(o => o >= 83)).toBe(true);
    expect(ovrs.slice(2, 10).every(o => o >= 78 && o < 83)).toBe(true);
    expect(ovrs.slice(10).every(o => o >= 68 && o < 78)).toBe(true);
  });

  it('respects the age band — never picks outside [minAge, maxAge]', () => {
    const drawn = drawForFaPoolSeed(pool, 30, [], 7, bands);
    const fcIds = drawn.map(t => t.fcId);
    expect(fcIds).not.toContain('young1');
    expect(fcIds).not.toContain('old1');
  });

  it('never picks below midMinOvr even when pools thin', () => {
    const drawn = drawForFaPoolSeed(pool, 50, [], 11, bands);
    expect(drawn.every(t => t.ovr >= bands.midMinOvr)).toBe(true);
    expect(drawn.map(t => t.fcId)).not.toContain('low1');
  });

  it('excludes fcIds in the excludeIds set', () => {
    const exclude = ['e1', 'e2', 'e3'];
    const drawn = drawForFaPoolSeed(pool, 15, exclude, 42, bands);
    expect(drawn.map(t => t.fcId).some(id => exclude.includes(id!))).toBe(false);
  });

  it('returns empty array for count <= 0', () => {
    expect(drawForFaPoolSeed(pool, 0, [], 1, bands)).toEqual([]);
    expect(drawForFaPoolSeed(pool, -5, [], 1, bands)).toEqual([]);
  });

  it('returns fewer than `count` when pool is exhausted', () => {
    // Exclude almost everything — only 2 mid templates left.
    const exclude = [
      'e1', 'e2', 'e3',
      ...Array.from({ length: 10 }, (_, i) => `t${i}`),
      ...Array.from({ length: 18 }, (_, i) => `m${i}`),
    ];
    const drawn = drawForFaPoolSeed(pool, 10, exclude, 42, bands);
    expect(drawn.length).toBeLessThanOrEqual(2);
  });

  it('is deterministic for the same seed', () => {
    const a = drawForFaPoolSeed(pool, 10, [], 99, bands);
    const b = drawForFaPoolSeed(pool, 10, [], 99, bands);
    expect(a.map(t => t.fcId)).toEqual(b.map(t => t.fcId));
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
    // v60→v61 chains on top, adding lastSeedSeason=99 (past the seed window)
    // to the default pool the v59→v60 migration created.
    expect(migrated.cpPool).toEqual({
      shuffleSeed: 0,
      cursor: 0,
      usedFcIds: [],
      marketListings: [],
      lastMarketRefreshWeek: 0,
      lastSeedSeason: 99,
    });
  });

  it('preserves existing cpPool if a v59 save already carries one', () => {
    const existing = { shuffleSeed: 42, cursor: 100, usedFcIds: ['fc-x'], marketListings: ['fc-y'], lastMarketRefreshWeek: 8 };
    const v59: Record<string, unknown> = { version: 59, cpPool: existing, communityPackEnabled: true };
    const migrated = migrateSaveData(v59) as Record<string, unknown>;
    // v60→v61 adds lastSeedSeason=99 (past the seed window — we don't retro-
    // inject seeds into in-progress saves).
    expect(migrated.cpPool).toEqual({ ...existing, lastSeedSeason: 99 });
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

describe('communityPack: per-slot preference toggle (read/write/clear)', () => {
  // The CP toggle in SettingsPage stores its choice as a per-slot
  // localStorage flag, so the next "New Game" click on that slot can
  // skip the welcome popup and seed initGame with the right options.
  // These tests cover the persistence layer round-trip — the bug class
  // here is "user toggles, value doesn't stick" or "slot 1 leaks into
  // slot 2".

  it('read returns null when no preference has been set', () => {
    localStorage.removeItem('dynasty-cp-slot-99');
    expect(readCommunityPackSlotPref(99)).toBe(null);
  });

  it('round-trips a true preference', () => {
    writeCommunityPackSlotPref(7, true);
    expect(readCommunityPackSlotPref(7)).toBe(true);
    clearCommunityPackSlotPref(7);
  });

  it('round-trips a false preference (explicit opt-out, NOT null)', () => {
    // Explicit `false` must be distinguishable from "never asked" (null)
    // so the new-game flow knows whether to show the popup again.
    writeCommunityPackSlotPref(8, false);
    expect(readCommunityPackSlotPref(8)).toBe(false);
    clearCommunityPackSlotPref(8);
  });

  it('keeps slots isolated — writing slot 1 does not affect slot 2', () => {
    writeCommunityPackSlotPref(1, true);
    writeCommunityPackSlotPref(2, false);
    expect(readCommunityPackSlotPref(1)).toBe(true);
    expect(readCommunityPackSlotPref(2)).toBe(false);
    expect(readCommunityPackSlotPref(3)).toBe(null);
    clearCommunityPackSlotPref(1);
    clearCommunityPackSlotPref(2);
  });

  it('clearCommunityPackSlotPref removes the value (read returns null again)', () => {
    writeCommunityPackSlotPref(5, true);
    expect(readCommunityPackSlotPref(5)).toBe(true);
    clearCommunityPackSlotPref(5);
    expect(readCommunityPackSlotPref(5)).toBe(null);
  });

  it('updating from true to false updates the stored value', () => {
    writeCommunityPackSlotPref(6, true);
    expect(readCommunityPackSlotPref(6)).toBe(true);
    writeCommunityPackSlotPref(6, false);
    expect(readCommunityPackSlotPref(6)).toBe(false);
    clearCommunityPackSlotPref(6);
  });

  it('does not throw when localStorage is unavailable (returns null instead)', () => {
    // jsdom localStorage will normally succeed; here we shadow the
    // global to simulate a Safari Private Browsing-style failure where
    // every getItem throws. The helper must swallow the error and
    // return null, not crash the page mount.
    const realStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): never { throw new Error('storage unavailable'); },
    });
    try {
      expect(() => readCommunityPackSlotPref(1)).not.toThrow();
      expect(readCommunityPackSlotPref(1)).toBe(null);
      expect(() => writeCommunityPackSlotPref(1, true)).not.toThrow();
      expect(() => clearCommunityPackSlotPref(1)).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: realStorage,
        writable: true,
      });
    }
  });
});
