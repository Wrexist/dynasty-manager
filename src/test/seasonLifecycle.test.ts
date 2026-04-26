/**
 * Phase 3b — Player lifecycle at season end (integration via the store).
 *
 * Spins up a real game via `initGame`, manipulates the state to set up
 * specific scenarios, then calls `endSeason` and asserts the observable
 * lifecycle outcomes documented in CLAUDE.md.
 *
 * Covers:
 *   - season counter increments
 *   - all surviving players age by exactly 1
 *   - season stats reset; career stats accumulate
 *   - players whose contractEnd ≤ season are removed from their club
 *   - eligible expired players (age ≤ 34, OVR ≥ 55) join the free agent pool
 *   - ineligible expired players are dropped entirely
 *   - existing free agents age and over-34s are evicted
 *   - every club ends with ≥ 11 valid lineup IDs (gap-filling guarantee)
 *   - every player referenced by a club's playerIds exists in players
 *   - lineup/subs IDs are subsets of playerIds
 *
 * The state is initialized once and restored between tests via deep clone
 * to keep run time reasonable (initGame generates ~2000 players).
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { useGameStore } from '@/store/gameStore';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { FREE_AGENT_POOL_MAX } from '@/config/gameBalance';

import { withSeededRandom } from './helpers/seasonFixtures';

const PLAYER_CLUB_ID = 'manchester-city';

/**
 * Snapshot of the post-initGame state. Captured once and shallow-restored
 * before each test so we don't pay the initGame cost repeatedly.
 *
 * Shallow-clone is sufficient because endSeason reassigns whole sub-trees
 * (clubs, players, divisionTables, etc.) rather than mutating in place.
 */
let baseline: ReturnType<typeof useGameStore.getState> | null = null;

async function initBaseline() {
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  await useGameStore.getState().initGame(PLAYER_CLUB_ID);
  baseline = useGameStore.getState();
}

function restoreBaseline() {
  if (!baseline) throw new Error('Baseline not initialized');
  // Deep clone the slice fields we mutate during tests so individual tests
  // can't poison each other. JSON round-trip is fine here — the fields are
  // plain data (no Dates, Maps, Sets, or class instances).
  // Cup/continental fields are included so that sibling test files which
  // mutate them don't leak across the global Zustand store.
  const fresh = JSON.parse(JSON.stringify({
    season: baseline.season,
    week: baseline.week,
    clubs: baseline.clubs,
    players: baseline.players,
    fixtures: baseline.fixtures,
    divisionFixtures: baseline.divisionFixtures,
    divisionTables: baseline.divisionTables,
    divisionClubs: baseline.divisionClubs,
    leagueTable: baseline.leagueTable,
    freeAgents: baseline.freeAgents,
    activeLoans: baseline.activeLoans,
    seasonHistory: baseline.seasonHistory,
    messages: baseline.messages,
    cup: baseline.cup,
    leagueCup: baseline.leagueCup,
    championsCup: baseline.championsCup,
    shieldCup: baseline.shieldCup,
    conferenceCup: baseline.conferenceCup,
    boardConfidence: baseline.boardConfidence,
  }));
  useGameStore.setState(fresh);
}

beforeAll(async () => {
  await initBaseline();
}, /* timeout */ 60_000);

beforeEach(() => {
  restoreBaseline();
});

// ── Helpers ────────────────────────────────────────────────────────────

function endSeasonSeeded(seed: number) {
  withSeededRandom(seed, () => {
    useGameStore.getState().endSeason();
  });
}

function getState() {
  return useGameStore.getState();
}

/** Build a synthetic finished league table from the current state's fixture
 *  list so endSeason has data to compute awards/promotion against. We just
 *  mark every fixture as played with a 1-0 home win — enough structure for
 *  the rollover code to run without warnings about empty tables. */
