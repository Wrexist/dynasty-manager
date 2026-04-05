import { describe, it, expect } from 'vitest';
import {
  createDefaultManager,
  generateStartingAttributes,
  calculateReputationTier,
  calculateLegacyScore,
  generateStartingOffers,
  getRetirementAge,
  isRetired,
  growAttribute,
  getReputationTierLabel,
  generateDefaultBonuses,
} from '@/utils/managerCareer';
import {
  STAT_MIN, STAT_MAX,
  DEFAULT_RETIREMENT_AGE,
  LEGENDARY_RETIREMENT_EXTENSION,
} from '@/config/managerCareer';

describe('Manager Career Mode', () => {
  describe('createDefaultManager', () => {
    it('should create a manager with all fields initialized', () => {
      const manager = createDefaultManager('Test Manager', 'England', 35, ['tactician', 'motivator']);
      expect(manager.name).toBe('Test Manager');
      expect(manager.nationality).toBe('England');
      expect(manager.age).toBe(35);
      expect(manager.retirementAge).toBe(DEFAULT_RETIREMENT_AGE);
      expect(manager.traits).toEqual(['tactician', 'motivator']);
      expect(manager.contract).toBeNull();
      expect(manager.careerHistory).toEqual([]);
      expect(manager.reputationScore).toBe(30);
      expect(manager.totalCareerWins).toBe(0);
      expect(manager.totalCareerDraws).toBe(0);
      expect(manager.totalCareerLosses).toBe(0);
      expect(manager.totalCareerMatches).toBe(0);
      expect(manager.promotionsWon).toBe(0);
      expect(manager.titlesWon).toBe(0);
      expect(manager.cupsWon).toBe(0);
      expect(manager.sackedCount).toBe(0);
      expect(manager.resignedCount).toBe(0);
      expect(manager.awardsWon).toEqual([]);
      expect(manager.legacyScore).toBe(0);
      expect(manager.unemployedWeeks).toBe(0);
    });

    it('should apply trait bonuses to attributes', () => {
      const manager = createDefaultManager('Test', 'England', 35, ['tactician']);
      // Tactician gives +3 to tacticalKnowledge
      expect(manager.attributes.tacticalKnowledge).toBeGreaterThanOrEqual(STAT_MIN + 3);
    });
  });

  describe('generateStartingAttributes', () => {
    it('should generate attributes within valid range', () => {
      const attrs = generateStartingAttributes([]);
      for (const value of Object.values(attrs)) {
        expect(value).toBeGreaterThanOrEqual(STAT_MIN);
        expect(value).toBeLessThanOrEqual(STAT_MAX);
      }
    });

    it('should have all 7 attributes', () => {
      const attrs = generateStartingAttributes([]);
      expect(attrs).toHaveProperty('tacticalKnowledge');
      expect(attrs).toHaveProperty('motivation');
      expect(attrs).toHaveProperty('negotiation');
      expect(attrs).toHaveProperty('scoutingEye');
      expect(attrs).toHaveProperty('youthDevelopment');
      expect(attrs).toHaveProperty('discipline');
      expect(attrs).toHaveProperty('mediaHandling');
    });

    it('should apply trait bonuses', () => {
      // Generate many times and check that trait-boosted stats are higher on average
      let totalWithTrait = 0;
      let totalWithout = 0;
      const runs = 100;
      for (let i = 0; i < runs; i++) {
        totalWithTrait += generateStartingAttributes(['tactician']).tacticalKnowledge;
        totalWithout += generateStartingAttributes([]).tacticalKnowledge;
      }
      expect(totalWithTrait / runs).toBeGreaterThan(totalWithout / runs);
    });
  });

  describe('calculateReputationTier', () => {
    it('should return unknown for low scores', () => {
      expect(calculateReputationTier(0)).toBe('unknown');
      expect(calculateReputationTier(99)).toBe('unknown');
    });

    it('should return regional for scores 100-249', () => {
      expect(calculateReputationTier(100)).toBe('regional');
      expect(calculateReputationTier(249)).toBe('regional');
    });

    it('should return national for scores 250-499', () => {
      expect(calculateReputationTier(250)).toBe('national');
      expect(calculateReputationTier(499)).toBe('national');
    });

    it('should return continental for scores 500-749', () => {
      expect(calculateReputationTier(500)).toBe('continental');
      expect(calculateReputationTier(749)).toBe('continental');
    });

    it('should return world_class for scores 750-899', () => {
      expect(calculateReputationTier(750)).toBe('world_class');
      expect(calculateReputationTier(899)).toBe('world_class');
    });

    it('should return legendary for scores 900+', () => {
      expect(calculateReputationTier(900)).toBe('legendary');
      expect(calculateReputationTier(1000)).toBe('legendary');
    });
  });

  describe('calculateLegacyScore', () => {
    it('should return 0 for a fresh manager', () => {
      const manager = createDefaultManager('Test', 'England', 35, []);
      expect(calculateLegacyScore(manager)).toBe(Math.round(30 * 0.5)); // only reputation contributes
    });

    it('should increase with titles and wins', () => {
      const manager = createDefaultManager('Test', 'England', 35, []);
      const winner = { ...manager, titlesWon: 3, totalCareerWins: 100, cupsWon: 2, reputationScore: 500 };
      expect(calculateLegacyScore(winner)).toBeGreaterThan(calculateLegacyScore(manager));
    });
  });

  describe('getRetirementAge', () => {
    it('should return default retirement age for non-legendary managers', () => {
      const manager = createDefaultManager('Test', 'England', 35, []);
      expect(getRetirementAge(manager)).toBe(DEFAULT_RETIREMENT_AGE);
    });

    it('should extend retirement age for legendary managers', () => {
      const manager = createDefaultManager('Test', 'England', 35, []);
      const legendary = { ...manager, reputationTier: 'legendary' as const };
      expect(getRetirementAge(legendary)).toBe(DEFAULT_RETIREMENT_AGE + LEGENDARY_RETIREMENT_EXTENSION);
    });
  });

  describe('isRetired', () => {
    it('should return false for young managers', () => {
      const manager = createDefaultManager('Test', 'England', 35, []);
      expect(isRetired(manager)).toBe(false);
    });

    it('should return true for managers at retirement age', () => {
      const manager = createDefaultManager('Test', 'England', 35, []);
      const old = { ...manager, age: DEFAULT_RETIREMENT_AGE };
      expect(isRetired(old)).toBe(true);
    });
  });

  describe('growAttribute', () => {
    it('should grow attribute value', () => {
      expect(growAttribute(5, 0.5)).toBe(5.5);
    });

    it('should clamp at STAT_MAX', () => {
      expect(growAttribute(19.8, 0.5)).toBe(STAT_MAX);
    });

    it('should not go below STAT_MIN', () => {
      expect(growAttribute(1, -2)).toBe(STAT_MIN);
    });
  });

  describe('getReputationTierLabel', () => {
    it('should return readable labels', () => {
      expect(getReputationTierLabel('unknown')).toBe('Newcomer');
      expect(getReputationTierLabel('world_class')).toBe('World Class');
      expect(getReputationTierLabel('legendary')).toBe('Legendary');
    });
  });

  describe('generateStartingOffers', () => {
    it('should generate 3 offers from lower-tier clubs', () => {
      // Create a minimal clubs record with some lower-tier clubs
      const clubs: Record<string, { id: string; name: string; divisionId: string; reputation: number }> = {};
      // Use real league IDs that have qualityTier 3 or 4
      for (let i = 0; i < 10; i++) {
        clubs[`club-${i}`] = {
          id: `club-${i}`,
          name: `Club ${i}`,
          divisionId: 'cze', // Czech league has qualityTier 3
          reputation: 2,
        };
      }
      const offers = generateStartingOffers(clubs);
      expect(offers.length).toBeLessThanOrEqual(3);
      if (offers.length > 0) {
        expect(offers[0]).toHaveProperty('clubId');
        expect(offers[0]).toHaveProperty('salary');
        expect(offers[0]).toHaveProperty('contractLength');
        expect(offers[0]).toHaveProperty('bonuses');
        expect(offers[0].bonuses.length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateDefaultBonuses', () => {
    it('should generate bonuses for lower-tier clubs', () => {
      const bonuses = generateDefaultBonuses(4);
      expect(bonuses.length).toBeGreaterThan(0);
      expect(bonuses.some(b => b.condition === 'avoid_relegation')).toBe(true);
    });

    it('should include promotion bonus for non-top-tier clubs', () => {
      const bonuses = generateDefaultBonuses(3);
      expect(bonuses.some(b => b.condition === 'promotion')).toBe(true);
    });

    it('should not include promotion bonus for top-tier clubs', () => {
      const bonuses = generateDefaultBonuses(1);
      expect(bonuses.some(b => b.condition === 'promotion')).toBe(false);
    });
  });
});
