/**
 * Phase 2 — Per-division promotion/relegation cascade tests.
 *
 * Goes beyond the single-helper coverage in promotionRelegation.test.ts by
 * exercising applyPromotionRelegation across full country pyramids and
 * asserting the cascading invariants the orchestration slice relies on:
 *
 *   - league sizes are preserved (within replacedSlots tolerance for bottom)
 *   - no club appears in two divisions after rollover
 *   - playerNewDivision tracks the player's club movement correctly
 *   - playoff winners only promote when there's a slot left
 *   - bottom-tier replacedSlots correctly removes clubs (but never the player's)
 *   - budget/reputation adjustments fire on actual moves
 *   - single-tier countries fall back gracefully
 */

import { describe, it, expect, vi } from 'vitest';

import { applyPromotionRelegation } from '@/utils/promotionRelegation';
import { LEAGUES, getLeaguesByCountry } from '@/data/league';

import {
  setupCountryPyramid,
  placeClubAt,
  withSeededRandom,
  findCountryWithTiers,
} from './helpers/seasonFixtures';

// ── Helpers ──────────────────────────────────────────────────────────────

function totalClubs(divisionClubs: Record<string, string[]>): number {
  return Object.values(divisionClubs).reduce((sum, ids) => sum + ids.length, 0);
}

