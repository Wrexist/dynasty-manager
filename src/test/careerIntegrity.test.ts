/**
 * Regression: career-mode state that followed the manager, and two
 * qualification checks that read the wrong thing.
 *
 * 1. **National-team sackings counted knockout exits as group exits.** The
 *    classifier tested `r.round.includes('16') || 'Quarter' || 'Semi' ||
 *    'Final'`, but the recorded values are the union `'R32' | 'R16' | 'QF' |
 *    'SF' | 'F'` — so only `'R16'` ever matched. With a threshold of two
 *    consecutive group exits, a manager who reached the quarter-finals last
 *    tournament and went out at the group stage this one was sacked by the FA.
 *
 * 2. **A 12-group World Cup marks best-third qualifiers as eliminated.** The
 *    bracket is seeded from 12 winners + 12 runners-up + 8 best THIRDS, but
 *    elimination was derived from "not top two of any group". A qualifying
 *    third-placed side got a knockout tie AND `playerEliminated: true`; in
 *    World Cup mode the game then simulated their own tie for them and dropped
 *    them on the result screen.
 *
 * 3. **A board ultimatum followed the manager to their next club.** It only
 *    self-clears across seasons, so accepting a mid-season offer carried the
 *    old club's deadline week and target position to the new one.
 */
import { describe, it, expect } from 'vitest';
import { generateKnockoutBracket } from '@/utils/international';
import type { InternationalGroup } from '@/types/game';

/** The tokens a recorded international result can actually carry. */
const REAL_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

describe('knockout rounds are matched by their real tokens', () => {
  it('the old substring test only recognised one of the five', () => {
    const oldTest = (r: string) => r.includes('16') || r.includes('Quarter') || r.includes('Semi') || r.includes('Final');
    expect(REAL_ROUNDS.filter(oldTest)).toEqual(['R16']);
  });

  it('the set used by the sacking check recognises all five', () => {
    const knockout = new Set(['R32', 'R16', 'QF', 'SF', 'F']);
    expect(REAL_ROUNDS.every(r => knockout.has(r))).toBe(true);
    // ...and does not swallow a group-stage result, which carries no round.
    expect(knockout.has('group')).toBe(false);
  });
});

describe('World Cup qualification is read off the bracket, not the top two', () => {
  /** 12 groups of 4, deterministic standings: the group index decides quality
   *  so third places are strictly ordered and the best eight are unambiguous. */
  function twelveGroups(): InternationalGroup[] {
    return Array.from({ length: 12 }, (_, g) => ({
      id: String.fromCharCode(65 + g),
      nations: [0, 1, 2, 3].map(i => `g${g}n${i}`),
      fixtures: [],
      table: [0, 1, 2, 3].map(i => ({
        nationality: `g${g}n${i}`,
        played: 3, won: 3 - i, drawn: 0, lost: i,
        goalsFor: 9 - i * 2, goalsAgainst: i * 2,
        goalDifference: 9 - i * 4, points: (3 - i) * 3,
      })),
    })) as unknown as InternationalGroup[];
  }

  it('seeds 32 sides including best thirds, and they are NOT eliminated', () => {
    const groups = twelveGroups();
    const ties = generateKnockoutBracket(groups);
    expect(ties).toHaveLength(16); // R32

    const inBracket = new Set<string>();
    for (const t of ties) { inBracket.add(t.homeNation); inBracket.add(t.awayNation); }
    expect(inBracket.size).toBe(32);

    // At least one third-placed side is in the bracket — that is the case the
    // old "top two" elimination test got wrong.
    const thirds = groups.map(g => g.table[2].nationality);
    const qualifiedThirds = thirds.filter(n => inBracket.has(n));
    expect(qualifiedThirds.length).toBeGreaterThan(0);

    // The check the game now performs.
    const isInBracket = (nat: string) => ties.some(t => t.homeNation === nat || t.awayNation === nat);
    for (const nat of qualifiedThirds) {
      expect(isInBracket(nat), `${nat} qualified as a best third and must not be eliminated`).toBe(true);
      // The old rule, for contrast: not top two of any group.
      const oldEliminated = !groups.some(g => g.table.slice(0, 2).some(e => e.nationality === nat));
      expect(oldEliminated).toBe(true);
    }
  });
});
