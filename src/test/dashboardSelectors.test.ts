/**
 * Dashboard rules, pulled out of the page so they can be tested at all.
 *
 * `seasonOver`, `raceMode` and `objectivesWithProgress` used to be inline in a
 * 2,000-line component; the only way to exercise them was to render the page,
 * and nothing did. Two had already broken there (see the header of
 * `utils/dashboardSelectors.ts`).
 */
import { describe, it, expect } from 'vitest';
import type { LeagueTableEntry, Match, CupState, Club, Player } from '@/types/game';
import {
  isSeasonOver, getRaceMode, getSeasonStage, selectObjectivesWithProgress,
  selectPrimaryAction, selectNextFixture, selectAttentionItems, countClaimableObjectives, type AttentionInput,
} from '@/utils/dashboardSelectors';
import { getTransferWindows } from '@/config/transfers';
import {
  RACE_MODE_WINDOW_WEEKS, TITLE_RACE_MAX_POINTS_GAP, SPRING_PHASE_END_WEEK, MIN_SQUAD_SIZE, MAX_SQUAD_SIZE,
} from '@/config/gameBalance';
import { CONFIDENCE_CRITICAL_THRESHOLD } from '@/config/ui';
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

describe('selectPrimaryAction — the one Continue button', () => {
  const base = { seasonOver: false, hasMatchThisWeek: false, hasFixtureThisWeek: false, seasonPhase: 'regular' as const, week: 10, totalWeeks: 38 };

  it('rolls the season when it is over', () => {
    expect(selectPrimaryAction({ ...base, seasonOver: true, hasMatchThisWeek: true })).toEqual({ kind: 'season-summary' });
  });

  it('goes to Match Prep in a match week', () => {
    expect(selectPrimaryAction({ ...base, hasMatchThisWeek: true, hasFixtureThisWeek: true })).toEqual({ kind: 'match-prep' });
  });

  it('advances a training week, offering the skip in the regular season', () => {
    expect(selectPrimaryAction(base)).toEqual({ kind: 'advance', nextWeek: 11, canSkipToNextMatch: true });
    expect(selectPrimaryAction({ ...base, seasonPhase: 'playoff' })).toMatchObject({ kind: 'advance', canSkipToNextMatch: false });
    expect(selectPrimaryAction({ ...base, week: 38 })).toMatchObject({ kind: 'advance', canSkipToNextMatch: false });
  });

  it('does not offer the skip when a fixture exists this week but its opponent did not resolve', () => {
    expect(selectPrimaryAction({ ...base, hasFixtureThisWeek: true })).toMatchObject({ kind: 'advance', canSkipToNextMatch: false });
  });
});

describe('selectNextFixture', () => {
  it('is the earliest unplayed player fixture after this week', () => {
    const fixtures = [fixture(12, false), fixture(11, true), fixture(14, false), fixture(13, false, 'x', 'y'), fixture(10, false)];
    expect(selectNextFixture(fixtures, ME, 10)?.week).toBe(12);
    expect(selectNextFixture(fixtures, ME, 14)).toBeNull();
  });
});

describe('countClaimableObjectives', () => {
  it('counts completed objectives whose XP is uncollected', () => {
    const o = (completed: boolean, claimed: boolean) => ({ objectiveId: `${completed}${claimed}`, title: '', description: '', icon: '', xpReward: 5, completed, claimed });
    expect(countClaimableObjectives([o(true, false), o(true, true), o(false, false)])).toBe(1);
  });
});

