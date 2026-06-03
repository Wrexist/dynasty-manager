/**
 * Phase 4a — Season Awards (Golden Boot, Golden Glove, Playmaker,
 * Young POTY, Manager POTY, Team of the Season).
 *
 * Pure-function tests for `calculateSeasonAwards`. Awards drive the
 * Season Summary screen, manager honours, hall-of-managers entries,
 * and Ballon d'Or value boosts — bugs here are highly visible.
 */

import { describe, it, expect } from 'vitest';

import { calculateSeasonAwards } from '@/utils/seasonAwards';
import type { Club, LeagueTableEntry, Player } from '@/types/game';

import { buildClub, buildPlayer, buildOrderedTable } from './helpers/seasonFixtures';

// ── Helpers ────────────────────────────────────────────────────────────

function clubsMap(clubs: Club[]): Record<string, Club> {
  return Object.fromEntries(clubs.map(c => [c.id, c]));
}

/** Build a 4-club synthetic league with a stat-rich set of players. */
function buildAwardsScenario() {
  const clubs = clubsMap([
    buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng', reputation: 5 }),
    buildClub({ id: 'mid', shortName: 'MID', divisionId: 'eng', reputation: 3 }),
    buildClub({ id: 'low', shortName: 'LOW', divisionId: 'eng', reputation: 2 }),
    buildClub({ id: 'bot', shortName: 'BOT', divisionId: 'eng', reputation: 1 }),
  ]);

  // Build a finished league table where TOP is 1st, MID 2nd, LOW 3rd, BOT 4th.
  const table: LeagueTableEntry[] = buildOrderedTable(['top', 'mid', 'low', 'bot']);
  // Override the cleanSheets / goalsAgainst per row for Golden Glove specifics.
  table[0] = { ...table[0], goalsAgainst: 18 }; // top — best defence
  table[1] = { ...table[1], goalsAgainst: 25 };
  table[2] = { ...table[2], goalsAgainst: 40 };
  table[3] = { ...table[3], goalsAgainst: 70 };

  const players: Player[] = [
    // GK — three keepers across three different defences
    buildPlayer({ id: 'gk-top', clubId: 'top', position: 'GK', overall: 84, firstName: 'Alex', lastName: 'Keeper' }),
    buildPlayer({ id: 'gk-mid', clubId: 'mid', position: 'GK', overall: 78 }),
    buildPlayer({ id: 'gk-bot', clubId: 'bot', position: 'GK', overall: 70 }),
    // Striker — top scorer
    buildPlayer({ id: 'st-king', clubId: 'top', position: 'ST', overall: 88, goals: 30, assists: 4, age: 27, firstName: 'Striker', lastName: 'King' }),
    buildPlayer({ id: 'st-mid', clubId: 'mid', position: 'ST', overall: 80, goals: 18, assists: 5, age: 24 }),
    buildPlayer({ id: 'st-bot', clubId: 'bot', position: 'ST', overall: 70, goals: 5, assists: 2, age: 26 }),
    // Playmaker — top assister
    buildPlayer({ id: 'cm-maestro', clubId: 'mid', position: 'CAM', overall: 86, goals: 8, assists: 22, age: 28, firstName: 'Mae', lastName: 'Stro' }),
    buildPlayer({ id: 'cm-other', clubId: 'top', position: 'CM', overall: 82, goals: 4, assists: 9, age: 25 }),
    // Young Player of the Season candidate
    buildPlayer({ id: 'wonderkid', clubId: 'low', position: 'CAM', overall: 83, goals: 12, assists: 6, age: 19, appearances: 34, firstName: 'Wonder', lastName: 'Kid' }),
    buildPlayer({ id: 'youth-fade', clubId: 'bot', position: 'CB', overall: 65, goals: 0, assists: 0, age: 22 }),
    // Defenders for Team of Season
    buildPlayer({ id: 'cb-rock', clubId: 'top', position: 'CB', overall: 85, goals: 2, assists: 1, age: 28 }),
    buildPlayer({ id: 'cb-2', clubId: 'top', position: 'CB', overall: 80, goals: 1, assists: 0, age: 26 }),
    buildPlayer({ id: 'lb-1', clubId: 'top', position: 'LB', overall: 78, goals: 1, assists: 5, age: 25 }),
    buildPlayer({ id: 'rb-1', clubId: 'mid', position: 'RB', overall: 77, goals: 0, assists: 4, age: 26 }),
    // Midfielders for Team of Season
    buildPlayer({ id: 'mid-1', clubId: 'top', position: 'CDM', overall: 81, goals: 1, assists: 3, age: 27 }),
    buildPlayer({ id: 'mid-2', clubId: 'top', position: 'LM', overall: 79, goals: 4, assists: 7, age: 25 }),
    // Attackers
    buildPlayer({ id: 'att-1', clubId: 'top', position: 'LW', overall: 84, goals: 14, assists: 10, age: 26 }),
    buildPlayer({ id: 'att-2', clubId: 'mid', position: 'RW', overall: 80, goals: 11, assists: 8, age: 24 }),
  ];

  return { clubs, table, players };
}

