import { describe, it, expect, vi, afterEach } from 'vitest';
import type { TransferListing } from '@/types/game';
import {
  generateInitialMarket,
  generateInitialFreeAgents,
  spawnFreeAgents,
  replenishMarket,
  processListingExpiry,
} from '@/utils/transferMarketGen';
import {
  INITIAL_MARKET_GEN_MIN,
  INITIAL_MARKET_GEN_RANGE,
  INITIAL_FREE_AGENTS_MIN,
  INITIAL_FREE_AGENTS_RANGE,
  FREE_AGENT_SPAWN_MIN,
  FREE_AGENT_SPAWN_RANGE,
  MARKET_REPLENISH_BATCH_MIN,
  MARKET_REPLENISH_BATCH_RANGE,
} from '@/config/transfers';

// Every generator calls Math.random many times inside player generation.
// For size-window assertions we just let the real Math.random run (size is
// already bounded by config); for expiry tests we mock narrowly.

describe('generateInitialMarket', () => {
  it('returns a listings batch sized within [MIN, MIN + RANGE - 1] and a matching players map', () => {
    const { players, listings } = generateInitialMarket(1, 1);
    expect(listings.length).toBeGreaterThanOrEqual(INITIAL_MARKET_GEN_MIN);
    expect(listings.length).toBeLessThanOrEqual(INITIAL_MARKET_GEN_MIN + INITIAL_MARKET_GEN_RANGE - 1);
    for (const listing of listings) {
      expect(players[listing.playerId]).toBeDefined();
      expect(listing.externalPlayer).toBe(true);
      expect(listing.sellerClubId).toBe('');
      expect(listing.listedWeek).toBe(1);
      expect(listing.listedSeason).toBe(1);
      expect(listing.askingPrice).toBeGreaterThanOrEqual(50_000);
    }
  });
});

describe('generateInitialFreeAgents', () => {
  it('returns a free-agent batch sized within the configured window with clubId=""', () => {
    const { players, freeAgentIds } = generateInitialFreeAgents(1);
    expect(freeAgentIds.length).toBeGreaterThanOrEqual(INITIAL_FREE_AGENTS_MIN);
    expect(freeAgentIds.length).toBeLessThanOrEqual(INITIAL_FREE_AGENTS_MIN + INITIAL_FREE_AGENTS_RANGE - 1);
    for (const id of freeAgentIds) {
      expect(players[id]).toBeDefined();
      expect(players[id].clubId).toBe('');
      expect(players[id].listedForSale).toBe(false);
    }
  });
});

describe('spawnFreeAgents', () => {
  it('respects FREE_AGENT_SPAWN_MIN / _RANGE window', () => {
    const { freeAgentIds } = spawnFreeAgents(1);
    expect(freeAgentIds.length).toBeGreaterThanOrEqual(FREE_AGENT_SPAWN_MIN);
    expect(freeAgentIds.length).toBeLessThanOrEqual(FREE_AGENT_SPAWN_MIN + FREE_AGENT_SPAWN_RANGE - 1);
  });
});

describe('replenishMarket', () => {
  it('stamps the current week/season onto every new listing', () => {
    const { listings } = replenishMarket(3, 17);
    expect(listings.length).toBeGreaterThanOrEqual(MARKET_REPLENISH_BATCH_MIN);
    expect(listings.length).toBeLessThanOrEqual(MARKET_REPLENISH_BATCH_MIN + MARKET_REPLENISH_BATCH_RANGE - 1);
    for (const l of listings) {
      expect(l.listedWeek).toBe(17);
      expect(l.listedSeason).toBe(3);
    }
  });
});

// ── processListingExpiry ──────────────────────────────────────────────────────

function externalListing(overrides: Partial<TransferListing> = {}): TransferListing {
  return {
    playerId: 'ext-1',
    askingPrice: 1_000_000,
    sellerClubId: '',
    externalPlayer: true,
    divisionId: '',
    listedWeek: 1,
    listedSeason: 1,
    ...overrides,
  };
}

function clubListing(overrides: Partial<TransferListing> = {}): TransferListing {
  return {
    playerId: 'club-p-1',
    askingPrice: 2_000_000,
    sellerClubId: 'club-b',
    externalPlayer: false,
    divisionId: 'eng',
    listedWeek: 1,
    listedSeason: 1,
    ...overrides,
  };
}

describe('processListingExpiry', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('keeps a listing that is still within its expiry window', () => {
    const market = [externalListing({ listedWeek: 1, listedSeason: 1 })];
    const { market: next, expiredPlayerIds, expiredClubPlayerIds } = processListingExpiry(
      market, 3, 1, 46, 6, 0.5, 0.2, 4,
    );
    expect(next).toHaveLength(1);
    expect(expiredPlayerIds).toEqual([]);
    expect(expiredClubPlayerIds).toEqual([]);
  });

  it('expires an external listing and surfaces the player id when relist roll misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // > relistChance
    const market = [externalListing({ listedWeek: 1, listedSeason: 1, playerId: 'stale-1' })];
    const { market: next, expiredPlayerIds } = processListingExpiry(
      market, 10, 1, 46, 6, 0.5, 0.2, 4,
    );
    expect(next).toHaveLength(0);
    expect(expiredPlayerIds).toEqual(['stale-1']);
  });

  it('relists an external listing at a discount when the relist roll hits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < relistChance
    const market = [externalListing({ listedWeek: 1, listedSeason: 1, askingPrice: 1_000_000 })];
    const { market: next, expiredPlayerIds } = processListingExpiry(
      market, 10, 1, 46, 6, 0.5, 0.2, 4,
    );
    expect(next).toHaveLength(1);
    expect(next[0].askingPrice).toBe(800_000); // 20% off
    expect(next[0].listedWeek).toBe(10);
    expect(next[0].listedSeason).toBe(1);
    expect(expiredPlayerIds).toEqual([]);
  });

  it('expires a club listing into expiredClubPlayerIds rather than relisting', () => {
    const market = [clubListing({ listedWeek: 1, listedSeason: 1, playerId: 'clubp-1' })];
    const { market: next, expiredPlayerIds, expiredClubPlayerIds } = processListingExpiry(
      market, 10, 1, 46, 6, 0.5, 0.2, 4,
    );
    expect(next).toHaveLength(0);
    expect(expiredPlayerIds).toEqual([]);
    expect(expiredClubPlayerIds).toEqual(['clubp-1']);
  });

  it('handles cross-season ageing via totalWeeks (s1w40 + 1 season = age >= 46+week diff)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // force expiry path, no relist
    const market = [externalListing({ listedWeek: 40, listedSeason: 1, playerId: 'old-1' })];
    const { market: next, expiredPlayerIds } = processListingExpiry(
      market, 5, 2, 46, 6, 0.5, 0.2, 4,
    );
    // weeksListed = 1 * 46 + (5 - 40) = 46 - 35 = 11, well past the 6-week window.
    expect(next).toHaveLength(0);
    expect(expiredPlayerIds).toEqual(['old-1']);
  });

  it('keeps listings with no listedWeek (legacy shape) untouched', () => {
    const legacy: TransferListing = {
      playerId: 'legacy-1',
      askingPrice: 500_000,
      sellerClubId: '',
      externalPlayer: true,
      divisionId: '',
    };
    const { market: next, expiredPlayerIds, expiredClubPlayerIds } = processListingExpiry(
      [legacy], 30, 2, 46, 6, 0.5, 0.2, 4,
    );
    expect(next).toEqual([legacy]);
    expect(expiredPlayerIds).toEqual([]);
    expect(expiredClubPlayerIds).toEqual([]);
  });
});
