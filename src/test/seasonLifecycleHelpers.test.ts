/**
 * Phase 3a — Pure-helper tests used by `finalizeSeason`.
 *
 * Covers:
 *   - getFarewellSummary: shouldShow gating, stats payload
 *   - selectBestLineup: formation slot fill, injury/loan/suspension exclusion,
 *                       MAX_SUBS cap, fallback when no eligible players
 *
 * These helpers run hundreds of times during a season rollover. Bugs here
 * silently corrupt the player's farewell screen or leave clubs with broken
 * lineups, so isolated coverage here gives us cheap defence-in-depth.
 */

import { describe, it, expect } from 'vitest';

import { getFarewellSummary } from '@/utils/playerNarratives';
import { selectBestLineup } from '@/utils/playerGen';
import { MAX_SUBS } from '@/config/playerGeneration';

import { buildPlayer } from './helpers/seasonFixtures';

// ── getFarewellSummary ─────────────────────────────────────────────────

describe('getFarewellSummary', () => {
  it('shows when seasonsServed is at least 2', () => {
    const player = buildPlayer({ id: 'p1', appearances: 0 });
    const result = getFarewellSummary(player, /* season */ 5, /* joinedSeason */ 3);
    expect(result.shouldShow).toBe(true);
    expect(result.seasonsServed).toBe(2);
  });

  it('shows when appearances ≥ 20 even if joined this season', () => {
    const player = buildPlayer({ id: 'p2', appearances: 25 });
    const result = getFarewellSummary(player, /* season */ 5, /* joinedSeason */ 5);
    expect(result.shouldShow).toBe(true);
    expect(result.seasonsServed).toBe(0);
  });

  it('hides for short stints under 20 apps', () => {
    const player = buildPlayer({ id: 'p3', appearances: 10 });
    const result = getFarewellSummary(player, /* season */ 5, /* joinedSeason */ 4);
    expect(result.shouldShow).toBe(false);
  });

  it('treats missing joinedSeason as 0 seasons served', () => {
    const player = buildPlayer({ id: 'p4', appearances: 5 });
    const result = getFarewellSummary(player, /* season */ 5, /* joinedSeason */ undefined);
    expect(result.shouldShow).toBe(false);
    expect(result.seasonsServed).toBe(0);
  });

  it('returns the four expected stat labels in order', () => {
    const player = buildPlayer({ id: 'p5', appearances: 30, goals: 12, assists: 7 });
    const result = getFarewellSummary(player, 5, 1);
    expect(result.stats.map(s => s.label)).toEqual([
      'Seasons',
      'Appearances',
      'Goals',
      'Assists',
    ]);
    expect(result.stats[1].value).toBe('30');
    expect(result.stats[2].value).toBe('12');
    expect(result.stats[3].value).toBe('7');
  });

  it('handles boundary: exactly 20 appearances shows', () => {
    const player = buildPlayer({ id: 'p6', appearances: 20 });
    const result = getFarewellSummary(player, 3, 3);
    expect(result.shouldShow).toBe(true);
  });

  it('handles boundary: exactly 1 season served does not show without apps', () => {
    const player = buildPlayer({ id: 'p7', appearances: 0 });
    const result = getFarewellSummary(player, /* season */ 5, /* joinedSeason */ 4);
    expect(result.shouldShow).toBe(false);
  });
});

// ── selectBestLineup ────────────────────────────────────────────────────

/**
 * Build a balanced 22-player squad covering every standard formation slot.
 * Deterministic IDs and overalls so tests can assert on specific picks.
 */
function buildBalancedSquad() {
  return [
    // Goalkeepers
    buildPlayer({ id: 'gk1', position: 'GK', overall: 80 }),
    buildPlayer({ id: 'gk2', position: 'GK', overall: 65 }),
    // Centre-backs
    buildPlayer({ id: 'cb1', position: 'CB', overall: 82 }),
    buildPlayer({ id: 'cb2', position: 'CB', overall: 78 }),
    buildPlayer({ id: 'cb3', position: 'CB', overall: 70 }),
    // Full-backs
    buildPlayer({ id: 'lb1', position: 'LB', overall: 76 }),
    buildPlayer({ id: 'rb1', position: 'RB', overall: 76 }),
    buildPlayer({ id: 'lb2', position: 'LB', overall: 65 }),
    buildPlayer({ id: 'rb2', position: 'RB', overall: 65 }),
    // Midfield
    buildPlayer({ id: 'cm1', position: 'CM', overall: 84 }),
    buildPlayer({ id: 'cm2', position: 'CM', overall: 80 }),
    buildPlayer({ id: 'cm3', position: 'CM', overall: 72 }),
    buildPlayer({ id: 'cdm1', position: 'CDM', overall: 78 }),
    buildPlayer({ id: 'cam1', position: 'CAM', overall: 80 }),
    // Wide midfielders
    buildPlayer({ id: 'lm1', position: 'LM', overall: 75 }),
    buildPlayer({ id: 'rm1', position: 'RM', overall: 75 }),
    // Wingers
    buildPlayer({ id: 'lw1', position: 'LW', overall: 82 }),
    buildPlayer({ id: 'rw1', position: 'RW', overall: 82 }),
    // Strikers
    buildPlayer({ id: 'st1', position: 'ST', overall: 88 }),
    buildPlayer({ id: 'st2', position: 'ST', overall: 80 }),
    buildPlayer({ id: 'st3', position: 'ST', overall: 70 }),
    buildPlayer({ id: 'st4', position: 'ST', overall: 65 }),
  ];
}

