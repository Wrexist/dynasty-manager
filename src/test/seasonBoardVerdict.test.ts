/**
 * Phase 6c — Board verdict thresholds at season end (integration via store).
 *
 * The board verdict drives sackings, confidence resets, and Hall of Managers
 * eligibility. The verdict ladder is:
 *   - excellent: pos ≤ max(1, expectedPos - 3)
 *   - good:      pos ≤ expectedPos
 *   - acceptable:pos ≤ expectedPos + 4
 *   - poor:      pos > expectedPos + 4 AND boardConfidence ≥ 20
 *   - sacked:    pos > expectedPos + 4 AND boardConfidence < 20
 *
 * Spins up a real game, forces the player's club to a specific final
 * position, sets boardConfidence, calls endSeason, and asserts the verdict
 * recorded on the latest SeasonHistory entry.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { useGameStore } from '@/store/gameStore';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { getExpectedPosition } from '@/config/gameBalance';
import type { LeagueTableEntry } from '@/types/game';

import { withSeededRandom } from './helpers/seasonFixtures';

const PLAYER_CLUB_ID = 'manchester-city'; // reputation 5 → expected position 3

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

/**
 * Force the player's club to a specific finishing position in the league.
 * Builds a fresh table for the player's division with the player's club at
 * `targetPosition` (1-indexed), then mirrors it onto leagueTable.
 */
function placePlayerAt(targetPosition: number) {
  const state = useGameStore.getState();
  const divId = state.playerDivision;
  const divClubs = state.divisionClubs[divId];
  if (!divClubs || divClubs.length === 0) {
    throw new Error('No division clubs available');
  }
  // Build an ordered list with the player's club at the requested slot.
  const others = divClubs.filter(id => id !== state.playerClubId);
  const ordered = [
    ...others.slice(0, targetPosition - 1),
    state.playerClubId,
    ...others.slice(targetPosition - 1),
  ];
  const table: LeagueTableEntry[] = ordered.map((clubId, i) => ({
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

  // Build matching tables for every other division so endSeason has data.
  const allTables: Record<string, LeagueTableEntry[]> = {};
  for (const [otherDivId, clubs] of Object.entries(state.divisionClubs)) {
    if (otherDivId === divId) continue;
    allTables[otherDivId] = clubs.map((clubId, i) => ({
      clubId, played: 46, won: Math.max(0, 28 - i), drawn: 5, lost: i,
      goalsFor: Math.max(10, 80 - i * 2), goalsAgainst: 20 + i * 2,
      goalDifference: Math.max(-50, 60 - i * 4), points: Math.max(0, 90 - i * 3),
      form: [], cleanSheets: Math.max(0, 14 - i),
    }));
  }
  allTables[divId] = table;

  useGameStore.setState({
    divisionTables: allTables,
    leagueTable: table,
  });
}

function setBoardConfidence(value: number) {
  useGameStore.setState({ boardConfidence: value });
}

function getLatestVerdict() {
  const { seasonHistory } = useGameStore.getState();
  return seasonHistory[seasonHistory.length - 1].boardVerdict;
}

// ── Verdict thresholds ────────────────────────────────────────────────

describe('endSeason — board verdict thresholds (rep 5 → expected position 3)', () => {
  it('precondition: Manchester City has reputation 5 → expected position 3', () => {
    const club = baseline!.clubs[PLAYER_CLUB_ID];
    expect(club.reputation).toBe(5);
    expect(getExpectedPosition(club.reputation)).toBe(3);
  });

  it('records "excellent" when finishing at expected - 3 or higher (pos 1)', () => {
    placePlayerAt(1);
    setBoardConfidence(60);
    withSeededRandom(1, () => useGameStore.getState().endSeason());
    expect(getLatestVerdict()).toBe('excellent');
  });

  it('records "good" when finishing at expected position (pos 3)', () => {
    placePlayerAt(3);
    setBoardConfidence(60);
    withSeededRandom(2, () => useGameStore.getState().endSeason());
    expect(getLatestVerdict()).toBe('good');
  });

  it('records "good" when finishing better than expected but not excellent (pos 2)', () => {
    placePlayerAt(2);
    setBoardConfidence(60);
    withSeededRandom(3, () => useGameStore.getState().endSeason());
    expect(getLatestVerdict()).toBe('good');
  });

  it('records "acceptable" within VERDICT_ACCEPTABLE_OFFSET of expected (pos 7)', () => {
    placePlayerAt(7);
    setBoardConfidence(60);
    withSeededRandom(4, () => useGameStore.getState().endSeason());
    expect(getLatestVerdict()).toBe('acceptable');
  });

  it('records "poor" when below acceptable but board still trusts (pos 12, conf 50)', () => {
    placePlayerAt(12);
    setBoardConfidence(50);
    withSeededRandom(5, () => useGameStore.getState().endSeason());
    expect(getLatestVerdict()).toBe('poor');
  });

  it('records "sacked" when below acceptable AND board confidence below threshold (pos 12, conf 10)', () => {
    placePlayerAt(12);
    setBoardConfidence(10);
    withSeededRandom(6, () => useGameStore.getState().endSeason());
    expect(getLatestVerdict()).toBe('sacked');
  });
});