function hasDuplicates(divisionClubs: Record<string, string[]>): boolean {
  const seen = new Set<string>();
  for (const ids of Object.values(divisionClubs)) {
    for (const id of ids) {
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  return false;
}

// ── Single-tier helpers (zone math) ──────────────────────────────────────

describe('applyPromotionRelegation — England pyramid (4 tiers)', () => {
  const COUNTRY = 'eng';

  it('preserves total club count minus bottom replacedSlots', () => {
    const setup = setupCountryPyramid(COUNTRY);
    const before = totalClubs(setup.divisionClubs);

    const result = withSeededRandom(42, () =>
      applyPromotionRelegation(
        COUNTRY,
        setup.divisionClubs,
        setup.divisionTables,
        setup.clubs,
        'no-such-player-club',
      ),
    );

    const after = totalClubs(result.updatedDivisionClubs);
    const bottomTier = setup.leagues[setup.leagues.length - 1];
    expect(after).toBe(before - bottomTier.replacedSlots);
  });

  it('never duplicates a club across divisions after rollover', () => {
    const setup = setupCountryPyramid(COUNTRY);

    const result = withSeededRandom(7, () =>
      applyPromotionRelegation(
        COUNTRY,
        setup.divisionClubs,
        setup.divisionTables,
        setup.clubs,
        'no-such-player-club',
      ),
    );

    expect(hasDuplicates(result.updatedDivisionClubs)).toBe(false);
  });

  it('keeps each tier at expected size (excluding pending bottom replacements)', () => {
    const setup = setupCountryPyramid(COUNTRY);

    const result = withSeededRandom(11, () =>
      applyPromotionRelegation(
        COUNTRY,
        setup.divisionClubs,
        setup.divisionTables,
        setup.clubs,
        'no-such-player-club',
      ),
    );

    const tiers = setup.leagues;
    const bottomId = tiers[tiers.length - 1].id;
    for (const tier of tiers) {
      const expected = tier.id === bottomId
        ? tier.teamCount - tier.replacedSlots
        : tier.teamCount;
      expect(result.updatedDivisionClubs[tier.id]).toHaveLength(expected);
    }
  });

  describe('Tier 1 (Premier League) — relegation only', () => {
    it('moves bottom 3 of eng down to eng-2', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const eng = LEAGUES.find(l => l.id === 'eng')!;
      const relegatedIds = setup.divisionTables.eng
        .slice(eng.teamCount - eng.relegationSpots)
        .map(e => e.clubId);

      const result = withSeededRandom(1, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      for (const id of relegatedIds) {
        expect(result.updatedDivisionClubs.eng).not.toContain(id);
        expect(result.updatedDivisionClubs['eng-2']).toContain(id);
        expect(result.updatedClubs[id].divisionId).toBe('eng-2');
      }
    });

    it('records turnover for both tiers', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const result = withSeededRandom(2, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );
      expect(result.turnovers.eng.relegatedClubs).toHaveLength(3);
      expect(result.turnovers.eng.promotedClubs).toHaveLength(3);
    });

    it('top-finishing club stays put', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const champion = setup.divisionTables.eng[0].clubId;

      const result = withSeededRandom(3, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );
      expect(result.updatedDivisionClubs.eng).toContain(champion);
      expect(result.updatedClubs[champion].divisionId).toBe('eng');
    });
  });

  describe('Tier 2 (Championship) — auto-promotion + playoffs', () => {
    it('auto-promotes top 2 of eng-2 to eng', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const autoPromoted = setup.divisionTables['eng-2']
        .slice(0, 2)
        .map(e => e.clubId);

      const result = withSeededRandom(4, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );
      for (const id of autoPromoted) {
        expect(result.updatedDivisionClubs.eng).toContain(id);
        expect(result.updatedClubs[id].divisionId).toBe('eng');
      }
    });

    it('exactly one playoff candidate (positions 3-6) wins promotion', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const playoffCandidates = setup.divisionTables['eng-2']
        .slice(2, 6)
        .map(e => e.clubId);

      const result = withSeededRandom(5, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      const promotedFromPlayoff = playoffCandidates.filter(id =>
        result.updatedDivisionClubs.eng.includes(id),
      );
      expect(promotedFromPlayoff).toHaveLength(1);
    });
  });

  describe('Tier 4 (League Two) — bottom-tier replacement', () => {
    it('removes exactly replacedSlots clubs from bottom tier', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const eng4 = LEAGUES.find(l => l.id === 'eng-4')!;
      const beforeIds = new Set(setup.divisionClubs['eng-4']);

      const result = withSeededRandom(6, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      const removed = [...beforeIds].filter(id =>
        !result.updatedDivisionClubs['eng-4'].includes(id) &&
        !Object.values(result.updatedDivisionClubs).flat().includes(id),
      );
      // Some bottom-tier clubs are auto-promoted to eng-3, so we count only
      // those that disappeared entirely. Should equal replacedSlots.
      expect(removed.length).toBe(eng4.replacedSlots);
      // Replaced clubs are deleted from the clubs record entirely.
      for (const id of removed) {
        expect(result.updatedClubs[id]).toBeUndefined();
      }
    });

    it('never replaces the player\'s club even if they finish bottom', () => {
      const PLAYER_ID = 'eng-4-club-24'; // last in default ordering
      const setup = setupCountryPyramid(COUNTRY);

      // The player-shielding path leaves the bottom tier one club short of
      // teamCount until orchestrationSlice fills it in — production code
      // logs a dev warning for that drift. Silence it for this test so
      // stderr stays clean.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = withSeededRandom(8, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          PLAYER_ID,
        ),
      );
      expect(result.updatedDivisionClubs['eng-4']).toContain(PLAYER_ID);
      expect(result.updatedClubs[PLAYER_ID]).toBeDefined();

      warnSpy.mockRestore();
    });
  });

  describe('Player-club perspective', () => {
    it('player in relegated club gets new (lower) division', () => {
      const PLAYER_ID = 'eng-club-1';
      // Place the player's club at the very bottom of eng (relegation zone).
      const setup = placeClubAt(
        setupCountryPyramid(COUNTRY),
        'eng',
        PLAYER_ID,
        19,
      );

      const result = withSeededRandom(9, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          PLAYER_ID,
        ),
      );
      expect(result.playerNewDivision).toBe('eng-2');
      expect(result.updatedClubs[PLAYER_ID].divisionId).toBe('eng-2');
    });

    it('player auto-promoted gets new (higher) division', () => {
      const PLAYER_ID = 'eng-2-club-1';
      // Default ordering puts club-1 first; that is auto-promotion territory.
      const setup = setupCountryPyramid(COUNTRY);

      const result = withSeededRandom(10, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          PLAYER_ID,
        ),
      );
      expect(result.playerNewDivision).toBe('eng');
      expect(result.updatedClubs[PLAYER_ID].divisionId).toBe('eng');
    });

    it('player in mid-table stays put (playerNewDivision is null)', () => {
      const PLAYER_ID = 'eng-club-10';
      // Force the player's club into a safe mid-table slot.
      const setup = placeClubAt(
        setupCountryPyramid(COUNTRY),
        'eng',
        PLAYER_ID,
        9,
      );

      const result = withSeededRandom(12, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          PLAYER_ID,
        ),
      );
      expect(result.playerNewDivision).toBeNull();
      expect(result.updatedClubs[PLAYER_ID].divisionId).toBe('eng');
      expect(result.updatedDivisionClubs.eng).toContain(PLAYER_ID);
    });
  });

  describe('Budget & reputation adjustments', () => {
    it('relegated club loses budget and reputation', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const relegatedId = setup.divisionTables.eng[19].clubId; // last
      const before = setup.clubs[relegatedId];

      const result = withSeededRandom(13, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      const after = result.updatedClubs[relegatedId];
      expect(after.budget).toBeLessThan(before.budget);
      expect(after.reputation).toBeLessThanOrEqual(before.reputation);
      // Reputation never drops below 1.
      expect(after.reputation).toBeGreaterThanOrEqual(1);
    });

    it('promoted club gains budget and reputation', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const promotedId = setup.divisionTables['eng-2'][0].clubId; // top
      const before = setup.clubs[promotedId];

      const result = withSeededRandom(14, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      const after = result.updatedClubs[promotedId];
      expect(after.budget).toBeGreaterThan(before.budget);
      expect(after.reputation).toBeGreaterThanOrEqual(before.reputation);
      // Reputation caps at 5.
      expect(after.reputation).toBeLessThanOrEqual(5);
    });

    it('mid-table club budget/reputation unchanged', () => {
      const setup = setupCountryPyramid(COUNTRY);
      const safeId = setup.divisionTables.eng[10].clubId;
      const before = setup.clubs[safeId];

      const result = withSeededRandom(15, () =>
        applyPromotionRelegation(
          COUNTRY,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      const after = result.updatedClubs[safeId];
      expect(after.budget).toBe(before.budget);
      expect(after.reputation).toBe(before.reputation);
    });
  });
});

