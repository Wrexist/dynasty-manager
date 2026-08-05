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
import { simulatePlayoff, determineProRelZones, stepPlayoff, resumePlayoff } from '@/utils/promotionRelegation';
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

describe('the player\'s own playoff run is recoverable from the bracket', () => {
  // seasonEnd records the ties its resolver sees that involve the player's club,
  // and stores them on SeasonHistory.playoffRun so the season summary can show
  // the matches that decided the season. Before this, promotion playoffs
  // resolved silently inside season rollover and the player was simply promoted
  // or not, with nothing on screen acknowledging a playoff had happened.
  //
  // This exercises the same shape seasonEnd's closure uses: record a tie when
  // either side is the player, and note whether the player went through.
  const runWithRecorder = (candidates: string[], playerId: string, winnerOf: (h: string, a: string) => string) => {
    const run: { homeClubId: string; awayClubId: string; playerAdvanced: boolean }[] = [];
    const champion = simulatePlayoff(candidates, (home, away) => {
      const winner = winnerOf(home, away);
      if (home === playerId || away === playerId) {
        run.push({ homeClubId: home, awayClubId: away, playerAdvanced: winner === playerId });
      }
      return winner;
    });
    return { run, champion };
  };

  it('captures every tie the player played, and no others', () => {
    // Seeds: a(0) b(1) c(2) d(3). Bracket is a-d and b-c, then the final.
    // Player is 'c', who upsets 'b' and then loses the final to 'a'.
    const { run, champion } = runWithRecorder(['a', 'b', 'c', 'd'], 'c', (home, away) => {
      if (home === 'b' && away === 'c') return 'c';   // semi upset
      if (home === 'a' && away === 'd') return 'a';   // other semi
      return 'a';                                     // final
    });

    expect(run).toHaveLength(2);
    expect(run[0]).toMatchObject({ homeClubId: 'b', awayClubId: 'c', playerAdvanced: true });
    expect(run[1].playerAdvanced).toBe(false);
    // The player reached the final, so the losing tie must be against the champion.
    expect(champion).toBe('a');
    expect([run[1].homeClubId, run[1].awayClubId]).toContain('a');
    expect([run[1].homeClubId, run[1].awayClubId]).toContain('c');
  });

  it('records nothing when the player is not in the bracket', () => {
    const { run } = runWithRecorder(['a', 'b', 'c', 'd'], 'not-playing', home => home);
    expect(run).toEqual([]);
  });

  it('the last recorded tie decides whether the player went up', () => {
    const { run, champion } = runWithRecorder(['p', 'b', 'c', 'd'], 'p', home => home);
    // Top seed wins every tie, so the player wins the semi and the final.
    expect(champion).toBe('p');
    expect(run).toHaveLength(2);
    expect(run[run.length - 1].playerAdvanced).toBe(true);
  });
});


describe('stepPlayoff / resumePlayoff — suspending for the player\'s own tie', () => {
  // The interactive playoff needs to pause the bracket on the tie the player is
  // in, let them play it, then carry on — without duplicating the seeding rules
  // anywhere. `stepPlayoff` is the single walk; `simulatePlayoff` is that walk
  // with a resolver that never suspends.
  const tie = (h: string, a: string, hg: number, ag: number) => ({
    homeClubId: h, awayClubId: a, homeGoals: hg, awayGoals: ag,
    playerAdvanced: hg === ag ? true : hg > ag,
  });

  it('suspends on the first tie the resolver declines', () => {
    const out = stepPlayoff(['a', 'b', 'p', 'd'], (home, away) =>
      (home === 'p' || away === 'p') ? null : home);
    expect(out.kind).toBe('pending');
    if (out.kind !== 'pending') return;
    // Bracket is a-d and b-p, so the player's semi is b vs p.
    expect(out.tie).toMatchObject({ homeClubId: 'b', awayClubId: 'p' });
    // Four clubs still in it — a semi-final.
    expect(out.tie.teamsInRound).toBe(4);
  });

  it('reports teamsInRound 2 for the final, so a caller can name the round', () => {
    // Player loses nothing: only the final involves them.
    const out = stepPlayoff(['p', 'b', 'c', 'd'], (home, away) => {
      if (home === 'p' && away === 'd') return 'p';   // player's semi, resolved
      if (home === 'b' && away === 'c') return 'b';
      return null;                                    // suspend on the final
    });
    expect(out.kind).toBe('pending');
    if (out.kind !== 'pending') return;
    expect(out.tie.teamsInRound).toBe(2);
    expect([out.tie.homeClubId, out.tie.awayClubId].sort()).toEqual(['b', 'p']);
  });

  it('resumePlayoff replays recorded results and never re-decides them', () => {
    const candidates = ['a', 'b', 'p', 'd'];
    // Player already won their semi 2-1 against b.
    const resolved = [tie('b', 'p', 1, 2)];
    let simulated = 0;
    const out = resumePlayoff(candidates, resolved, 'p', (home) => { simulated++; return home; });
    // a-d is simulated; b-p is replayed from the record; the final suspends.
    expect(simulated).toBe(1);
    expect(out.kind).toBe('pending');
    if (out.kind !== 'pending') return;
    expect([out.tie.homeClubId, out.tie.awayClubId].sort()).toEqual(['a', 'p']);
    expect(out.tie.teamsInRound).toBe(2);
  });

  it('a level tie is replayed as a win for the better-placed side', () => {
    // The rule lives in one place; resumePlayoff must apply the same one.
    // b hosted the player's semi and drew, so b advances and the player is OUT
    // — which means nothing suspends and the bracket runs to a decision.
    const out = resumePlayoff(['a', 'b', 'p', 'd'], [tie('b', 'p', 1, 1)], 'p', home => home);
    expect(out).toEqual({ kind: 'decided', winner: 'a' });
  });

  it('finishes without suspending once every player tie is recorded', () => {
    const resolved = [tie('b', 'p', 0, 3), tie('a', 'p', 1, 2)];
    const out = resumePlayoff(['a', 'b', 'p', 'd'], resolved, 'p', home => home);
    expect(out).toEqual({ kind: 'decided', winner: 'p' });
  });

  it('an eliminated player does not suspend the rest of the bracket', () => {
    const resolved = [tie('b', 'p', 4, 0)]; // player knocked out in the semi
    const out = resumePlayoff(['a', 'b', 'p', 'd'], resolved, 'p', home => home);
    expect(out).toEqual({ kind: 'decided', winner: 'a' });
  });

  it('stepPlayoff and simulatePlayoff agree when nothing suspends', () => {
    const alwaysHome = (home: string) => home;
    const stepped = stepPlayoff(['a', 'b', 'c', 'd'], alwaysHome);
    const simulated = simulatePlayoff(['a', 'b', 'c', 'd'], alwaysHome);
    expect(stepped).toEqual({ kind: 'decided', winner: 'a' });
    expect(simulated).toBe('a');
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
