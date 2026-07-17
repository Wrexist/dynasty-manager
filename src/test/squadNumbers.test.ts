import { describe, it, expect } from 'vitest';
import {
  pickSquadNumber,
  collectTakenNumbers,
  assignSquadNumber,
  assignSquadNumbersToSquad,
  assignNumberOnJoin,
} from '@/utils/squadNumbers';
import { POSITION_SQUAD_NUMBERS } from '@/config/squadNumbers';
import { generateSquad } from '@/utils/playerGen';
import { resetRealPlayerClaims } from '@/utils/realPlayerPicker';
import { migrateSaveData } from '@/utils/saveMigration';
import { Player, Position } from '@/types/game';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: crypto.randomUUID(),
    firstName: 'Test', lastName: 'Player',
    age: 25, nationality: 'England', position: 'CM' as Position,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70 },
    overall: 70, potential: 75, clubId: 'c1', wage: 10000, value: 5_000_000,
    contractEnd: 3, fitness: 90, morale: 70, form: 70,
    injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0,
    ...overrides,
  } as Player;
}

describe('pickSquadNumber', () => {
  it('returns the first preferred number when free', () => {
    expect(pickSquadNumber('GK', new Set())).toBe(POSITION_SQUAD_NUMBERS.GK[0]);
    expect(pickSquadNumber('ST', new Set())).toBe(POSITION_SQUAD_NUMBERS.ST[0]);
  });

  it('skips taken preferred numbers', () => {
    const taken = new Set([1]); // GK 1 taken
    expect(pickSquadNumber('GK', taken)).toBe(POSITION_SQUAD_NUMBERS.GK[1]);
  });

  it('falls back to lowest free 1-99 when all preferred are taken', () => {
    const taken = new Set(POSITION_SQUAD_NUMBERS.GK);
    const n = pickSquadNumber('GK', taken);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(99);
    expect(taken.has(n!)).toBe(false);
  });
});

describe('collectTakenNumbers', () => {
  it('gathers assigned numbers and retired shirts', () => {
    const players = [makePlayer({ squadNumber: 9 }), makePlayer({ squadNumber: 10 }), makePlayer()];
    const taken = collectTakenNumbers(players, [7]);
    expect(taken).toEqual(new Set([9, 10, 7]));
  });
});

describe('assignSquadNumber', () => {
  it('keeps a valid non-clashing existing number', () => {
    const p = makePlayer({ squadNumber: 42, position: 'ST' });
    assignSquadNumber(p, [makePlayer({ squadNumber: 9 })]);
    expect(p.squadNumber).toBe(42);
  });

  it('reassigns when the existing number clashes with the squad', () => {
    const p = makePlayer({ squadNumber: 9, position: 'ST' });
    assignSquadNumber(p, [makePlayer({ squadNumber: 9 }), makePlayer({ id: p.id, squadNumber: 9 })]);
    expect(p.squadNumber).not.toBe(9);
  });

  it('excludes retired shirts', () => {
    const p = makePlayer({ position: 'ST' });
    // ST prefers 9 first; retire 9 → must pick a different number.
    assignSquadNumber(p, [], [9]);
    expect(p.squadNumber).not.toBe(9);
  });
});

describe('assignSquadNumbersToSquad', () => {
  it('assigns unique numbers to every player', () => {
    const squad = [
      makePlayer({ position: 'GK' }),
      makePlayer({ position: 'GK' }),
      makePlayer({ position: 'CB' }),
      makePlayer({ position: 'CB' }),
      makePlayer({ position: 'ST' }),
      makePlayer({ position: 'ST' }),
    ];
    assignSquadNumbersToSquad(squad);
    const numbers = squad.map(p => p.squadNumber);
    expect(new Set(numbers).size).toBe(squad.length); // all unique
    numbers.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(99);
    });
  });

  it('gives GKs and the first CB their canonical shirts', () => {
    const squad = [makePlayer({ position: 'GK' }), makePlayer({ position: 'CB' })];
    assignSquadNumbersToSquad(squad);
    expect(squad[0].squadNumber).toBe(1);
    expect(squad[1].squadNumber).toBe(4);
  });

  it('never assigns a retired shirt', () => {
    const squad = Array.from({ length: 5 }, () => makePlayer({ position: 'ST' }));
    assignSquadNumbersToSquad(squad, [9, 10]);
    squad.forEach(p => {
      expect(p.squadNumber).not.toBe(9);
      expect(p.squadNumber).not.toBe(10);
    });
  });
});

describe('generateSquad', () => {
  it('gives every generated player a unique shirt within the club', () => {
    resetRealPlayerClaims();
    const squad = generateSquad('Arsenal', 80, 1, undefined, true);
    const numbers = squad.map(p => p.squadNumber).filter(n => typeof n === 'number');
    expect(numbers.length).toBe(squad.length);
    expect(new Set(numbers).size).toBe(squad.length);
  });
});

describe('save migration v72 -> v73', () => {
  it('assigns shirts to every club roster in an existing save', () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: 'p1', clubId: 'c1', position: 'GK' }),
      p2: makePlayer({ id: 'p2', clubId: 'c1', position: 'ST' }),
      p3: makePlayer({ id: 'p3', clubId: 'c2', position: 'CB' }),
    };
    const save = {
      version: 72,
      players,
      clubs: {
        c1: { id: 'c1', playerIds: ['p1', 'p2'] },
        c2: { id: 'c2', playerIds: ['p3'] },
      },
    } as unknown as Record<string, unknown>;

    const migrated = migrateSaveData(save) as unknown as { players: Record<string, Player>; migrationError?: boolean };
    expect(migrated.migrationError).toBeFalsy();
    expect(migrated.players.p1.squadNumber).toBe(1);   // GK canonical
    expect(migrated.players.p2.squadNumber).toBeDefined();
    expect(migrated.players.p1.squadNumber).not.toBe(migrated.players.p2.squadNumber);
    expect(migrated.players.p3.squadNumber).toBeDefined();
  });
});

describe('assignNumberOnJoin', () => {
  it('assigns a shirt honouring the destination roster and retired shirts', () => {
    const joining = makePlayer({ id: 'new', position: 'ST' });
    const existing = makePlayer({ id: 'a', squadNumber: 9 });
    const playersMap: Record<string, Player> = { a: existing };
    assignNumberOnJoin(joining, ['a', 'new'], playersMap, [{ number: 10 }]);
    expect(joining.squadNumber).toBeDefined();
    expect(joining.squadNumber).not.toBe(9);  // taken by roster
    expect(joining.squadNumber).not.toBe(10); // retired
  });
});
