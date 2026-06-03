import { describe, it, expect } from 'vitest';
import { generateCupDraw, advanceCupRound, getCupResultForClub, getRoundName, CUP_BYE_MARKER } from '@/data/cup';

function makeClubIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `club-${i + 1}`);
}

describe('cup', () => {
  describe('generateCupDraw', () => {
    it('seeds a 20-club field into a clean bracket via a preliminary round', () => {
      const cup = generateCupDraw(makeClubIds(20));
      // 20 → largest power of two is 16: 4 played ties + 12 byes → 16 clubs.
      expect(cup.currentRound).toBe('R3');
      expect(cup.ties.filter(t => t.awayClubId !== CUP_BYE_MARKER)).toHaveLength(4);
      expect(cup.ties.filter(t => t.awayClubId === CUP_BYE_MARKER)).toHaveLength(12);
      expect(cup.eliminated).toBe(false);
      expect(cup.winner).toBeNull();
    });

    it('should include all clubs exactly once', () => {
      const cup = generateCupDraw(makeClubIds(20));
      const allClubs = cup.ties
        .flatMap(t => [t.homeClubId, t.awayClubId])
        .filter(id => id !== CUP_BYE_MARKER);
      expect(new Set(allClubs).size).toBe(20);
    });

    it('uses straight pairings with no byes when the field is a power of two', () => {
      const cup = generateCupDraw(makeClubIds(16));
      expect(cup.currentRound).toBe('R4');
      expect(cup.ties).toHaveLength(8);
      expect(cup.ties.every(t => t.awayClubId !== CUP_BYE_MARKER)).toBe(true);
    });

    it('a 24-club cup resolves to a real, contested Final (no walkover bye)', () => {
      let cup = generateCupDraw(makeClubIds(24));
      let guard = 0;
      while (cup.currentRound && cup.currentRound !== 'F' && guard++ < 10) {
        cup.ties
          .filter(t => t.round === cup.currentRound && !t.played)
          .forEach(t => { t.played = true; t.homeGoals = 1; t.awayGoals = 0; });
        cup = advanceCupRound(cup);
      }
      const finalTies = cup.ties.filter(t => t.round === 'F');
      expect(finalTies).toHaveLength(1);
      expect(finalTies[0].homeClubId).not.toBe(CUP_BYE_MARKER);
      expect(finalTies[0].awayClubId).not.toBe(CUP_BYE_MARKER);
    });
  });

  describe('advanceCupRound', () => {
    it('should create next round ties from winners', () => {
      const cup = generateCupDraw(makeClubIds(20));
      // Resolve every R3 tie (byes are already played) with the home side winning.
      cup.ties.forEach(t => { t.played = true; t.homeGoals = 2; t.awayGoals = 1; });
      const advanced = advanceCupRound(cup);
      // 4 tie winners + 12 byes = 16 clubs → 8 R4 ties.
      expect(advanced.currentRound).toBe('R4');
      expect(advanced.ties.filter(t => t.round === 'R4')).toHaveLength(8);
    });

    it('records a winnerId on every resolved tie (decisive and on penalties)', () => {
      const cup = generateCupDraw(makeClubIds(16)); // power of two → straight R4 pairings, no byes
      cup.ties.forEach((t, i) => {
        t.played = true;
        if (i === 0) { t.homeGoals = 2; t.awayGoals = 1; } // decisive
        else { t.homeGoals = 1; t.awayGoals = 1; }          // drawn → resolves on penalties
      });
      const advanced = advanceCupRound(cup);
      const resolved = advanced.ties.filter(t => t.round === 'R4');
      // Every resolved tie now carries a winnerId that is one of its two clubs.
      for (const t of resolved) {
        expect(t.winnerId).toBeDefined();
        expect([t.homeClubId, t.awayClubId]).toContain(t.winnerId);
      }
      // Decisive tie → higher scorer wins.
      expect(resolved[0].winnerId).toBe(resolved[0].homeClubId);
      // Drawn ties carry a penaltyShootout score and winnerId matches it.
      const drawnResolved = resolved.find(t => t.penaltyShootout);
      expect(drawnResolved).toBeDefined();
      const ps = drawnResolved!.penaltyShootout!;
      expect(drawnResolved!.winnerId).toBe(ps.home > ps.away ? drawnResolved!.homeClubId : drawnResolved!.awayClubId);
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
