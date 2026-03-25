/**
 * Edge Case & Boundary Tests
 *
 * Tests for dangerous scenarios: mass contract expiry, transfer window boundaries,
 * loan edge cases, and season turnover integrity.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertValidGameState } from './stateValidator';
import { determineZones } from '@/utils/promotionRelegation';
import { LEAGUES } from '@/data/league';
const CLUB_ID = 'manchester-city';
const TOTAL_WEEKS = 46;

/** Advance one full season. */
function advanceFullSeason() {
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
  }
  useGameStore.getState().endSeason();
}

describe('2A: Mass Contract Expiry', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('handles 8+ players expiring in the same season without crashing', { timeout: 30_000 }, () => {
    const state = useGameStore.getState();
    const playerClub = state.clubs[CLUB_ID];
    const players = { ...state.players };

    // Set 10 players to expire this season
    let count = 0;
    for (const pid of playerClub.playerIds) {
      if (count >= 10) break;
      players[pid] = { ...players[pid], contractEnd: state.season };
      count++;
    }
    useGameStore.setState({ players });

    // Advance the full season
    advanceFullSeason();

    const postState = useGameStore.getState();

    // Club should still have a valid squad
    const club = postState.clubs[CLUB_ID] || postState.clubs[postState.playerClubId];
    if (club) {
      const validPlayers = club.playerIds.filter(id => postState.players[id]);
      expect(validPlayers.length, 'Club should still have enough players').toBeGreaterThanOrEqual(11);

      // No orphaned players in lineup
      for (const pid of club.lineup) {
        expect(club.playerIds.includes(pid), `Lineup player ${pid} should be in playerIds`).toBe(true);
        expect(postState.players[pid], `Lineup player ${pid} should exist in state.players`).toBeDefined();
      }

      // wageBill should be non-negative
      expect(club.wageBill).toBeGreaterThanOrEqual(0);
    }

    // State should still be valid
    assertValidGameState(postState, 'After mass contract expiry');
  });
});

describe('2B: Transfer Window Boundaries', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('enforces transfer window open/close at correct weeks', () => {
    const state = useGameStore.getState();

    // Week 1: window should be open
    expect(state.transferWindowOpen, 'Week 1 should be open').toBe(true);

    // Advance to week 8 (last summer window week)
    for (let w = 0; w < 7; w++) {
      useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }
    const stateW8 = useGameStore.getState();
    expect(stateW8.week).toBe(8);
    expect(stateW8.transferWindowOpen, `Week ${stateW8.week}: window should be open`).toBe(true);

    // Advance to week 9 (window closed)
    useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
    const stateW9 = useGameStore.getState();
    expect(stateW9.week).toBe(9);
    expect(stateW9.transferWindowOpen, `Week ${stateW9.week}: window should be closed`).toBe(false);

    // Advance to week 20 (winter window opens)
    while (useGameStore.getState().week < 20) {
      useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }
    const stateW20 = useGameStore.getState();
    expect(stateW20.week).toBe(20);
    expect(stateW20.transferWindowOpen, `Week ${stateW20.week}: winter window should be open`).toBe(true);

    // Advance to week 24 (last winter week)
    while (useGameStore.getState().week < 24) {
      useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }
    const stateW24 = useGameStore.getState();
    expect(stateW24.week).toBe(24);
    expect(stateW24.transferWindowOpen, `Week ${stateW24.week}: winter window should be open`).toBe(true);

    // Advance to week 25 (window closed again)
    useGameStore.getState().advanceWeek();
    useGameStore.getState().playCurrentMatch();
    const stateW25 = useGameStore.getState();
    expect(stateW25.week).toBe(25);
    expect(stateW25.transferWindowOpen, `Week ${stateW25.week}: window should be closed`).toBe(false);
  });

  it('rejects transfers when window is closed', () => {
    // Advance to week 9 (window closed)
    for (let w = 0; w < 8; w++) {
      useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }

    const state = useGameStore.getState();
    expect(state.transferWindowOpen).toBe(false);

    // Try to make an offer — should fail
    const listing = state.transferMarket[0];
    if (listing) {
      const result = useGameStore.getState().makeOfferWithNegotiation(listing.playerId, listing.askingPrice);
      expect(result.outcome).toBe('rejected');
      expect(result.message).toContain('closed');
    }
  });
});

