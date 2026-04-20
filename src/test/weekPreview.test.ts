import { describe, it, expect } from 'vitest';
import type { Player, Club, Match, FacilitiesState, ScoutingState, LeagueTableEntry } from '@/types/game';
import { getWeekPreview, getFallbackPreview, generateCliffhangers } from '@/utils/weekPreview';

// ── Fixture factories ─────────────────────────────────────────────────────────
// Shapes are validated by the declared return types — no `as` casts, so any
// field drift on the Player / Club / FacilitiesState interfaces will surface
// as a test-file TS error instead of silently skipping validation.

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe', age: 25, position: 'CM',
    nationality: 'England', overall: 70, potential: 80, value: 1_000_000, wage: 10_000,
    clubId: 'club-a', contractEnd: 3,
    goals: 0, assists: 0, appearances: 10,
    careerGoals: 0, careerAssists: 0, careerAppearances: 10,
    fitness: 85, morale: 70, form: 60, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0,
    attributes: { pace: 65, shooting: 60, passing: 75, defending: 55, physical: 65, mental: 70 },
    ...overrides,
  };
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-a', name: 'Club A', shortName: 'A', color: '#000', secondaryColor: '#FFF',
    budget: 10_000_000, reputation: 3, fanBase: 50, wageBill: 500_000, formation: '4-4-2',
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    facilities: 5, youthRating: 5, boardPatience: 5,
    ...overrides,
  };
}

const emptyFacilities: FacilitiesState = {
  trainingLevel: 3,
  youthLevel: 3,
  medicalLevel: 3,
  recoveryLevel: 3,
  stadiumStands: { north: 1, south: 1, east: 1, west: 1 },
  upgradeInProgress: null,
};

const emptyScouting: ScoutingState = {
  maxAssignments: 2, assignments: [], reports: [], discoveredPlayers: [],
};

function baseCtx(overrides: Partial<Parameters<typeof getWeekPreview>[0]> = {}) {
  return {
    playerClubId: 'club-a',
    players: {},
    clubs: { 'club-a': makeClub({ playerIds: [] }) },
    fixtures: [] as Match[],
    facilities: emptyFacilities,
    scouting: emptyScouting,
    week: 10,
    season: 1,
    totalWeeks: 46,
    ...overrides,
  };
}

// ── getWeekPreview ────────────────────────────────────────────────────────────

describe('getWeekPreview', () => {
  it('returns [] when playerClubId has no matching club', () => {
    const items = getWeekPreview(baseCtx({ playerClubId: 'missing' }));
    expect(items).toEqual([]);
  });

  it('flags a player returning from injury next week', () => {
    const p = makePlayer({ id: 'inj-1', injured: true, injuryWeeks: 1, lastName: 'Bale' });
    const items = getWeekPreview(baseCtx({
      players: { 'inj-1': p },
      clubs: { 'club-a': makeClub({ playerIds: ['inj-1'] }) },
    }));
    expect(items.some(i => i.icon === 'heart-pulse' && i.text.includes('Bale'))).toBe(true);
  });

  it('flags expiring contracts only after week 20 when a qualifying player exists', () => {
    const p = makePlayer({ id: 'exp-1', contractEnd: 1, overall: 75 });
    const early = getWeekPreview(baseCtx({
      week: 10,
      players: { 'exp-1': p },
      clubs: { 'club-a': makeClub({ playerIds: ['exp-1'] }) },
    }));
    const late = getWeekPreview(baseCtx({
      week: 22,
      players: { 'exp-1': p },
      clubs: { 'club-a': makeClub({ playerIds: ['exp-1'] }) },
    }));
    expect(early.some(i => i.icon === 'clipboard')).toBe(false);
    expect(late.some(i => i.icon === 'clipboard')).toBe(true);
  });

  it('caps output at 3 items', () => {
    // Pile on 4 qualifying returning-from-injury players.
    const players: Record<string, Player> = {};
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = `p-${i}`;
      ids.push(id);
      players[id] = makePlayer({ id, injured: true, injuryWeeks: 1, lastName: `Player${i}` });
    }
    const items = getWeekPreview(baseCtx({
      players, clubs: { 'club-a': makeClub({ playerIds: ids }) },
    }));
    expect(items.length).toBeLessThanOrEqual(3);
  });
});

// ── getFallbackPreview ────────────────────────────────────────────────────────

