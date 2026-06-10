import { describe, it, expect } from 'vitest';
import { processKnockoutRound } from '@/utils/international';
import type { InternationalKnockoutTie } from '@/types/game';

/** Two ties between similarly-ranked nations → frequent draws → shootouts. */
function makeTies(): InternationalKnockoutTie[] {
  const pairs: [string, string][] = [
    ['Czech Republic', 'Hungary'],
    ['Scotland', 'Greece'],
  ];
  return pairs.map(([home, away], i) => ({
    id: `tie-${i}`,
    round: 'SF',
    homeNation: home,
    awayNation: away,
    played: false,
    homeGoals: 0,
    awayGoals: 0,
    week: 1,
  }));
}

describe('international knockout penalty shootouts', () => {
  it('resolves drawn AI ties via the canonical shootout — winner matches the score, no fabricated 5-3', () => {
    const shootouts: {
      home: number; away: number; winnerId?: string;
      homeNation: string; awayNation: string;
    }[] = [];

    for (let attempt = 0; attempt < 400 && shootouts.length < 12; attempt++) {
      const { updatedTies } = processKnockoutRound(makeTies(), 'SF', 'France');
      for (const t of updatedTies) {
        if (t.penaltyShootout) {
          shootouts.push({
            ...t.penaltyShootout,
            winnerId: t.winnerId,
            homeNation: t.homeNation,
            awayNation: t.awayNation,
          });
        }
      }
    }

    expect(shootouts.length).toBeGreaterThan(0);
    for (const s of shootouts) {
      // A shootout always produces a decisive, internally consistent result.
      expect(s.home).not.toBe(s.away);
      const expectedWinner = s.home > s.away ? s.homeNation : s.awayNation;
      expect(s.winnerId).toBe(expectedWinner);
      // Scores stay within the canonical sim's bounds (5 kicks + capped sudden death).
      expect(Math.max(s.home, s.away)).toBeLessThanOrEqual(40);
      expect(Math.min(s.home, s.away)).toBeGreaterThanOrEqual(0);
    }

    // The old coin-flip path fabricated every shootout as exactly 5-3. The
    // canonical sim varies; with 8+ samples an all-5-3 run is ~impossible.
    if (shootouts.length >= 8) {
      const allFiveThree = shootouts.every(
        s => (s.home === 5 && s.away === 3) || (s.home === 3 && s.away === 5),
      );
      expect(allFiveThree).toBe(false);
    }
  });
});
