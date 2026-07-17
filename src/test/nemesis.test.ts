import { describe, it, expect } from 'vitest';
import type { Club, HeadToHeadRecord } from '@/types/game';
import { getNemesis, getHeatLabel, getNemesisBarb } from '@/utils/nemesis';
import { NEMESIS_GRUDGE_THRESHOLD } from '@/config/gameBalance';

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-a', name: 'Club A', shortName: 'A', color: '#000', secondaryColor: '#FFF',
    budget: 10_000_000, reputation: 3, fanBase: 50, wageBill: 500_000, formation: '4-4-2',
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    facilities: 5, youthRating: 5, boardPatience: 5,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<HeadToHeadRecord> = {}): HeadToHeadRecord {
  return { wins: 0, draws: 0, losses: 0, lastResult: null, grudgeLevel: 0, ...overrides };
}

const clubs: Record<string, Club> = {
  rival: makeClub({ id: 'rival', shortName: 'RIV' }),
  minor: makeClub({ id: 'minor', shortName: 'MIN' }),
  ghost: makeClub({ id: 'ghost', shortName: 'GHO' }),
};

describe('getNemesis', () => {
  it('returns null when there are no rivalries', () => {
    expect(getNemesis(undefined, clubs)).toBeNull();
    expect(getNemesis({}, clubs)).toBeNull();
  });

  it('ignores grudges below the threshold', () => {
    const rivalries = {
      minor: makeRecord({ grudgeLevel: NEMESIS_GRUDGE_THRESHOLD - 1, losses: 1 }),
    };
    expect(getNemesis(rivalries, clubs)).toBeNull();
  });

  it('selects a club exactly at the threshold', () => {
    const rivalries = {
      minor: makeRecord({ grudgeLevel: NEMESIS_GRUDGE_THRESHOLD, losses: 3 }),
    };
    const n = getNemesis(rivalries, clubs);
    expect(n?.clubId).toBe('minor');
  });

  it('picks the highest grudge among several qualifying rivals', () => {
    const rivalries = {
      minor: makeRecord({ grudgeLevel: NEMESIS_GRUDGE_THRESHOLD, losses: 3 }),
      rival: makeRecord({ grudgeLevel: 5, losses: 6 }),
    };
    const n = getNemesis(rivalries, clubs);
    expect(n?.clubId).toBe('rival');
    expect(n?.grudgeLevel).toBe(5);
    expect(n?.heat).toBe('Nemesis');
  });

  it('skips rivals with no matching club record (e.g. virtual sides)', () => {
    const rivalries = {
      unknown: makeRecord({ grudgeLevel: 5, losses: 6 }),
      rival: makeRecord({ grudgeLevel: NEMESIS_GRUDGE_THRESHOLD, losses: 3 }),
    };
    const n = getNemesis(rivalries, clubs);
    expect(n?.clubId).toBe('rival');
  });

  it('keeps the first-encountered rival on a grudge tie (stable)', () => {
    const rivalries = {
      rival: makeRecord({ grudgeLevel: 4, losses: 4 }),
      minor: makeRecord({ grudgeLevel: 4, losses: 4 }),
    };
    const n = getNemesis(rivalries, clubs);
    expect(n?.clubId).toBe('rival');
    expect(n?.heat).toBe('Bitter Rivals');
  });

  it('surfaces the head-to-head record on the result', () => {
    const rec = makeRecord({ grudgeLevel: 5, wins: 1, draws: 2, losses: 6, lastResult: 'L' });
    const n = getNemesis({ rival: rec }, clubs);
    expect(n?.record).toEqual(rec);
    expect(n?.club.shortName).toBe('RIV');
  });
});

describe('getHeatLabel', () => {
  it('escalates from Bad Blood to Nemesis', () => {
    expect(getHeatLabel(NEMESIS_GRUDGE_THRESHOLD)).toBe('Bad Blood');
    expect(getHeatLabel(4)).toBe('Bitter Rivals');
    expect(getHeatLabel(5)).toBe('Nemesis');
  });
});

describe('getNemesisBarb', () => {
  it('is deterministic for a given record and interpolates the opponent name', () => {
    const rec = makeRecord({ grudgeLevel: 5, wins: 1, draws: 1, losses: 4, lastResult: 'L' });
    const a = getNemesisBarb(rec, 'RIV');
    const b = getNemesisBarb(rec, 'RIV');
    expect(a).toBe(b);
    expect(a).toContain('RIV');
  });

  it('uses different copy pools depending on who won last', () => {
    const base = { grudgeLevel: 5, wins: 2, draws: 2, losses: 2 } as const;
    const won = getNemesisBarb(makeRecord({ ...base, lastResult: 'W' }), 'RIV');
    const lost = getNemesisBarb(makeRecord({ ...base, lastResult: 'L' }), 'RIV');
    const drew = getNemesisBarb(makeRecord({ ...base, lastResult: 'D' }), 'RIV');
    // Same game count → each pool indexes the same slot, so the three lines
    // must differ because the pools themselves differ.
    expect(new Set([won, lost, drew]).size).toBe(3);
  });
});
