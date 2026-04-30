/**
 * Phase 4b — Ballon d'Or season ranking.
 *
 * Pure-function tests for `calculateBallonDOr` and `getBallonDOrValueBoost`.
 * Ballon d'Or drives:
 *   - End-of-season top-25 ranking shown to the player
 *   - Permanent placement records on each player
 *   - +N% market value boosts for top placements
 * Bugs here corrupt save data permanently (placements stick), so coverage
 * here is high-leverage.
 */

import { describe, it, expect } from 'vitest';

import { calculateBallonDOr, getBallonDOrValueBoost } from '@/utils/ballonDor';
import {
  BALLON_DOR_TOP_N,
  BALLON_DOR_VALUE_BOOST,
  BALLON_DOR_MAX_PER_DIVISION,
} from '@/config/gameBalance';
import type {
  Club,
  ContinentalTournamentState,
  CupState,
  InternationalTournamentState,
  LeagueCupState,
  LeagueTableEntry,
  Player,
} from '@/types/game';

import { buildClub, buildPlayer, buildOrderedTable } from './helpers/seasonFixtures';

// ── Helpers ────────────────────────────────────────────────────────────

function clubsMap(clubs: Club[]): Record<string, Club> {
  return Object.fromEntries(clubs.map(c => [c.id, c]));
}

/** Build a small fixed scenario with a top-flight club and 5 players. */
function smallScenario() {
  const clubs = clubsMap([
    buildClub({ id: 'cityA', shortName: 'CTA', divisionId: 'eng', reputation: 5 }),
  ]);
  const table: LeagueTableEntry[] = buildOrderedTable(['cityA']);
  const players: Player[] = [
    buildPlayer({ id: 'star', clubId: 'cityA', position: 'ST', overall: 92, goals: 35, assists: 12, appearances: 38, age: 27 }),
    buildPlayer({ id: 'mid', clubId: 'cityA', position: 'CAM', overall: 88, goals: 18, assists: 22, appearances: 36, age: 28 }),
    buildPlayer({ id: 'def', clubId: 'cityA', position: 'CB', overall: 86, goals: 4, assists: 1, appearances: 35, age: 29 }),
    buildPlayer({ id: 'gk', clubId: 'cityA', position: 'GK', overall: 87, goals: 0, assists: 1, appearances: 38, age: 30 }),
    // Excluded: too few appearances
    buildPlayer({ id: 'rare', clubId: 'cityA', position: 'CM', overall: 90, goals: 5, assists: 3, appearances: 3, age: 24 }),
  ];
  return { clubs, table, players };
}

// ── getBallonDOrValueBoost ────────────────────────────────────────────

describe('getBallonDOrValueBoost', () => {
  it('returns 0 for ranks beyond top-N', () => {
    expect(getBallonDOrValueBoost(BALLON_DOR_TOP_N + 1)).toBe(0);
    expect(getBallonDOrValueBoost(99)).toBe(0);
  });

  it('matches exact thresholds', () => {
    for (const [rankStr, boost] of Object.entries(BALLON_DOR_VALUE_BOOST)) {
      const rank = Number(rankStr);
      expect(getBallonDOrValueBoost(rank)).toBe(boost);
    }
  });

  it('interpolates between defined thresholds', () => {
    // Between rank 5 (0.12) and rank 10 (0.08): rank 7 should sit linearly
    // between them — t = (7 - 5) / (10 - 5) = 0.4 → 0.12 + 0.4 * (0.08 - 0.12)
    // = 0.12 - 0.016 = 0.104.
    expect(getBallonDOrValueBoost(7)).toBeCloseTo(0.104, 4);
  });

  it('returns winner boost for rank 1', () => {
    expect(getBallonDOrValueBoost(1)).toBe(BALLON_DOR_VALUE_BOOST[1]);
  });

  it('returns top-25 floor for rank 25', () => {
    expect(getBallonDOrValueBoost(25)).toBe(BALLON_DOR_VALUE_BOOST[25]);
  });

  it('extrapolates safely past the highest interior threshold', () => {
    // Rank 11..24 should fall on the line between rank 10 (0.08) and rank 25 (0.04).
    // Strictly decreasing, never below the rank-25 floor.
    for (let r = 11; r <= 24; r++) {
      const boost = getBallonDOrValueBoost(r);
      expect(boost).toBeLessThanOrEqual(BALLON_DOR_VALUE_BOOST[10]);
      expect(boost).toBeGreaterThanOrEqual(BALLON_DOR_VALUE_BOOST[25]);
    }
  });
});

