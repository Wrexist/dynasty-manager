/**
 * Dashboard rules, pulled out of the page so they can be tested at all.
 *
 * `seasonOver`, `raceMode` and `objectivesWithProgress` used to be inline in a
 * 2,000-line component; the only way to exercise them was to render the page,
 * and nothing did. Two had already broken there (see the header of
 * `utils/dashboardSelectors.ts`).
 */
import { describe, it, expect } from 'vitest';
import type { LeagueTableEntry, Match, CupState, Club } from '@/types/game';
import {
  isSeasonOver, getRaceMode, getSeasonStage, selectObjectivesWithProgress,
} from '@/utils/dashboardSelectors';
import { getTransferWindows } from '@/config/transfers';
import {
  RACE_MODE_WINDOW_WEEKS, TITLE_RACE_MAX_POINTS_GAP, SPRING_PHASE_END_WEEK,
} from '@/config/gameBalance';
import type { ObjectiveInstance } from '@/utils/weeklyObjectives';

const ME = 'me';

function fixture(week: number, played: boolean, home = ME, away = 'them'): Match {
  return { id: `m${week}-${home}-${away}`, week, homeClubId: home, awayClubId: away, played, homeGoals: 1, awayGoals: 0, events: [] } as unknown as Match;
}

function table(ids: string[], points: number[]): LeagueTableEntry[] {
  return ids.map((clubId, i) => ({ clubId, played: 30, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: points[i] } as unknown as LeagueTableEntry));
}

describe('isSeasonOver', () => {
  const base = { playerClubId: ME, totalWeeks: 38, seasonPhase: 'regular' as const };

  it('is false while the player still has a fixture to play', () => {
    expect(isSeasonOver({ ...base, week: 38, fixtures: [fixture(37, true), fixture(38, false)] })).toBe(false);
  });

  it('is true once every player fixture is played', () => {
    expect(isSeasonOver({ ...base, week: 38, fixtures: [fixture(37, true), fixture(38, true)] })).toBe(true);
  });

  it('is true past the last week even with an unplayed fixture', () => {
    expect(isSeasonOver({ ...base, week: 39, fixtures: [fixture(38, false)] })).toBe(true);
  });

  it('is never true during the promotion playoffs — the tie still has to be played', () => {
    // The inline version compared against 'playoffs' and was true here, which
    // hid the only button that plays the tie.
    expect(isSeasonOver({ ...base, seasonPhase: 'playoff', week: 39, fixtures: [fixture(38, true)] })).toBe(false);
  });

  it('is false on a fresh season with nothing played anywhere', () => {
    expect(isSeasonOver({ ...base, week: 1, fixtures: [] })).toBe(false);
  });
});

describe('getRaceMode', () => {
  const clubs = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const base = {
    seasonOver: false, seasonPhase: 'regular' as const, week: 30, totalWeeks: 38,
    playerClubId: ME, relegationSpots: 3,
  };

  it('is a title race for second place within the gap of the leader', () => {
    const t = table(['a', ME, ...clubs.slice(1)], [70, 70 - TITLE_RACE_MAX_POINTS_GAP, 50, 40, 30, 20, 10, 5, 1]);
    expect(getRaceMode({ ...base, leagueTable: t })).toBe('title');
  });

  it('is not a title race when the gap is too big', () => {
    const t = table(['a', ME, ...clubs.slice(1)], [70, 70 - TITLE_RACE_MAX_POINTS_GAP - 1, 50, 40, 30, 20, 10, 5, 1]);
    expect(getRaceMode({ ...base, leagueTable: t })).toBeNull();
  });

  it('is a relegation battle in the bottom three of a relegating league', () => {
    const t = table([...clubs, ME], [90, 80, 70, 60, 50, 40, 30, 20, 10]);
    expect(getRaceMode({ ...base, leagueTable: t })).toBe('relegation');
  });

  it('is NOT a relegation battle in a league nobody can go down from', () => {
    // Behaviour change: the inline version flagged the bottom three of the
    // lowest tier as a "Relegation Battle" they could not lose.
    const t = table([...clubs, ME], [90, 80, 70, 60, 50, 40, 30, 20, 10]);
    expect(getRaceMode({ ...base, relegationSpots: 0, leagueTable: t })).toBeNull();
  });

  it('is off before the final stretch, in the playoffs and after the season', () => {
    const t = table([...clubs, ME], [90, 80, 70, 60, 50, 40, 30, 20, 10]);
    expect(getRaceMode({ ...base, week: 38 - RACE_MODE_WINDOW_WEEKS - 1, leagueTable: t })).toBeNull();
    expect(getRaceMode({ ...base, seasonPhase: 'playoff', leagueTable: t })).toBeNull();
    expect(getRaceMode({ ...base, seasonOver: true, leagueTable: t })).toBeNull();
  });

  it('is null when the player is not in the table', () => {
    expect(getRaceMode({ ...base, leagueTable: table(clubs, [8, 7, 6, 5, 4, 3, 2, 1]) })).toBeNull();
  });
});

describe('getSeasonStage', () => {
  const tw = getTransferWindows(46);
  it('walks the season in order', () => {
    expect(getSeasonStage(1, tw)).toBe('preSeason');
    expect(getSeasonStage(tw.summerEnd, tw)).toBe('preSeason');
    expect(getSeasonStage(tw.summerEnd + 1, tw)).toBe('autumn');
    expect(getSeasonStage(tw.winterStart, tw)).toBe('winter');
    expect(getSeasonStage(tw.winterEnd + 1, tw)).toBe('spring');
    expect(getSeasonStage(SPRING_PHASE_END_WEEK + 1, tw)).toBe('runIn');
  });
});

describe('selectObjectivesWithProgress', () => {
  const objective: ObjectiveInstance = {
    objectiveId: 'score-2-plus', title: 'Fire Power', description: 'Score 2 or more goals',
    icon: 'circle', xpReward: 10, completed: false,
  };
  const club = { id: ME, playerIds: [], lineup: [] } as unknown as Club;
  const base = {
    weeklyObjectives: [objective], club, players: {}, playerClubId: ME,
    fixtures: [] as Match[], leagueTable: [] as LeagueTableEntry[], week: 5, season: 1,
  };
  const cup = {
    ties: [{ id: 'cup1', round: 'R1', homeClubId: ME, awayClubId: 'them', played: true, homeGoals: 3, awayGoals: 1, week: 5 }],
  } as unknown as CupState;

  it('counts a domestic cup tie, not only league fixtures', () => {
    const [withCup] = selectObjectivesWithProgress({ ...base, cup });
    expect(withCup.progress).toEqual({ current: 3, target: 2 });
  });

  it('reads the cup from its input — no hidden store read', () => {
    // Without the cup passed in there is no match this week. The inline
    // version pulled cups from getState() without listing them as memo
    // dependencies; here the input is the only source.
    const [withoutCup] = selectObjectivesWithProgress(base);
    expect(withoutCup.progress).toEqual({ current: 0, target: 2 });
  });

  it('returns the objectives untouched when there is no club', () => {
    const objectives = [objective];
    expect(selectObjectivesWithProgress({ ...base, club: null, weeklyObjectives: objectives })).toBe(objectives);
  });
});