function fillLeagueTablesForRollover() {
  const state = getState();
  const updatedDivisionTables: Record<string, typeof state.divisionTables[string]> = {};
  for (const [divId, clubIds] of Object.entries(state.divisionClubs)) {
    updatedDivisionTables[divId] = clubIds.map((clubId, i) => ({
      clubId,
      played: 46,
      won: Math.max(0, 28 - i),
      drawn: 5,
      lost: i,
      goalsFor: Math.max(10, 80 - i * 2),
      goalsAgainst: 20 + i * 2,
      goalDifference: Math.max(-50, 60 - i * 4),
      points: Math.max(0, 90 - i * 3),
      form: [],
      cleanSheets: Math.max(0, 14 - i),
    }));
  }
  useGameStore.setState({
    divisionTables: updatedDivisionTables,
    leagueTable: updatedDivisionTables[state.playerDivision] ?? [],
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('endSeason — season counter & invariants', () => {
  it('increments the season counter by 1', () => {
    fillLeagueTablesForRollover();
    const before = getState().season;
    endSeasonSeeded(1);
    expect(getState().season).toBe(before + 1);
  });

  it('every club ends with at least 11 valid playerIds (safety-net guarantee)', () => {
    // The safety net at the end of finalizeSeason ensures every club's
    // squad — not necessarily the lineup — has at least 11 valid players.
    // selectBestLineup may legitimately fill < 11 slots if position-
    // compatible players are missing for the chosen formation.
    fillLeagueTablesForRollover();
    endSeasonSeeded(2);
    const { clubs, players } = getState();
    for (const club of Object.values(clubs)) {
      const validSquad = club.playerIds.filter(id => players[id]);
      expect(validSquad.length).toBeGreaterThanOrEqual(11);
    }
  });

  it('every club lineup ID exists in the club\'s playerIds', () => {
    fillLeagueTablesForRollover();
    endSeasonSeeded(3);
    const { clubs } = getState();
    for (const club of Object.values(clubs)) {
      const playerIdSet = new Set(club.playerIds);
      for (const id of club.lineup) {
        expect(playerIdSet.has(id)).toBe(true);
      }
      for (const id of club.subs) {
        expect(playerIdSet.has(id)).toBe(true);
      }
    }
  });

  it('every playerId on a club references an existing player', () => {
    fillLeagueTablesForRollover();
    endSeasonSeeded(4);
    const { clubs, players } = getState();
    for (const club of Object.values(clubs)) {
      for (const id of club.playerIds) {
        expect(players[id]).toBeDefined();
      }
    }
  });

  it('free-agent pool does not exceed FREE_AGENT_POOL_MAX', () => {
    fillLeagueTablesForRollover();
    endSeasonSeeded(5);
    expect(getState().freeAgents.length).toBeLessThanOrEqual(FREE_AGENT_POOL_MAX);
  });
});

describe('endSeason — player aging', () => {
  it('ages every surviving player by exactly 1', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    // Snapshot current ages of the player's club squad (small sample).
    const playerClub = before.clubs[before.playerClubId];
    const sample = playerClub.playerIds
      .map(id => before.players[id])
      .filter(Boolean)
      .filter(p => p.age < 33 && p.contractEnd > before.season) // long-contract, not retiring
      .slice(0, 5);
    expect(sample.length).toBeGreaterThan(0);
    const ageBefore = new Map(sample.map(p => [p.id, p.age]));

    endSeasonSeeded(10);

    const after = getState();
    for (const [id, prevAge] of ageBefore) {
      const survivor = after.players[id];
      // Survivor should still exist and be one year older.
      if (survivor) {
        expect(survivor.age).toBe(prevAge + 1);
      }
    }
  });
});

describe('endSeason — career stats accumulation & season reset', () => {
  it('rolls season goals/assists/appearances into career totals and resets', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    const playerClub = before.clubs[before.playerClubId];

    // Pick a long-contract player and seed their season stats.
    const target = playerClub.playerIds
      .map(id => before.players[id])
      .filter(Boolean)
      .find(p => p.contractEnd > before.season + 1 && p.age < 30);
    expect(target).toBeDefined();

    const seasonGoals = 15;
    const seasonAssists = 8;
    const seasonApps = 38;
    const careerGoalsBefore = target!.careerGoals ?? 0;
    const careerAssistsBefore = target!.careerAssists ?? 0;
    const careerAppsBefore = target!.careerAppearances ?? 0;

    useGameStore.setState({
      players: {
        ...before.players,
        [target!.id]: {
          ...target!,
          goals: seasonGoals,
          assists: seasonAssists,
          appearances: seasonApps,
        },
      },
    });

    endSeasonSeeded(20);

    const after = getState();
    const aged = after.players[target!.id];
    expect(aged).toBeDefined();
    expect(aged.careerGoals).toBe(careerGoalsBefore + seasonGoals);
    expect(aged.careerAssists).toBe(careerAssistsBefore + seasonAssists);
    expect(aged.careerAppearances).toBe(careerAppsBefore + seasonApps);
    // Season counters reset.
    expect(aged.goals).toBe(0);
    expect(aged.assists).toBe(0);
    expect(aged.appearances).toBe(0);
    expect(aged.yellowCards).toBe(0);
    expect(aged.redCards).toBe(0);
    // Match history wiped.
    expect(aged.matchHistory ?? []).toEqual([]);
  });
});

describe('endSeason — contract expiry', () => {
  it('removes expired-contract players from their club', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    const playerClub = before.clubs[before.playerClubId];

    // Force one player to have an expired contract.
    const target = playerClub.playerIds
      .map(id => before.players[id])
      .filter(Boolean)
      .find(p => p.age < 30 && p.overall >= 65);
    expect(target).toBeDefined();

    useGameStore.setState({
      players: {
        ...before.players,
        [target!.id]: { ...target!, contractEnd: before.season }, // expires this season
      },
    });

    endSeasonSeeded(30);

    const after = getState();
    const club = after.clubs[before.playerClubId];
    expect(club.playerIds).not.toContain(target!.id);
    expect(club.lineup).not.toContain(target!.id);
    expect(club.subs).not.toContain(target!.id);
  });

  it('routes eligible expired players (age ≤ 34, OVR ≥ 55) to the free agent pool', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    const playerClub = before.clubs[before.playerClubId];

    const target = playerClub.playerIds
      .map(id => before.players[id])
      .filter(Boolean)
      .find(p => p.overall >= 65 && p.age >= 22 && p.age <= 28);
    expect(target).toBeDefined();

    useGameStore.setState({
      players: {
        ...before.players,
        [target!.id]: { ...target!, contractEnd: before.season },
      },
    });

    endSeasonSeeded(31);

    const after = getState();
    expect(after.freeAgents).toContain(target!.id);
    const fa = after.players[target!.id];
    expect(fa).toBeDefined();
    expect(fa.clubId).toBe('');
  });

  it('drops over-34 expired players entirely (retirement)', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    const playerClub = before.clubs[before.playerClubId];

    const target = playerClub.playerIds
      .map(id => before.players[id])
      .filter(Boolean)
      .find(p => p.contractEnd > before.season);
    expect(target).toBeDefined();

    // Force this player to be 35 with expiring contract — over the cap, so
    // they should be dropped (not added to FA pool).
    useGameStore.setState({
      players: {
        ...before.players,
        [target!.id]: { ...target!, age: 35, contractEnd: before.season },
      },
    });

    endSeasonSeeded(32);

    const after = getState();
    expect(after.freeAgents).not.toContain(target!.id);
    const club = after.clubs[before.playerClubId];
    expect(club.playerIds).not.toContain(target!.id);
  });
});