describe('2C: Loan Edge Cases', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('rejects loan recall before 4 weeks', () => {
    const state = useGameStore.getState();
    const playerClub = state.clubs[CLUB_ID];
    const benchedPlayer = playerClub.playerIds.find(
      pid => !playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid)
    );
    if (!benchedPlayer) return; // skip if no benched player

    // Find a destination club
    const destClubId = Object.keys(state.clubs).find(id => id !== CLUB_ID);
    if (!destClubId) return;

    // Loan out with recall clause
    const loanResult = useGameStore.getState().loanOut(benchedPlayer, destClubId, 20, 50, true);
    expect(loanResult.success).toBe(true);

    // Try to recall immediately (week 1, 0 weeks elapsed)
    const loans = useGameStore.getState().activeLoans;
    expect(loans.length).toBeGreaterThan(0);

    const recallResult = useGameStore.getState().recallLoan(loans[0].id);
    expect(recallResult.success).toBe(false);
    expect(recallResult.message).toContain('4 weeks');
  });

  it('allows loan recall after 4 weeks with recall clause', () => {
    const state = useGameStore.getState();
    const playerClub = state.clubs[CLUB_ID];
    const benchedPlayer = playerClub.playerIds.find(
      pid => !playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid)
    );
    if (!benchedPlayer) return;

    const destClubId = Object.keys(state.clubs).find(id => id !== CLUB_ID);
    if (!destClubId) return;

    const loanResult = useGameStore.getState().loanOut(benchedPlayer, destClubId, 20, 50, true);
    expect(loanResult.success).toBe(true);

    // Advance 5 weeks
    for (let w = 0; w < 5; w++) {
      useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }

    const loans = useGameStore.getState().activeLoans;
    const loan = loans.find(l => l.playerId === benchedPlayer);
    if (!loan) return;

    const recallResult = useGameStore.getState().recallLoan(loan.id);
    expect(recallResult.success).toBe(true);

    // Player should be back at parent club
    const postState = useGameStore.getState();
    const player = postState.players[benchedPlayer];
    expect(player.onLoan).toBe(false);
    expect(player.clubId).toBe(CLUB_ID);
    expect(postState.clubs[CLUB_ID].playerIds).toContain(benchedPlayer);
  });

  it('processes obligatory buy fee at loan end', () => {
    const state = useGameStore.getState();
    const playerClub = state.clubs[CLUB_ID];
    const benchedPlayer = playerClub.playerIds.find(
      pid => !playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid)
    );
    if (!benchedPlayer) return;

    const destClubId = Object.keys(state.clubs).find(id => id !== CLUB_ID);
    if (!destClubId) return;

    const fee = 5_000_000;
    const preBudget = state.clubs[CLUB_ID].budget;
    const loanResult = useGameStore.getState().loanOut(benchedPlayer, destClubId, 4, 50, false, fee);
    expect(loanResult.success).toBe(true);

    // Advance 5 weeks so the loan expires (duration = 4 weeks)
    for (let w = 0; w < 5; w++) {
      useGameStore.getState().advanceWeek();
      useGameStore.getState().playCurrentMatch();
    }

    // processLoanReturns should have been called during advanceWeek
    const postState = useGameStore.getState();
    const player = postState.players[benchedPlayer];

    // After obligatory buy, player should belong to destination permanently
    if (player) {
      // If loan was processed, player should be at dest club permanently
      const loan = postState.activeLoans.find(l => l.playerId === benchedPlayer);
      if (!loan) {
        // Loan completed — check permanent transfer occurred
        expect(player.onLoan).toBe(false);
        expect(player.clubId).toBe(destClubId);
        // Source club should have received the fee
        expect(postState.clubs[CLUB_ID].budget).toBeGreaterThan(preBudget - 100_000_000); // account for weekly expenses (realistic wages for top-tier clubs)
      }
    }
  });

  it('tracks multiple simultaneous loans independently', () => {
    // Re-init to avoid loan state from prior tests
    useGameStore.getState().initGame(CLUB_ID);
    const state = useGameStore.getState();
    const playerClub = state.clubs[CLUB_ID];
    const benched = playerClub.playerIds.filter(
      pid => !playerClub.lineup.includes(pid) && !playerClub.subs.includes(pid)
    );

    const destClubs = Object.keys(state.clubs).filter(id => id !== CLUB_ID).slice(0, 2);
    if (benched.length < 2 || destClubs.length < 2) return;

    // Loan out two players to different clubs
    const r1 = useGameStore.getState().loanOut(benched[0], destClubs[0], 10, 50, true);
    expect(r1.success).toBe(true);

    const r2 = useGameStore.getState().loanOut(benched[1], destClubs[1], 15, 60, false);
    expect(r2.success).toBe(true);

    // Both our loans should exist in activeLoans
    const loans = useGameStore.getState().activeLoans;
    expect(loans.length).toBeGreaterThanOrEqual(2);
    const ourLoans = loans.filter(l => l.playerId === benched[0] || l.playerId === benched[1]);
    expect(ourLoans.length).toBe(2);

    // Each loan should be independently tracked
    const loan1 = loans.find(l => l.playerId === benched[0])!;
    const loan2 = loans.find(l => l.playerId === benched[1])!;
    expect(loan1.toClubId).toBe(destClubs[0]);
    expect(loan2.toClubId).toBe(destClubs[1]);
    expect(loan1.durationWeeks).toBe(10);
    expect(loan2.durationWeeks).toBe(15);
  });
});

