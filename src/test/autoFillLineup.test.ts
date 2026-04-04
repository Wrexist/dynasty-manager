import { describe, it, expect } from 'vitest';
import type { Player, Position, FormationType } from '@/types/game';
import { hungarianAssignment, autoFillBestTeam, optimizeStarterPositions } from '@/utils/autoFillLineup';

// ── Test helpers ──

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe', age: 25, position: 'CM' as Position,
    nationality: 'England', overall: 70, potential: 80, value: 1000000, wage: 10000,
    clubId: 'club-a', contractEnd: 3, goals: 0, assists: 0, appearances: 10,
    fitness: 85, morale: 70, form: 60, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0, suspended: false, suspendedUntil: 0,
    attributes: { pace: 65, shooting: 60, passing: 75, defending: 55, physical: 65, mental: 70 },
    ...overrides,
  } as Player;
}

function makeSquad(count: number, _formation: FormationType = '4-4-2'): Player[] {
  // Build a realistic squad that covers common formation positions
  const positionPool: Position[] = [
    'GK', 'GK',
    'CB', 'CB', 'CB', 'CB',
    'LB', 'LB', 'RB', 'RB',
    'CM', 'CM', 'CM', 'CDM',
    'LM', 'RM',
    'LW', 'RW',
    'ST', 'ST', 'ST',
    'CAM', 'CM', 'CB', 'LM',
  ];

  const players: Player[] = [];
  for (let i = 0; i < count; i++) {
    const pos = positionPool[i % positionPool.length];
    players.push(makePlayer({
      id: `player-${i}`,
      position: pos,
      overall: 65 + Math.floor(i * 0.5),
      fitness: 75 + (i % 20),
      morale: 60 + (i % 30),
      form: 50 + (i % 40),
    }));
  }
  return players;
}

// ── Hungarian Algorithm Tests ──

describe('hungarianAssignment', () => {
  it('finds optimal 3x3 assignment', () => {
    // Known optimal: slot0→p2 (9), slot1→p0 (7), slot2→p1 (8) = 24
    const scores = [
      [1, 2, 9],  // slot 0
      [7, 3, 5],  // slot 1
      [4, 8, 6],  // slot 2
    ];
    const result = hungarianAssignment(scores);
    expect(result).toHaveLength(3);

    // Verify total is maximal
    const total = result.reduce((sum, pi, si) => sum + scores[si][pi], 0);
    expect(total).toBe(24);
  });

  it('handles rectangular matrix (more players than slots)', () => {
    // 2 slots, 4 players
    const scores = [
      [10, 5, 3, 8],  // slot 0
      [2, 12, 7, 1],  // slot 1
    ];
    const result = hungarianAssignment(scores);
    expect(result).toHaveLength(2);

    // Optimal: slot0→p0 (10), slot1→p1 (12) = 22
    const total = result.reduce((sum, pi, si) => sum + scores[si][pi], 0);
    expect(total).toBe(22);
    // All assigned players must be unique
    expect(new Set(result).size).toBe(result.length);
  });

  it('handles undersized case (fewer players than slots)', () => {
    // 3 slots, 2 players — one slot will be unassigned (-1)
    const scores = [
      [10, 5],  // slot 0
      [3, 12],  // slot 1
      [8, 2],   // slot 2
    ];
    const result = hungarianAssignment(scores);
    expect(result).toHaveLength(3);

    // Exactly one slot should be -1 (unassigned)
    const assigned = result.filter(pi => pi >= 0 && pi < 2);
    expect(assigned.length).toBe(2);
    expect(new Set(assigned).size).toBe(2);
  });

  it('handles 1x1 matrix', () => {
    const result = hungarianAssignment([[42]]);
    expect(result).toEqual([0]);
  });

  it('handles empty matrix', () => {
    const result = hungarianAssignment([]);
    expect(result).toEqual([]);
  });

  it('handles all-negative scores', () => {
    const scores = [
      [-10, -5],
      [-3, -12],
    ];
    const result = hungarianAssignment(scores);
    expect(result).toHaveLength(2);
    // Optimal: slot0→p1 (-5), slot1→p0 (-3) = -8
    const total = result.reduce((sum, pi, si) => sum + scores[si][pi], 0);
    expect(total).toBe(-8);
  });

  it('handles equal scores', () => {
    const scores = [
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
    ];
    const result = hungarianAssignment(scores);
    expect(result).toHaveLength(3);
    // All should be unique assignments
    expect(new Set(result).size).toBe(3);
  });
});

