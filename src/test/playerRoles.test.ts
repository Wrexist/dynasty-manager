import { describe, it, expect } from 'vitest';
import { inferDefaultRole, getValidRolesForPosition, getRoleWeights } from '@/utils/playerRoles';
import { PLAYER_ROLE_DEFINITIONS } from '@/config/playerRoles';
import type { Player, Position, PlayerAttributes } from '@/types/game';

function makePlayer(position: Position, attrs: Partial<PlayerAttributes> = {}): Player {
  return {
    id: 'p',
    firstName: 'Test',
    lastName: 'Player',
    age: 25,
    nationality: 'England',
    position,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70, ...attrs },
    overall: 70,
    potential: 75,
    clubId: 'c',
    wage: 1000,
    value: 1_000_000,
    contractEnd: 3,
    fitness: 100,
    morale: 80,
    form: 75,
    injured: false,
    injuryWeeks: 0,
    goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
    careerGoals: 0, careerAssists: 0, careerAppearances: 0,
  } as Player;
}

describe('playerRoles', () => {
  describe('PLAYER_ROLE_DEFINITIONS', () => {
    it('defines all twelve archetypes', () => {
      expect(Object.keys(PLAYER_ROLE_DEFINITIONS)).toHaveLength(12);
    });

    it('every role has at least one valid position', () => {
      for (const def of Object.values(PLAYER_ROLE_DEFINITIONS)) {
        expect(def.validPositions.length).toBeGreaterThan(0);
      }
    });

    it('every role has positive weight multipliers', () => {
      for (const def of Object.values(PLAYER_ROLE_DEFINITIONS)) {
        expect(def.attackWeight).toBeGreaterThan(0);
        expect(def.assistWeight).toBeGreaterThan(0);
        expect(def.foulWeight).toBeGreaterThan(0);
      }
    });
  });

  describe('getValidRolesForPosition', () => {
    it('returns Poacher / Target-Man / Complete-Forward for ST', () => {
      const roles = getValidRolesForPosition('ST');
      expect(roles).toEqual(expect.arrayContaining(['poacher', 'target-man', 'complete-forward']));
    });

    it('returns Sweeper-Keeper as the only GK role', () => {
      expect(getValidRolesForPosition('GK')).toEqual(['sweeper-keeper']);
    });

    it('returns Trequartista for CAM', () => {
      expect(getValidRolesForPosition('CAM')).toContain('trequartista');
    });
  });

  describe('inferDefaultRole', () => {
    it('poacher = high shooting striker', () => {
      const p = makePlayer('ST', { shooting: 85, physical: 65 });
      expect(inferDefaultRole(p)).toBe('poacher');
    });

    it('target-man = physical striker', () => {
      const p = makePlayer('ST', { shooting: 70, physical: 85 });
      expect(inferDefaultRole(p)).toBe('target-man');
    });

    it('complete-forward = balanced striker', () => {
      const p = makePlayer('ST', { shooting: 72, physical: 70 });
      expect(inferDefaultRole(p)).toBe('complete-forward');
    });

    it('trequartista = CAM', () => {
      expect(inferDefaultRole(makePlayer('CAM'))).toBe('trequartista');
    });

    it('deep-lying-playmaker = high passing CDM', () => {
      const p = makePlayer('CDM', { passing: 82 });
      expect(inferDefaultRole(p)).toBe('deep-lying-playmaker');
    });

    it('ball-winning-mid = low-passing CDM', () => {
      const p = makePlayer('CDM', { passing: 65 });
      expect(inferDefaultRole(p)).toBe('ball-winning-mid');
    });

    it('mezzala = balanced CM', () => {
      const p = makePlayer('CM', { passing: 70, defending: 65 });
      expect(inferDefaultRole(p)).toBe('mezzala');
    });

    it('wing-back = pacy full-back', () => {
      expect(inferDefaultRole(makePlayer('LB', { pace: 80 }))).toBe('wing-back');
      expect(inferDefaultRole(makePlayer('RB', { pace: 80 }))).toBe('wing-back');
    });

    it('slow full-back gets no specialist role', () => {
      expect(inferDefaultRole(makePlayer('LB', { pace: 55 }))).toBeUndefined();
    });

    it('ball-playing-def = passing CB', () => {
      expect(inferDefaultRole(makePlayer('CB', { passing: 78 }))).toBe('ball-playing-def');
    });

    it('sweeper = high-defending CB with low passing', () => {
      expect(inferDefaultRole(makePlayer('CB', { passing: 60, defending: 82 }))).toBe('sweeper');
    });

    it('sweeper-keeper = GK with mental & pace', () => {
      expect(inferDefaultRole(makePlayer('GK', { mental: 75, pace: 62 }))).toBe('sweeper-keeper');
    });

    it('slow GK gets no specialist role', () => {
      expect(inferDefaultRole(makePlayer('GK', { mental: 60, pace: 45 }))).toBeUndefined();
    });

    it('assigns a valid-position role for every pick', () => {
      const positions: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
      for (const pos of positions) {
        for (let i = 0; i < 5; i++) {
          const p = makePlayer(pos);
          const role = inferDefaultRole(p);
          if (role) {
            expect(PLAYER_ROLE_DEFINITIONS[role].validPositions).toContain(pos);
          }
        }
      }
    });
  });

  describe('getRoleWeights', () => {
    it('returns neutral weights when no role assigned', () => {
      const p = makePlayer('ST');
      const w = getRoleWeights(p);
      expect(w.attackWeight).toBe(1.0);
      expect(w.assistWeight).toBe(1.0);
      expect(w.foulWeight).toBe(1.0);
    });

    it('poacher has high attack weight', () => {
      const p = makePlayer('ST');
      p.role = 'poacher';
      expect(getRoleWeights(p).attackWeight).toBeGreaterThan(1.2);
    });

    it('ball-winning-mid has high foul weight', () => {
      const p = makePlayer('CDM');
      p.role = 'ball-winning-mid';
      expect(getRoleWeights(p).foulWeight).toBeGreaterThan(1.2);
    });

    it('deep-lying-playmaker has high assist weight', () => {
      const p = makePlayer('CDM');
      p.role = 'deep-lying-playmaker';
      expect(getRoleWeights(p).assistWeight).toBeGreaterThan(1.2);
    });
  });
});
