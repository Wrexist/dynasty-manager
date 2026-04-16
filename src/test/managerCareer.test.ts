import { describe, it, expect } from 'vitest';
import {
  createDefaultManager,
  generateStartingAttributes,
  generateBaseAttributes,
  applyTraitBonuses,
  calculateReputationTier,
  calculateLegacyScore,
  generateStartingOffers,
  getRetirementAge,
  isRetired,
  growAttribute,
  getReputationTierLabel,
  generateDefaultBonuses,
  generateCompetitors,
  selectPitchQuestions,
  calculateInterviewResult,
  negotiateContract,
} from '@/utils/managerCareer';
import {
  STAT_MIN, STAT_MAX,
  STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX,
  DEFAULT_RETIREMENT_AGE,
  LEGENDARY_RETIREMENT_EXTENSION,
  INTERVIEW_PITCH_QUESTIONS,
  BOARD_TOLERANCE_START,
  BOARD_TOLERANCE_DECAY_PER_ROUND,
} from '@/config/managerCareer';
import type { JobOffer, CompetingCandidate } from '@/types/game';

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

  describe('generateBaseAttributes', () => {
    it('should generate all 7 attributes within starting range', () => {
      const attrs = generateBaseAttributes();
      for (const value of Object.values(attrs)) {
        expect(value).toBeGreaterThanOrEqual(STARTING_ATTRIBUTE_MIN);
        expect(value).toBeLessThanOrEqual(STARTING_ATTRIBUTE_MAX);
      }
    });

    it('should have all 7 attribute keys', () => {
      const attrs = generateBaseAttributes();
      expect(Object.keys(attrs)).toHaveLength(7);
      expect(attrs).toHaveProperty('tacticalKnowledge');
      expect(attrs).toHaveProperty('motivation');
      expect(attrs).toHaveProperty('negotiation');
      expect(attrs).toHaveProperty('scoutingEye');
      expect(attrs).toHaveProperty('youthDevelopment');
      expect(attrs).toHaveProperty('discipline');
      expect(attrs).toHaveProperty('mediaHandling');
    });
  });

  describe('applyTraitBonuses', () => {
    const fixedBase = {
      tacticalKnowledge: 5,
      motivation: 5,
      negotiation: 5,
      scoutingEye: 5,
      youthDevelopment: 5,
      discipline: 5,
      mediaHandling: 5,
    };

    it('should be deterministic — same base + same traits = same result', () => {
      const a = applyTraitBonuses(fixedBase, ['tactician', 'motivator']);
      const b = applyTraitBonuses(fixedBase, ['tactician', 'motivator']);
      expect(a).toEqual(b);
    });

    it('should apply single-trait bonus correctly', () => {
      const result = applyTraitBonuses(fixedBase, ['tactician']);
      expect(result.tacticalKnowledge).toBe(8); // 5 + 3
      expect(result.motivation).toBe(5); // unchanged
    });

    it('should stack multiple trait bonuses', () => {
      const result = applyTraitBonuses(fixedBase, ['tactician', 'motivator']);
      expect(result.tacticalKnowledge).toBe(8); // 5 + 3
      expect(result.motivation).toBe(8); // 5 + 3
    });

    it('should handle multi-attribute traits (fitness_fanatic)', () => {
      const result = applyTraitBonuses(fixedBase, ['fitness_fanatic']);
      expect(result.discipline).toBe(7); // 5 + 2
      expect(result.motivation).toBe(6); // 5 + 1
    });

    it('should clamp at STAT_MAX (20)', () => {
      const highBase = { ...fixedBase, tacticalKnowledge: 19 };
      const result = applyTraitBonuses(highBase, ['tactician']);
      expect(result.tacticalKnowledge).toBe(STAT_MAX); // 19 + 3 clamped to 20
    });

    it('should not mutate the input base', () => {
      const base = { ...fixedBase };
      applyTraitBonuses(base, ['tactician']);
      expect(base.tacticalKnowledge).toBe(5);
    });

    it('should return base unchanged when no traits given', () => {
      const result = applyTraitBonuses(fixedBase, []);
      expect(result).toEqual(fixedBase);
    });
  });

  describe('createDefaultManager with precomputed attributes', () => {
    it('should use precomputed attributes instead of generating new ones', () => {
      const attrs = {
        tacticalKnowledge: 10,
        motivation: 10,
        negotiation: 10,
        scoutingEye: 10,
        youthDevelopment: 10,
        discipline: 10,
        mediaHandling: 10,
      };
      const manager = createDefaultManager('Test', 'England', 35, [], undefined, attrs);
      expect(manager.attributes).toEqual(attrs);
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

  // ── Interview System Tests ──

  describe('generateCompetitors', () => {
    it('should return 1-3 competitors', () => {
      for (let i = 0; i < 20; i++) {
        const competitors = generateCompetitors(200, 3);
        expect(competitors.length).toBeGreaterThanOrEqual(1);
        expect(competitors.length).toBeLessThanOrEqual(3);
      }
    });

    it('should generate competitors with valid fields', () => {
      const competitors = generateCompetitors(200, 3);
      for (const c of competitors) {
        expect(c.name).toBeTruthy();
        expect(c.name.includes(' ')).toBe(true); // first + last name
        expect(c.reputationScore).toBeGreaterThanOrEqual(0);
        expect(c.strength).toBeGreaterThanOrEqual(0);
        expect(c.strength).toBeLessThanOrEqual(1);
        expect(['unknown', 'regional', 'national', 'continental', 'world_class', 'legendary']).toContain(c.reputationTier);
        expect(c.previousClub).toBeTruthy();
      }
    });

    it('should generate unique names', () => {
      // Run many times to check deduplication
      for (let i = 0; i < 30; i++) {
        const competitors = generateCompetitors(200, 3);
        const names = competitors.map(c => c.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
      }
    });
  });

  describe('selectPitchQuestions', () => {
    it('should return exactly INTERVIEW_PITCH_QUESTIONS questions', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const questions = selectPitchQuestions(tier as 1 | 2 | 3 | 4);
        expect(questions.length).toBe(INTERVIEW_PITCH_QUESTIONS);
      }
    });

    it('should return questions from different contexts', () => {
      const questions = selectPitchQuestions(2);
      const contexts = questions.map(q => q.context);
      const unique = new Set(contexts);
      expect(unique.size).toBe(questions.length); // all different
    });

    it('should provide 4 options per question', () => {
      const questions = selectPitchQuestions(3);
      for (const q of questions) {
        expect(q.options.length).toBe(4);
        const tones = q.options.map(o => o.tone);
        expect(tones).toContain('ambitious');
        expect(tones).toContain('pragmatic');
        expect(tones).toContain('developmental');
        expect(tones).toContain('defensive');
      }
    });

    it('should assign unique IDs to each question', () => {
      const questions = selectPitchQuestions(1);
      const ids = questions.map(q => q.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  describe('calculateInterviewResult', () => {
    const strongCompetitors: CompetingCandidate[] = [
      { name: 'Strong Rival', reputationTier: 'continental', reputationScore: 500, previousClub: 'Big FC', strength: 0.9 },
    ];
    const weakCompetitors: CompetingCandidate[] = [
      { name: 'Weak Rival', reputationTier: 'unknown', reputationScore: 20, previousClub: 'Small FC', strength: 0.1 },
    ];

    it('should always hire with very high pitch score', () => {
      // pitchScore 83, rep 500, vacancy 200 → finalScore well above 70
      const result = calculateInterviewResult(83, 500, 200, weakCompetitors);
      expect(result.hired).toBe(true);
    });

    it('should reject with very low pitch score and strong competitors', () => {
      // pitchScore 52, rep 50, vacancy 300 → low final score
      const result = calculateInterviewResult(52, 50, 300, strongCompetitors);
      expect(result.hired).toBe(false);
    });

    it('should include competitor name in rejection message', () => {
      const result = calculateInterviewResult(52, 50, 300, strongCompetitors);
      expect(result.message).toContain('Strong Rival');
    });

    it('should handle empty competitors', () => {
      const result = calculateInterviewResult(70, 400, 200, []);
      // With no competitors, should hire easily at high score
      expect(result.hired).toBe(true);
    });

    it('should produce probabilistic results in the threshold zone', () => {
      // Run many times with score in the 55-70 zone to verify probability
      let hires = 0;
      const runs = 100;
      for (let i = 0; i < runs; i++) {
        const result = calculateInterviewResult(58, 200, 200, weakCompetitors);
        if (result.hired) hires++;
      }
      // Should be probabilistic — not always hired or always rejected
      expect(hires).toBeGreaterThan(0);
      expect(hires).toBeLessThan(runs);
    });
  });

  describe('negotiateContract', () => {
    const baseOffer: JobOffer = {
      id: 'test-offer',
      clubId: 'club-1',
      clubName: 'Test FC',
      divisionId: 'eng-4',
      salary: 5000,
      contractLength: 2,
      bonuses: [
        { condition: 'promotion', amount: 25000, met: false },
        { condition: 'avoid_relegation', amount: 10000, met: false },
      ],
      boardExpectations: 'Push for promotion',
      expiresWeek: 10,
      expiresSeason: 1,
      initialSalary: 5000,
      initialContractLength: 2,
      negotiationRound: 0,
      negotiationStatus: 'pending',
      boardTolerance: BOARD_TOLERANCE_START,
      boardPatience: 5,
    };

    it('should return unchanged offer if status is already final', () => {
      const finalOffer = { ...baseOffer, negotiationStatus: 'final' as const };
      const result = negotiateContract(finalOffer, 7000, 3, finalOffer.bonuses, 10);
      expect(result).toBe(finalOffer); // Same reference, not modified
    });

    it('should return unchanged offer if status is already accepted', () => {
      const acceptedOffer = { ...baseOffer, negotiationStatus: 'accepted' as const };
      const result = negotiateContract(acceptedOffer, 7000, 3, acceptedOffer.bonuses, 10);
      expect(result).toBe(acceptedOffer);
    });

    it('should increment negotiation round', () => {
      const result = negotiateContract(baseOffer, 5500, 2, baseOffer.bonuses, 10);
      expect(result.negotiationRound).toBe(1);
    });

    it('should decay board tolerance each round', () => {
      const result = negotiateContract(baseOffer, 5500, 2, baseOffer.bonuses, 10);
      expect(result.boardTolerance).toBe(BOARD_TOLERANCE_START - BOARD_TOLERANCE_DECAY_PER_ROUND);
    });

    it('should return final status when max rounds exceeded', () => {
      const maxRoundsOffer = { ...baseOffer, negotiationRound: 3 };
      const result = negotiateContract(maxRoundsOffer, 7000, 3, maxRoundsOffer.bonuses, 10);
      expect(result.negotiationStatus).toBe('final');
    });

    it('should not go below 0 board tolerance', () => {
      const lowToleranceOffer = { ...baseOffer, boardTolerance: 5 };
      const result = negotiateContract(lowToleranceOffer, 5500, 2, lowToleranceOffer.bonuses, 10);
      expect(result.boardTolerance).toBeGreaterThanOrEqual(0);
    });

    it('should produce a result with valid negotiation status', () => {
      const result = negotiateContract(baseOffer, 6000, 3, baseOffer.bonuses, 5);
      expect(['pending', 'accepted', 'final']).toContain(result.negotiationStatus);
    });
  });
});