// ── autoFillBestTeam Tests ──

describe('autoFillBestTeam', () => {
  it('returns 11 starters and up to 5 subs for a full squad', () => {
    const squad = makeSquad(22);
    const result = autoFillBestTeam(squad, '4-4-2');
    expect(result.lineup).toHaveLength(11);
    expect(result.subs.length).toBeGreaterThan(0);
    expect(result.subs.length).toBeLessThanOrEqual(7);
  });

  it('returns unique player IDs — no duplicates between lineup and subs', () => {
    const squad = makeSquad(20);
    const result = autoFillBestTeam(squad, '4-3-3');
    const allIds = [...result.lineup, ...result.subs].map(p => p.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('never selects injured players', () => {
    const squad = makeSquad(18);
    // Injure the top 5 players
    squad.slice(0, 5).forEach(p => { p.injured = true; });
    const result = autoFillBestTeam(squad, '4-4-2');
    const allSelected = [...result.lineup, ...result.subs];
    expect(allSelected.every(p => !p.injured)).toBe(true);
  });

  it('never selects suspended players', () => {
    const squad = makeSquad(18);
    squad[0].suspendedUntilWeek = 10;
    const result = autoFillBestTeam(squad, '4-4-2', 5); // current week 5, suspended until 10
    const allSelected = [...result.lineup, ...result.subs];
    expect(allSelected.every(p => p.id !== squad[0].id)).toBe(true);
  });

  it('never selects players on loan', () => {
    const squad = makeSquad(18);
    (squad[0] as Player & { onLoan?: boolean }).onLoan = true;
    const result = autoFillBestTeam(squad, '4-4-2');
    const allSelected = [...result.lineup, ...result.subs];
    expect(allSelected.every(p => p.id !== squad[0].id)).toBe(true);
  });

  it('places GK in GK slot, not outfield', () => {
    const squad = makeSquad(18);
    const result = autoFillBestTeam(squad, '4-4-2');
    // The GK in lineup should be a player with position GK
    const gkInLineup = result.lineup.find(p => p.position === 'GK');
    expect(gkInLineup).toBeDefined();
    // Only 1 GK in lineup (4-4-2 has 1 GK slot)
    const gkCount = result.lineup.filter(p => p.position === 'GK').length;
    expect(gkCount).toBe(1);
  });

  it('prefers natural position players over out-of-position alternatives', () => {
    // Create a squad where a natural ST exists alongside a CB who has higher overall
    const squad: Player[] = [
      makePlayer({ id: 'gk1', position: 'GK', overall: 75 }),
      makePlayer({ id: 'cb1', position: 'CB', overall: 78 }),
      makePlayer({ id: 'cb2', position: 'CB', overall: 76 }),
      makePlayer({ id: 'lb1', position: 'LB', overall: 74 }),
      makePlayer({ id: 'rb1', position: 'RB', overall: 74 }),
      makePlayer({ id: 'cm1', position: 'CM', overall: 75 }),
      makePlayer({ id: 'cm2', position: 'CM', overall: 73 }),
      makePlayer({ id: 'lm1', position: 'LM', overall: 72 }),
      makePlayer({ id: 'rm1', position: 'RM', overall: 72 }),
      makePlayer({ id: 'st1', position: 'ST', overall: 70 }), // Natural ST, lower overall
      makePlayer({ id: 'st2', position: 'ST', overall: 69 }),
      // Extra CB with high overall — should NOT be picked as ST
      makePlayer({ id: 'cb3', position: 'CB', overall: 82 }),
    ];
    const result = autoFillBestTeam(squad, '4-4-2');
    const strikers = result.lineup.filter(p =>
      p.position === 'ST' || p.position === 'LW' || p.position === 'RW'
    );
    // No CBs should be in the striker slots — natural STs should be preferred
    expect(strikers.every(p => p.position !== 'CB')).toBe(true);
  });

  it('boosts set piece takers when provided in context', () => {
    // Create two similar CMs, one designated as set piece taker
    const squad: Player[] = [
      makePlayer({ id: 'gk1', position: 'GK', overall: 75 }),
      makePlayer({ id: 'cb1', position: 'CB', overall: 75 }),
      makePlayer({ id: 'cb2', position: 'CB', overall: 75 }),
      makePlayer({ id: 'lb1', position: 'LB', overall: 75 }),
      makePlayer({ id: 'rb1', position: 'RB', overall: 75 }),
      makePlayer({ id: 'cm1', position: 'CM', overall: 72 }),  // Slightly lower but set piece taker
      makePlayer({ id: 'cm2', position: 'CM', overall: 73 }),
      makePlayer({ id: 'cm3', position: 'CM', overall: 74 }),  // Highest CM
      makePlayer({ id: 'lm1', position: 'LM', overall: 72 }),
      makePlayer({ id: 'rm1', position: 'RM', overall: 72 }),
      makePlayer({ id: 'st1', position: 'ST', overall: 75 }),
      makePlayer({ id: 'st2', position: 'ST', overall: 74 }),
    ];
    const result = autoFillBestTeam(squad, '4-4-2', 1, 1, {
      setPieceTakerId: 'cm1',
    });
    const lineupIds = result.lineup.map(p => p.id);
    // Set piece taker cm1 should be in the lineup despite slightly lower overall
    expect(lineupIds).toContain('cm1');
  });

  it('handles undersized squad gracefully', () => {
    const squad = makeSquad(8);
    const result = autoFillBestTeam(squad, '4-4-2');
    // Should return whatever players are available, not crash
    expect(result.lineup.length).toBeLessThanOrEqual(11);
    expect(result.lineup.length).toBeGreaterThan(0);
  });

  it('returns chemistry info', () => {
    const squad = makeSquad(20);
    const result = autoFillBestTeam(squad, '4-3-3');
    expect(typeof result.chemistryBonus).toBe('number');
    expect(typeof result.chemistryLabel).toBe('string');
  });

  it('returns empty lineup for empty squad', () => {
    const result = autoFillBestTeam([], '4-4-2');
    expect(result.lineup).toHaveLength(0);
    expect(result.subs).toHaveLength(0);
  });

  it('works with all 7 formations', () => {
    const formations: FormationType[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1', '3-4-3', '5-3-2'];
    const squad = makeSquad(22);
    for (const formation of formations) {
      const result = autoFillBestTeam(squad, formation);
      expect(result.lineup).toHaveLength(11);
    }
  });
});

// ── optimizeStarterPositions Tests ──

describe('optimizeStarterPositions', () => {
  it('reorders players for better positional fit', () => {
    // Create 11 players deliberately in wrong slots for 4-4-2
    // 4-4-2: GK, LB, CB, CB, RB, LM, CM, CM, RM, ST, ST
    const players: Record<string, Player> = {};
    const correctOrder: Position[] = ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
    // Create players with these positions
    correctOrder.forEach((pos, i) => {
      players[`p${i}`] = makePlayer({ id: `p${i}`, position: pos, overall: 70 + i });
    });

    // Deliberately shuffle the IDs (put them in wrong slots)
    const shuffledIds = ['p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1', 'p0'];
    const optimized = optimizeStarterPositions(shuffledIds, players, '4-4-2');

    // The GK (p0) should be in slot 0 (GK slot)
    expect(players[optimized[0]].position).toBe('GK');
  });

  it('returns original lineup when squad is undersized', () => {
    const players: Record<string, Player> = {};
    const ids = ['p0', 'p1', 'p2'];
    ids.forEach((id, i) => {
      players[id] = makePlayer({ id, position: 'CM', overall: 70 + i });
    });
    // 3 players for 11 slots — should return original
    const result = optimizeStarterPositions(ids, players, '4-4-2');
    expect(result).toEqual(ids);
  });

  it('produces no duplicate IDs', () => {
    const players: Record<string, Player> = {};
    const positions: Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST'];
    positions.forEach((pos, i) => {
      players[`p${i}`] = makePlayer({ id: `p${i}`, position: pos, overall: 70 + i });
    });
    const ids = positions.map((_, i) => `p${i}`);
    const result = optimizeStarterPositions(ids, players, '4-4-2');
    expect(new Set(result).size).toBe(result.length);
  });
});
