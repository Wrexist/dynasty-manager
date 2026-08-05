/**
 * Regression: the promotion playoff must be decided by football, not a die.
 *
 * `simulatePlayoff` was `Math.random() < 0.6 ? higherSeed : lowerSeed` with no
 * reference to squads, form or home advantage — and it governed the PLAYER's
 * own promotion too, with no match played and nothing shown on screen. A whole
 * season in tier 2-4 could end on two invisible dice rolls.
 *
 * Two separate defects are covered here:
 *   - the tie result now comes from an injected resolver (seasonEnd supplies
 *     one backed by the real match engine);
 *   - the bracket is seeded 1vN rather than pairing adjacent entries, and an
 *     odd field gives the BYE to the top seed rather than the bottom one.
 *
 * Plus the league-config half of it: Spain, Italy, Germany and France shipped
 * `playoffSpots: 1`, which collapses to a single candidate that simulatePlayoff
 * returns unconditionally — 3rd place was auto-promoted and no playoff existed.
 */
import { describe, it, expect } from 'vitest';
import { simulatePlayoff, determineProRelZones } from '@/utils/promotionRelegation';
import { ALL_LEAGUES } from '@/data/leagues/index';
import type { LeagueTableEntry } from '@/types/game';

describe('simulatePlayoff — bracket seeding', () => {
  it('pairs 1vN, not adjacent entries', () => {
    const seen: [string, string][] = [];
    // Resolver records the pairing and always advances the home (better) side,
    // so the recorded ties are the bracket itself.
    simulatePlayoff(['a', 'b', 'c', 'd'], (home, away) => {
      seen.push([home, away]);
      return home;
    });
    // Round 1 must be 1v4 and 2v3 — never 1v2 / 3v4.
    expect(seen.slice(0, 2)).toEqual([['a', 'd'], ['b', 'c']]);
  });

  it('gives an odd field its bye to the TOP seed', () => {
    const seen: [string, string][] = [];
    simulatePlayoff(['a', 'b', 'c'], (home, away) => {
      seen.push([home, away]);
      return home;
    });
    // 'a' sits out round 1; 'b' hosts 'c'. The old code gave the bye to the
    // worst-placed side instead.
    expect(seen[0]).toEqual(['b', 'c']);
  });

  it('the better-placed side is always the home team in a tie', () => {
    const order = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];
    const seedOf = new Map(order.map((id, i) => [id, i]));
    simulatePlayoff(order, (home, away) => {
      expect(seedOf.get(home)!).toBeLessThan(seedOf.get(away)!);
      return home;
    });
  });

  it('a resolver fully determines the winner — no residual randomness', () => {
    // The lowest seed wins every tie; it must therefore win the whole bracket.
    const winner = simulatePlayoff(['a', 'b', 'c', 'd'], (_home, away) => away);
    expect(winner).toBe('d');
  });

  it('still resolves without a resolver (pure fallback path)', () => {
    const winner = simulatePlayoff(['a', 'b', 'c', 'd']);
    expect(['a', 'b', 'c', 'd']).toContain(winner);
    expect(simulatePlayoff([])).toBeNull();
    expect(simulatePlayoff(['solo'])).toBe('solo');
  });
});

describe('league config — a playoff must have something to play for', () => {
  const table = (n: number): LeagueTableEntry[] =>
    Array.from({ length: n }, (_, i) => ({ clubId: `c${i}` } as LeagueTableEntry));

  it('no league configures a one-club playoff', () => {
    // playoffSpots: 1 yields exactly one candidate, which simulatePlayoff
    // returns unconditionally — an automatic promotion wearing a playoff label.
    const offenders = ALL_LEAGUES
      .filter(l => l.playoffSpots === 1)
      .map(l => l.id);
    expect(offenders).toEqual([]);
  });

  it('every configured playoff yields at least two candidates', () => {
    for (const league of ALL_LEAGUES) {
      if (league.playoffSpots <= 0) continue;
      const zones = determineProRelZones(table(league.teamCount), league);
      expect(
        zones.playoffCandidates.length,
        `${league.id} playoff has ${zones.playoffCandidates.length} candidate(s)`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('auto promotions plus one playoff winner never exceed the tier above', () => {
    // applyPromotionRelegation caps total promotions at the upper tier's
    // relegation count. If auto >= that cap the playoff winner is silently
    // discarded and the bracket is decorative.
    const byCountry = new Map<string, typeof ALL_LEAGUES>();
    for (const l of ALL_LEAGUES) {
      const list = byCountry.get(l.country) ?? [];
      list.push(l);
      byCountry.set(l.country, list);
    }
    for (const [country, leagues] of byCountry) {
      const tiers = [...leagues].sort((a, b) => a.tier - b.tier);
      for (let i = 0; i < tiers.length - 1; i++) {
        const upper = tiers[i];
        const lower = tiers[i + 1];
        if (lower.playoffSpots <= 0) continue;
        expect(
          lower.promotionSpots + 1,
          `${country} T${lower.tier} sends ${lower.promotionSpots} auto + 1 playoff winner up into ${lower.promotionSpots + 1} slots, but T${upper.tier} only relegates ${upper.relegationSpots}`,
        ).toBeLessThanOrEqual(upper.relegationSpots);
      }
    }
  });
});
