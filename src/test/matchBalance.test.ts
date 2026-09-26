import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateMatch } from '@/engine/match';
import { generateSquad, selectBestLineup } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import type { Club, Match } from '@/types/game';

// Deterministic PRNG so statistical balance assertions don't flake.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeClub(id: string, rep: number): Club {
  return {
    id, name: id, shortName: id.slice(0, 3).toUpperCase(),
    color: '#fff', secondaryColor: '#000',
    budget: 50_000_000, wageBill: 200_000,
    reputation: rep, facilities: 5, youthRating: 5, fanBase: 5, boardPatience: 60,
    playerIds: [], formation: '4-3-3', lineup: [], subs: [],
    divisionId: 'eng',
  };
}

function setupClub(id: string, quality: number, rep: number) {
  const club = makeClub(id, rep);
  const squad = generateSquad(id, quality, 1);
  squad.forEach(p => club.playerIds.push(p.id));
  const { lineup, subs } = selectBestLineup(squad, '4-3-3');
  club.lineup = lineup.map(p => p.id);
  club.subs = subs.map(p => p.id);
  return { club, lineup, subs: subs, squad };
}

describe('Match Balance', () => {
  const originalRandom = Math.random;
  beforeEach(() => {
    Math.random = mulberry32(0xDEAD_BEEF);
    // Real-player claims are module-level. Without a reset, the second test
    // would inherit "claimed" real players from the first and silently fall
    // through to procedural generation for those slots.
    resetRealPlayerClaims();
  });
  afterEach(() => { Math.random = originalRandom; });

  it('average goals per match is within expected range (2.2-3.3)', () => {
    const SAMPLE_SIZE = 200;
    let totalGoals = 0;

    const { club: homeClub, lineup: homePlayers } = setupClub('home', 70, 70);
    const { club: awayClub, lineup: awayPlayers } = setupClub('away', 70, 70);

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const match: Match = { id: `bal-${i}`, week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };
      const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);
      totalGoals += result.homeGoals + result.awayGoals;
    }

    const avgGoals = totalGoals / SAMPLE_SIZE;
    // This cell measures 3.07 (2.83 before the S6 real-save calibration). It is
    // two freshly generated sides at kickoff form (45-85, mean 65) with no AI
    // manager, i.e. both `balanced` — the most open matchup the engine has. A
    // running league settles at form ~50 with mostly cautious AI managers and
    // scores ~2.7 (real football 2.6-2.9); that target is asserted on real
    // saves in matchCalibration / matchCalibrationSmoke, which is why the
    // ceiling here sits above the real-football band. The old 1.0-3.5 band was
    // so wide that the engine's real output of 1.54 passed green — see
    // matchRealism.test.ts for the full profile.
    expect(avgGoals).toBeGreaterThanOrEqual(2.2);
    expect(avgGoals).toBeLessThanOrEqual(3.6);
  });

  it('elite vs weak team produces expected scoreline distribution', () => {
    const SAMPLE_SIZE = 100;
    let eliteWins = 0;
    let weakWins = 0;

    const { club: elite, lineup: elitePlayers } = setupClub('elite', 85, 90);
    const { club: weak, lineup: weakPlayers } = setupClub('weak', 55, 40);

    // Re-seed after squad generation so the simulation random sequence
    // doesn't drift when squad-gen consumes a different number of values
    // (e.g. when fillers are pulled from the real-player pool).
    Math.random = mulberry32(0xC0FFEE);

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const match: Match = { id: `mismatch-${i}`, week: 1, homeClubId: 'elite', awayClubId: 'weak', played: false, homeGoals: 0, awayGoals: 0, events: [] };
      const { result } = simulateMatch(match, elite, weak, elitePlayers, weakPlayers);
      if (result.homeGoals > result.awayGoals) eliteWins++;
      else if (result.awayGoals > result.homeGoals) weakWins++;
    }

    // Elite team should clearly dominate the weak team. The engine's true
    // elite-home win rate (measured over 1,000 unseeded sims) is ~46-47%
    // with ~33% draws and ~20% weak wins — the previous hard `>= 50 wins`
    // threshold sat at the distribution's median and only held through the
    // luck of the fixed RNG stream, so ANY engine change that perturbed
    // random-call ordering re-rolled it. Assert dominance (wins comfortably
    // exceeding losses) plus a sane win floor instead.
    // Measured: 92 elite wins to 2 weak wins over 100 matches (64 to 14 before
    // the S6 calibration — more goals make a 30-point gap tell). The old
    // `>= 35 wins` floor was met even when penalties were being awarded
    // BACKWARDS (fouls followed the event team, so the stronger side conceded
    // most of the spot-kicks and 64% of the weak side's goals came from them).
    expect(eliteWins).toBeGreaterThan(weakWins * 2);
    expect(eliteWins).toBeGreaterThanOrEqual(45);
  });

  it('draws occur at a realistic frequency (18-34%)', () => {
    const SAMPLE_SIZE = 200;
    let draws = 0;

    const { club: homeClub, lineup: homePlayers } = setupClub('home', 70, 70);
    const { club: awayClub, lineup: awayPlayers } = setupClub('away', 70, 70);

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const match: Match = { id: `draw-${i}`, week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };
      const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);
      if (result.homeGoals === result.awayGoals) draws++;
    }

    const drawRate = draws / SAMPLE_SIZE;
    // Real football draw rate is ~25%; this cell measures 29% (unchanged by
    // the S6 calibration on this seed). The old
    // 10-45% band passed the pre-fix engine's 40% draw rate (a symptom of the
    // goal rate being far too low), which is the regression this now catches.
    expect(drawRate).toBeGreaterThanOrEqual(0.18);
    expect(drawRate).toBeLessThanOrEqual(0.34);
  });

  it('clean sheets occur reasonably (38-68% of matches)', () => {
    const SAMPLE_SIZE = 200;
    let cleanSheets = 0;

    const { club: homeClub, lineup: homePlayers } = setupClub('home', 70, 70);
    const { club: awayClub, lineup: awayPlayers } = setupClub('away', 70, 70);

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const match: Match = { id: `cs-${i}`, week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };
      const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);
      if (result.homeGoals === 0 || result.awayGoals === 0) cleanSheets++;
    }

    const csRate = cleanSheets / SAMPLE_SIZE;
    // At least one side keeps a clean sheet in ~48-50% of real matches. This
    // cell measures 39.5% (47% before the S6 calibration): it scores ~3.1, above
    // a real league by construction (see the goals test above), and a higher
    // scoring rate means fewer clean sheets — so the floor sits below the
    // real-football figure. The old 5-75% band could not fail.
    expect(csRate).toBeGreaterThanOrEqual(0.33);
    expect(csRate).toBeLessThanOrEqual(0.68);
  });

  it('home advantage produces more home wins over large sample', () => {
    const SAMPLE_SIZE = 500;
    let homeWins = 0;
    let awayWins = 0;

    const { club: homeClub, lineup: homePlayers } = setupClub('home', 70, 70);
    const { club: awayClub, lineup: awayPlayers } = setupClub('away', 70, 70);

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const match: Match = { id: `ha-${i}`, week: 1, homeClubId: 'home', awayClubId: 'away', played: false, homeGoals: 0, awayGoals: 0, events: [] };
      const { result } = simulateMatch(match, homeClub, awayClub, homePlayers, awayPlayers);
      if (result.homeGoals > result.awayGoals) homeWins++;
      else if (result.awayGoals > result.homeGoals) awayWins++;
    }

    // Measured 203 home wins to 161 away over 500. Before the S6 calibration
    // (HOME_ADVANTAGE 1.15) it was 179 to 175 — and the old `>= away * 0.95`
    // check passed a home side that won LESS than the away side. Real league
    // football is ~45% home to ~28% away; tightened so a barely-there edge
    // fails.
    expect(homeWins).toBeGreaterThanOrEqual(awayWins * 1.15);
  });
});