// ── Golden Boot ────────────────────────────────────────────────────────

describe('calculateSeasonAwards — Golden Boot', () => {
  it('awards the top scorer', () => {
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const gb = awards.find(a => a.name === 'Golden Boot');
    expect(gb).toBeDefined();
    expect(gb!.recipientName).toBe('Striker King');
    expect(gb!.stat).toBe(30);
    expect(gb!.recipientClub).toBe('TOP');
  });

  it('skips Golden Boot when no one scored', () => {
    const players = [
      buildPlayer({ id: 'p1', clubId: 'top', position: 'GK', goals: 0 }),
      buildPlayer({ id: 'p2', clubId: 'mid', position: 'CB', goals: 0 }),
    ];
    const clubs = clubsMap([
      buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' }),
      buildClub({ id: 'mid', shortName: 'MID', divisionId: 'eng' }),
    ]);
    const table = buildOrderedTable(['top', 'mid']);
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    expect(awards.find(a => a.name === 'Golden Boot')).toBeUndefined();
  });
});

// ── Golden Glove ──────────────────────────────────────────────────────

describe('calculateSeasonAwards — Golden Glove', () => {
  it('awards GK whose club conceded fewest goals', () => {
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const gg = awards.find(a => a.name === 'Golden Glove');
    expect(gg).toBeDefined();
    expect(gg!.recipientName).toBe('Alex Keeper');
    expect(gg!.recipientClub).toBe('TOP');
    expect(gg!.stat).toBe(18); // goalsAgainst for top
  });

  it('handles no GKs in the league', () => {
    const players = [buildPlayer({ id: 'st1', clubId: 'top', position: 'ST', goals: 5 })];
    const clubs = clubsMap([buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' })]);
    const table = buildOrderedTable(['top']);
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    expect(awards.find(a => a.name === 'Golden Glove')).toBeUndefined();
  });
});

// ── Playmaker ─────────────────────────────────────────────────────────

describe('calculateSeasonAwards — Playmaker', () => {
  it('awards top assister', () => {
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const pm = awards.find(a => a.name === 'Playmaker of the Season');
    expect(pm).toBeDefined();
    expect(pm!.recipientName).toBe('Mae Stro');
    expect(pm!.stat).toBe(22);
  });

  it('skips Playmaker when no one assisted', () => {
    const players = [buildPlayer({ id: 'st1', clubId: 'top', position: 'ST', goals: 10, assists: 0 })];
    const clubs = clubsMap([buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' })]);
    const table = buildOrderedTable(['top']);
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    expect(awards.find(a => a.name === 'Playmaker of the Season')).toBeUndefined();
  });
});

// ── Young Player of the Season ────────────────────────────────────────

describe('calculateSeasonAwards — Young Player', () => {
  it('awards U23 highest-overall player', () => {
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const yp = awards.find(a => a.name === 'Young Player of the Season');
    expect(yp).toBeDefined();
    expect(yp!.recipientName).toBe('Wonder Kid');
    expect(yp!.stat).toBe(83);
  });

  it('boundary: age 23 is eligible', () => {
    const players = [
      buildPlayer({ id: '23-yo', clubId: 'top', position: 'ST', overall: 80, age: 23, appearances: 30 }),
      buildPlayer({ id: '24-yo', clubId: 'top', position: 'ST', overall: 90, age: 24, appearances: 30 }),
    ];
    const clubs = clubsMap([buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' })]);
    const table = buildOrderedTable(['top']);
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const yp = awards.find(a => a.name === 'Young Player of the Season');
    expect(yp!.stat).toBe(80); // 23-year-old wins because 24-year-old is excluded
  });
});

// ── Manager of the Season ─────────────────────────────────────────────

describe('calculateSeasonAwards — Manager of the Season', () => {
  it('rewards the most overperforming club (low rep, high finish)', () => {
    // Expectation thresholds: rep ≥5 → 3, ≥4 → 8, ≥3 → 12, else → 17.
    // TOP: rep 5 → exp 3, finishes 1st → overperf 2.
    // MID: rep 3 → exp 12, finishes 2nd → overperf 10.
    // LOW: rep 2 → exp 17, finishes 3rd → overperf 14.  ← winner
    // BOT: rep 1 → exp 17, finishes 4th → overperf 13.
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const mgr = awards.find(a => a.name === 'Manager of the Season');
    expect(mgr).toBeDefined();
    expect(mgr!.recipientClub).toBe('LOW');
  });

  it('uses "You" when the player\'s club wins Manager of the Season', () => {
    // LOW is the overperformance winner — viewing from LOW's manager seat
    // should render as 'You'.
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'low');
    const mgr = awards.find(a => a.name === 'Manager of the Season');
    expect(mgr!.recipientName).toBe('You');
  });
});

// ── Team of the Season ────────────────────────────────────────────────

describe('calculateSeasonAwards — Team of the Season', () => {
  it('selects exactly 11 players across positional groups (1 GK, 4 DEF, 3 MID, 3 ATT)', () => {
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const tots = awards.filter(a => a.name === 'Team of the Season');
    expect(tots).toHaveLength(11);
  });

  it('top scorer makes Team of the Season', () => {
    const { clubs, table, players } = buildAwardsScenario();
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const tots = awards.filter(a => a.name === 'Team of the Season');
    expect(tots.some(a => a.recipientName === 'Striker King')).toBe(true);
  });

  it('falls back to fewer when not enough players for a group', () => {
    // Only 1 attacker available — Team of Season for that group should be size 1.
    const players = [
      buildPlayer({ id: 'gk', clubId: 'top', position: 'GK', overall: 80 }),
      buildPlayer({ id: 'cb', clubId: 'top', position: 'CB', overall: 80 }),
      buildPlayer({ id: 'cm', clubId: 'top', position: 'CM', overall: 80 }),
      buildPlayer({ id: 'st', clubId: 'top', position: 'ST', overall: 80 }),
    ];
    const clubs = clubsMap([buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' })]);
    const table = buildOrderedTable(['top']);
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const tots = awards.filter(a => a.name === 'Team of the Season');
    // 1 GK + 1 CB + 1 CM + 1 ST = 4 awards (capped to available)
    expect(tots).toHaveLength(4);
  });
});

// ── Defensive cases ──────────────────────────────────────────────────

describe('calculateSeasonAwards — defensive cases', () => {
  it('handles empty player list', () => {
    const clubs = clubsMap([buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' })]);
    const table = buildOrderedTable(['top']);
    const awards = calculateSeasonAwards([], clubs, table, 'top');
    // Manager of the Season still fires (it's based on table+clubs, not players),
    // but the player-facing awards drop out.
    expect(awards.find(a => a.name === 'Golden Boot')).toBeUndefined();
    expect(awards.find(a => a.name === 'Golden Glove')).toBeUndefined();
    expect(awards.find(a => a.name === 'Team of the Season')).toBeUndefined();
  });

  it('handles empty league table gracefully', () => {
    expect(() => calculateSeasonAwards([], {}, [], 'no-such')).not.toThrow();
  });

  it('handles missing club references in clubs record', () => {
    // Player references a club that does not exist in `clubs` — recipientClub
    // falls back to the empty string and the function does not throw.
    const players = [buildPlayer({ id: 'p1', clubId: 'ghost', position: 'ST', goals: 10 })];
    const table = buildOrderedTable(['ghost']);
    const awards = calculateSeasonAwards(players, {}, table, 'ghost');
    const gb = awards.find(a => a.name === 'Golden Boot');
    expect(gb).toBeDefined();
    expect(gb!.recipientClub).toBe('');
  });
});

// ── Regression: division scoping (audit fix) ──────────────────────────

describe('calculateSeasonAwards — division scoping (audit fix)', () => {
  it('ignores players from other divisions not in the league table', () => {
    const clubs = clubsMap([
      buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' }),
      buildClub({ id: 'lower', shortName: 'LOW', divisionId: 'eng2' }),
    ]);
    // League table contains only the player's own division (TOP).
    const table = buildOrderedTable(['top']);
    const players = [
      buildPlayer({ id: 'div-striker', clubId: 'top', position: 'ST', goals: 20, appearances: 30, firstName: 'Div', lastName: 'Striker' }),
      // A more prolific scorer in a *different* division — must NOT win this division's Golden Boot.
      buildPlayer({ id: 'lower-striker', clubId: 'lower', position: 'ST', goals: 40, appearances: 30, firstName: 'Lower', lastName: 'Striker' }),
    ];
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const gb = awards.find(a => a.name === 'Golden Boot');
    expect(gb!.recipientName).toBe('Div Striker');
    expect(gb!.stat).toBe(20);
  });
});

// ── Regression: Young Player requires appearances (audit fix) ─────────

describe('calculateSeasonAwards — Young Player requires appearances (audit fix)', () => {
  it('does not award a 0-appearance youth-academy prospect', () => {
    const clubs = clubsMap([buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' })]);
    const table = buildOrderedTable(['top']);
    const players = [
      // High-ceiling prospect who never played a minute this season.
      buildPlayer({ id: 'bench-gem', clubId: 'top', position: 'ST', overall: 85, age: 18, appearances: 0 }),
      // A 21-year-old who actually featured.
      buildPlayer({ id: 'regular', clubId: 'top', position: 'CM', overall: 78, age: 21, appearances: 25, firstName: 'Reg', lastName: 'Ular' }),
    ];
    const awards = calculateSeasonAwards(players, clubs, table, 'top');
    const yp = awards.find(a => a.name === 'Young Player of the Season');
    expect(yp).toBeDefined();
    expect(yp!.recipientName).toBe('Reg Ular');
  });
});
