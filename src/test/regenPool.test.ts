import { describe, it, expect } from 'vitest';
import { generateSeasonalRegens, mergeRegensIntoFreeAgentPool } from '@/utils/regenPool';
import { Player } from '@/types/game';

describe('regenPool', () => {
  describe('generateSeasonalRegens', () => {
    it('generates the requested count of newgens', () => {
      const { players, playerIds } = generateSeasonalRegens(5, ['eng'], 25);
      expect(players).toHaveLength(25);
      expect(playerIds).toHaveLength(25);
    });

    it('every newgen is aged 16-19', () => {
      const { players } = generateSeasonalRegens(3, ['eng'], 50);
      for (const p of players) {
        expect(p.age).toBeGreaterThanOrEqual(16);
        expect(p.age).toBeLessThanOrEqual(19);
      }
    });

    it('every newgen is unattached (no clubId)', () => {
      const { players } = generateSeasonalRegens(1, ['eng'], 20);
      for (const p of players) {
        expect(p.clubId).toBe('');
        expect(p.listedForSale).toBe(false);
      }
    });

    it('potential is always >= overall', () => {
      const { players } = generateSeasonalRegens(1, ['eng'], 40);
      for (const p of players) {
        expect(p.potential).toBeGreaterThanOrEqual(p.overall);
      }
    });

    it('potential never exceeds the cap of 94', () => {
      const { players } = generateSeasonalRegens(1, ['eng'], 100);
      for (const p of players) {
        expect(p.potential).toBeLessThanOrEqual(94);
      }
    });

    it('season/career stats are reset to zero', () => {
      const { players } = generateSeasonalRegens(1, ['eng'], 10);
      for (const p of players) {
        expect(p.goals).toBe(0);
        expect(p.assists).toBe(0);
        expect(p.appearances).toBe(0);
        expect(p.careerGoals).toBe(0);
        expect(p.careerAssists).toBe(0);
        expect(p.careerAppearances).toBe(0);
      }
    });

    it('returns unique player ids', () => {
      const { playerIds } = generateSeasonalRegens(1, ['eng'], 30);
      expect(new Set(playerIds).size).toBe(playerIds.length);
    });

    it('tolerates empty divisionIds array', () => {
      const { players } = generateSeasonalRegens(1, [], 5);
      expect(players).toHaveLength(5);
    });

    it('produces at least some wonderkids over a large batch', () => {
      // With WONDERKID_CHANCE = 0.04, expect ~8 wonderkids (potential >= 85) in a batch of 200
      const { players } = generateSeasonalRegens(1, ['eng'], 200);
      const wonderkids = players.filter(p => p.potential >= 85);
      expect(wonderkids.length).toBeGreaterThan(0);
    });
  });

  describe('mergeRegensIntoFreeAgentPool', () => {
    function makeFA(id: string, overall: number, age: number): Player {
      return {
        id,
        firstName: 'Test',
        lastName: id,
        age,
        nationality: 'England',
        position: 'CM',
        attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 },
        overall,
        potential: overall,
        clubId: '',
        wage: 1000,
        value: 1000000,
        contractEnd: 1,
        fitness: 100,
        morale: 70,
        form: 70,
        injured: false,
        injuryWeeks: 0,
        goals: 0, assists: 0, appearances: 0, yellowCards: 0, redCards: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
      } as Player;
    }

    it('appends regens when the pool has room', () => {
      const regens = [makeFA('regen1', 55, 17), makeFA('regen2', 58, 18)];
      const existing = ['fa1', 'fa2'];
      const allPlayers: Record<string, Player> = {
        fa1: makeFA('fa1', 70, 29),
        fa2: makeFA('fa2', 65, 31),
        regen1: regens[0],
        regen2: regens[1],
      };
      const { freeAgentIds, evictedIds } = mergeRegensIntoFreeAgentPool(regens, existing, allPlayers, 10);
      expect(freeAgentIds).toHaveLength(4);
      expect(freeAgentIds).toContain('regen1');
      expect(freeAgentIds).toContain('regen2');
      expect(evictedIds).toHaveLength(0);
    });

    it('evicts the weakest free agent when the pool is full', () => {
      const regens = [makeFA('regen1', 55, 17)];
      const existing = ['fa1', 'fa2', 'fa3'];
      const allPlayers: Record<string, Player> = {
        fa1: makeFA('fa1', 80, 28), // strong
        fa2: makeFA('fa2', 40, 34), // weakest — should be evicted
        fa3: makeFA('fa3', 72, 30),
        regen1: regens[0],
      };
      const { freeAgentIds, evictedIds } = mergeRegensIntoFreeAgentPool(regens, existing, allPlayers, 3);
      expect(freeAgentIds).toHaveLength(3);
      expect(freeAgentIds).toContain('regen1');
      expect(freeAgentIds).not.toContain('fa2');
      expect(evictedIds).toContain('fa2');
    });

    it('penalises older free agents in the eviction score', () => {
      // A 36-year-old with overall 60 should be evicted before a 23-year-old with overall 55
      const regens = [makeFA('regen1', 55, 17)];
      const existing = ['old', 'young'];
      const allPlayers: Record<string, Player> = {
        old: makeFA('old', 60, 36),
        young: makeFA('young', 55, 23),
        regen1: regens[0],
      };
      const { freeAgentIds, evictedIds } = mergeRegensIntoFreeAgentPool(regens, existing, allPlayers, 2);
      expect(evictedIds).toContain('old');
      expect(freeAgentIds).toContain('young');
      expect(freeAgentIds).toContain('regen1');
    });
  });
});
