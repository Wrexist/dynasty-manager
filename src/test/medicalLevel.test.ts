/**
 * Regression: the Medical Centre the player upgrades must reach the match engine.
 *
 * Two different numbers are easy to confuse and the engine confused them:
 *
 *   - `Club.facilities`            — a fixed 2-10 quality rating from the league
 *                                    data. Never changes.
 *   - `FacilitiesState.medicalLevel` — the upgradeable Medical Centre the player
 *                                    spends money on, shown in the UI as
 *                                    "Medical Center Lv.N".
 *
 * Every engine callsite passed the former for BOTH sides, so upgrading the
 * Medical Centre changed nothing about in-match injury probability, injury
 * duration or re-injury risk — and match injuries are the dominant injury
 * source. `simulateMatch` now takes explicit medical levels and
 * `clubMedicalLevel` projects an AI club's static rating onto the same scale.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateMatch } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import { clubMedicalLevel, FACILITY_MAX_LEVEL, MEDICAL_LEVEL_FACTOR } from '@/config/gameBalance';
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

describe('clubMedicalLevel', () => {
  it('projects the static club rating onto the medical scale', () => {
    expect(clubMedicalLevel(10)).toBe(Math.round(10 * MEDICAL_LEVEL_FACTOR));
    expect(clubMedicalLevel(5)).toBe(Math.round(5 * MEDICAL_LEVEL_FACTOR));
  });

  it('clamps into [0, FACILITY_MAX_LEVEL] and survives junk input', () => {
    expect(clubMedicalLevel(1000)).toBe(FACILITY_MAX_LEVEL);
    expect(clubMedicalLevel(-50)).toBe(0);
    expect(clubMedicalLevel(Number.NaN)).toBe(clubMedicalLevel(5));
  });
});

describe('simulateMatch — Medical Centre level reaches the injury system', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });
  beforeEach(() => { resetRealPlayerClaims(); });

  it('a maxed Medical Centre produces fewer injuries than none at all', () => {
    const SEEDS = 60;
    let injuriesAtZero = 0;
    let injuriesAtMax = 0;

    for (let seed = 0; seed < SEEDS; seed++) {
      Math.random = mulberry32(0x5EED + seed);
      const home = setupClub('home');
      const away = setupClub('away');

      const run = (medical: number) => {
        Math.random = mulberry32(0xA11CE + seed);
        // Home is the player's club, so only ITS medical level varies; the
        // away side is held at the same value in both arms.
        const { matchInjuries } = simulateMatch(
          emptyMatch(), home.club, away.club,
          home.lineup as Player[], away.lineup as Player[],
          undefined, undefined, undefined, home.club.id,
          undefined, undefined, 1, undefined,
          home.subs as Player[], away.subs as Player[],
          undefined, undefined,
          medical, 5,
        );
        // Count only injuries to the home side — the away side's level is fixed.
        const homeIds = new Set(home.club.playerIds);
        return Object.keys(matchInjuries).filter(id => homeIds.has(id)).length;
      };

      injuriesAtZero += run(0);
      injuriesAtMax += run(FACILITY_MAX_LEVEL);
    }

    // Sanity: the sample actually produced injuries, otherwise the comparison
    // below is vacuously true.
    expect(injuriesAtZero).toBeGreaterThan(0);
    // MEDICAL_INJURY_PREVENTION_PER_LEVEL is 0.015, so ten levels subtract 0.15
    // from a base non-foul injury probability of 0.02 — i.e. it floors out.
    // Pre-fix both arms were identical because the parameter never varied.
    expect(injuriesAtMax).toBeLessThan(injuriesAtZero);
  });
});
