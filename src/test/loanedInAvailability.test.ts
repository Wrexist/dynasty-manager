/**
 * A player loaned IN plays for the club that borrowed him.
 *
 * Every loan moves the player into the borrower's squad with `onLoan: true`
 * (`clubId === loanToClubId`). The team pickers read `onLoan` as "unavailable",
 * so a loanee could never play for the club that borrowed him: the lineup
 * editor let the user pick him, then the match XI silently dropped him, and the
 * weekly loan block handed him fabricated appearances instead. Unavailable
 * means out on loan AWAY from the club being picked for — `isAwayOnLoan`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { buildPlayerMatchXI } from '@/store/slices/orchestration/matchActions';
import { pickAiMatchSquad } from '@/store/slices/orchestration/helpers';
import { selectBestLineup } from '@/utils/playerGen';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import { isAwayOnLoan } from '@/utils/helpers';
import type { Player } from '@/types/game';

const CLUB_ID = 'celtic';

/** Loan the rival's best outfielder into the user's club, the way
 *  `executeLoanIn` does, boosted so he is an automatic pick. */
function loanInStar(overrides: Partial<Player> = {}): string {
  const s = useGameStore.getState();
  const rivalId = Object.keys(s.clubs).find(id => id !== s.playerClubId && s.clubs[id].playerIds.length > 18)!;
  const rival = s.clubs[rivalId];
  const star = rival.playerIds.map(id => s.players[id]).filter(p => p && p.position !== 'GK')
    .sort((a, b) => b.overall - a.overall)[0];
  const user = s.clubs[s.playerClubId];
  const loanee: Player = {
    ...star,
    overall: 97,
    // autoFillBestTeam scores from attributes, not the stored overall.
    attributes: { pace: 97, shooting: 97, passing: 97, defending: 97, physical: 97, mental: 97 },
    fitness: 100,
    injured: false,
    suspendedUntilWeek: undefined,
    onLoan: true,
    loanFromClubId: rivalId,
    loanToClubId: s.playerClubId,
    clubId: s.playerClubId,
    ...overrides,
  };
  useGameStore.setState({
    players: { ...s.players, [star.id]: loanee },
    clubs: {
      ...s.clubs,
      [rivalId]: { ...rival, playerIds: rival.playerIds.filter(id => id !== star.id), lineup: rival.lineup.filter(id => id !== star.id), subs: rival.subs.filter(id => id !== star.id) },
      [user.id]: { ...user, playerIds: [...user.playerIds, star.id] },
    },
    activeLoans: [...s.activeLoans, {
      id: 'loan-in-test', playerId: star.id, fromClubId: rivalId, toClubId: s.playerClubId,
      startWeek: s.week, startSeason: s.season, durationWeeks: 30, wageSplit: 100, recallClause: false,
    }],
  });
  return star.id;
}

describe('isAwayOnLoan', () => {
  it('is false for a loanee at the club that borrowed him, true everywhere else', () => {
    const p = { onLoan: true, loanToClubId: 'borrower', clubId: 'borrower' };
    expect(isAwayOnLoan(p)).toBe(false);
    expect(isAwayOnLoan(p, 'borrower')).toBe(false);
    expect(isAwayOnLoan(p, 'lender')).toBe(true);
  });

  it('keeps legacy/ambiguous state (onLoan with no borrower) unavailable', () => {
    expect(isAwayOnLoan({ onLoan: true, loanToClubId: undefined, clubId: 'c' })).toBe(true);
    expect(isAwayOnLoan({ onLoan: false, loanToClubId: undefined, clubId: 'c' })).toBe(false);
  });
});

describe('a loaned-in player is picked by every team picker', () => {
  let loaneeId: string;
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
    loaneeId = loanInStar();
  });

  it('buildPlayerMatchXI fields him when the manager names him', () => {
    const s = useGameStore.getState();
    const club = { ...s.clubs[s.playerClubId] };
    club.lineup = [loaneeId, ...club.lineup.slice(1)];
    const xi = buildPlayerMatchXI(club, s.players, s.week);
    expect(xi.map(p => p.id)).toContain(loaneeId);
  });

  it('selectBestLineup, autoFillBestTeam and pickAiMatchSquad all pick him', () => {
    const s = useGameStore.getState();
    const club = s.clubs[s.playerClubId];
    const squad = club.playerIds.map(id => s.players[id]).filter(Boolean);
    expect(selectBestLineup(squad, club.formation, s.week).lineup.map(p => p.id)).toContain(loaneeId);
    expect(autoFillBestTeam(squad, club.formation, s.week).lineup.map(p => p.id)).toContain(loaneeId);
    expect(pickAiMatchSquad(club, s.players, s.week).xi.map(p => p.id)).toContain(loaneeId);
  });
});

describe('no fabricated loan appearances at the user\'s club', () => {
  it('a loaned-in player who cannot play gains no appearances from the loan block', async () => {
    useGameStore.getState().initGame(CLUB_ID);
    // Injured for the whole window, so every appearance he could gain would be
    // fabricated. Pre-fix the loan block credited one on 40-70% of weeks.
    const id = loanInStar({
      injured: true, injuryWeeks: 30,
      injuryDetails: { type: 'acl', severity: 'severe', weeksRemaining: 30, totalWeeks: 30 } as Player['injuryDetails'],
      appearances: 0,
    });
    for (let i = 0; i < 8; i++) await useGameStore.getState().advanceWeek();
    const p = useGameStore.getState().players[id];
    expect(p.clubId).toBe(useGameStore.getState().playerClubId);
    expect(p.appearances).toBe(0);
  }, 120_000);
});
