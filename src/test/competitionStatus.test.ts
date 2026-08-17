import { describe, it, expect } from 'vitest';
import { getActiveCompetitions, type CompetitionStatusContext } from '@/utils/competitionStatus';
import type { CupState, LeagueCupState, ContinentalTournamentState, SuperCupMatch } from '@/types/game';

const PLAYER = 'arsenal';
const RIVAL = 'chelsea';

const clubs = {
  [PLAYER]: { shortName: 'ARS' },
  [RIVAL]: { shortName: 'CHE' },
};
const virtualClubs = { 'virt-madrid': { shortName: 'RMA' } };

function baseCtx(overrides: Partial<CompetitionStatusContext> = {}): CompetitionStatusContext {
  return {
    cup: { ties: [], currentRound: null, eliminated: false, winner: null },
    leagueCup: { ties: [], currentRound: null, eliminated: false, winner: null },
    championsCup: null,
    shieldCup: null,
    conferenceCup: null,
    domesticSuperCup: null,
    continentalSuperCup: null,
    playerClubId: PLAYER,
    clubs,
    virtualClubs,
    ...overrides,
  };
}

function cup(partial: Partial<CupState>): CupState {
  return { ties: [], currentRound: null, eliminated: false, winner: null, ...partial };
}
function leagueCup(partial: Partial<LeagueCupState>): LeagueCupState {
  return { ties: [], currentRound: null, eliminated: false, winner: null, ...partial };
}
function continental(partial: Partial<ContinentalTournamentState>): ContinentalTournamentState {
  return {
    competition: 'champions_cup',
    season: 1,
    groups: [],
    knockoutTies: [],
    currentPhase: 'group',
    currentRound: 'group',
    playerEliminated: false,
    // The player is IN this tournament by default. Selection keys on
    // `playerGroupId`, because season rollover creates all three continental
    // competitions every year and stamps the ones the player is not in as
    // eliminated — so "whichever is present, highest tier first" showed a
    // permanent "Champions Cup — Eliminated" row to Shield Cup qualifiers.
    playerGroupId: 'A',
    winnerId: null,
    ...partial,
  };
}
function superCup(partial: Partial<SuperCupMatch>): SuperCupMatch {
  return {
    type: 'domestic',
    homeClubId: PLAYER,
    awayClubId: RIVAL,
    played: false,
    homeGoals: 0,
    awayGoals: 0,
    week: 1,
    winnerId: null,
    ...partial,
  };
}

describe('getActiveCompetitions', () => {
  it('returns no competitions when none are active', () => {
    expect(getActiveCompetitions(baseCtx())).toEqual([]);
  });

  it('surfaces cup-only with the current round name', () => {
    const result = getActiveCompetitions(baseCtx({ cup: cup({ currentRound: 'QF' }) }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: 'cup', screen: 'cup', title: 'Domestic Cup', status: 'Quarter-Finals', outcome: 'active' });
  });

  it('reports every active competition in order', () => {
    const result = getActiveCompetitions(baseCtx({
      cup: cup({ currentRound: 'R4' }),
      leagueCup: leagueCup({ currentRound: 'SF' }),
      championsCup: continental({ currentPhase: 'knockout', currentRound: 'QF' }),
      domesticSuperCup: superCup({ week: 2 }),
    }));
    expect(result.map(e => e.key)).toEqual(['cup', 'league-cup', 'continental', 'super-cup']);
    expect(result.find(e => e.key === 'league-cup')!.status).toBe('Semi-Finals');
    expect(result.find(e => e.key === 'continental')!).toMatchObject({ screen: 'champions-cup', title: 'Champions Cup', status: 'QF' });
    expect(result.find(e => e.key === 'super-cup')!.status).toBe('Week 2');
  });

  it('collapses continental to a single entry, preferring the highest tier the player is in', () => {
    const result = getActiveCompetitions(baseCtx({
      shieldCup: continental({ competition: 'shield_cup', currentPhase: 'group', currentRound: 'group' }),
      conferenceCup: continental({ competition: 'conference_cup' }),
    }));
    const continentalEntries = result.filter(e => e.key === 'continental');
    expect(continentalEntries).toHaveLength(1);
    expect(continentalEntries[0]).toMatchObject({ screen: 'shield-cup', title: 'Shield Cup', status: 'Group Stage' });
  });

  it('picks the tournament the player is actually IN, not the highest tier present', () => {
    // The real state from season 2 onward: all three exist, the two the player
    // is not in are stamped eliminated with no group.
    const result = getActiveCompetitions(baseCtx({
      championsCup: continental({ competition: 'champions_cup', playerGroupId: null, playerEliminated: true }),
      shieldCup: continental({ competition: 'shield_cup', currentPhase: 'group', currentRound: 'group' }),
      conferenceCup: continental({ competition: 'conference_cup', playerGroupId: null, playerEliminated: true }),
    }));
    const continentalEntries = result.filter(e => e.key === 'continental');
    expect(continentalEntries).toHaveLength(1);
    expect(continentalEntries[0]).toMatchObject({ screen: 'shield-cup', title: 'Shield Cup' });
  });

  it('shows no continental entry when the player qualified for nothing', () => {
    const result = getActiveCompetitions(baseCtx({
      championsCup: continental({ competition: 'champions_cup', playerGroupId: null, playerEliminated: true }),
      shieldCup: continental({ competition: 'shield_cup', playerGroupId: null, playerEliminated: true }),
      conferenceCup: continental({ competition: 'conference_cup', playerGroupId: null, playerEliminated: true }),
    }));
    expect(result.filter(e => e.key === 'continental')).toHaveLength(0);
  });

  it('reflects eliminated states', () => {
    const result = getActiveCompetitions(baseCtx({
      cup: cup({ currentRound: 'QF', eliminated: true }),
      championsCup: continental({ currentPhase: 'knockout', currentRound: 'R16', playerEliminated: true }),
    }));
    expect(result.find(e => e.key === 'cup')!).toMatchObject({ status: 'Eliminated', outcome: 'eliminated' });
    expect(result.find(e => e.key === 'continental')!).toMatchObject({ status: 'Eliminated', outcome: 'eliminated' });
  });

  it('reflects a won competition with the winner short name and outcome', () => {
    const result = getActiveCompetitions(baseCtx({
      cup: cup({ currentRound: 'F', winner: PLAYER }),
      championsCup: continental({ currentPhase: 'complete', winnerId: 'virt-madrid' }),
    }));
    expect(result.find(e => e.key === 'cup')!).toMatchObject({ status: 'Winner: ARS', outcome: 'won' });
    // Continental won by another (virtual) club — resolves short name, stays 'active' outcome.
    expect(result.find(e => e.key === 'continental')!).toMatchObject({ status: 'Winner: RMA', outcome: 'active' });
  });
});
