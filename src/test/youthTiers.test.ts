import { describe, it, expect } from 'vitest';
import { getYouthTierDevMultiplier, promoteYouthTier, inferYouthTier, generateYouthProspects } from '@/utils/youth';
import type { Player, YouthProspect } from '@/types/game';

function makePlayer(age: number, overall: number): Player {
  return {
    id: 'p',
    firstName: 'T',
    lastName: 'P',
    age,
    nationality: 'England',
    position: 'CM',
    attributes: { pace: 60, shooting: 55, passing: 60, defending: 55, physical: 55, mental: 60 },
    overall,
    potential: overall + 15,
    clubId: 'club',
    wage: 500,
    value: 500_000,
    contractEnd: 3,
    fitness: 100,
    morale: 75,
    form: 70,
    injured: false,
    injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
  } as Player;
}

function makeProspect(tier: YouthProspect['tier'], overrides: Partial<YouthProspect> = {}): YouthProspect {
  return {
    playerId: 'p',
    readyToPromote: false,
    developmentScore: 20,
    tier,
    ...overrides,
  };
}

describe('youthTiers', () => {
  describe('getYouthTierDevMultiplier', () => {
    it('U21 is fastest (1.15x)', () => {
      expect(getYouthTierDevMultiplier('u21')).toBeCloseTo(1.15);
    });
    it('U18 is baseline (1.0x)', () => {
      expect(getYouthTierDevMultiplier('u18')).toBe(1.0);
    });
    it('B-team is slower (0.90x)', () => {
      expect(getYouthTierDevMultiplier('bteam')).toBeCloseTo(0.90);
    });
    it('Undefined tier defaults to U18', () => {
      expect(getYouthTierDevMultiplier(undefined)).toBe(1.0);
    });
  });

  describe('promoteYouthTier', () => {
    it('U18 → U21 when age ≥ 18', () => {
      const prospect = makeProspect('u18');
      const player = makePlayer(18, 50);
      expect(promoteYouthTier(prospect, player).tier).toBe('u21');
    });

    it('U18 → U21 when overall ≥ 58', () => {
      const prospect = makeProspect('u18');
      const player = makePlayer(17, 60);
      expect(promoteYouthTier(prospect, player).tier).toBe('u21');
    });

    it('U18 stays U18 when neither threshold met', () => {
      const prospect = makeProspect('u18');
      const player = makePlayer(17, 50);
      expect(promoteYouthTier(prospect, player).tier).toBe('u18');
    });

    it('U21 → B-Team when age ≥ 20', () => {
      const prospect = makeProspect('u21');
      const player = makePlayer(20, 60);
      expect(promoteYouthTier(prospect, player).tier).toBe('bteam');
    });

    it('U21 → B-Team when overall ≥ 65', () => {
      const prospect = makeProspect('u21');
      const player = makePlayer(19, 68);
      expect(promoteYouthTier(prospect, player).tier).toBe('bteam');
    });

    it('B-Team stays B-Team (top of pyramid)', () => {
      const prospect = makeProspect('bteam');
      const player = makePlayer(22, 75);
      expect(promoteYouthTier(prospect, player).tier).toBe('bteam');
    });

    it('Returns same reference when no promotion occurs', () => {
      const prospect = makeProspect('u18');
      const player = makePlayer(16, 48);
      expect(promoteYouthTier(prospect, player)).toBe(prospect);
    });

    it('Handles missing player reference gracefully', () => {
      const prospect = makeProspect('u18');
      expect(promoteYouthTier(prospect, undefined)).toBe(prospect);
    });
  });

  describe('inferYouthTier', () => {
    it('infers U18 for young inexperienced prospect', () => {
      expect(inferYouthTier(makePlayer(16, 45))).toBe('u18');
    });

    it('infers U21 for mid-tier prospect', () => {
      expect(inferYouthTier(makePlayer(18, 55))).toBe('u21');
    });

    it('infers B-Team for advanced prospect', () => {
      expect(inferYouthTier(makePlayer(20, 70))).toBe('bteam');
    });

    it('defaults to U18 when no player data', () => {
      expect(inferYouthTier(undefined)).toBe('u18');
    });
  });

  describe('generateYouthProspects', () => {
    it('newly generated prospects start at U18', () => {
      const { prospects } = generateYouthProspects('club1', 5, 3, 1, 5);
      for (const p of prospects) {
        expect(p.tier).toBe('u18');
      }
    });
  });
});
