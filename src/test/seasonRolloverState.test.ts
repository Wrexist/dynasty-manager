/**
 * Phase 7b — Next-season state cleanup at endSeason (integration via store).
 *
 * After endSeason runs, the new season must start in a fully clean state:
 *   - season counter +1, week reset to 1
 *   - league tables reset to 0/0/0/0
 *   - Player season stats wiped (covered separately in seasonLifecycle.test.ts);
 *     here we focus on league/cup/fixture-level reset
 *   - New cup draw generated
 *   - Fixtures regenerated for the player's division
 *
 * Bugs here surface as "Season 2 starts on week 47", stale standings, or
 * the cup ladder showing last season's eliminated round.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { useGameStore } from '@/store/gameStore';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type { LeagueTableEntry } from '@/types/game';

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
    totalWeeks: baseline.totalWeeks,
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
    transferMarket: baseline.transferMarket,
  }));
  useGameStore.setState(fresh);
}

beforeAll(async () => {
  await initBaseline();
}, 60_000);

beforeEach(() => {
  restoreBaseline();
});

function fillLeagueTablesAndPlayFixtures() {
  const state = useGameStore.getState();
  const updatedTables: Record<string, LeagueTableEntry[]> = {};
  for (const [divId, clubIds] of Object.entries(state.divisionClubs)) {
    updatedTables[divId] = clubIds.map((clubId, i) => ({
      clubId, played: 46, won: Math.max(0, 28 - i), drawn: 5, lost: i,
      goalsFor: Math.max(10, 80 - i * 2), goalsAgainst: 20 + i * 2,
      goalDifference: Math.max(-50, 60 - i * 4), points: Math.max(0, 90 - i * 3),
      form: ['W', 'L', 'W', 'D', 'W'], cleanSheets: Math.max(0, 14 - i),
    }));
  }
  // Mark all fixtures as played
  const playedFixtures = state.fixtures.map(f => ({
    ...f, played: true, homeGoals: 2, awayGoals: 1,
  }));
  useGameStore.setState({
    divisionTables: updatedTables,
    leagueTable: updatedTables[state.playerDivision] ?? [],
    fixtures: playedFixtures,
  });
}

// ── Season counter & week ─────────────────────────────────────────────

describe('endSeason — season counter & week reset', () => {
  it('increments season by exactly 1', () => {
    fillLeagueTablesAndPlayFixtures();
    const before = useGameStore.getState().season;
    withSeededRandom(1, () => useGameStore.getState().endSeason());
    expect(useGameStore.getState().season).toBe(before + 1);
  });

  it('resets week to 1', () => {
    fillLeagueTablesAndPlayFixtures();
    useGameStore.setState({ week: 38 }); // pretend last week of last season
    withSeededRandom(2, () => useGameStore.getState().endSeason());
    expect(useGameStore.getState().week).toBe(1);
  });

  it('sets totalWeeks to the new division\'s totalWeeks', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(3, () => useGameStore.getState().endSeason());
    const tw = useGameStore.getState().totalWeeks;
    // Player started in div-1 (eng, 38 weeks for 20 teams) — totalWeeks
    // depends on the new division they're in. Safety: should be in a
    // sensible range.
    expect(tw).toBeGreaterThanOrEqual(38);
    expect(tw).toBeLessThanOrEqual(46);
  });
});

// ── Fixture regeneration ──────────────────────────────────────────────

describe('endSeason — fixture regeneration', () => {
  it('regenerates fixtures (every fixture starts unplayed with 0-0)', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(4, () => useGameStore.getState().endSeason());
    const { fixtures } = useGameStore.getState();
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      expect(f.played).toBe(false);
      expect(f.homeGoals).toBe(0);
      expect(f.awayGoals).toBe(0);
      expect(f.events).toEqual([]);
    }
  });

  it('every new fixture has a week within totalWeeks', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(5, () => useGameStore.getState().endSeason());
    const { fixtures, totalWeeks } = useGameStore.getState();
    for (const f of fixtures) {
      expect(f.week).toBeGreaterThanOrEqual(1);
      expect(f.week).toBeLessThanOrEqual(totalWeeks);
    }
  });

  it('player\'s club is referenced in its new division\'s fixtures', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(6, () => useGameStore.getState().endSeason());
    const { fixtures, playerClubId } = useGameStore.getState();
    const playerFixtures = fixtures.filter(
      f => f.homeClubId === playerClubId || f.awayClubId === playerClubId,
    );
    // Each team plays (n-1)*2 matches; even small leagues guarantee ≥ 18.
    expect(playerFixtures.length).toBeGreaterThanOrEqual(18);
  });
});

// ── Cup regeneration ──────────────────────────────────────────────────

describe('endSeason — cup state regeneration', () => {
  it('regenerates the domestic cup with no winner and not eliminated', () => {
    fillLeagueTablesAndPlayFixtures();
    // Pretend we won the cup last season.
    useGameStore.setState({
      cup: { ties: [], currentRound: 'F', eliminated: false, winner: PLAYER_CLUB_ID },
    });

    withSeededRandom(7, () => useGameStore.getState().endSeason());

    const cup = useGameStore.getState().cup;
    expect(cup.winner).toBeNull();
    expect(cup.eliminated).toBe(false);
    expect(cup.ties.length).toBeGreaterThan(0);
    // All new ties should start unplayed (except byes, which start played).
    const realTies = cup.ties.filter(t => t.awayClubId !== '__BYE__');
    for (const t of realTies) {
      expect(t.played).toBe(false);
      expect(t.homeGoals).toBe(0);
      expect(t.awayGoals).toBe(0);
    }
  });
});

// ── League table reset ───────────────────────────────────────────────

describe('endSeason — league table reset', () => {
  it('resets every divisionTable entry to played=0/points=0', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(8, () => useGameStore.getState().endSeason());
    const { divisionTables } = useGameStore.getState();
    for (const [, table] of Object.entries(divisionTables)) {
      for (const entry of table) {
        expect(entry.played).toBe(0);
        expect(entry.won).toBe(0);
        expect(entry.drawn).toBe(0);
        expect(entry.lost).toBe(0);
        expect(entry.goalsFor).toBe(0);
        expect(entry.goalsAgainst).toBe(0);
        expect(entry.points).toBe(0);
        expect(entry.form).toEqual([]);
      }
    }
  });

  it('top-level leagueTable mirrors the player\'s reset division table', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(9, () => useGameStore.getState().endSeason());
    const { leagueTable } = useGameStore.getState();
    for (const entry of leagueTable) {
      expect(entry.played).toBe(0);
      expect(entry.points).toBe(0);
    }
  });
});

// ── Continental cup regeneration ──────────────────────────────────────

describe('endSeason — continental cup regeneration', () => {
  it('regenerates Champions Cup with current season number and no winner', () => {
    fillLeagueTablesAndPlayFixtures();
    withSeededRandom(10, () => useGameStore.getState().endSeason());
    const { championsCup, season } = useGameStore.getState();
    if (championsCup) {
      // Re-drawn for the new season — winner is reset, season number matches.
      // `playerEliminated` may be true if the player's club did not qualify
      // for the new draw (legitimate case), so we don't pin it here.
      expect(championsCup.season).toBe(season);
      expect(championsCup.winnerId).toBeNull();
    }
  });
});
