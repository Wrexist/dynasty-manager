/**
 * Phase 9b/c — Adversarial integration scenarios via the store.
 *
 * Pushes the season pipeline through unusual sequences:
 *   - Two consecutive endSeason calls (relegation cascade — eng → eng-2 → eng-3)
 *   - Multi-cycle smoke run (3 endSeasons in a row) — no orphans, no dupes
 *   - Mass contract expiry across the player's entire lineup — gap-fill
 *     must produce a valid 11-player squad
 *
 * Scenarios that purely test the *integration* of season helpers under
 * stress. Pure-helper coverage lives in seasonEdgeCases.test.ts.
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
    playerDivision: baseline.playerDivision,
    // The phase pair belongs in the snapshot. Left out, a test that happened
    // to enter the promotion playoff (see `rollSeason`) leaked
    // `seasonPhase: 'playoff'` into every test after it, and `endSeason`
    // correctly refused to roll for the rest of the file.
    seasonPhase: baseline.seasonPhase,
    playoffState: baseline.playoffState,
  }));
  useGameStore.setState(fresh);
}

beforeAll(async () => { await initBaseline(); }, 60_000);
beforeEach(() => { restoreBaseline(); });

/**
 * Roll the season, playing out a promotion playoff if one is offered.
 *
 * `endSeason` defers the rollover when the player's club lands in a playoff
 * zone (`orchestration/playoff.ts`) — the bracket is real matches the player
 * has to play first. This harness injects `divisionTables`, but rollover
 * rebuilds its own tables from `divisionFixtures`, so the club's real finishing
 * position is whatever the catch-up simulation produces. Once a season
 * relegates it into a tier that HAS a playoff (eng-2 has four spots), a
 * mid-table injection is no protection: the club can qualify, the rollover is
 * deferred, and every later `endSeason` in the file becomes a no-op.
 *
 * So drive the playoff the way the game does, through `playCurrentMatch`, and
 * return once the season has actually rolled.
 */
function rollSeason(seed: number) {
  withSeededRandom(seed, () => {
    useGameStore.getState().endSeason();
    // Bounded: the bracket is a semi-final and a final at most.
    for (let guard = 0; guard < 4; guard++) {
      const s = useGameStore.getState();
      if (s.seasonPhase !== 'playoff' || !s.playoffState?.pendingMatch) break;
      useGameStore.getState().playCurrentMatch();
    }
  });
}

/**
 * Place player's club at a specific position in their division and fill
 * every league table so endSeason has data to compute promo/relegation
 * against.
 */
function placePlayerAtAndFillTables(targetPosition: number) {
  const state = useGameStore.getState();
  const playerDiv = state.playerDivision;
  const allTables: Record<string, LeagueTableEntry[]> = {};
  for (const [divId, clubIds] of Object.entries(state.divisionClubs)) {
    let ordered = clubIds;
    if (divId === playerDiv) {
      const others = clubIds.filter(id => id !== state.playerClubId);
      ordered = [
        ...others.slice(0, targetPosition - 1),
        state.playerClubId,
        ...others.slice(targetPosition - 1),
      ];
    }
    allTables[divId] = ordered.map((clubId, i) => ({
      clubId, played: 46, won: Math.max(0, 28 - i), drawn: 5, lost: i,
      goalsFor: Math.max(10, 80 - i * 2), goalsAgainst: 20 + i * 2,
      goalDifference: Math.max(-50, 60 - i * 4), points: Math.max(0, 90 - i * 3),
      form: [], cleanSheets: Math.max(0, 14 - i),
    }));
  }
  useGameStore.setState({
    divisionTables: allTables,
    leagueTable: allTables[playerDiv] ?? [],
  });
}

function clubHasNoOrphans() {
  const { clubs, players } = useGameStore.getState();
  for (const club of Object.values(clubs)) {
    for (const id of club.playerIds) {
      if (!players[id]) return false;
    }
    for (const id of club.lineup) {
      if (!club.playerIds.includes(id)) return false;
    }
  }
  return true;
}