// ── Multi-country generality ─────────────────────────────────────────────

describe('applyPromotionRelegation — generality across countries', () => {
  it('runs cleanly for every country with multiple tiers', () => {
    const countries = new Set(LEAGUES.map(l => l.countryId));
    for (const countryId of countries) {
      const tiers = getLeaguesByCountry(countryId);
      if (tiers.length < 2) continue;

      const setup = setupCountryPyramid(countryId);
      const before = totalClubs(setup.divisionClubs);

      const result = withSeededRandom(100, () =>
        applyPromotionRelegation(
          countryId,
          setup.divisionClubs,
          setup.divisionTables,
          setup.clubs,
          'no-such-player-club',
        ),
      );

      // Invariants that must hold for every multi-tier country.
      expect(hasDuplicates(result.updatedDivisionClubs)).toBe(false);
      const bottomTier = tiers[tiers.length - 1];
      const after = totalClubs(result.updatedDivisionClubs);
      expect(after).toBe(before - bottomTier.replacedSlots);
    }
  });
});

// ── Defensive cases ──────────────────────────────────────────────────────

describe('applyPromotionRelegation — defensive cases', () => {
  it('returns inputs unchanged for unknown country', () => {
    const result = applyPromotionRelegation(
      'no-such-country',
      { 'foo': ['a', 'b'] },
      { 'foo': [] },
      {},
      'a',
    );
    expect(result.updatedDivisionClubs).toEqual({ 'foo': ['a', 'b'] });
    expect(result.updatedClubs).toEqual({});
    expect(result.playerNewDivision).toBeNull();
    expect(result.turnovers).toEqual({});
  });

  it('skips tier pairs with empty tables (mid-migration save)', () => {
    const setup = setupCountryPyramid('eng');
    // Simulate a corrupt save where one division's table is missing.
    const damagedTables = { ...setup.divisionTables, 'eng-2': [] };

    const result = withSeededRandom(50, () =>
      applyPromotionRelegation(
        'eng',
        setup.divisionClubs,
        damagedTables,
        setup.clubs,
        'no-such-player-club',
      ),
    );

    // eng <-> eng-2 pair is skipped entirely, so eng keeps all its clubs.
    expect(result.updatedDivisionClubs.eng).toHaveLength(20);
    // eng-3 <-> eng-4 pair still runs because both tables are present.
    expect(result.turnovers['eng-3']).toBeDefined();
  });

  it('handles single-tier country (e.g. country with only one division)', () => {
    // Find a country with exactly one tier; if none exist we skip.
    const single = findCountryWithTiers(1);
    if (!single) {
      // Nothing to test against — note it explicitly.
      return;
    }
    const setup = setupCountryPyramid(single);
    const result = applyPromotionRelegation(
      single,
      setup.divisionClubs,
      setup.divisionTables,
      setup.clubs,
      'no-such-player-club',
    );
    // Single-tier countries should pass through with no movement.
    expect(result.playerNewDivision).toBeNull();
    // Bottom tier may still trigger replacements if replacedSlots > 0.
    const tier = setup.leagues[0];
    const expectedAfter = tier.teamCount - tier.replacedSlots;
    expect(result.updatedDivisionClubs[tier.id]).toHaveLength(expectedAfter);
  });
});
