/**
 * Tests for the setPlayerPrimaryPosition action — the store plumbing
 * behind PlayerDetail's alternate-position swap pills.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { Player, Position } from '@/types/game';

function seedPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p-test',
    firstName: 'Alt',
    lastName: 'Tester',
    age: 25,
    nationality: 'England',
    position: 'CM',
    alternatePositions: ['CAM', 'RM'],
    attributes: { pace: 70, shooting: 60, passing: 75, defending: 55, physical: 65, mental: 72 },
    overall: 78,
    potential: 82,
    clubId: 'c1',
    wage: 20000,
    value: 10_000_000,
    contractEnd: 3,
    fitness: 90,
    morale: 70,
    form: 60,
    injured: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
    yellowCards: 0,
    redCards: 0,
    ...overrides,
  } as Player;
}

function installPlayer(player: Player) {
  useGameStore.setState(s => ({
    players: { ...s.players, [player.id]: player },
  }));
}

describe('setPlayerPrimaryPosition', () => {
  beforeEach(() => {
    // Start from a clean players map so mutations don't leak between tests.
    useGameStore.setState({ players: {} });
  });

  it('promotes the chosen alternate and demotes the old primary', () => {
    installPlayer(seedPlayer());
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'CAM' as Position);
    const after = useGameStore.getState().players['p-test'];
    expect(after.position).toBe('CAM');
    expect(after.alternatePositions).toEqual(['CM', 'RM']);
  });

  it('preserves the order of the remaining alternates', () => {
    installPlayer(seedPlayer({ alternatePositions: ['CAM', 'RM', 'LM'] as Position[] }));
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'RM' as Position);
    const after = useGameStore.getState().players['p-test'];
    expect(after.position).toBe('RM');
    // Old primary first, then the other alts in their original relative order.
    expect(after.alternatePositions).toEqual(['CM', 'CAM', 'LM']);
  });

  it('is a no-op when newPosition equals the current primary', () => {
    installPlayer(seedPlayer());
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'CM' as Position);
    const after = useGameStore.getState().players['p-test'];
    expect(after.position).toBe('CM');
    expect(after.alternatePositions).toEqual(['CAM', 'RM']);
  });

  it('is a no-op when newPosition is not one of the alternates', () => {
    installPlayer(seedPlayer());
    // GK is not in the player's alternatePositions — should not be promoted.
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'GK' as Position);
    const after = useGameStore.getState().players['p-test'];
    expect(after.position).toBe('CM');
    expect(after.alternatePositions).toEqual(['CAM', 'RM']);
  });

  it('is a no-op when the player does not exist', () => {
    // No installPlayer; store map is empty.
    useGameStore.getState().setPlayerPrimaryPosition('nonexistent', 'CM' as Position);
    expect(useGameStore.getState().players['nonexistent']).toBeUndefined();
  });

  it('handles a player with no alternates without throwing', () => {
    installPlayer(seedPlayer({ alternatePositions: undefined }));
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'CAM' as Position);
    const after = useGameStore.getState().players['p-test'];
    expect(after.position).toBe('CM'); // unchanged
  });

  it('swapping back restores the original position shape', () => {
    installPlayer(seedPlayer());
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'CAM' as Position);
    useGameStore.getState().setPlayerPrimaryPosition('p-test', 'CM' as Position);
    const after = useGameStore.getState().players['p-test'];
    expect(after.position).toBe('CM');
    // After two swaps the CM comes back to primary; CAM re-slots first in
    // alternates and RM follows.
    expect(after.alternatePositions).toEqual(['CAM', 'RM']);
  });
});
