import { describe, it, expect } from 'vitest';
import { generateCupDraw, advanceCupRound, getCupResultForClub, getRoundName } from '@/data/cup';

function makeClubIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `club-${i + 1}`);
}

describe('cup', () => {
  describe('generateCupDraw', () => {
    it('should generate 10 ties from 20 clubs', () => {
      const ids = makeClubIds(20);
      const cup = generateCupDraw(ids);
      expect(cup.ties).toHaveLength(10);
      expect(cup.currentRound).toBe('R1');
      expect(cup.eliminated).toBe(false);
      expect(cup.winner).toBeNull();
    });

    it('should include all clubs exactly once', () => {
      const ids = makeClubIds(20);
      const cup = generateCupDraw(ids);
      const allClubs = cup.ties.flatMap(t => [t.homeClubId, t.awayClubId]);
      expect(new Set(allClubs).size).toBe(20);
    });

    it('should set all ties to R1 round', () => {
      const ids = makeClubIds(20);
      const cup = generateCupDraw(ids);
      expect(cup.ties.every(t => t.round === 'R1')).toBe(true);
    });
  });

  describe('advanceCupRound', () => {
    it('should create next round ties from winners', () => {
      const ids = makeClubIds(20);
      const cup = generateCupDraw(ids);
      // Mark all R1 ties as played with home winning
      cup.ties.forEach(t => { t.played = true; t.homeGoals = 2; t.awayGoals = 1; });
      const advanced = advanceCupRound(cup);
      expect(advanced.currentRound).toBe('R2');
      const r2Ties = advanced.ties.filter(t => t.round === 'R2');
      expect(r2Ties).toHaveLength(5);
    });

    it('should not advance past final', () => {
      const cup = { ties: [], currentRound: 'F' as const, eliminated: false, winner: null };
      const result = advanceCupRound(cup);
      expect(result.currentRound).toBe('F');
    });
  });

  describe('getCupResultForClub', () => {
    it('should return Winner for cup winner', () => {
      const cup = { ties: [], currentRound: null, eliminated: false, winner: 'club-1' };
      expect(getCupResultForClub(cup, 'club-1')).toBe('Winner');
    });

    it('should return round name for eliminated club', () => {
      const cup = {
        ties: [{
          id: '1', round: 'QF' as const, homeClubId: 'club-1', awayClubId: 'club-2',
          played: true, homeGoals: 0, awayGoals: 2, week: 14,
        }],
        currentRound: 'SF' as const, eliminated: true, winner: null,
      };
      expect(getCupResultForClub(cup, 'club-1')).toBe('Quarter-Finals');
    });

    it('should return "Did not enter" for unknown club', () => {
      const cup = { ties: [], currentRound: 'R1' as const, eliminated: false, winner: null };
      expect(getCupResultForClub(cup, 'unknown')).toBe('Did not enter');
    });
  });

  describe('getRoundName', () => {
    it('should return correct names', () => {
      expect(getRoundName('R1')).toBe('Round 1');
      expect(getRoundName('QF')).toBe('Quarter-Finals');
      expect(getRoundName('SF')).toBe('Semi-Finals');
      expect(getRoundName('F')).toBe('Final');
    });
  });
});