describe('selectAttentionItems — only what needs action, most urgent first', () => {
  let n = 0;
  const player = (over: Partial<Player> = {}): Player => ({
    id: `p${++n}`, firstName: 'A', lastName: `Player${n}`, position: 'CM', age: 25, overall: 70, potential: 72,
    clubId: ME, contractEnd: 5, injured: false, injuryWeeks: 0, ...over,
  } as unknown as Player);

  function input(squad: Player[], over: Partial<AttentionInput> = {}): AttentionInput {
    const players = Object.fromEntries(squad.map(p => [p.id, p]));
    const club = { id: ME, playerIds: squad.map(p => p.id), lineup: squad.slice(0, 11).map(p => p.id), subs: [] } as unknown as Club;
    return {
      club, players, playerClubId: ME, season: 1, week: 10, incomingOffers: 0, boardConfidence: 60,
      boardUltimatum: null, leaguePosition: 8, transferWindowOpen: false, windows: getTransferWindows(38),
      jobOffers: 0, youthReady: 0, hasMatchThisWeek: true, ...over,
    };
  }
  const healthySquad = () => Array.from({ length: 25 }, () => player());

  it('is empty for a healthy club with nothing pending', () => {
    expect(selectAttentionItems(input(healthySquad()))).toEqual([]);
  });

  it('lists injuries with names and the longest lay-off, pointing at the squad', () => {
    const squad = healthySquad();
    squad[20] = player({ injured: true, injuryWeeks: 2, lastName: 'Saka' });
    squad[21] = player({ injured: true, injuryWeeks: 6, lastName: 'Kane' });
    const [item] = selectAttentionItems(input(squad));
    expect(item).toMatchObject({ id: 'injuries', screen: 'squad', params: { count: 2, names: 'Kane, Saka', weeks: 6 } });
  });

  it('flags an injured starter as an XI to fix, in Tactics', () => {
    const squad = healthySquad();
    squad[0] = player({ injured: true, injuryWeeks: 1 });
    const items = selectAttentionItems(input(squad));
    expect(items.find(i => i.id === 'lineup')).toMatchObject({ screen: 'tactics', params: { gaps: 1 }, severity: 'warning' });
  });

  it('lists contracts expiring THIS season, not next, and never a borrowed player', () => {
    const squad = healthySquad();
    squad[22] = player({ contractEnd: 1, lastName: 'Rice' });
    squad[23] = player({ contractEnd: 2, lastName: 'NextYear' });
    squad[24] = player({ contractEnd: 1, onLoan: true, loanToClubId: ME, loanFromClubId: 'parent', lastName: 'Borrowed' });
    const item = selectAttentionItems(input(squad)).find(i => i.id === 'contracts');
    expect(item?.params).toEqual({ count: 1, names: 'Rice' });
  });

  it('does not count a player out on loan as injured here', () => {
    const squad = healthySquad();
    squad[24] = player({ injured: true, injuryWeeks: 3, onLoan: true, loanToClubId: 'elsewhere' });
    expect(selectAttentionItems(input(squad)).find(i => i.id === 'injuries')).toBeUndefined();
  });

  it('puts a board ultimatum first, and does not repeat it as a confidence row', () => {
    const items = selectAttentionItems(input(healthySquad(), {
      incomingOffers: 2, boardConfidence: 20, leaguePosition: 17,
      boardUltimatum: { issuedSeason: 1, issuedWeek: 8, deadlineWeek: 14, targetPosition: 12 },
    }));
    expect(items[0]).toMatchObject({ id: 'ultimatum', severity: 'critical', screen: 'board', params: { target: '12th', deadline: 14, weeks: 4, position: '17th' } });
    expect(items.some(i => i.id === 'board')).toBe(false);
    expect(items.some(i => i.id === 'offers')).toBe(true);
  });

  it('ignores an ultimatum from another season', () => {
    const items = selectAttentionItems(input(healthySquad(), {
      boardUltimatum: { issuedSeason: 0, issuedWeek: 30, deadlineWeek: 36, targetPosition: 12 },
    }));
    expect(items.some(i => i.id === 'ultimatum')).toBe(false);
  });

  it('shows critical board confidence without an ultimatum', () => {
    expect(selectAttentionItems(input(healthySquad(), { boardConfidence: CONFIDENCE_CRITICAL_THRESHOLD }))[0])
      .toMatchObject({ id: 'board', screen: 'board' });
    expect(selectAttentionItems(input(healthySquad(), { boardConfidence: CONFIDENCE_CRITICAL_THRESHOLD + 1 })))
      .toEqual([]);
  });

  it('flags squad size problems at both ends', () => {
    const short = Array.from({ length: MIN_SQUAD_SIZE - 1 }, () => player());
    expect(selectAttentionItems(input(short)).find(i => i.id === 'squad-short')).toMatchObject({ screen: 'transfers', params: { size: MIN_SQUAD_SIZE - 1, min: MIN_SQUAD_SIZE } });
    const full = Array.from({ length: MAX_SQUAD_SIZE }, () => player());
    expect(selectAttentionItems(input(full)).find(i => i.id === 'squad-full')).toMatchObject({ screen: 'squad' });
  });

  it('flags deadline day only while the window is open', () => {
    const windows = getTransferWindows(38);
    expect(selectAttentionItems(input(healthySquad(), { week: windows.summerEnd, transferWindowOpen: true })).map(i => i.id)).toContain('deadline');
    expect(selectAttentionItems(input(healthySquad(), { week: windows.summerEnd, transferWindowOpen: false })).map(i => i.id)).not.toContain('deadline');
  });

  it('orders critical, then warnings, then info', () => {
    const squad = healthySquad();
    squad[20] = player({ injured: true, injuryWeeks: 2 });
    const items = selectAttentionItems(input(squad, { youthReady: 1, jobOffers: 1, boardConfidence: 10, incomingOffers: 1 }));
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    const ranks = items.map(i => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(items[0].id).toBe('board');
    expect(items.at(-1)?.severity).toBe('info');
  });
});
