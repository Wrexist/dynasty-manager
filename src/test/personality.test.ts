import { describe, it, expect } from 'vitest';
import { generatePersonality, getPersonalityLabel, getTrainingMultiplier, getDevelopmentMultiplier, getCardRiskMultiplier, getMoraleStability, getLeadershipBonus, wantsTransfer } from '@/utils/personality';
import { generatePlayer } from '@/utils/playerGen';

describe('personality', () => {
  describe('generatePersonality', () => {
    it('should generate all traits in 1-20 range', () => {
      for (let i = 0; i < 50; i++) {
        const p = generatePersonality();
        for (const val of Object.values(p)) {
          expect(val).toBeGreaterThanOrEqual(1);
          expect(val).toBeLessThanOrEqual(20);
        }
      }
    });

    it('should have all five traits', () => {
      const p = generatePersonality();
      expect(p).toHaveProperty('professionalism');
      expect(p).toHaveProperty('ambition');
      expect(p).toHaveProperty('temperament');
      expect(p).toHaveProperty('loyalty');
      expect(p).toHaveProperty('leadership');
    });
  });

  describe('getPersonalityLabel', () => {
    it('should return Model Professional for high professionalism + temperament', () => {
      expect(getPersonalityLabel({ professionalism: 17, ambition: 10, temperament: 15, loyalty: 10, leadership: 10 })).toBe('Model Professional');
    });

    it('should return Born Leader for high leadership + professionalism', () => {
      expect(getPersonalityLabel({ professionalism: 13, ambition: 10, temperament: 10, loyalty: 10, leadership: 17 })).toBe('Born Leader');
    });

    it('should return Hot Head for low temperament', () => {
      expect(getPersonalityLabel({ professionalism: 10, ambition: 10, temperament: 5, loyalty: 10, leadership: 10 })).toBe('Hot Head');
    });

    it('should return Determined as fallback', () => {
      expect(getPersonalityLabel({ professionalism: 12, ambition: 12, temperament: 12, loyalty: 12, leadership: 12 })).toBe('Determined');
    });
  });

  describe('multiplier functions', () => {
    it('getTrainingMultiplier should return 1.0 for no personality', () => {
      expect(getTrainingMultiplier()).toBe(1.0);
    });

    it('getTrainingMultiplier should scale with professionalism', () => {
      const low = getTrainingMultiplier({ professionalism: 4, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 });
      const high = getTrainingMultiplier({ professionalism: 17, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 });
      expect(high).toBeGreaterThan(low);
      expect(low).toBeGreaterThanOrEqual(0.7);
      expect(high).toBeLessThanOrEqual(1.3);
    });

    it('getDevelopmentMultiplier should scale with ambition', () => {
      const low = getDevelopmentMultiplier({ professionalism: 10, ambition: 4, temperament: 10, loyalty: 10, leadership: 10 });
      const high = getDevelopmentMultiplier({ professionalism: 10, ambition: 17, temperament: 10, loyalty: 10, leadership: 10 });
      expect(high).toBeGreaterThan(low);
    });

    it('getCardRiskMultiplier should be higher for low temperament', () => {
      const calm = getCardRiskMultiplier({ professionalism: 10, ambition: 10, temperament: 17, loyalty: 10, leadership: 10 });
      const hotHead = getCardRiskMultiplier({ professionalism: 10, ambition: 10, temperament: 4, loyalty: 10, leadership: 10 });
      expect(hotHead).toBeGreaterThan(calm);
    });

    it('getMoraleStability should return 1.0 for no personality', () => {
      expect(getMoraleStability()).toBe(1.0);
    });

    it('getLeadershipBonus should return 0 for low leadership', () => {
      expect(getLeadershipBonus({ professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 })).toBe(0);
    });

    it('getLeadershipBonus should return positive for high leadership', () => {
      const bonus = getLeadershipBonus({ professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 16 });
      expect(bonus).toBeGreaterThan(0);
      expect(bonus).toBeLessThanOrEqual(0.15);
    });
  });

  describe('wantsTransfer', () => {
    it('should return false when no personality', () => {
      const player = generatePlayer('ST', 80, 'club-1', 1);
      delete (player as unknown as Record<string, unknown>).personality;
      expect(wantsTransfer(player, 3)).toBe(false);
    });

    it('should return false for loyal players', () => {
      const player = generatePlayer('ST', 80, 'club-1', 1);
      player.personality = { professionalism: 10, ambition: 16, temperament: 10, loyalty: 15, leadership: 10 };
      expect(wantsTransfer(player, 3)).toBe(false);
    });

    it('should return false for low-ambition players', () => {
      const player = generatePlayer('ST', 80, 'club-1', 1);
      player.personality = { professionalism: 10, ambition: 10, temperament: 10, loyalty: 8, leadership: 10 };
      expect(wantsTransfer(player, 3)).toBe(false);
    });

    it('should return false when player overall is below club threshold', () => {
      const player = generatePlayer('ST', 40, 'club-1', 1);
      player.overall = 40;
      player.personality = { professionalism: 10, ambition: 17, temperament: 10, loyalty: 5, leadership: 10 };
      // clubRep 5 => threshold = 5*12+15 = 75. overall 40 < 75
      expect(wantsTransfer(player, 5)).toBe(false);
    });

    it('should almost never trigger for happy players (morale >= 70)', () => {
      // Run 500 trials: with morale 80 the chance is multiplied by 0.15
      // Base: (18-2)*0.02 = 0.32, dampened: 0.32 * 0.15 = 0.048
      let triggers = 0;
      for (let i = 0; i < 500; i++) {
        const player = generatePlayer('ST', 80, 'club-1', 1);
        player.overall = 80;
        player.morale = 80;
        player.personality = { professionalism: 10, ambition: 18, temperament: 10, loyalty: 2, leadership: 10 };
        if (wantsTransfer(player, 3)) triggers++;
      }
      // Expect far fewer than the ~160 (32%) we'd get without dampening
      expect(triggers).toBeLessThan(60);
    });

    it('should have reduced chance for content players (morale 50-69)', () => {
      // With morale 55, chance is multiplied by 0.4
      // Base: (18-2)*0.02 = 0.32, dampened: 0.32 * 0.4 = 0.128
      let triggers = 0;
      for (let i = 0; i < 500; i++) {
        const player = generatePlayer('ST', 80, 'club-1', 1);
        player.overall = 80;
        player.morale = 55;
        player.personality = { professionalism: 10, ambition: 18, temperament: 10, loyalty: 2, leadership: 10 };
        if (wantsTransfer(player, 3)) triggers++;
      }
      // ~64 expected (12.8%) — should be notably less than undampened ~160
      expect(triggers).toBeLessThan(120);
      expect(triggers).toBeGreaterThan(10);
    });

    it('should apply full base chance for unhappy players (morale < 50)', () => {
      // With morale 30, no dampening applies
      // Base: (18-2)*0.02 = 0.32
      let triggers = 0;
      for (let i = 0; i < 500; i++) {
        const player = generatePlayer('ST', 80, 'club-1', 1);
        player.overall = 80;
        player.morale = 30;
        player.personality = { professionalism: 10, ambition: 18, temperament: 10, loyalty: 2, leadership: 10 };
        if (wantsTransfer(player, 3)) triggers++;
      }
      // Expect around 160 (32%) — full base rate
      expect(triggers).toBeGreaterThan(100);
    });
  });
});
