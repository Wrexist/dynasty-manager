/**
 * R5 — a new game starts with a position-correct XI.
 *
 * Quick Start opened Liverpool with Salah (RW) at ST and Isak and Ekitiké
 * (both ST) on the wings, while the lineup optimizer that would fix it is Pro.
 * `selectBestLineup` walks a 4-3-3's slots in order (…LW, ST, RW) and took the
 * best COMPATIBLE player for each: the LW slot took the best striker (ST can
 * play LW), the ST slot the best right winger. The manager's own XI is now
 * picked natural-positions-first at game start (`naturalFirst`), with the free
 * selector, not the Pro Smart Optimizer. AI selection is unchanged.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generatePlayer, selectBestLineup } from '@/utils/playerGen';
import { useGameStore } from '@/store/gameStore';
import { mulberry32 } from '@/utils/communityPackPool';
import { FORMATION_POSITIONS, type Player, type Position } from '@/types/game';
import {
  EFFECTIVE_RATING_OVERALL_WEIGHT, EFFECTIVE_RATING_FORM_WEIGHT, EFFECTIVE_RATING_FITNESS_WEIGHT,
  STARTING_XI_OUT_OF_POSITION_PENALTY,
} from '@/config/playerGeneration';

function player(pos: Position, overall: number, id: string): Player {
  const p = generatePlayer(pos, overall, 'c', 1);
  return { ...p, id, position: pos, overall, form: 70, fitness: 100, injured: false, alternatePositions: [] };
}

/** A 4-3-3 squad with the playthrough's trap: the two best forwards are
 *  strikers, the right winger is next, the left winger is the weakest. */
function trapSquad(): Player[] {
  return [
    player('GK', 80, 'gk'),
    player('LB', 78, 'lb'), player('CB', 80, 'cb1'), player('CB', 79, 'cb2'), player('RB', 78, 'rb'),
    player('CM', 80, 'cm1'), player('CM', 79, 'cm2'), player('CM', 78, 'cm3'),
    player('ST', 88, 'isak'), player('ST', 85, 'ekitike'), player('RW', 87, 'salah'), player('LW', 80, 'gakpo'),
    player('GK', 70, 'gk2'), player('CB', 70, 'cb3'),
  ];
}

function seated(lineup: Player[]): Record<string, string> {
  const slots = FORMATION_POSITIONS['4-3-3'];
  return Object.fromEntries(lineup.map((p, i) => [p.id, slots[i].pos]));
}

describe('selectBestLineup preferNaturalPositions', () => {
  it('without it, the slot-order greedy pick is out of position (the R5 shape)', () => {
    const { lineup } = selectBestLineup(trapSquad(), '4-3-3');
    const at = seated(lineup);
    expect(at.isak).toBe('LW');
    expect(at.salah).toBe('ST');
  });

  it('seats every player in his own position when one is available', () => {
    const { lineup, subs } = selectBestLineup(trapSquad(), '4-3-3', undefined, { preferNaturalPositions: true });
    const at = seated(lineup);
    expect(at).toMatchObject({ gakpo: 'LW', isak: 'ST', salah: 'RW' });
    expect(lineup).toHaveLength(11);
    expect(subs.map(p => p.id)).toContain('ekitike');
  });

  it('still plays a much better player out of position (a 90 CDM over a 75 CM)', () => {
    const squad = trapSquad().map(p => (p.id === 'cm3' ? { ...p, overall: 75 } : p));
    squad.push(player('CDM', 90, 'rodri'));
    const { lineup } = selectBestLineup(squad, '4-3-3', undefined, { preferNaturalPositions: true });
    expect(seated(lineup).rodri).toBe('CM');
  });

  it('still fills a slot with no natural player from compatible positions', () => {
    const squad = trapSquad().filter(p => p.id !== 'gakpo');
    const { lineup } = selectBestLineup(squad, '4-3-3', undefined, { preferNaturalPositions: true });
    const at = seated(lineup);
    expect(at.salah).toBe('RW');
    expect(at.isak).toBe('ST');
    expect(at.ekitike).toBe('LW');
    expect(lineup).toHaveLength(11);
  });
});

describe('a new game opens with a position-correct XI', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(5));
    useGameStore.getState().resetGame();
  });
  afterEach(() => vi.restoreAllMocks());

  for (const clubId of ['liverpool', 'manchester-city', 'arsenal']) {
    it(`${clubId}: no starter is out of position while a comparable natural one sits out`, () => {
      useGameStore.getState().initGame(clubId);
      const s = useGameStore.getState();
      const club = s.clubs[clubId];
      const slots = FORMATION_POSITIONS[club.formation];
      const starters = new Set(club.lineup);
      const bench = club.playerIds.map(id => s.players[id]).filter(p => p && !starters.has(p.id) && !p.injured);
      expect(club.lineup).toHaveLength(11);
      // Effective rating as selectBestLineup computes it, in overall points.
      const eff = (p: Player) => p.overall + ((p.form / 100) * EFFECTIVE_RATING_FORM_WEIGHT
        + (p.fitness / 100) * EFFECTIVE_RATING_FITNESS_WEIGHT) / EFFECTIVE_RATING_OVERALL_WEIGHT;
      club.lineup.forEach((id, i) => {
        const p = s.players[id];
        if (p.position === slots[i].pos) return;
        const natural = bench
          .filter(b => b.position === slots[i].pos && eff(b) > eff(p) - STARTING_XI_OUT_OF_POSITION_PENALTY)
          .map(b => `${b.lastName} (${b.position} ${b.overall})`);
        expect(natural, `${p.lastName} (${p.position} ${p.overall}) in the ${slots[i].pos} slot`).toEqual([]);
      });
    });
  }
});
