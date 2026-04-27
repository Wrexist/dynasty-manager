/**
 * Phase 10 — Integration & regression suite for season rollover.
 *
 * Captures the end-to-end guarantees the season pipeline must satisfy and
 * pins them to specific assertions. Complements (does not duplicate)
 * longevity.test.ts, which exercises real advanceWeek-driven 10-20 season
 * runs. This file focuses on:
 *
 *   - Performance budget: endSeason completes within a reasonable wall-clock
 *     budget on a default 4-tier eng pyramid (catches accidental quadratic
 *     blow-ups during refactors)
 *   - Console-clean assertion: endSeason emits no errors or warnings on the
 *     happy path
 *   - Week-1 next-season invariants: comprehensive checklist of fields the
 *     UI immediately reads when loading the dashboard
 *   - 5-cycle drift check: stable state across 5 consecutive endSeasons
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

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
    playerDivision: baseline.playerDivision,
  }));
  useGameStore.setState(fresh);
}

beforeAll(async () => { await initBaseline(); }, 60_000);
beforeEach(() => { restoreBaseline(); });

function fillTablesAndPlayFixtures() {
  const state = useGameStore.getState();
  const tables: Record<string, LeagueTableEntry[]> = {};
  for (const [divId, clubIds] of Object.entries(state.divisionClubs)) {
    tables[divId] = clubIds.map((clubId, i) => ({
      clubId, played: 46, won: Math.max(0, 28 - i), drawn: 5, lost: i,
      goalsFor: Math.max(10, 80 - i * 2), goalsAgainst: 20 + i * 2,
      goalDifference: Math.max(-50, 60 - i * 4), points: Math.max(0, 90 - i * 3),
      form: ['W', 'L', 'W'], cleanSheets: Math.max(0, 14 - i),
    }));
  }
  const playedFixtures = state.fixtures.map(f => ({
    ...f, played: true, homeGoals: 2, awayGoals: 1,
  }));
  useGameStore.setState({
    divisionTables: tables,
    leagueTable: tables[state.playerDivision] ?? [],
    fixtures: playedFixtures,
    week: 46,
  });
}

// ── Performance budget ───────────────────────────────────────────────

describe('endSeason — performance budget', () => {
  it('completes within 5 seconds on a default 4-tier eng pyramid', () => {
    fillTablesAndPlayFixtures();
    const start = performance.now();
    withSeededRandom(1, () => useGameStore.getState().endSeason());
    const elapsed = performance.now() - start;
    // Generous bound — should typically be under 1s. The point is to fail
    // loudly if a refactor makes endSeason quadratic in clubs/players.
    expect(elapsed).toBeLessThan(5_000);
  });
});

// ── Console-clean assertion ─────────────────────────────────────────

describe('endSeason — console hygiene', () => {
  it('emits no console.error during a happy-path rollover', () => {
    fillTablesAndPlayFixtures();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      withSeededRandom(2, () => useGameStore.getState().endSeason());
      expect(errSpy).not.toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('emits no console.warn during a happy-path rollover (non-empty division tables)', () => {
    // The promotionRelegation defensive warning fires only when league
    // sizes drift; with a clean baseline + filled tables, there should be
    // no warnings.
    fillTablesAndPlayFixtures();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      withSeededRandom(3, () => useGameStore.getState().endSeason());
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// ── Week-1 next-season invariants ────────────────────────────────────

describe('endSeason — week 1 next-season invariants', () => {
  it('week is exactly 1 and matchSubsUsed is reset', () => {
    fillTablesAndPlayFixtures();
    withSeededRandom(4, () => useGameStore.getState().endSeason());
    const state = useGameStore.getState();
    expect(state.week).toBe(1);
    expect(state.matchSubsUsed).toBe(0);
  });

  it('all fixtures unplayed with empty events array', () => {
    fillTablesAndPlayFixtures();
    withSeededRandom(5, () => useGameStore.getState().endSeason());
    const { fixtures } = useGameStore.getState();
    expect(fixtures.length).toBeGreaterThan(0);
    for (const f of fixtures) {
      expect(f.played).toBe(false);
      expect(f.events).toEqual([]);
    }
  });

  it('every player on a clublineup has 0 season stats', () => {
    fillTablesAndPlayFixtures();
    withSeededRandom(6, () => useGameStore.getState().endSeason());
    const { clubs, players } = useGameStore.getState();
    for (const club of Object.values(clubs)) {
      for (const id of club.lineup) {
        const p = players[id];
        if (!p) continue;
        expect(p.goals).toBe(0);
        expect(p.assists).toBe(0);
        expect(p.appearances).toBe(0);
        expect(p.yellowCards).toBe(0);
        expect(p.redCards).toBe(0);
      }
    }
  });

  it('seasonHistory contains exactly one new entry vs the baseline', () => {
    fillTablesAndPlayFixtures();
    const before = baseline!.seasonHistory.length;
    withSeededRandom(7, () => useGameStore.getState().endSeason());
    expect(useGameStore.getState().seasonHistory.length).toBe(before + 1);
  });

  it('current match state is fully reset', () => {
    fillTablesAndPlayFixtures();
    withSeededRandom(8, () => useGameStore.getState().endSeason());
    const state = useGameStore.getState();
    expect(state.currentMatchResult).toBeNull();
    expect(state.halfTimeState).toBeNull();
    expect(state.matchPhase).toBe('none');
  });

  it('transferMarket is non-empty (initial market regenerated)', () => {
    fillTablesAndPlayFixtures();
    withSeededRandom(9, () => useGameStore.getState().endSeason());
    expect(useGameStore.getState().transferMarket.length).toBeGreaterThan(0);
  });

  it('player\'s club references valid players in lineup AND subs', () => {
    fillTablesAndPlayFixtures();
    withSeededRandom(10, () => useGameStore.getState().endSeason());
    const { clubs, players, playerClubId } = useGameStore.getState();
    const club = clubs[playerClubId];
    for (const id of [...club.lineup, ...club.subs]) {
      expect(players[id]).toBeDefined();
      expect(club.playerIds).toContain(id);
    }
  });
});

// ── 5-season multi-cycle drift check ─────────────────────────────────

describe('endSeason — 5-cycle drift check', () => {
  it('5 consecutive endSeasons produce a stable state with monotonic season counter', () => {
    let lastClubsCount = 0;
    let lastPlayersCount = 0;
    for (let i = 0; i < 5; i++) {
      fillTablesAndPlayFixtures();
      withSeededRandom(500 + i, () => useGameStore.getState().endSeason());

      const state = useGameStore.getState();
      // Season counter is monotonically increasing.
      expect(state.season).toBe(baseline!.season + i + 1);
      // Week stays at 1 every rollover.
      expect(state.week).toBe(1);

      // Clubs count must stay within a realistic band (replacements may
      // shuffle ids but total should be stable to within ±5%).
      const clubsCount = Object.keys(state.clubs).length;
      const playersCount = Object.keys(state.players).length;
      if (i > 0) {
        const clubsDriftPct = Math.abs(clubsCount - lastClubsCount) / lastClubsCount;
        // Players naturally drift more (gap-fill, retirements, generation),
        // but absolute headcount should remain within 50% bounds.
        const playersDriftPct = Math.abs(playersCount - lastPlayersCount) / lastPlayersCount;
        expect(clubsDriftPct).toBeLessThan(0.05);
        expect(playersDriftPct).toBeLessThan(0.5);
      }
      lastClubsCount = clubsCount;
      lastPlayersCount = playersCount;
    }
  });

  it('seasonHistory grows by exactly 1 each cycle', () => {
    const before = baseline!.seasonHistory.length;
    for (let i = 0; i < 5; i++) {
      fillTablesAndPlayFixtures();
      withSeededRandom(600 + i, () => useGameStore.getState().endSeason());
      expect(useGameStore.getState().seasonHistory.length).toBe(before + i + 1);
    }
  });
});
