/**
 * squadStrength — pure squad-vs-league position-group analysis used by the
 * Squad page's "Squad vs League" insight panel.
 */
import { describe, it, expect } from 'vitest';
import {
  positionGroup,
  squadStrengthByGroup,
  leagueAverageByGroup,
  compareSquadToLeague,
} from '@/utils/squadStrength';
import type { Player, Club } from '@/types/game';

function mkPlayer(id: string, position: Player['position'], overall: number, clubId = 'c'): Player {
  return { id, position, overall, clubId, firstName: 'A', lastName: id } as unknown as Player;
}
function mkClub(id: string, playerIds: string[]): Club {
  return { id, playerIds } as unknown as Club;
}

describe('positionGroup', () => {
  it('buckets granular positions into GK/DEF/MID/ATT', () => {
    expect(positionGroup('GK')).toBe('GK');
    expect(positionGroup('CB')).toBe('DEF');
    expect(positionGroup('LB')).toBe('DEF');
    expect(positionGroup('CDM')).toBe('MID');
    expect(positionGroup('CAM')).toBe('MID');
    expect(positionGroup('LW')).toBe('ATT');
    expect(positionGroup('ST')).toBe('ATT');
  });
});

describe('squadStrengthByGroup', () => {
  it('averages overall per group and rounds', () => {
    const squad = [
      mkPlayer('g', 'GK', 70),
      mkPlayer('d1', 'CB', 80),
      mkPlayer('d2', 'LB', 70), // DEF avg = 75
      mkPlayer('a', 'ST', 85),
    ];
    const r = squadStrengthByGroup(squad);
    expect(r.GK).toEqual({ count: 1, avgOverall: 70 });
    expect(r.DEF).toEqual({ count: 2, avgOverall: 75 });
    expect(r.MID).toEqual({ count: 0, avgOverall: 0 });
    expect(r.ATT).toEqual({ count: 1, avgOverall: 85 });
  });
});

describe('leagueAverageByGroup', () => {
  it('averages across all players in the given clubs and skips missing refs', () => {
    const players: Record<string, Player> = {
      p1: mkPlayer('p1', 'ST', 80, 'a'),
      p2: mkPlayer('p2', 'ST', 70, 'b'), // ATT league avg = 75
      p3: mkPlayer('p3', 'CB', 60, 'a'),
    };
    const clubs: Record<string, Club> = {
      a: mkClub('a', ['p1', 'p3', 'ghost']), // 'ghost' has no player record
      b: mkClub('b', ['p2']),
    };
    const r = leagueAverageByGroup(['a', 'b', 'missing-club'], clubs, players);
    expect(r.ATT).toBe(75);
    expect(r.DEF).toBe(60);
    expect(r.GK).toBe(0);
  });
});

describe('compareSquadToLeague', () => {
  it('produces signed deltas vs the rest of the league', () => {
    const squad = [mkPlayer('m1', 'ST', 90, 'me')];
    const players: Record<string, Player> = {
      r1: mkPlayer('r1', 'ST', 80, 'rival'),
      r2: mkPlayer('r2', 'GK', 70, 'rival'),
    };
    const clubs: Record<string, Club> = { rival: mkClub('rival', ['r1', 'r2']) };
    const rows = compareSquadToLeague(squad, ['rival'], clubs, players);
    const att = rows.find(r => r.group === 'ATT')!;
    expect(att.mine).toBe(90);
    expect(att.league).toBe(80);
    expect(att.delta).toBe(10);
    // A group with no squad players reads as a glaring gap (mine 0).
    const gk = rows.find(r => r.group === 'GK')!;
    expect(gk.count).toBe(0);
    expect(gk.delta).toBe(-70);
  });
});