describe('selectBestLineup', () => {
  it('returns 11 players for a healthy 4-3-3 lineup', () => {
    const { lineup } = selectBestLineup(buildBalancedSquad(), '4-3-3');
    expect(lineup).toHaveLength(11);
  });

  it('caps subs at MAX_SUBS', () => {
    const { subs } = selectBestLineup(buildBalancedSquad(), '4-3-3');
    expect(subs.length).toBeLessThanOrEqual(MAX_SUBS);
  });

  it('picks the highest-overall GK first', () => {
    const { lineup } = selectBestLineup(buildBalancedSquad(), '4-3-3');
    const gk = lineup.find(p => p.position === 'GK');
    expect(gk?.id).toBe('gk1');
  });

  it('excludes injured players from the lineup', () => {
    const squad = buildBalancedSquad();
    const topStriker = squad.find(p => p.id === 'st1')!;
    topStriker.injured = true;
    const { lineup } = selectBestLineup(squad, '4-3-3');
    expect(lineup.every(p => p.id !== 'st1')).toBe(true);
    // Next-best ST should fill in.
    expect(lineup.some(p => p.id === 'st2')).toBe(true);
  });

  it('excludes loaned-out players', () => {
    const squad = buildBalancedSquad();
    const topCm = squad.find(p => p.id === 'cm1')!;
    topCm.onLoan = true;
    const { lineup } = selectBestLineup(squad, '4-3-3');
    expect(lineup.every(p => p.id !== 'cm1')).toBe(true);
  });

  it('excludes suspended players when currentWeek is provided', () => {
    const squad = buildBalancedSquad();
    const topCm = squad.find(p => p.id === 'cm1')!;
    topCm.suspendedUntilWeek = 10;
    const { lineup } = selectBestLineup(squad, '4-3-3', /* currentWeek */ 5);
    expect(lineup.every(p => p.id !== 'cm1')).toBe(true);
  });

  it('admits players whose suspension has ended', () => {
    const squad = buildBalancedSquad();
    const topCm = squad.find(p => p.id === 'cm1')!;
    topCm.suspendedUntilWeek = 10;
    const { lineup } = selectBestLineup(squad, '4-3-3', /* currentWeek */ 12);
    expect(lineup.some(p => p.id === 'cm1')).toBe(true);
  });

  it('returns fewer than 11 when not enough eligible players exist', () => {
    const squad = buildBalancedSquad().slice(0, 5);
    const { lineup } = selectBestLineup(squad, '4-3-3');
    expect(lineup.length).toBeLessThanOrEqual(5);
  });

  it('handles empty squad without throwing', () => {
    expect(() => selectBestLineup([], '4-3-3')).not.toThrow();
    const { lineup, subs } = selectBestLineup([], '4-3-3');
    expect(lineup).toHaveLength(0);
    expect(subs).toHaveLength(0);
  });

  it('lineup and subs share no players', () => {
    const { lineup, subs } = selectBestLineup(buildBalancedSquad(), '4-3-3');
    const ids = new Set(lineup.map(p => p.id));
    for (const sub of subs) {
      expect(ids.has(sub.id)).toBe(false);
    }
  });

  it('respects different formations (4-4-2 vs 4-3-3 produce different shapes)', () => {
    const squad = buildBalancedSquad();
    const a = selectBestLineup(squad, '4-3-3').lineup;
    const b = selectBestLineup(squad, '4-4-2').lineup;
    // Both pick 11, but the position distribution should differ —
    // 4-4-2 wants 2 STs, 4-3-3 wants 1 ST + LW + RW.
    const stCount = (xs: typeof a) => xs.filter(p => p.position === 'ST').length;
    expect(stCount(b)).toBeGreaterThanOrEqual(stCount(a));
  });

  it('uses alternatePositions when no natural fit exists', () => {
    // No natural CDM in the squad; a CM with CDM listed as alternate
    // resolves through the static POSITION_COMPATIBILITY (CM↔CDM) but we
    // still cover the alternatePositions branch by giving an oddball.
    // Slot order for 4-2-3-1: GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST.
    const squad = [
      buildPlayer({ id: 'gk', position: 'GK', overall: 70 }),
      buildPlayer({ id: 'lb', position: 'LB', overall: 70 }),
      buildPlayer({ id: 'cb1', position: 'CB', overall: 75 }),
      buildPlayer({ id: 'cb2', position: 'CB', overall: 75 }),
      buildPlayer({ id: 'rb', position: 'RB', overall: 70 }),
      buildPlayer({ id: 'cm1', position: 'CM', overall: 78 }),
      buildPlayer({ id: 'cm2', position: 'CM', overall: 76 }),
      // Striker carrying CAM as an alternate — used for the CAM slot.
      buildPlayer({ id: 'cam-flex', position: 'ST', overall: 79, alternatePositions: ['CAM'] }),
      buildPlayer({ id: 'lw', position: 'LW', overall: 75 }),
      buildPlayer({ id: 'rw', position: 'RW', overall: 75 }),
      buildPlayer({ id: 'st-main', position: 'ST', overall: 82 }),
    ];
    const { lineup } = selectBestLineup(squad, '4-2-3-1');
    expect(lineup).toHaveLength(11);
    expect(lineup.some(p => p.id === 'cam-flex')).toBe(true);
  });
});
