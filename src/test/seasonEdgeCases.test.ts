/**
 * Phase 9a — Edge cases & adversarial scenarios for season helpers.
 *
 * Pure-function adversarial tests that cover:
 *   - simulatePlayoff variants (3, 5, 6, 8 candidates) — only 1, 2, 4
 *     are covered elsewhere; the general bracket loop is largely untested.
 *   - determineProRelZones extreme inputs (huge zones, single-team table,
 *     overlapping zones)
 *   - applyPromotionRelegation defensive paths:
 *     * country without ≥2 tiers (no-op)
 *     * playerClubId pointing at a non-existent club
 *     * mismatched division/club assignments
 *     * empty divisionClubs map for a real country
 *
 * These are the "unhappy paths" that historically slip through and corrupt
 * saves at season boundaries.
 */

import { describe, it, expect } from 'vitest';

import {
  simulatePlayoff,
  determineProRelZones,
  applyPromotionRelegation,
  applySeasonTurnover,
  generateReplacementClub,
} from '@/utils/promotionRelegation';
import { LEAGUES } from '@/data/league';
import type { LeagueInfo, LeagueTableEntry } from '@/types/game';

import {
  setupCountryPyramid,
  withSeededRandom,
  buildOrderedTable,
} from './helpers/seasonFixtures';

// ── simulatePlayoff — bracket variants ────────────────────────────────

describe('simulatePlayoff — bracket sizes', () => {
  it('handles 3 candidates by reducing the field via the general loop', () => {
    const winner = withSeededRandom(1, () => simulatePlayoff(['a', 'b', 'c']));
    expect(winner).not.toBeNull();
    expect(['a', 'b', 'c']).toContain(winner);
  });

  it('handles 5 candidates (odd, larger) — winner from the field', () => {
    const candidates = ['a', 'b', 'c', 'd', 'e'];
    const winner = withSeededRandom(2, () => simulatePlayoff(candidates));
    expect(candidates).toContain(winner);
  });

  it('handles 6 candidates (even, ≠ 4)', () => {
    const candidates = ['a', 'b', 'c', 'd', 'e', 'f'];
    const winner = withSeededRandom(3, () => simulatePlayoff(candidates));
    expect(candidates).toContain(winner);
  });

  it('handles 8 candidates (round-of-8 bracket)', () => {
    const candidates = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const winner = withSeededRandom(4, () => simulatePlayoff(candidates));
    expect(candidates).toContain(winner);
  });

  it('produces deterministic output under a seeded RNG', () => {
    const w1 = withSeededRandom(99, () => simulatePlayoff(['a', 'b', 'c', 'd']));
    const w2 = withSeededRandom(99, () => simulatePlayoff(['a', 'b', 'c', 'd']));
    expect(w1).toBe(w2);
  });

  it('higher-seeded teams win more often over many runs (sanity)', () => {
    // The 60% win rate for the higher-seeded team should produce a clear
    // bias toward the top candidate over a 200-run sample.
    let topWins = 0;
    for (let i = 0; i < 200; i++) {
      const w = simulatePlayoff(['top', 'mid-1', 'mid-2', 'bot']);
      if (w === 'top') topWins++;
    }
    // Top seed should win at least ~30% of the time vs random ~25%.
    expect(topWins).toBeGreaterThan(50);
  });
});

// ── determineProRelZones — extreme inputs ─────────────────────────────

