/**
 * An unemployed career manager is not credited with a trophy their ex-club won
 * AFTER they left (audit 2026-09-25, S5 follow-up).
 *
 * Since `progressCompetitionsWeek` runs in the unemployed week, the Cup, League
 * Cup and continental tournaments keep going while the manager is out of work
 * — and nothing clears `playerClubId`, which still names the club that let
 * them go. `endSeasonImpl` judged every trophy by `winner === playerClubId`, so
 * a Cup the ex-club won weeks after the sacking landed on the manager's record:
 * a 'Winner' season-history row (achievements, Hall of Managers, prestige), a
 * "Cup Winners!" timeline milestone and cup-win XP. Before S5 the cups froze
 * while the manager was unemployed, so this could not happen.
 *
 * A trophy decided BEFORE the manager left is still theirs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { createDefaultManager } from '@/utils/managerCareer';
import type { CupState, CupTie } from '@/types/game';

const CLUB = 'manchester-city';

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

/** A season with every league fixture already played (so the ticks below do
 *  no league work), the manager out of work since week `leftWeek`, and the
 *  calendar at `week`. */
function unemployedLateInSeason(week: number, leftWeek: number, cup: CupState): void {
  const s = useGameStore.getState();
  const done = <T extends { played: boolean }>(ms: T[]) => ms.map(m => ({ ...m, played: true, homeGoals: 1, awayGoals: 0 }));
  const divisionFixtures = Object.fromEntries(Object.entries(s.divisionFixtures).map(([id, ms]) => [id, done(ms)]));
  useGameStore.setState({
    gameMode: 'career',
    careerManager: { ...createDefaultManager('Test Manager', 'England', 40, []), unemployedWeeks: week - leftWeek },
    week,
    divisionFixtures,
    fixtures: divisionFixtures[s.playerDivision],
    cup,
    leagueCup: null,
    championsCup: null, shieldCup: null, conferenceCup: null,
    domesticSuperCup: null, continentalSuperCup: null,
  });
}

function finalTie(opponent: string, week: number, played: boolean): CupTie {
  return {
    id: 'cup-final', round: 'F', homeClubId: CLUB, awayClubId: opponent, week,
    played, homeGoals: played ? 2 : 0, awayGoals: 0, ...(played ? { winnerId: CLUB } : {}),
  };
}

describe('an unemployed manager and the ex-club\'s trophies', () => {
  let opponent: string;

  beforeEach(async () => {
    Math.random = mulberry32(0x7209);
    useGameStore.getState().resetGame();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB);
    const s = useGameStore.getState();
    useGameStore.setState({ settings: { ...s.settings, autoSave: false } });
    opponent = s.divisionClubs[s.playerDivision].find(id => id !== CLUB)!;
  });
  afterEach(() => { Math.random = realRandom; });

  it('does not credit a Cup the ex-club won after the manager left', { timeout: 120_000 }, async () => {
    const totalWeeks = useGameStore.getState().totalWeeks;
    // Sacked at week 8; the Cup Final is on the season's last week.
    unemployedLateInSeason(totalWeeks - 1, 8, {
      ties: [finalTie(opponent, totalWeeks, false)], currentRound: 'F', eliminated: false, winner: null,
    });
    // The opponent cannot raise a team, so the ex-club takes the final.
    const s0 = useGameStore.getState();
    useGameStore.setState({ clubs: { ...s0.clubs, [opponent]: { ...s0.clubs[opponent], playerIds: [] } } });

    await useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().cup.winner, 'the unemployed week plays the final').toBe(CLUB);

    const timelineBefore = useGameStore.getState().careerTimeline.length;
    await useGameStore.getState().advanceWeek(); // season end
    const s = useGameStore.getState();
    const row = s.seasonHistory[s.seasonHistory.length - 1];
    expect(row.cupResult).not.toBe('Winner');
    expect(row.cupResult).toBe('Final');
    expect(s.careerTimeline.slice(timelineBefore).map(m => m.title)).not.toContain('Cup Winners!');
  });

  it('still credits a Cup won before the manager left', { timeout: 120_000 }, async () => {
    const totalWeeks = useGameStore.getState().totalWeeks;
    // Won the Final in week 5, sacked in week 8.
    unemployedLateInSeason(totalWeeks, 8, {
      ties: [finalTie(opponent, 5, true)], currentRound: null, eliminated: false, winner: CLUB,
    });
    const timelineBefore = useGameStore.getState().careerTimeline.length;
    await useGameStore.getState().advanceWeek(); // season end
    const s = useGameStore.getState();
    const row = s.seasonHistory[s.seasonHistory.length - 1];
    expect(row.cupResult).toBe('Winner');
    expect(s.careerTimeline.slice(timelineBefore).map(m => m.title)).toContain('Cup Winners!');
  });
});
