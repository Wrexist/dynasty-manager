/**
 * Shooting profile — shot volume, on-target rate and corners against real football.
 *
 * These four numbers are over-determined and have to be pinned together. Shot
 * volume sat at ~20 per match against a real ~25, and at that volume you cannot
 * simultaneously have a realistic on-target rate (~34%), a realistic conversion
 * (~32% of shots on target) and a realistic goal total (~2.8) — which is why an
 * earlier attempt to fix the on-target rate on its own could not work and was
 * reverted.
 *
 * MEASURED after the rebalance, 400 matches of even 70-quality sides:
 *   shots 24.9   on target 8.95 (36.0%)   goals 2.83   conversion 31.6%
 *   corners 9.7   saves 5.6   fouls 21.8   yellows 3.8   penalties 0.34
 *
 * Goal total, fouls, cards and penalties are covered by matchBalance and
 * matchRealism; this file guards the shooting side those two do not.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateMatch } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import type { Club, Match, Player } from '@/types/game';

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeClub(id: string): Club {
  return {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: 70, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation: '4-3-3', lineup: [], subs: [],
    divisionId: 'eng',
  };
}

function setupClub(id: string, quality: number) {
  const club = makeClub(id);
  const squad = generateSquad(id, quality, 1);
  squad.forEach(p => club.playerIds.push(p.id));
  const { lineup, subs } = selectBestLineup(squad, '4-3-3');
  club.lineup = lineup.map(p => p.id);
  club.subs = subs.map(p => p.id);
  return { club, lineup, subs };
}

describe('shooting profile matches real football', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });
  beforeEach(() => { resetRealPlayerClaims(); });

  it('shot volume, on-target rate, conversion and corners are all in range together', () => {
    const N = 400;
    let shots = 0, sot = 0, goals = 0, corners = 0, saves = 0;

    for (let seed = 0; seed < N; seed++) {
      Math.random = mulberry32(0x51D0 + seed);
      resetRealPlayerClaims();
      const home = setupClub('home', 70);
      const away = setupClub('away', 70);
      Math.random = mulberry32(0x7E50 + seed);
      const { result } = simulateMatch(
        { id: 'm', week: 1, season: 1, homeClubId: 'home', awayClubId: 'away', homeGoals: 0, awayGoals: 0, played: false, events: [] } as unknown as Match,
        home.club, away.club,
        home.lineup as Player[], away.lineup as Player[],
        undefined, undefined, undefined, undefined, undefined, undefined, 1,
        undefined, home.subs as Player[], away.subs as Player[],
      );
      shots += result.stats!.homeShots + result.stats!.awayShots;
      sot += result.stats!.homeShotsOnTarget + result.stats!.awayShotsOnTarget;
      corners += result.stats!.homeCorners + result.stats!.awayCorners;
      goals += result.homeGoals + result.awayGoals;
      saves += result.events.filter(e => e.type === 'shot_saved').length;
    }

    const perMatch = (v: number) => v / N;

    // Real top-five-league combined totals are ~25 shots and ~8.5 on target.
    expect(perMatch(shots), `shots ${perMatch(shots).toFixed(2)}`).toBeGreaterThan(21);
    expect(perMatch(shots), `shots ${perMatch(shots).toFixed(2)}`).toBeLessThan(29);

    // The headline defect: this sat at 47.4% before the rebalance.
    const onTargetPct = (100 * sot) / shots;
    expect(onTargetPct, `on target ${onTargetPct.toFixed(1)}%`).toBeGreaterThan(30);
    expect(onTargetPct, `on target ${onTargetPct.toFixed(1)}%`).toBeLessThan(40);

    // Conversion of shots on target — real ~32%.
    const conversionPct = (100 * goals) / sot;
    expect(conversionPct, `conversion ${conversionPct.toFixed(1)}%`).toBeGreaterThan(26);
    expect(conversionPct, `conversion ${conversionPct.toFixed(1)}%`).toBeLessThan(38);

    // Corners sat at 5.9 against a real ~10.
    expect(perMatch(corners), `corners ${perMatch(corners).toFixed(2)}`).toBeGreaterThan(7.5);
    expect(perMatch(corners), `corners ${perMatch(corners).toFixed(2)}`).toBeLessThan(12.5);

    // Saves are the other half of the double-counted keeper: 6.2 before.
    expect(perMatch(saves), `saves ${perMatch(saves).toFixed(2)}`).toBeGreaterThan(3.5);
    expect(perMatch(saves), `saves ${perMatch(saves).toFixed(2)}`).toBeLessThan(8);

    // Shots on target can never exceed shots, at any sample size.
    expect(sot).toBeLessThanOrEqual(shots);
  });
});
