/**
 * Regressions for three match-engine accounting defects.
 *
 * 1. Goalkeeper-error goals incremented the score but neither the shot nor the
 *    shot-on-target counter, so a match could finish with more goals than shots.
 * 2. The goal-flavour ladder used cumulative thresholds with per-branch
 *    eligibility gates, so a failed gate handed its probability band to the next
 *    branch instead of skipping it.
 * 3. A sending-off that took a side below MIN_PLAYERS_TO_CONTINUE forfeited the
 *    match, but the loop only broke at the top of the next minute — so the
 *    penalty block below still ran and could score into a finalised scoreline.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateMatch } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import {
  COUNTER_ATTACK_GOAL_CHANCE,
  LONG_RANGE_GOAL_CHANCE,
  GOAL_SCORING_TYPES,
} from '@/config/matchEngine';
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

function setupClub(id: string) {
  const club = makeClub(id);
  const squad = generateSquad(id, 70, 1);
  squad.forEach(p => club.playerIds.push(p.id));
  const { lineup, subs } = selectBestLineup(squad, '4-3-3');
  club.lineup = lineup.map(p => p.id);
  club.subs = subs.map(p => p.id);
  return { club, lineup, subs };
}

const emptyMatch = (): Match => ({
  id: 'm', week: 1, season: 1,
  homeClubId: 'home', awayClubId: 'away',
  homeGoals: 0, awayGoals: 0, played: false, events: [],
} as unknown as Match);

describe('match event accounting', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });
  beforeEach(() => { resetRealPlayerClaims(); });

  it('every goal is on target or an own goal — goalkeeper errors included', () => {
    // Own goals legitimately score without a shot by the benefiting side, so
    // they are subtracted rather than assumed away. Everything else that ends
    // in the net must have been counted as a shot on target.
    let checked = 0;
    for (let seed = 0; seed < 40; seed++) {
      Math.random = mulberry32(0x1234 + seed);
      const home = setupClub('home');
      const away = setupClub('away');
      Math.random = mulberry32(0x9999 + seed);
      const { result } = simulateMatch(
        emptyMatch(), home.club, away.club,
        home.lineup as Player[], away.lineup as Player[],
        undefined, undefined, undefined, undefined, undefined, undefined, 1,
        undefined, home.subs as Player[], away.subs as Player[],
      );
      const ownGoalsFor = (clubId: string) =>
        result.events.filter(e => e.type === 'own_goal' && e.clubId === clubId).length;

      expect(result.stats!.homeShotsOnTarget)
        .toBeGreaterThanOrEqual(result.homeGoals - ownGoalsFor(home.club.id));
      expect(result.stats!.awayShotsOnTarget)
        .toBeGreaterThanOrEqual(result.awayGoals - ownGoalsFor(away.club.id));
      // Shots on target can never exceed total shots.
      expect(result.stats!.homeShots).toBeGreaterThanOrEqual(result.stats!.homeShotsOnTarget);
      expect(result.stats!.awayShots).toBeGreaterThanOrEqual(result.stats!.awayShotsOnTarget);
      checked++;
    }
    expect(checked).toBe(40);
  });

  it('an ineligible goal flavour does not donate its band to the next one', () => {
    // Both sides play a NORMAL defensive line, so counterVuln is 0 and the
    // counter-attack flavour is ineligible. Its 12% band must be skipped, not
    // inherited by long range: pre-fix long range owned [0, 0.22) and fired at
    // roughly twice its configured 10%.
    //
    // Scorers are forced to shooting 80 (long range eligible) and physical 60
    // with low skill moves (header and solo ineligible), so long range is the
    // first eligible band and its share is read directly.
    const forceAttrs = (players: Player[]): Player[] =>
      players.map(p => ({
        ...p,
        skillMoves: 1,
        attributes: { ...p.attributes, shooting: 80, physical: 60 },
      }));

    let longRangeGoals = 0;
    let totalGoals = 0;

    for (let seed = 0; seed < 60; seed++) {
      Math.random = mulberry32(0xAB00 + seed);
      const home = setupClub('home');
      const away = setupClub('away');
      Math.random = mulberry32(0xCD00 + seed);
      const { result } = simulateMatch(
        emptyMatch(), home.club, away.club,
        forceAttrs(home.lineup as Player[]), forceAttrs(away.lineup as Player[]),
        undefined, undefined, undefined, undefined, undefined, undefined, 1,
        undefined, forceAttrs(home.subs as Player[]), forceAttrs(away.subs as Player[]),
      );
      for (const ev of result.events) {
        if ((GOAL_SCORING_TYPES as readonly string[]).includes(ev.type)) totalGoals++;
        if (ev.type === 'long_range_goal') longRangeGoals++;
      }
      // No counter-attack goal may occur at all with a normal defensive line.
      expect(result.events.some(e => e.type === 'counter_attack_goal')).toBe(false);
    }

    expect(totalGoals).toBeGreaterThan(50); // sample is meaningful
    const share = longRangeGoals / totalGoals;
    // Post-fix this sits near LONG_RANGE_GOAL_CHANCE. Pre-fix it sat near
    // COUNTER + LONG_RANGE. The midpoint separates the two cleanly.
    const preFixShare = COUNTER_ATTACK_GOAL_CHANCE + LONG_RANGE_GOAL_CHANCE;
    expect(share).toBeLessThan((LONG_RANGE_GOAL_CHANCE + preFixShare) / 2);
  });

  it('no goal is scored after a match has been abandoned', () => {
    // A 7-player AI side is valid to field (AI_MIN_MATCH_PLAYERS) but one red
    // card drops it below MIN_PLAYERS_TO_CONTINUE and forfeits the match. The
    // penalty block used to run in that same minute, scoring into a scoreline
    // the forfeit had already finalised.
    let abandonedSeen = 0;
    for (let seed = 0; seed < 120; seed++) {
      Math.random = mulberry32(0x7A00 + seed);
      const home = setupClub('home');
      const away = setupClub('away');
      Math.random = mulberry32(0x7B00 + seed);
      const { result } = simulateMatch(
        emptyMatch(), home.club, away.club,
        home.lineup as Player[], (away.lineup as Player[]).slice(0, 7),
        undefined, undefined, undefined, undefined, undefined, undefined, 1,
        undefined, home.subs as Player[], [],
      );
      const abandonIdx = result.events.findIndex(
        e => typeof e.description === 'string' && e.description.includes('Match abandoned'),
      );
      if (abandonIdx === -1) continue;
      abandonedSeen++;
      const after = result.events.slice(abandonIdx + 1);
      const goalsAfter = after.filter(e => (GOAL_SCORING_TYPES as readonly string[]).includes(e.type));
      expect(goalsAfter, `seed ${seed} scored after abandonment`).toEqual([]);
    }
    // The scenario has to actually occur or the assertion above is vacuous.
    expect(abandonedSeen).toBeGreaterThan(0);
  });
});