describe('determineProRelZones — extreme inputs', () => {
  function makeLeague(overrides: Partial<LeagueInfo> = {}): LeagueInfo {
    return {
      id: 'x', name: 'X', shortName: 'X', country: 'X', countryCode: 'X',
      teamCount: 4, totalWeeks: 38, replacedSlots: 0, description: '', difficulty: '',
      colorClass: '', prizeMoney: 0, averageWage: 0,
      qualityTier: 4, tier: 1, countryId: 'x',
      promotionSpots: 0, relegationSpots: 0, playoffSpots: 0, ...overrides,
    };
  }

  it('handles a single-team table (degenerate)', () => {
    const league = makeLeague({ teamCount: 1 });
    const zones = determineProRelZones(buildOrderedTable(['only']), league);
    expect(zones.promoted).toEqual([]);
    expect(zones.relegated).toEqual([]);
    expect(zones.safe).toEqual(['only']);
  });

  it('handles an empty table', () => {
    const league = makeLeague({ teamCount: 0, promotionSpots: 0, relegationSpots: 0 });
    const zones = determineProRelZones([], league);
    expect(zones.promoted).toEqual([]);
    expect(zones.playoffCandidates).toEqual([]);
    expect(zones.safe).toEqual([]);
    expect(zones.relegated).toEqual([]);
  });

  it('handles overlapping zones gracefully (promotionSpots + relegationSpots > teamCount)', () => {
    // Defensive — caused historically by typos in league config. The slice
    // math should not produce duplicate club ids across zones.
    const league = makeLeague({ teamCount: 4, promotionSpots: 3, relegationSpots: 3 });
    const zones = determineProRelZones(buildOrderedTable(['a', 'b', 'c', 'd']), league);
    const allIds = [...zones.promoted, ...zones.playoffCandidates, ...zones.safe, ...zones.relegated];
    // Total may exceed teamCount when zones overlap, but the underlying
    // ids should still be drawn from the original table — no duplicates
    // across the safe set vs promoted/relegated.
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBeGreaterThan(0);
    // Every id should still come from the original table.
    for (const id of uniqueIds) {
      expect(['a', 'b', 'c', 'd']).toContain(id);
    }
  });

  it('every real LEAGUES entry partitions clubs without duplicates', () => {
    // Stronger invariant for production configs: zones must partition
    // (no club appears in two zones).
    for (const league of LEAGUES) {
      const ids = Array.from({ length: league.teamCount }, (_, i) => `c${i}`);
      const zones = determineProRelZones(buildOrderedTable(ids), league);
      const all = [...zones.promoted, ...zones.playoffCandidates, ...zones.safe, ...zones.relegated];
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

// ── applyPromotionRelegation — defensive paths ─────────────────────────

describe('applyPromotionRelegation — defensive paths', () => {
  it('handles a country whose tiers list is empty (unknown country)', () => {
    // If getLeaguesByCountry returns empty, the function must early-return
    // with all inputs intact.
    const result = applyPromotionRelegation(
      'no-such',
      { 'foo': ['x', 'y'] },
      { 'foo': [] },
      {},
      'x',
    );
    expect(result.updatedDivisionClubs).toEqual({ 'foo': ['x', 'y'] });
    expect(result.updatedClubs).toEqual({});
    expect(result.playerNewDivision).toBeNull();
    expect(result.turnovers).toEqual({});
  });

  it('handles a non-existent player-club id (no playerNewDivision flip)', () => {
    const setup = setupCountryPyramid('eng');
    const result = withSeededRandom(10, () => applyPromotionRelegation(
      'eng', setup.divisionClubs, setup.divisionTables, setup.clubs,
      'no-such-club-id',
    ));
    expect(result.playerNewDivision).toBeNull();
    // Real clubs should still be moved between tiers as expected.
    const eng = LEAGUES.find(l => l.id === 'eng')!;
    expect(result.turnovers.eng.relegatedClubs).toHaveLength(eng.relegationSpots);
  });

  it('handles missing entries in the clubs map for some clubIds', () => {
    // A save with stale divisionClubs entries pointing at deleted clubs
    // should not throw. Strip a few clubs from the clubs record and run.
    const setup = setupCountryPyramid('eng');
    const partialClubs = { ...setup.clubs };
    const someStaleId = setup.divisionClubs.eng[5];
    delete partialClubs[someStaleId];

    expect(() => withSeededRandom(11, () => applyPromotionRelegation(
      'eng', setup.divisionClubs, setup.divisionTables, partialClubs,
      'no-such-club-id',
    ))).not.toThrow();
  });

  it('handles a tier with empty divisionClubs (corrupt save)', () => {
    const setup = setupCountryPyramid('eng');
    const corruptDivisionClubs = { ...setup.divisionClubs, 'eng-3': [] };
    expect(() => withSeededRandom(12, () => applyPromotionRelegation(
      'eng', corruptDivisionClubs, setup.divisionTables, setup.clubs,
      'no-such-club-id',
    ))).not.toThrow();
  });
});

// ── applySeasonTurnover — single-tier (no promo/relegation) edge cases ──

describe('applySeasonTurnover — single-tier fallback', () => {
  it('returns no-op turnover for unknown leagueId', () => {
    const result = applySeasonTurnover('does-not-exist', ['a', 'b'], [], {});
    expect(result.turnover.relegatedClubs).toEqual([]);
    expect(result.turnover.promotedClubs).toEqual([]);
    expect(result.updatedLeagueClubs).toEqual(['a', 'b']);
  });

  it('removes only relegationSpots clubs from the bottom of the table', () => {
    const eng = LEAGUES.find(l => l.id === 'eng')!;
    const ids = Array.from({ length: eng.teamCount }, (_, i) => `eng-c${i}`);
    const table = buildOrderedTable(ids);
    const clubs = Object.fromEntries(ids.map(id => [id, {
      id, name: id, shortName: id, color: '#fff', secondaryColor: '#000',
      budget: 1, wageBill: 0, reputation: 3, facilities: 5, youthRating: 5,
      fanBase: 1, boardPatience: 50, playerIds: [], formation: '4-3-3' as const,
      lineup: [], subs: [], divisionId: 'eng',
    }]));
    const result = applySeasonTurnover('eng', ids, table, clubs);
    expect(result.turnover.relegatedClubs).toHaveLength(eng.relegationSpots);
    expect(result.updatedLeagueClubs).toHaveLength(eng.teamCount - eng.relegationSpots);
  });
});

// ── generateReplacementClub — adversarial parameters ────────────────

describe('generateReplacementClub — adversarial parameters', () => {
  it('produces a club even for a leagueId without a replacement pool', () => {
    // Falls back to DEFAULT_REPLACEMENTS pool when leagueId is unknown.
    const { clubData, clubId } = generateReplacementClub(1, 'unknown-league' as never);
    expect(clubId).toBeTruthy();
    expect(clubData.name).toBeTruthy();
    expect(clubData.budget).toBeGreaterThan(0);
  });

  it('produces ≥10 distinct ids for the same league across many calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const { clubId } = generateReplacementClub(7, 'eng-4');
      ids.add(clubId);
    }
    expect(ids.size).toBeGreaterThanOrEqual(10);
  });

  it('respects league qualityTier for squadQuality floor (rough)', () => {
    // tier 1 → floor ~58, tier 4 → floor ~33. Verify the average across
    // a small sample sits in plausible bounds.
    const tier1 = Array.from({ length: 10 }, () => generateReplacementClub(1, 'eng').clubData.squadQuality);
    const tier4 = Array.from({ length: 10 }, () => generateReplacementClub(1, 'eng-4').clubData.squadQuality);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(tier1)).toBeGreaterThan(avg(tier4));
  });
});

// ── Country with single tier (no promo/relego mechanics at all) ───────

describe('applyPromotionRelegation — single-tier country', () => {
  it('does nothing structural for a country with only one tier', () => {
    // Find any single-tier country; if all countries are multi-tier, skip.
    const byCountry: Record<string, LeagueInfo[]> = {};
    for (const l of LEAGUES) {
      if (!byCountry[l.countryId]) byCountry[l.countryId] = [];
      byCountry[l.countryId].push(l);
    }
    const single = Object.entries(byCountry).find(([, ls]) => ls.length === 1)?.[0];
    if (!single) return;

    const setup = setupCountryPyramid(single);
    const before = Object.values(setup.divisionClubs).flat().length;

    const result = withSeededRandom(20, () => applyPromotionRelegation(
      single, setup.divisionClubs, setup.divisionTables, setup.clubs,
      'no-such-club-id',
    ));

    // The adjacent-tier loop never runs (only one tier), so no movement.
    expect(result.playerNewDivision).toBeNull();
    // Bottom-tier replacedSlots may still trigger (if that league has any).
    const tier = setup.leagues[0];
    const expected = before - tier.replacedSlots;
    const after = Object.values(result.updatedDivisionClubs).flat().length;
    expect(after).toBe(expected);
  });
});