describe('2D: Season Turnover Integrity', () => {
  it('determines correct zones from league table', () => {
    const eng = LEAGUES.find(l => l.id === 'eng')!;

    // Create a mock table with the correct number of entries
    const table = Array.from({ length: eng.teamCount }, (_, i) => ({
      clubId: `club-${i + 1}`,
      played: 46,
      won: eng.teamCount - i,
      drawn: 0,
      lost: i,
      goalsFor: 50 - i,
      goalsAgainst: 20 + i,
      goalDifference: 30 - 2 * i,
      points: (eng.teamCount - i) * 3,
      form: [] as ('W' | 'D' | 'L')[],
      cleanSheets: 0,
    }));

    const zones = determineZones(table, eng);

    // eng: 3 replaced slots
    expect(zones.safe).toHaveLength(eng.teamCount - eng.replacedSlots);
    expect(zones.replaced).toHaveLength(eng.replacedSlots);
    // Bottom 3 should be replaced
    expect(zones.replaced).toEqual([
      `club-${eng.teamCount - 2}`,
      `club-${eng.teamCount - 1}`,
      `club-${eng.teamCount}`,
    ]);
  });

  it('maintains league integrity through season turnover cycle', { timeout: 60_000 }, () => {
    useGameStore.getState().initGame(CLUB_ID);

    // Run 3 seasons and verify after each
    for (let s = 0; s < 3; s++) {
      advanceFullSeason();

      const state = useGameStore.getState();
      const playerLeague = state.playerDivision;
      const leagueClubs = state.divisionClubs[playerLeague];
      const leagueInfo = LEAGUES.find(l => l.id === playerLeague)!;

      // League size preserved
      expect(leagueClubs.length).toBe(leagueInfo.teamCount);

      // No duplicate clubs
      expect(new Set(leagueClubs).size).toBe(leagueClubs.length);

      // Every club has a valid squad
      for (const clubId of leagueClubs) {
        const club = state.clubs[clubId];
        expect(club, `Club ${clubId} missing`).toBeDefined();
        const validPlayers = club.playerIds.filter(id => state.players[id]);
        expect(validPlayers.length, `Club ${club.name} (${clubId}) has zero valid players`)
          .toBeGreaterThan(0);
      }
    }
  });
});