// ── calculateBallonDOr — basic invariants ─────────────────────────────

describe('calculateBallonDOr — basic invariants', () => {
  it('returns at most BALLON_DOR_TOP_N entries', () => {
    const { clubs, table } = smallScenario();
    // Build 50 eligible players to flood the cap.
    const players: Player[] = Array.from({ length: 50 }, (_, i) => buildPlayer({
      id: `flood-${i}`,
      clubId: 'cityA',
      position: 'CM',
      overall: 80 + (i % 10),
      goals: 5 + (i % 8),
      assists: 5 + (i % 6),
      appearances: 30,
      age: 24 + (i % 8),
    }));
    const ranking = calculateBallonDOr(players, clubs, table, {});
    expect(ranking.length).toBeLessThanOrEqual(BALLON_DOR_TOP_N);
    expect(ranking.length).toBe(BALLON_DOR_TOP_N);
  });

  it('excludes players below BALLON_DOR_MIN_APPEARANCES', () => {
    const { clubs, table, players } = smallScenario();
    const ranking = calculateBallonDOr(players, clubs, table, {});
    expect(ranking.find(e => e.playerId === 'rare')).toBeUndefined();
  });

  it('excludes players with no club', () => {
    const { clubs, table, players } = smallScenario();
    players.push(buildPlayer({ id: 'fa', clubId: '', position: 'ST', overall: 95, goals: 30, assists: 10, appearances: 30 }));
    const ranking = calculateBallonDOr(players, clubs, table, {});
    expect(ranking.find(e => e.playerId === 'fa')).toBeUndefined();
  });

  it('assigns sequential ranks starting at 1', () => {
    const { clubs, table, players } = smallScenario();
    const ranking = calculateBallonDOr(players, clubs, table, {});
    for (let i = 0; i < ranking.length; i++) {
      expect(ranking[i].rank).toBe(i + 1);
    }
  });

  it('returns empty array when no players supplied', () => {
    const { clubs, table } = smallScenario();
    expect(calculateBallonDOr([], clubs, table, {})).toEqual([]);
  });

  it('returns empty array when no league/division tables exist', () => {
    const { players } = smallScenario();
    expect(calculateBallonDOr(players, {}, [], {})).toEqual([]);
  });

  it('still ranks when only divisionTables are given (no top-level leagueTable)', () => {
    const { clubs, players } = smallScenario();
    const divTables: Record<string, LeagueTableEntry[]> = {
      'eng': buildOrderedTable(['cityA']),
    };
    const ranking = calculateBallonDOr(players, clubs, [], divTables);
    expect(ranking.length).toBeGreaterThan(0);
  });
});

// ── calculateBallonDOr — score ordering ──────────────────────────────

