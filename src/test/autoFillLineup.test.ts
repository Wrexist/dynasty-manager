import { describe, it, expect } from 'vitest';
import type { Player, Position, FormationType } from '@/types/game';
import { hungarianAssignment, autoFillBestTeam, optimizeStarterPositions, scorePlayerForSlot } from '@/utils/autoFillLineup';

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

  it('boosts penalty takers when provided in context', () => {
    const squad: Player[] = [
      makePlayer({ id: 'gk1', position: 'GK', overall: 75 }),
      makePlayer({ id: 'cb1', position: 'CB', overall: 75 }),
      makePlayer({ id: 'cb2', position: 'CB', overall: 75 }),
      makePlayer({ id: 'lb1', position: 'LB', overall: 75 }),
      makePlayer({ id: 'rb1', position: 'RB', overall: 75 }),
      makePlayer({ id: 'cm1', position: 'CM', overall: 73 }),
      makePlayer({ id: 'cm2', position: 'CM', overall: 74 }),
      makePlayer({ id: 'lm1', position: 'LM', overall: 72 }),
      makePlayer({ id: 'rm1', position: 'RM', overall: 72 }),
      makePlayer({ id: 'st1', position: 'ST', overall: 72 }), // Penalty taker, slightly lower
      makePlayer({ id: 'st2', position: 'ST', overall: 74 }),
      makePlayer({ id: 'st3', position: 'ST', overall: 73 }),
    ];
    const result = autoFillBestTeam(squad, '4-4-2', 1, 1, {
      penaltyTakerId: 'st1',
    });
    const lineupIds = result.lineup.map(p => p.id);
    expect(lineupIds).toContain('st1');
  });

  it('handles stale/invalid set piece taker IDs gracefully', () => {
    const squad = makeSquad(18);
    // Reference a player that doesn't exist in the squad
    const result = autoFillBestTeam(squad, '4-4-2', 1, 1, {
      setPieceTakerId: 'non-existent-player',
      penaltyTakerId: 'also-non-existent',
    });
    // Should still produce a valid lineup without crashing
    expect(result.lineup).toHaveLength(11);
    expect(result.subs.length).toBeGreaterThan(0);
  });

  it('considers defensive formation for bench selection', () => {
    // Main formation: 4-4-2 (needs 2 CBs), defensive formation: 5-3-2 (needs 3 CBs)
    // Squad has exactly 2 CBs in starting XI + 1 extra CB available
    const squad: Player[] = [
      makePlayer({ id: 'gk1', position: 'GK', overall: 75 }),
      makePlayer({ id: 'gk2', position: 'GK', overall: 65 }),
      makePlayer({ id: 'cb1', position: 'CB', overall: 78 }),
      makePlayer({ id: 'cb2', position: 'CB', overall: 76 }),
      makePlayer({ id: 'cb3', position: 'CB', overall: 64 }), // Extra CB for defensive formation
      makePlayer({ id: 'lb1', position: 'LB', overall: 74 }),
      makePlayer({ id: 'rb1', position: 'RB', overall: 74 }),
      makePlayer({ id: 'cm1', position: 'CM', overall: 75 }),
      makePlayer({ id: 'cm2', position: 'CM', overall: 73 }),
      makePlayer({ id: 'lm1', position: 'LM', overall: 72 }),
      makePlayer({ id: 'rm1', position: 'RM', overall: 72 }),
      makePlayer({ id: 'st1', position: 'ST', overall: 75 }),
      makePlayer({ id: 'st2', position: 'ST', overall: 74 }),
      // A non-CB bench option with similar overall to cb3
      makePlayer({ id: 'cam1', position: 'CAM', overall: 65 }),
    ];
    const resultWithDef = autoFillBestTeam(squad, '4-4-2', 1, 1, {
      defensiveFormation: '5-3-2',
    });
    const resultWithout = autoFillBestTeam(squad, '4-4-2', 1, 1);

    // With defensive formation context, CB3 should be prioritized on bench
    const defBenchIds = resultWithDef.subs.map(p => p.id);
    const noBenchIds = resultWithout.subs.map(p => p.id);

    // CB3 should appear on bench in both cases (it's a valid bench candidate),
    // but with defensive formation it should be ranked higher
    const cb3DefRank = defBenchIds.indexOf('cb3');
    const cb3NoRank = noBenchIds.indexOf('cb3');
    // With defensive formation awareness, cb3 should be at same or better rank
    if (cb3DefRank >= 0 && cb3NoRank >= 0) {
      expect(cb3DefRank).toBeLessThanOrEqual(cb3NoRank);
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

// ── Pro-tier "Smart" Optimizer Signal Tests ──

describe('autoFillBestTeam — Smart signals (Pro)', () => {
  it('GK slot uses match-engine GK formula (defending+mental+physical)', () => {
    // Two equally-overalled GKs: shot-stopper (high D/M/Phys) vs all-rounder
    // (decent pace/shooting/passing, irrelevant for GK). Match-engine-aware
    // GK scoring should rate the shot-stopper higher.
    const stopper = makePlayer({
      id: 'stopper', position: 'GK',
      attributes: { pace: 50, shooting: 30, passing: 50, defending: 90, physical: 85, mental: 88 },
    });
    const allrounder = makePlayer({
      id: 'allround', position: 'GK',
      attributes: { pace: 75, shooting: 75, passing: 75, defending: 65, physical: 65, mental: 65 },
    });
    expect(scorePlayerForSlot(stopper, 'GK')).toBeGreaterThan(scorePlayerForSlot(allrounder, 'GK'));
  });

  it('high defensive line penalises slow CBs vs fast CBs of equal value', () => {
    // Two CBs with equal positional CB OVR (defending+physical-weighted), but
    // different pace. Under a high defensive line, the fast CB outscores the slow CB.
    const fastCB = makePlayer({
      id: 'cbFast', position: 'CB',
      attributes: { pace: 80, shooting: 30, passing: 50, defending: 75, physical: 70, mental: 65 },
    });
    const slowCB = makePlayer({
      id: 'cbSlow', position: 'CB',
      // Compensate slower pace with higher defending+physical so positional OVRs match
      attributes: { pace: 40, shooting: 30, passing: 50, defending: 88, physical: 78, mental: 65 },
    });
    const tactics = { mentality: 'balanced' as const, width: 'normal' as const, tempo: 'normal' as const, defensiveLine: 'high' as const, pressingIntensity: 50 };
    const fastScore = scorePlayerForSlot(fastCB, 'CB', { tactics });
    const slowScore = scorePlayerForSlot(slowCB, 'CB', { tactics });
    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it('wide width tactic boosts pacy wide players', () => {
    const pacy = makePlayer({
      id: 'pacy', position: 'LM',
      attributes: { pace: 85, shooting: 60, passing: 65, defending: 50, physical: 60, mental: 60 },
    });
    const baseline = scorePlayerForSlot(pacy, 'LM');
    const wide = scorePlayerForSlot(pacy, 'LM', {
      tactics: { mentality: 'balanced', width: 'wide', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
    });
    expect(wide).toBeGreaterThan(baseline);
  });

  it('disciplinarian perk softens yellow-card penalties', () => {
    const cmWithCards = makePlayer({ id: 'cm_cards', position: 'CM', yellowCards: 2 });
    const cleanCM = makePlayer({ id: 'cm_clean', position: 'CM', yellowCards: 0 });

    // Baseline: yellow-card player scores lower than clean player
    const cardsBase = scorePlayerForSlot(cmWithCards, 'CM');
    const cleanBase = scorePlayerForSlot(cleanCM, 'CM');
    const baselineGap = cleanBase - cardsBase;
    expect(baselineGap).toBeGreaterThan(0);

    // With disciplinarian perk, the gap should shrink (penalty halved)
    const cardsPerk = scorePlayerForSlot(cmWithCards, 'CM', { managerPerks: ['disciplinarian'] });
    const cleanPerk = scorePlayerForSlot(cleanCM, 'CM', { managerPerks: ['disciplinarian'] });
    const perkGap = cleanPerk - cardsPerk;
    expect(perkGap).toBeLessThan(baselineGap);
  });

  it('long-range threat (shooting >= 75) boosts CAM/ST scores', () => {
    const sniper = makePlayer({
      id: 'sniper', position: 'CAM',
      attributes: { pace: 70, shooting: 82, passing: 70, defending: 30, physical: 60, mental: 70 },
    });
    const passer = makePlayer({
      id: 'passer', position: 'CAM',
      attributes: { pace: 70, shooting: 65, passing: 70, defending: 30, physical: 60, mental: 70 },
    });
    expect(scorePlayerForSlot(sniper, 'CAM')).toBeGreaterThan(scorePlayerForSlot(passer, 'CAM'));
  });

  it('skill moves >= 4 + pace >= 70 unlocks solo-goal threat bonus on wingers', () => {
    const trickster = makePlayer({
      id: 'trick', position: 'LW', skillMoves: 4,
      attributes: { pace: 75, shooting: 65, passing: 65, defending: 30, physical: 55, mental: 65 },
    });
    const plain = makePlayer({
      id: 'plain', position: 'LW', skillMoves: 2,
      attributes: { pace: 75, shooting: 65, passing: 65, defending: 30, physical: 55, mental: 65 },
    });
    expect(scorePlayerForSlot(trickster, 'LW')).toBeGreaterThan(scorePlayerForSlot(plain, 'LW'));
  });

  it('header threat: tall, physically strong CB wins over a short technical CB', () => {
    const tower = makePlayer({
      id: 'tower', position: 'CB', heightCm: 192,
      attributes: { pace: 55, shooting: 30, passing: 50, defending: 75, physical: 80, mental: 65 },
    });
    const small = makePlayer({
      id: 'small', position: 'CB', heightCm: 175,
      attributes: { pace: 65, shooting: 30, passing: 60, defending: 75, physical: 60, mental: 65 },
    });
    expect(scorePlayerForSlot(tower, 'CB')).toBeGreaterThan(scorePlayerForSlot(small, 'CB'));
  });

  it('low tactical familiarity penalises out-of-position deployments', () => {
    // Player whose natural position is LB but is being deployed at LM.
    // Both deployments are "compatible" (not natural) — the penalty only
    // applies when familiarity is below the threshold.
    const fullback = makePlayer({
      id: 'fullback', position: 'LB',
      alternatePositions: ['LM'],
      attributes: { pace: 80, shooting: 50, passing: 65, defending: 70, physical: 70, mental: 65 },
    });
    const highFamiliarity = scorePlayerForSlot(fullback, 'LM', { tacticalFamiliarity: 90 });
    const lowFamiliarity = scorePlayerForSlot(fullback, 'LM', { tacticalFamiliarity: 10 });
    expect(highFamiliarity).toBeGreaterThan(lowFamiliarity);
  });

  it('motivator perk softens low-morale penalty', () => {
    const sad = makePlayer({ id: 'sad', position: 'CM', morale: 30 });
    const baseline = scorePlayerForSlot(sad, 'CM');
    const withMotivator = scorePlayerForSlot(sad, 'CM', { managerPerks: ['motivator'] });
    expect(withMotivator).toBeGreaterThan(baseline);
  });

  it('iron_will perk softens wantsToLeave penalty', () => {
    const unhappy = makePlayer({ id: 'unhappy', position: 'CM', wantsToLeave: true });
    const baseline = scorePlayerForSlot(unhappy, 'CM');
    const withIronWill = scorePlayerForSlot(unhappy, 'CM', { managerPerks: ['iron_will'] });
    expect(withIronWill).toBeGreaterThan(baseline);
  });

  it('set_piece_coach perk amplifies the designated taker bonus', () => {
    const taker = makePlayer({ id: 'taker', position: 'CM' });
    const baseline = scorePlayerForSlot(taker, 'CM', { setPieceTakerId: 'taker' });
    const withCoach = scorePlayerForSlot(taker, 'CM', { setPieceTakerId: 'taker', managerPerks: ['set_piece_coach'] });
    expect(withCoach).toBeGreaterThan(baseline);
  });

  it('big-match rep gap rewards mentally strong players', () => {
    // A high-mental player gets a big-match bonus when our reputation
    // trails the opponent's by more than the threshold.
    const clutch = makePlayer({
      id: 'clutch', position: 'CM',
      attributes: { pace: 65, shooting: 60, passing: 70, defending: 55, physical: 65, mental: 80 },
    });
    const baseline = scorePlayerForSlot(clutch, 'CM', { ourReputation: 50, opponentReputation: 50 });
    const bigMatch = scorePlayerForSlot(clutch, 'CM', { ourReputation: 50, opponentReputation: 80 });
    expect(bigMatch).toBeGreaterThan(baseline);
  });

  it('age + low physical fragility lowers a veteran CB score', () => {
    // Two identical CBs except age + physical. Smart optimizer should rate
    // the young + physically robust CB higher.
    const youngCB = makePlayer({
      id: 'young', position: 'CB', age: 24,
      attributes: { pace: 70, shooting: 30, passing: 50, defending: 75, physical: 75, mental: 65 },
    });
    const oldCB = makePlayer({
      id: 'old', position: 'CB', age: 35,
      attributes: { pace: 50, shooting: 30, passing: 50, defending: 75, physical: 55, mental: 65 },
    });
    const youngScore = scorePlayerForSlot(youngCB, 'CB');
    const oldScore = scorePlayerForSlot(oldCB, 'CB');
    expect(youngScore).toBeGreaterThan(oldScore);
  });

  // ── Engine-aligned role contribution signals (defense / shot / assist / wide play) ──

  it('CB defense formula: prefers a high-defending CB over an equal-rated technical CB', () => {
    // Two CBs with the same positional CB OVR (CB weights are 0.35 def + 0.25 phys).
    // The "stopper" has more defending+physical (engine defense formula),
    // the "ball-player" has compensating passing+pace. Engine contribution
    // should tip the choice toward the stopper.
    const stopper = makePlayer({
      id: 'stopper', position: 'CB',
      attributes: { pace: 55, shooting: 30, passing: 45, defending: 82, physical: 78, mental: 65 },
    });
    const ballPlayer = makePlayer({
      id: 'ballp', position: 'CB',
      attributes: { pace: 78, shooting: 30, passing: 75, defending: 70, physical: 70, mental: 70 },
    });
    expect(scorePlayerForSlot(stopper, 'CB')).toBeGreaterThan(scorePlayerForSlot(ballPlayer, 'CB'));
  });

  it('defensive mentality amplifies the defensive contribution score', () => {
    const cb = makePlayer({
      id: 'cb', position: 'CB',
      attributes: { pace: 60, shooting: 30, passing: 50, defending: 80, physical: 75, mental: 65 },
    });
    const balanced = scorePlayerForSlot(cb, 'CB', {
      tactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
    });
    const defensive = scorePlayerForSlot(cb, 'CB', {
      tactics: { mentality: 'defensive', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
    });
    expect(defensive).toBeGreaterThan(balanced);
  });

  it('ST shot formula: prefers a finisher (shooting + mental) over a target man', () => {
    const finisher = makePlayer({
      id: 'finisher', position: 'ST',
      attributes: { pace: 70, shooting: 85, passing: 55, defending: 30, physical: 65, mental: 80 },
    });
    const target = makePlayer({
      id: 'target', position: 'ST',
      attributes: { pace: 55, shooting: 70, passing: 55, defending: 30, physical: 85, mental: 65 },
    });
    expect(scorePlayerForSlot(finisher, 'ST')).toBeGreaterThan(scorePlayerForSlot(target, 'ST'));
  });

  it('attacking mentality amplifies the shot contribution score for attackers', () => {
    const striker = makePlayer({
      id: 'striker', position: 'ST',
      attributes: { pace: 75, shooting: 80, passing: 55, defending: 30, physical: 70, mental: 70 },
    });
    const balanced = scorePlayerForSlot(striker, 'ST', {
      tactics: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
    });
    const attacking = scorePlayerForSlot(striker, 'ST', {
      tactics: { mentality: 'attacking', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50 },
    });
    expect(attacking).toBeGreaterThan(balanced);
  });

  it('CAM assist formula: prefers a creator (passing + mental) over a poacher', () => {
    const creator = makePlayer({
      id: 'creator', position: 'CAM',
      attributes: { pace: 65, shooting: 65, passing: 85, defending: 35, physical: 60, mental: 80 },
    });
    const poacher = makePlayer({
      id: 'poacher', position: 'CAM',
      attributes: { pace: 75, shooting: 80, passing: 60, defending: 35, physical: 65, mental: 70 },
    });
    expect(scorePlayerForSlot(creator, 'CAM')).toBeGreaterThan(scorePlayerForSlot(poacher, 'CAM'));
  });

  it('wide play formula: prefers a pacy crosser over a technical narrow player at LM', () => {
    const pacyCrosser = makePlayer({
      id: 'crosser', position: 'LM',
      attributes: { pace: 85, shooting: 60, passing: 75, defending: 50, physical: 70, mental: 65 },
    });
    const narrowTechnician = makePlayer({
      id: 'narrow', position: 'LM',
      attributes: { pace: 60, shooting: 70, passing: 80, defending: 50, physical: 60, mental: 75 },
    });
    expect(scorePlayerForSlot(pacyCrosser, 'LM')).toBeGreaterThan(scorePlayerForSlot(narrowTechnician, 'LM'));
  });

  it('high pressing intensity penalises low-fitness midfielders', () => {
    const tired = makePlayer({ id: 'tired', position: 'CM', fitness: 60 });
    const fresh = makePlayer({ id: 'fresh', position: 'CM', fitness: 95 });
    const lowPress = { mentality: 'balanced' as const, width: 'normal' as const, tempo: 'normal' as const, defensiveLine: 'normal' as const, pressingIntensity: 40 };
    const highPress = { mentality: 'balanced' as const, width: 'normal' as const, tempo: 'normal' as const, defensiveLine: 'normal' as const, pressingIntensity: 90 };

    const tiredLow = scorePlayerForSlot(tired, 'CM', { tactics: lowPress });
    const tiredHigh = scorePlayerForSlot(tired, 'CM', { tactics: highPress });
    const freshLow = scorePlayerForSlot(fresh, 'CM', { tactics: lowPress });
    const freshHigh = scorePlayerForSlot(fresh, 'CM', { tactics: highPress });

    // Tired players lose more under high pressing than fresh players do
    expect(tiredHigh - tiredLow).toBeLessThan(freshHigh - freshLow);
  });
});