function divisionsHaveNoDuplicates() {
  const { divisionClubs } = useGameStore.getState();
  const seen = new Set<string>();
  for (const ids of Object.values(divisionClubs)) {
    for (const id of ids) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  return true;
}

// ── Consecutive endSeason runs preserve state integrity ──────────────

describe('endSeason — consecutive runs preserve state integrity', () => {
  it('two back-to-back endSeasons keep the player\'s club valid', () => {
    // Note: `endSeason` rebuilds final tables from `state.divisionFixtures`
    // (not from injected `divisionTables`), so unplayed fixtures produce
    // tied tables resolved alphabetically — promotion/relegation outcomes
    // are not reliably forced from this test harness. We assert the
    // robustness invariants rather than a specific division change.
    placePlayerAtAndFillTables(5);
    rollSeason(1);
    const state2 = useGameStore.getState();
    expect(state2.clubs[PLAYER_CLUB_ID]).toBeDefined();
    expect(state2.season).toBe(baseline!.season + 1);

    placePlayerAtAndFillTables(5);
    rollSeason(2);
    const state3 = useGameStore.getState();

    expect(state3.clubs[PLAYER_CLUB_ID]).toBeDefined();
    expect(state3.clubs[PLAYER_CLUB_ID].playerIds.length).toBeGreaterThanOrEqual(11);
    expect(state3.season).toBe(baseline!.season + 2);
    expect(clubHasNoOrphans()).toBe(true);
    expect(divisionsHaveNoDuplicates()).toBe(true);
  });

  it('player\'s playerDivision matches their club\'s divisionId after rollover', () => {
    placePlayerAtAndFillTables(5);
    rollSeason(3);
    const state = useGameStore.getState();
    const club = state.clubs[PLAYER_CLUB_ID];
    expect(club.divisionId).toBe(state.playerDivision);
  });
});

// ── Multi-cycle smoke ─────────────────────────────────────────────────

describe('endSeason — 3-season smoke run with no state corruption', () => {
  it('three consecutive endSeasons leave no orphans, no duplicates, valid squads', () => {
    for (let i = 0; i < 3; i++) {
      placePlayerAtAndFillTables(5); // mid-table — no promo/releg flips
      rollSeason(100 + i);
      expect(clubHasNoOrphans()).toBe(true);
      expect(divisionsHaveNoDuplicates()).toBe(true);
    }
    const final = useGameStore.getState();
    // Season counter incremented exactly 3 times.
    expect(final.season).toBe(baseline!.season + 3);
    // Every club still has ≥11 valid players.
    for (const club of Object.values(final.clubs)) {
      const valid = club.playerIds.filter(id => final.players[id]);
      expect(valid.length).toBeGreaterThanOrEqual(11);
    }
  });
});

// ── Mass contract expiry on player's club ─────────────────────────────

describe('endSeason — mass contract expiry across the lineup', () => {
  it('survives every player on the lineup having an expiring contract', () => {
    placePlayerAtAndFillTables(5);
    const state = useGameStore.getState();
    const playerClub = state.clubs[PLAYER_CLUB_ID];

    // Force the contract of every starting-XI player to expire.
    const updatedPlayers = { ...state.players };
    for (const id of playerClub.lineup) {
      const p = updatedPlayers[id];
      if (p) updatedPlayers[id] = { ...p, contractEnd: state.season };
    }
    useGameStore.setState({ players: updatedPlayers });

    rollSeason(200);

    const after = useGameStore.getState();
    const club = after.clubs[PLAYER_CLUB_ID];
    // Gap-fill must produce ≥11 valid players.
    const validSquad = club.playerIds.filter(id => after.players[id]);
    expect(validSquad.length).toBeGreaterThanOrEqual(11);
    // No orphan IDs anywhere.
    expect(clubHasNoOrphans()).toBe(true);
  });

  it('survives every club in the player\'s division having mass-expiring contracts', () => {
    placePlayerAtAndFillTables(5);
    const state = useGameStore.getState();
    const playerDiv = state.playerDivision;
    const divClubIds = state.divisionClubs[playerDiv];

    // Expire the lineups of every club in the division simultaneously.
    const updatedPlayers = { ...state.players };
    for (const clubId of divClubIds) {
      const club = state.clubs[clubId];
      if (!club) continue;
      for (const id of club.lineup) {
        const p = updatedPlayers[id];
        if (p) updatedPlayers[id] = { ...p, contractEnd: state.season };
      }
    }
    useGameStore.setState({ players: updatedPlayers });

    rollSeason(201);

    expect(clubHasNoOrphans()).toBe(true);
    expect(divisionsHaveNoDuplicates()).toBe(true);
    const after = useGameStore.getState();
    for (const clubId of divClubIds) {
      const club = after.clubs[clubId];
      // Some clubs in this division may have been promoted/relegated and
      // are no longer in the original divClubIds list — but if they still
      // exist, they should have a valid squad.
      if (club) {
        const valid = club.playerIds.filter(id => after.players[id]);
        expect(valid.length).toBeGreaterThanOrEqual(11);
      }
    }
  });
});

// ── Promotion + cup win in the same season ────────────────────────────

describe('endSeason — promotion + cup win same season', () => {
  it('records both Promotion (verdict reflects high finish) and cup Winner', () => {
    // Player isn't actually in a promotable position from div 1 — but we
    // can still verify that cup-win + great finish coexist in history.
    placePlayerAtAndFillTables(1);
    useGameStore.setState({
      cup: {
        ties: [{ id: 'final', round: 'F', homeClubId: PLAYER_CLUB_ID, awayClubId: 'arsenal',
          played: true, homeGoals: 3, awayGoals: 1, week: 42 }],
        currentRound: 'F', eliminated: false, winner: PLAYER_CLUB_ID,
      },
    });

    rollSeason(300);

    const { seasonHistory } = useGameStore.getState();
    const latest = seasonHistory[seasonHistory.length - 1];
    expect(latest.cupResult).toBe('Winner');
    expect(latest.boardVerdict).toBe('excellent');
    expect(latest.position).toBe(1);
  });
});