describe('calculateBallonDOr — score ordering', () => {
  it('ranks higher-counting-stat players above lower-counting-stat ones at the same position', () => {
    const clubs = clubsMap([buildClub({ id: 'a', shortName: 'A', divisionId: 'eng', reputation: 5 })]);
    const table = buildOrderedTable(['a']);
    const players: Player[] = [
      buildPlayer({ id: 'big', clubId: 'a', position: 'ST', overall: 85, goals: 30, assists: 10, appearances: 36, age: 26 }),
      buildPlayer({ id: 'small', clubId: 'a', position: 'ST', overall: 85, goals: 10, assists: 3, appearances: 36, age: 26 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    expect(ranking[0].playerId).toBe('big');
    expect(ranking[1].playerId).toBe('small');
  });

  it('rewards playmakers (CAM assists) above pure goalscorers when assist totals dominate', () => {
    // Position multipliers — ST goals ×1.0, CAM assists ×2.5 — mean a CAM
    // with strong assists can outscore an ST with stronger raw goals when
    // the counting stats are close. This documents that intentional bias.
    const { clubs, table, players } = smallScenario();
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const star = ranking.find(e => e.playerId === 'star')!;
    const playmaker = ranking.find(e => e.playerId === 'mid')!;
    expect(playmaker.score).toBeGreaterThan(star.score);
  });

  it('tie-breaks by goals → assists → appearances → overall', () => {
    const clubs = clubsMap([buildClub({ id: 'tie', shortName: 'TIE', divisionId: 'eng', reputation: 3 })]);
    const table = buildOrderedTable(['tie']);
    // Two strikers identical in everything except goals.
    const players: Player[] = [
      buildPlayer({ id: 'a', clubId: 'tie', position: 'ST', overall: 80, goals: 10, assists: 5, appearances: 30, age: 25 }),
      buildPlayer({ id: 'b', clubId: 'tie', position: 'ST', overall: 80, goals: 12, assists: 5, appearances: 30, age: 25 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    expect(ranking[0].playerId).toBe('b');
    expect(ranking[1].playerId).toBe('a');
  });

  it('exposes meaningful avgRating field on each entry', () => {
    const { clubs, table, players } = smallScenario();
    // Give the star a strong rating signal.
    players[0].seasonRatingTotal = 8 * 38; // avg 8.0
    players[0].seasonRatedMatches = 38;
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const star = ranking.find(e => e.playerId === 'star');
    expect(star).toBeDefined();
    expect(star!.avgRating).toBeCloseTo(8.0, 1);
  });

  it('falls back to overall-derived avgRating for unrated players', () => {
    const clubs = clubsMap([buildClub({ id: 'tie', shortName: 'TIE', divisionId: 'eng' })]);
    const table = buildOrderedTable(['tie']);
    const players: Player[] = [
      buildPlayer({ id: 'unrated', clubId: 'tie', position: 'ST', overall: 80, goals: 5, assists: 5, appearances: 20 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    // Formula: 4.5 + (80 / 100) * 2.0 = 6.1, rounded to 1dp.
    expect(ranking[0].avgRating).toBeCloseTo(6.1, 1);
  });
});

// ── calculateBallonDOr — modifiers ───────────────────────────────────

describe('calculateBallonDOr — modifiers', () => {
  it('division tier bonus rewards top-flight players over lower-tier', () => {
    // Two identical strikers — one in tier-1, one in tier-4.
    const clubs = clubsMap([
      buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' }),    // qualityTier 1
      buildClub({ id: 'low', shortName: 'LOW', divisionId: 'eng-4' }),  // qualityTier 4
    ]);
    // Use one big aggregated league table containing both clubs.
    const table = buildOrderedTable(['top', 'low']);
    const players: Player[] = [
      buildPlayer({ id: 'p-top', clubId: 'top', position: 'ST', overall: 80, goals: 15, assists: 5, appearances: 30, age: 26 }),
      buildPlayer({ id: 'p-low', clubId: 'low', position: 'ST', overall: 80, goals: 15, assists: 5, appearances: 30, age: 26 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const top = ranking.find(e => e.playerId === 'p-top')!;
    const low = ranking.find(e => e.playerId === 'p-low')!;
    expect(top.score).toBeGreaterThan(low.score);
  });

  it('discipline penalty drops dirty players below clean ones with the same stats', () => {
    const clubs = clubsMap([buildClub({ id: 'tie', shortName: 'TIE', divisionId: 'eng' })]);
    const table = buildOrderedTable(['tie']);
    const players: Player[] = [
      buildPlayer({ id: 'clean', clubId: 'tie', position: 'CM', overall: 80, goals: 10, assists: 10, appearances: 30, yellowCards: 0, redCards: 0, age: 25 }),
      buildPlayer({ id: 'dirty', clubId: 'tie', position: 'CM', overall: 80, goals: 10, assists: 10, appearances: 30, yellowCards: 12, redCards: 2, age: 25 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const clean = ranking.find(e => e.playerId === 'clean')!;
    const dirty = ranking.find(e => e.playerId === 'dirty')!;
    expect(clean.score).toBeGreaterThan(dirty.score);
  });

  it('division counting scale — tier-1 striker outranks tier-4 striker with MORE goals', () => {
    // The whole point of the v68 tier-scaling rebalance: a 25-goal Premier
    // League striker should beat a 35-goal Foundation League striker. Pre-
    // rebalance, the T4 player would have won outright (goals × 3.0 ×
    // posMult had no division scaling).
    const clubs = clubsMap([
      buildClub({ id: 'top', shortName: 'TOP', divisionId: 'eng' }),    // qualityTier 1
      buildClub({ id: 'low', shortName: 'LOW', divisionId: 'eng-4' }),  // qualityTier 4
    ]);
    const table = buildOrderedTable(['top', 'low']);
    const players: Player[] = [
      buildPlayer({ id: 't1-elite', clubId: 'top', position: 'ST', overall: 88, goals: 25, assists: 8, appearances: 32, age: 27 }),
      buildPlayer({ id: 't4-scorer', clubId: 'low', position: 'ST', overall: 78, goals: 35, assists: 10, appearances: 32, age: 27 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const t1 = ranking.find(e => e.playerId === 't1-elite')!;
    const t4 = ranking.find(e => e.playerId === 't4-scorer')!;
    expect(t1.score).toBeGreaterThan(t4.score);
  });

  it('overall-rating weight — high-OVR player ranks above low-OVR with similar counting stats', () => {
    // Bumping `BALLON_DOR_WEIGHTS.overall` 1.5 → 2.0 means a 90-rated
    // striker with 20 goals beats a 75-rated striker with the same 20.
    const clubs = clubsMap([buildClub({ id: 'a', shortName: 'A', divisionId: 'eng' })]);
    const table = buildOrderedTable(['a']);
    const players: Player[] = [
      buildPlayer({ id: 'elite', clubId: 'a', position: 'ST', overall: 90, goals: 20, assists: 6, appearances: 30, age: 27 }),
      buildPlayer({ id: 'rotation', clubId: 'a', position: 'ST', overall: 75, goals: 20, assists: 6, appearances: 30, age: 27 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const elite = ranking.find(e => e.playerId === 'elite')!;
    const rotation = ranking.find(e => e.playerId === 'rotation')!;
    expect(elite.score).toBeGreaterThan(rotation.score);
    // Rotation player should still be ranked (eligible) — just behind.
    expect(rotation.rank).toBeGreaterThan(elite.rank);
  });

  it('continental bonus rewards Champions Cup winner over non-participant', () => {
    const clubs = clubsMap([
      buildClub({ id: 'eu', shortName: 'EU', divisionId: 'eng', reputation: 5 }),
      buildClub({ id: 'no-eu', shortName: 'NEU', divisionId: 'eng', reputation: 5 }),
    ]);
    const table = buildOrderedTable(['eu', 'no-eu']);
    const players: Player[] = [
      buildPlayer({ id: 'eu-star', clubId: 'eu', position: 'ST', overall: 85, goals: 20, assists: 8, appearances: 30, age: 26 }),
      buildPlayer({ id: 'neu-star', clubId: 'no-eu', position: 'ST', overall: 85, goals: 20, assists: 8, appearances: 30, age: 26 }),
    ];
    const championsCup: ContinentalTournamentState = {
      competition: 'champions_cup',
      season: 1,
      groups: [],
      knockoutTies: [],
      currentPhase: 'complete',
      currentRound: 'F',
      playerEliminated: false,
      playerGroupId: null,
      winnerId: 'eu',
    };
    const ranking = calculateBallonDOr(players, clubs, table, {}, championsCup);
    const winner = ranking.find(e => e.playerId === 'eu-star')!;
    const nonEu = ranking.find(e => e.playerId === 'neu-star')!;
    expect(winner.score).toBeGreaterThan(nonEu.score);
  });

  // ── Trophy bonuses ──────────────────────────────────────────────────

  it('league title — champions outrank otherwise-identical 2nd-placed players', () => {
    const clubs = clubsMap([
      buildClub({ id: 'champ', shortName: 'CMP', divisionId: 'eng', reputation: 5 }),
      buildClub({ id: 'second', shortName: 'SEC', divisionId: 'eng', reputation: 5 }),
    ]);
    const table = buildOrderedTable(['champ', 'second']);
    const players: Player[] = [
      buildPlayer({ id: 'champ-star', clubId: 'champ', position: 'ST', overall: 85, goals: 22, assists: 8, appearances: 30, age: 27 }),
      buildPlayer({ id: 'second-star', clubId: 'second', position: 'ST', overall: 85, goals: 22, assists: 8, appearances: 30, age: 27 }),
    ];
    const ranking = calculateBallonDOr(players, clubs, table, {});
    const champ = ranking.find(e => e.playerId === 'champ-star')!;
    const second = ranking.find(e => e.playerId === 'second-star')!;
    // sqrt position curve already favours the champion; the league-title
    // bonus widens the gap further. Assert a meaningful margin (≥10).
    expect(champ.score - second.score).toBeGreaterThanOrEqual(10);
  });

  it('domestic cup win adds a meaningful trophy bonus', () => {
    const clubs = clubsMap([
      buildClub({ id: 'cupwin', shortName: 'CUP', divisionId: 'eng', reputation: 5 }),
      buildClub({ id: 'cuploss', shortName: 'CL', divisionId: 'eng', reputation: 5 }),
    ]);
    const table = buildOrderedTable(['cupwin', 'cuploss']);
    const players: Player[] = [
      buildPlayer({ id: 'cup-hero', clubId: 'cupwin', position: 'CM', overall: 82, goals: 12, assists: 14, appearances: 30, age: 26 }),
      buildPlayer({ id: 'no-cup', clubId: 'cuploss', position: 'CM', overall: 82, goals: 12, assists: 14, appearances: 30, age: 26 }),
    ];
    const cup: CupState = { ties: [], currentRound: null, eliminated: false, winner: 'cupwin' };
    // Empty division-tables param + cup state passed through.
    const ranking = calculateBallonDOr(players, clubs, table, {}, undefined, undefined, undefined, cup);
    const hero = ranking.find(e => e.playerId === 'cup-hero')!;
    const noCup = ranking.find(e => e.playerId === 'no-cup')!;
    expect(hero.score).toBeGreaterThan(noCup.score);
  });

  it('league cup win adds a smaller trophy bonus than the main domestic cup', () => {
    // Put a neutral club at 1st so neither cup-winner picks up the
    // league-title bonus — we're isolating the FA-vs-League-cup gap.
    const clubs = clubsMap([
      buildClub({ id: 'champ', shortName: 'CHP', divisionId: 'eng', reputation: 5 }),
      buildClub({ id: 'lcwin', shortName: 'LCW', divisionId: 'eng', reputation: 5 }),
      buildClub({ id: 'fawin', shortName: 'FAW', divisionId: 'eng', reputation: 5 }),
    ]);
    // Pad the table so both winners share a non-1st position bracket; the
    // FA winner needs the higher table slot to isolate the cup-vs-cup gap.
    const table = buildOrderedTable(['champ', 'fawin', 'lcwin']);
    const players: Player[] = [
      buildPlayer({ id: 'lc', clubId: 'lcwin', position: 'CM', overall: 82, goals: 10, assists: 10, appearances: 30, age: 26 }),
      buildPlayer({ id: 'fa', clubId: 'fawin', position: 'CM', overall: 82, goals: 10, assists: 10, appearances: 30, age: 26 }),
    ];
    const cup: CupState = { ties: [], currentRound: null, eliminated: false, winner: 'fawin' };
    const leagueCup: LeagueCupState = { ties: [], currentRound: null, eliminated: false, winner: 'lcwin' };
    const ranking = calculateBallonDOr(
      players, clubs, table, {}, undefined, undefined, undefined, cup, leagueCup,
    );
    const fa = ranking.find(e => e.playerId === 'fa')!;
    const lc = ranking.find(e => e.playerId === 'lc')!;
    expect(fa.score).toBeGreaterThan(lc.score);
  });

  it('international tournament — World Cup winner gets the headline bonus', () => {
    const clubs = clubsMap([
      buildClub({ id: 'a', shortName: 'A', divisionId: 'eng', reputation: 5 }),
      buildClub({ id: 'b', shortName: 'B', divisionId: 'eng', reputation: 5 }),
    ]);
    const table = buildOrderedTable(['a', 'b']);
    const players: Player[] = [
      buildPlayer({ id: 'wc-winner', nationality: 'Brazil', clubId: 'a', position: 'ST', overall: 85, goals: 18, assists: 6, appearances: 30, age: 27 }),
      buildPlayer({ id: 'no-wc', nationality: 'England', clubId: 'b', position: 'ST', overall: 85, goals: 18, assists: 6, appearances: 30, age: 27 }),
    ];
    const intl: InternationalTournamentState = {
      type: 'world-cup',
      name: 'World Cup',
      season: 1,
      phase: 'complete',
      groups: [
        { name: 'A', teams: ['Brazil', 'England'], fixtures: [], table: [] },
      ],
      knockoutTies: [
        { id: 't1', round: 'F', homeNation: 'Brazil', awayNation: 'France', played: true, homeGoals: 1, awayGoals: 0, week: 50, winnerId: 'Brazil' },
        { id: 't2', round: 'R16', homeNation: 'England', awayNation: 'Spain', played: true, homeGoals: 0, awayGoals: 1, week: 47, winnerId: 'Spain' },
      ],
      currentRound: null,
      playerEliminated: false,
      winner: 'Brazil',
      currentWeek: 52,
      squadConfirmed: true,
    };
    const ranking = calculateBallonDOr(
      players, clubs, table, {}, undefined, undefined, undefined, undefined, undefined, intl,
    );
    const winner = ranking.find(e => e.playerId === 'wc-winner')!;
    const loser = ranking.find(e => e.playerId === 'no-wc')!;
    // Brazil wins → +60. England exits R16 → +5. That's a 55-point swing,
    // dwarfing other modifiers when counting stats are equal.
    expect(winner.score - loser.score).toBeGreaterThanOrEqual(40);
  });
});

describe('calculateBallonDOr — per-division soft cap', () => {
  // Helper: build N players for a single club, all otherwise-identical, so
  // their scores are deterministic and equal.
  function bulkPlayers(opts: { clubId: string; prefix: string; count: number; overall?: number; goals?: number; assists?: number; appearances?: number }) {
    const arr: Player[] = [];
    for (let i = 0; i < opts.count; i++) {
      arr.push(buildPlayer({
        id: `${opts.prefix}-${i}`,
        firstName: 'P', lastName: `${opts.prefix}${i}`,
        position: i % 2 === 0 ? 'ST' : 'CM',
        overall: opts.overall ?? 80,
        clubId: opts.clubId,
        goals: opts.goals ?? 15,
        assists: opts.assists ?? 5,
        appearances: opts.appearances ?? 30,
      }));
    }
    return arr;
  }

  it('backfills from a single division when no other division has candidates', () => {
    // Sanity: with 30 eligible candidates all in div-1 and no rival division,
    // the cap should NOT prevent the top 25 from filling. Soft = backfill.
    const club = buildClub({ id: 'solo-club', divisionId: 'div-1' });
    const players = bulkPlayers({ clubId: 'solo-club', prefix: 'solo', count: 30 });
    const table = buildOrderedTable(['solo-club']);

    const ranking = calculateBallonDOr(players, clubsMap([club]), table, {});
    expect(ranking.length).toBe(BALLON_DOR_TOP_N);
    // Every entry should belong to the only club that exists.
    for (const e of ranking) {
      expect(e.clubName).toBe(club.shortName);
    }
  });

  it('caps each division at BALLON_DOR_MAX_PER_DIVISION in the first pass when rivals exist', () => {
    // Two divisions, 15 elite candidates each (30 total > BALLON_DOR_TOP_N
    // so backfill engages). All otherwise-identical so sort order is
    // stable on tiebreakers. Both divisions should be represented at the
    // cap floor or above — the cap must never starve a division that has
    // eligible candidates while the dominant one produces 25 in a row.
    const div1Club = buildClub({ id: 'd1-club', divisionId: 'div-1' });
    const div2Club = buildClub({ id: 'd2-club', divisionId: 'div-2' });
    const div1Players = bulkPlayers({ clubId: 'd1-club', prefix: 'd1', count: 15 });
    const div2Players = bulkPlayers({ clubId: 'd2-club', prefix: 'd2', count: 15 });

    const ranking = calculateBallonDOr(
      [...div1Players, ...div2Players],
      clubsMap([div1Club, div2Club]),
      buildOrderedTable(['d1-club', 'd2-club']),
      {},
    );

    expect(ranking.length).toBe(BALLON_DOR_TOP_N);

    const d1Count = ranking.filter(e => e.clubName === div1Club.shortName).length;
    const d2Count = ranking.filter(e => e.clubName === div2Club.shortName).length;
    expect(d1Count).toBeGreaterThanOrEqual(BALLON_DOR_MAX_PER_DIVISION);
    expect(d2Count).toBeGreaterThanOrEqual(BALLON_DOR_MAX_PER_DIVISION);
    expect(d1Count + d2Count).toBe(BALLON_DOR_TOP_N);
  });

  it('keeps cap distribution when three divisions compete for spots', () => {
    // 10 elite candidates in each of three divisions. The walk should
    // accept BALLON_DOR_MAX_PER_DIVISION × 3 = 18 in the first pass, then
    // backfill the remaining 7 spots from the deferred set.
    const clubs = [
      buildClub({ id: 'd1-club', divisionId: 'div-1' }),
      buildClub({ id: 'd2-club', divisionId: 'div-2' }),
      buildClub({ id: 'd3-club', divisionId: 'div-3' }),
    ];
    const players = [
      ...bulkPlayers({ clubId: 'd1-club', prefix: 'd1', count: 10 }),
      ...bulkPlayers({ clubId: 'd2-club', prefix: 'd2', count: 10 }),
      ...bulkPlayers({ clubId: 'd3-club', prefix: 'd3', count: 10 }),
    ];

    const ranking = calculateBallonDOr(
      players,
      clubsMap(clubs),
      buildOrderedTable(['d1-club', 'd2-club', 'd3-club']),
      {},
    );

    expect(ranking.length).toBe(BALLON_DOR_TOP_N);
    // Every division must have at least the cap floor in the final
    // ranking — if any single division dominated and starved the others,
    // a count would fall below BALLON_DOR_MAX_PER_DIVISION.
    for (const c of clubs) {
      const count = ranking.filter(e => e.clubName === c.shortName).length;
      expect(count).toBeGreaterThanOrEqual(BALLON_DOR_MAX_PER_DIVISION);
    }
  });

  it('assigns contiguous ranks 1..N after the cap+backfill stage', () => {
    // Regression: ranks must be contiguous integers from 1 (no gaps, no
    // duplicates, exactly N entries). Note that *scores* are NOT
    // guaranteed monotonically non-increasing — the cap intentionally
    // surfaces lower-scoring players from second-tier divisions ahead of
    // higher-scoring deferred candidates from the dominant division.
    // That's the diversity feature, not a bug.
    const clubs = [
      buildClub({ id: 'a', divisionId: 'div-1' }),
      buildClub({ id: 'b', divisionId: 'div-2' }),
    ];
    const aPlayers = bulkPlayers({ clubId: 'a', prefix: 'a', count: 15, goals: 25, assists: 10, appearances: 38 });
    const bPlayers = bulkPlayers({ clubId: 'b', prefix: 'b', count: 15, goals: 18, assists: 6, appearances: 35 });

    const ranking = calculateBallonDOr(
      [...aPlayers, ...bPlayers],
      clubsMap(clubs),
      buildOrderedTable(['a', 'b']),
      {},
    );

    expect(ranking.length).toBe(BALLON_DOR_TOP_N);
    for (let i = 0; i < ranking.length; i++) {
      expect(ranking[i].rank).toBe(i + 1);
    }
    // Sanity: the very top rank still goes to a high-scoring entry from
    // the dominant division (the cap doesn't punish the leader).
    expect(ranking[0].clubName).toBe(clubs[0].shortName);
  });
});
