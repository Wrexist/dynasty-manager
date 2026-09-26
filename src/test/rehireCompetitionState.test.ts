/**
 * A manager re-hired by a club in the SAME league mid-season sees that club's
 * cup and continental state, not the old club's (simfinish item 6).
 *
 * A same-league move keeps the season's draws (it swaps `playerClubId` and
 * nothing else). The "your club" flags on those draws — `cup.eliminated`,
 * `leagueCup.eliminated`, a continental tournament's `playerGroupId` /
 * `playerEliminated` — are written incrementally as the manager's club plays, so
 * they described the OLD club: knocked out with the old club, the manager could
 * find the new club's live cup run reported as over (board objectives failed,
 * the Competitions hub said "Eliminated"), and the continental match finder
 * (`findPlayerContinentalMatch` bails on `playerEliminated`) never offered the
 * new club's continental fixtures. `progressCompetitionsWeek` now re-derives
 * those flags for the club managed this week; for a manager who stayed put it is
 * a no-op.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { alignContinentalToClub, alignCupToClub, progressCompetitionsWeek } from '@/store/slices/orchestration/competitionWeek';
import { CUP_BYE_MARKER } from '@/data/cup';
import { createDefaultManager } from '@/utils/managerCareer';
import type { ContinentalTournamentState, CupState, CupTie, JobOffer } from '@/types/game';

const OLD = 'arsenal';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;

const tie = (id: string, round: CupTie['round'], home: string, away: string, week: number, played: boolean, hg = 0, ag = 0, winnerId?: string): CupTie =>
  ({ id, round, homeClubId: home, awayClubId: away, played, homeGoals: hg, awayGoals: ag, week, ...(winnerId ? { winnerId } : {}) });

function continental(groups: { id: string; clubIds: string[] }[], phase: ContinentalTournamentState['currentPhase'], extra: Partial<ContinentalTournamentState> = {}): ContinentalTournamentState {
  return {
    competition: 'champions_cup', season: 2, currentPhase: phase, currentRound: phase === 'group' ? 'group' : 'R16',
    groups: groups.map(g => ({ ...g, matches: [], standings: [] })), knockoutTies: [],
    playerEliminated: false, playerGroupId: null, winnerId: null, ...extra,
  };
}

describe('alignCupToClub', () => {
  const cup = (ties: CupTie[], eliminated: boolean): CupState => ({ ties, currentRound: 'R2', eliminated, winner: null });

  it('the old club\'s exit is not the new club\'s', () => {
    const ties = [tie('1', 'R1', 'old', 'x', 4, true, 0, 1), tie('2', 'R1', 'new', 'y', 4, true, 2, 0), tie('3', 'R2', 'new', 'x', 9, false)];
    expect(alignCupToClub(cup(ties, true), 'new').eliminated).toBe(false);
  });

  it('the new club\'s exit is', () => {
    const ties = [tie('1', 'R1', 'old', 'x', 4, true, 1, 0), tie('2', 'R1', 'y', 'new', 4, true, 1, 1, 'y')];
    expect(alignCupToClub(cup(ties, false), 'new').eliminated).toBe(true);
  });

  it('is a no-op for a club whose flag already agrees (byes and undecided draws are not defeats)', () => {
    const c = cup([tie('1', 'R1', 'me', CUP_BYE_MARKER, 4, true, 1, 0), tie('2', 'R2', 'me', 'x', 9, true, 1, 1)], false);
    expect(alignCupToClub(c, 'me')).toBe(c);
  });
});

describe('alignContinentalToClub', () => {
  it('a new club that was never drawn is out; the old club\'s group is not its group', () => {
    const t = continental([{ id: 'A', clubIds: ['old', 'a2'] }, { id: 'B', clubIds: ['b1', 'b2'] }], 'group', { playerGroupId: 'A', playerEliminated: false });
    const aligned = alignContinentalToClub(t, 'new')!;
    expect(aligned.playerGroupId).toBeNull();
    expect(aligned.playerEliminated).toBe(true);
  });

  it('a new club that was drawn gets its own group and is alive', () => {
    const t = continental([{ id: 'A', clubIds: ['a1', 'a2'] }, { id: 'C', clubIds: ['new', 'c2'] }], 'group', { playerGroupId: null, playerEliminated: true });
    const aligned = alignContinentalToClub(t, 'new')!;
    expect(aligned.playerGroupId).toBe('C');
    expect(aligned.playerEliminated).toBe(false);
  });

  it('knockouts: alive until a tie is lost, out if never reached', () => {
    const ko = (home: string, away: string, winnerId: string | null) => ({
      id: `${home}-${away}`, round: 'R16' as const, homeClubId: home, awayClubId: away,
      leg1Played: true, leg1HomeGoals: 0, leg1AwayGoals: 0, leg2Played: !!winnerId, leg2HomeGoals: 0, leg2AwayGoals: 0,
      week1: 20, week2: 22, winnerId,
    });
    const groups = [{ id: 'A', clubIds: ['new', 'a2', 'x', 'y'] }];
    expect(alignContinentalToClub(continental(groups, 'knockout', { knockoutTies: [ko('new', 'b', null)], playerEliminated: true }), 'new')!.playerEliminated).toBe(false);
    expect(alignContinentalToClub(continental(groups, 'knockout', { knockoutTies: [ko('new', 'b', 'b')] }), 'new')!.playerEliminated).toBe(true);
    expect(alignContinentalToClub(continental(groups, 'knockout', { knockoutTies: [ko('a2', 'b', null)] }), 'new')!.playerEliminated).toBe(true);
  });

  it('is a no-op for the club the flags were written for', () => {
    const t = continental([{ id: 'A', clubIds: ['me', 'a2'] }], 'group', { playerGroupId: 'A', playerEliminated: false });
    expect(alignContinentalToClub(t, 'me')).toBe(t);
  });
});

describe('re-hired in the same league, mid-season', () => {
  beforeEach(() => {
    Math.random = mulberry32(0x2E41);
    useGameStore.getState().resetGame();
    useGameStore.getState().initGame(OLD);
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, autoSave: false } });
  });
  afterEach(() => { Math.random = realRandom; });

  it('the next week\'s competitions describe the new club', async () => {
    const s = useGameStore.getState();
    const others = s.divisionClubs[s.playerDivision].filter(id => id !== OLD);
    const [NEW, x, y, z] = others;
    const week = 10;
    // The old club went out of the Cup in R1; the new club won its R1 tie and
    // has an R2 tie later on. The old club was drawn in Champions Cup group A;
    // the new club in group B.
    useGameStore.setState({
      week,
      cup: {
        ties: [tie('r1-old', 'R1', OLD, x, 4, true, 0, 2), tie('r1-new', 'R1', NEW, y, 4, true, 3, 1),
          tie('r2-new', 'R2', NEW, z, 30, false)],
        currentRound: 'R2', eliminated: true, winner: null,
      },
      championsCup: continental([{ id: 'A', clubIds: [OLD, x] }, { id: 'B', clubIds: [NEW, y] }], 'group', { playerGroupId: 'A', playerEliminated: false }),
      gameMode: 'career',
      careerManager: { ...createDefaultManager('Test Manager', 'England', 40, []), unemployedWeeks: 2 },
    });

    useGameStore.getState().moveToNewClub(NEW, {
      id: 'offer-new', clubId: NEW, clubName: NEW, divisionId: s.playerDivision,
      salary: 20000, contractLength: 2, bonuses: [],
    } as unknown as JobOffer);
    expect(useGameStore.getState().playerClubId).toBe(NEW);

    const st = useGameStore.getState();
    const out = progressCompetitionsWeek({
      state: st, clubs: st.clubs, players: { ...st.players }, week: st.week, season: st.season,
      playerClubId: NEW, eloRankings: {}, messages: [],
    });
    expect(out.cup.eliminated, 'the new club is still in the Cup').toBe(false);
    expect(out.championsCup?.playerGroupId).toBe('B');
    expect(out.championsCup?.playerEliminated).toBe(false);
  });
});