describe('getFallbackPreview', () => {
  it('returns [] when the club is missing', () => {
    expect(getFallbackPreview(baseCtx({ playerClubId: 'nope' }))).toEqual([]);
  });

  it('surfaces a youth prospect with a meaningful potential gap', () => {
    const prospect = makePlayer({ id: 'y-1', age: 19, overall: 70, potential: 85, lastName: 'Youngblood' });
    const items = getFallbackPreview(baseCtx({
      players: { 'y-1': prospect },
      clubs: { 'club-a': makeClub({ playerIds: ['y-1'] }) },
    }));
    expect(items.some(i => i.icon === 'sparkles' && i.text.includes('Youngblood'))).toBe(true);
  });

  it('emits an end-of-season urgency item in the final 10 weeks', () => {
    const items = getFallbackPreview(baseCtx({ week: 42, totalWeeks: 46 }));
    expect(items.some(i => i.icon === 'calendar' && i.text.includes('weeks left'))).toBe(true);
  });

  it('caps output at 2 items', () => {
    // Construct a ctx that could emit several fallbacks.
    const prospect = makePlayer({ id: 'y-1', age: 19, overall: 70, potential: 85, lastName: 'Prospect' });
    const scorer = makePlayer({ id: 's-1', goals: 3, lastName: 'Striker' });
    const expiring1 = makePlayer({ id: 'e-1', contractEnd: 1, lastName: 'Exp1' });
    const expiring2 = makePlayer({ id: 'e-2', contractEnd: 1, lastName: 'Exp2' });
    const items = getFallbackPreview(baseCtx({
      week: 40,
      players: { 'y-1': prospect, 's-1': scorer, 'e-1': expiring1, 'e-2': expiring2 },
      clubs: { 'club-a': makeClub({ playerIds: ['y-1', 's-1', 'e-1', 'e-2'] }) },
    }));
    expect(items.length).toBeLessThanOrEqual(2);
  });
});

// ── generateCliffhangers ──────────────────────────────────────────────────────

function cliffCtx(overrides: Partial<Parameters<typeof generateCliffhangers>[0]> = {}) {
  return {
    playerClubId: 'club-a',
    players: {},
    clubs: { 'club-a': makeClub(), 'club-b': makeClub({ id: 'club-b', name: 'Club B', shortName: 'B' }) },
    fixtures: [] as Match[],
    leagueTable: [] as LeagueTableEntry[],
    week: 12,
    season: 1,
    boardConfidence: 50,
    transferWindowOpen: false,
    ...overrides,
  };
}

describe('generateCliffhangers', () => {
  it('returns [] when the club is missing', () => {
    expect(generateCliffhangers(cliffCtx({ playerClubId: 'none' }))).toEqual([]);
  });

  it('surfaces a title-race cliffhanger when within CLIFFHANGER_TITLE_RACE_GAP', () => {
    const table: LeagueTableEntry[] = [
      { clubId: 'club-b', points: 30, won: 10, drawn: 0, lost: 0, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, played: 10, form: [], cleanSheets: 4 },
      { clubId: 'club-a', points: 27, won: 9, drawn: 0, lost: 1, goalsFor: 18, goalsAgainst: 7, goalDifference: 11, played: 10, form: [], cleanSheets: 3 },
    ];
    const items = generateCliffhangers(cliffCtx({ leagueTable: table, week: 15 }));
    expect(items.some(i => i.category === 'title_race')).toBe(true);
  });

  it('slices output to MAX_CLIFFHANGERS when several candidates qualify', () => {
    // Produce FIVE qualifying cliffhangers — more than MAX_CLIFFHANGERS (3):
    //  1. Title race   (player leading by 1 point, week >= 10)
    //  2. Star out of contract (overall >= 70, contractEnd <= season, week >= 15)
    //  3. Player wants to leave (overall >= 65, wantsToLeave)
    //  4. Board pressure (boardConfidence < 35)
    //  5. Youth breakthrough (age <= 21, potential - overall >= 8)
    const table: LeagueTableEntry[] = [
      { clubId: 'club-a', points: 30, won: 10, drawn: 0, lost: 0, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, played: 10, form: [], cleanSheets: 4 },
      { clubId: 'club-b', points: 29, won: 9, drawn: 2, lost: 0, goalsFor: 18, goalsAgainst: 6, goalDifference: 12, played: 11, form: [], cleanSheets: 3 },
    ];
    const players: Record<string, Player> = {
      star: makePlayer({ id: 'star', overall: 78, contractEnd: 1, lastName: 'Star' }),
      unhappy: makePlayer({ id: 'unhappy', overall: 72, wantsToLeave: true, lastName: 'Unhappy' }),
      youth: makePlayer({ id: 'youth', age: 19, overall: 62, potential: 82, lastName: 'Prospect' }),
    };
    const items = generateCliffhangers(cliffCtx({
      leagueTable: table,
      week: 20,
      boardConfidence: 15,
      players,
      clubs: {
        'club-a': makeClub({ playerIds: ['star', 'unhappy', 'youth'] }),
        'club-b': makeClub({ id: 'club-b', name: 'Club B', shortName: 'B' }),
      },
    }));
    expect(items).toHaveLength(3); // MAX_CLIFFHANGERS
  });
});
