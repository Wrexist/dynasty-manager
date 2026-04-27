/**
 * Phase 5c — Integration: cup state flows into season history at endSeason.
 *
 * Spins up a real game via initGame, plants cup/league-cup/continental state
 * for the player's club, runs endSeason, and verifies the new SeasonHistory
 * entry records the correct results. This catches end-to-end wiring bugs
 * that pure-function tests miss.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { useGameStore } from '@/store/gameStore';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type { CupState, ContinentalTournamentState, LeagueTableEntry } from '@/types/game';

import { withSeededRandom } from './helpers/seasonFixtures';

const PLAYER_CLUB_ID = 'manchester-city';

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
}, 60_000);

beforeEach(() => {
  restoreBaseline();
});

function fillLeagueTablesForRollover() {
  const state = useGameStore.getState();
  const updatedDivisionTables: Record<string, LeagueTableEntry[]> = {};
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

function getLatestHistory() {
  const { seasonHistory } = useGameStore.getState();
  return seasonHistory[seasonHistory.length - 1];
}

// ── Domestic cup ──────────────────────────────────────────────────────

describe('endSeason — domestic cup result in season history', () => {
  it('records "Winner" when player\'s club won the cup', () => {
    fillLeagueTablesForRollover();
    const cupState: CupState = {
      ties: [{
        id: 'final', round: 'F', homeClubId: PLAYER_CLUB_ID, awayClubId: 'arsenal',
        played: true, homeGoals: 2, awayGoals: 1, week: 42,
      }],
      currentRound: 'F', eliminated: false, winner: PLAYER_CLUB_ID,
    };
    useGameStore.setState({ cup: cupState });

    withSeededRandom(1, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().cupResult).toBe('Winner');
  });

  it('records the eliminated round when player lost in QF', () => {
    fillLeagueTablesForRollover();
    const cupState: CupState = {
      ties: [
        { id: 'r1', round: 'R1', homeClubId: PLAYER_CLUB_ID, awayClubId: 'arsenal',
          played: true, homeGoals: 3, awayGoals: 1, week: 4 },
        { id: 'qf', round: 'QF', homeClubId: PLAYER_CLUB_ID, awayClubId: 'liverpool',
          played: true, homeGoals: 0, awayGoals: 1, week: 28 },
      ],
      currentRound: 'SF', eliminated: true, winner: null,
    };
    useGameStore.setState({ cup: cupState });

    withSeededRandom(2, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().cupResult).toBe('Quarter-Finals');
  });

  it('records "Did not enter" when player\'s club has no cup ties', () => {
    fillLeagueTablesForRollover();
    const cupState: CupState = {
      ties: [{ id: 'r1', round: 'R1', homeClubId: 'arsenal', awayClubId: 'liverpool',
        played: true, homeGoals: 1, awayGoals: 0, week: 4 }],
      currentRound: 'R2', eliminated: false, winner: null,
    };
    useGameStore.setState({ cup: cupState });

    withSeededRandom(3, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().cupResult).toBe('Did not enter');
  });
});

// ── Continental cups ──────────────────────────────────────────────────

describe('endSeason — continental cup result in season history', () => {
  it('records Champions Cup "Winner" when player won', () => {
    fillLeagueTablesForRollover();
    const championsCup: ContinentalTournamentState = {
      competition: 'champions_cup',
      season: 1,
      groups: [],
      knockoutTies: [{
        id: 'final', round: 'F', homeClubId: PLAYER_CLUB_ID, awayClubId: 'real-madrid',
        leg1Played: true, leg1HomeGoals: 2, leg1AwayGoals: 1,
        leg2Played: false, leg2HomeGoals: 0, leg2AwayGoals: 0,
        week1: 40, week2: 42, winnerId: PLAYER_CLUB_ID,
      }],
      currentPhase: 'complete',
      currentRound: null,
      playerEliminated: false,
      playerGroupId: null,
      winnerId: PLAYER_CLUB_ID,
    };
    useGameStore.setState({ championsCup });

    withSeededRandom(4, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().championsCupResult).toBe('Winner');
  });

  it('records Champions Cup "Quarter-Finals" when player exited at QF', () => {
    fillLeagueTablesForRollover();
    const championsCup: ContinentalTournamentState = {
      competition: 'champions_cup',
      season: 1,
      groups: [],
      knockoutTies: [{
        id: 'qf', round: 'QF', homeClubId: PLAYER_CLUB_ID, awayClubId: 'bayern-munich',
        leg1Played: true, leg1HomeGoals: 1, leg1AwayGoals: 1,
        leg2Played: true, leg2HomeGoals: 2, leg2AwayGoals: 0,
        week1: 28, week2: 30, winnerId: 'bayern-munich',
      }],
      currentPhase: 'complete',
      currentRound: null,
      playerEliminated: true,
      playerGroupId: null,
      winnerId: 'bayern-munich',
    };
    useGameStore.setState({ championsCup });

    withSeededRandom(5, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().championsCupResult).toBe('Quarter-Finals');
  });

  it('records "Did not qualify" when player\'s club is not in the tournament', () => {
    fillLeagueTablesForRollover();
    // Default state from initGame may or may not include a championsCup —
    // explicitly clear it to test the no-tournament path.
    useGameStore.setState({ championsCup: null });

    withSeededRandom(6, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().championsCupResult).toBe('Did not qualify');
  });
});

// ── Season history overall integrity ──────────────────────────────────

describe('endSeason — overall season history entry', () => {
  it('appends one new entry with the current season number', () => {
    fillLeagueTablesForRollover();
    const before = useGameStore.getState();
    const beforeLen = before.seasonHistory.length;
    const beforeSeason = before.season;

    withSeededRandom(7, () => useGameStore.getState().endSeason());

    const after = useGameStore.getState();
    expect(after.seasonHistory.length).toBe(beforeLen + 1);
    expect(getLatestHistory().season).toBe(beforeSeason);
  });

  it('records the player\'s final league position', () => {
    fillLeagueTablesForRollover();
    // Force player's club to the top of its division table.
    const state = useGameStore.getState();
    const playerDiv = state.playerDivision;
    const tableForDiv = state.divisionTables[playerDiv];
    if (!tableForDiv || tableForDiv.length === 0) {
      throw new Error('No division table to manipulate');
    }
    const reordered = [
      { ...tableForDiv[0], clubId: PLAYER_CLUB_ID },
      ...tableForDiv.slice(1).filter(e => e.clubId !== PLAYER_CLUB_ID),
    ];
    useGameStore.setState({
      divisionTables: { ...state.divisionTables, [playerDiv]: reordered },
      leagueTable: reordered,
    });

    withSeededRandom(8, () => useGameStore.getState().endSeason());

    expect(getLatestHistory().position).toBe(1);
  });
});