describe('endSeason — free agent pool maintenance', () => {
  it('ages existing free agents by 1', () => {
    fillLeagueTablesForRollover();
    const before = getState();

    // Inject a young free agent into the pool.
    const fakeFa = {
      ...Object.values(before.players)[0],
      id: 'test-fa-young',
      clubId: '',
      age: 24,
      overall: 70,
      potential: 75,
      contractEnd: before.season + 5,
      goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
    };
    useGameStore.setState({
      freeAgents: [...before.freeAgents, fakeFa.id],
      players: { ...before.players, [fakeFa.id]: fakeFa },
    });

    endSeasonSeeded(40);

    const after = getState();
    const aged = after.players['test-fa-young'];
    expect(aged).toBeDefined();
    expect(aged.age).toBe(25);
  });

  it('evicts free agents that age past 34', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    const fakeFa = {
      ...Object.values(before.players)[0],
      id: 'test-fa-old',
      clubId: '',
      age: 34, // becomes 35 after aging — over the cap
      overall: 70,
      potential: 70,
      contractEnd: before.season + 1,
    };
    useGameStore.setState({
      freeAgents: [...before.freeAgents, fakeFa.id],
      players: { ...before.players, [fakeFa.id]: fakeFa },
    });

    endSeasonSeeded(41);

    const after = getState();
    expect(after.freeAgents).not.toContain('test-fa-old');
  });
});

describe('endSeason — squad gap-fill', () => {
  it('fills squads back up to the minimum after mass departures', () => {
    fillLeagueTablesForRollover();
    const before = getState();
    const targetClubId = before.playerClubId;
    const targetClub = before.clubs[targetClubId];

    // Expire half the squad's contracts.
    const expirePlayers = targetClub.playerIds.slice(0, Math.floor(targetClub.playerIds.length / 2));
    const updatedPlayers = { ...before.players };
    for (const id of expirePlayers) {
      const p = updatedPlayers[id];
      if (p) updatedPlayers[id] = { ...p, contractEnd: before.season };
    }
    useGameStore.setState({ players: updatedPlayers });

    endSeasonSeeded(50);

    const after = getState();
    const club = after.clubs[targetClubId];
    const validSquad = club.playerIds.filter(id => after.players[id]);
    expect(validSquad.length).toBeGreaterThanOrEqual(11);
  });
});
