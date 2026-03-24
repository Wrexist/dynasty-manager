/**
 * International tournament generation and simulation utilities.
 * Handles World Cup and Continental Cup group draws, fixture generation,
 * AI match simulation, and knockout bracket progression.
 */

import type {
  InternationalTournamentState,
  InternationalTournamentType,
  InternationalGroup,
  InternationalGroupEntry,
  InternationalFixture,
  InternationalKnockoutTie,
  InternationalKnockoutRound,
  Player,
} from '@/types/game';
import { NATIONS, getNation } from '@/data/nations';
import {
  WORLD_CUP_GROUPS,
  WORLD_CUP_TEAMS_PER_GROUP,
  CONTINENTAL_CUP_GROUPS,
  WORLD_CUP_FREQUENCY,
  CONTINENTAL_CUP_FREQUENCY,
  NATIONAL_SQUAD_SIZE,
} from '@/config/gameBalance';

let fixtureCounter = 0;
function nextFixtureId(): string {
  return `intl-${++fixtureCounter}-${Date.now().toString(36)}`;
}

/** Determine which international tournament (if any) happens at end of the given season */
export function getTournamentForSeason(season: number): InternationalTournamentType | null {
  if (season >= 2 && season % WORLD_CUP_FREQUENCY === 0) return 'world-cup';
  if (season >= 2 && season % CONTINENTAL_CUP_FREQUENCY === 2) return 'continental';
  return null;
}

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generate a full tournament draw and initial state */
export function generateTournament(
  type: InternationalTournamentType,
  season: number,
  playerNationality: string,
): InternationalTournamentState {
  const numGroups = type === 'world-cup' ? WORLD_CUP_GROUPS : CONTINENTAL_CUP_GROUPS;
  const teamsPerGroup = WORLD_CUP_TEAMS_PER_GROUP;
  const totalTeams = numGroups * teamsPerGroup;

  // Sort nations by ranking, ensure player nation qualifies
  const sorted = [...NATIONS].sort((a, b) => a.baseRanking - b.baseRanking);
  const qualified = sorted.slice(0, totalTeams).map(n => n.name);

  // Ensure the player's nation is in
  if (!qualified.includes(playerNationality)) {
    qualified[qualified.length - 1] = playerNationality;
  }

  // Seed pots: split into numGroups pots of teamsPerGroup
  const pots: string[][] = [];
  for (let p = 0; p < teamsPerGroup; p++) {
    pots.push(shuffle(qualified.slice(p * numGroups, (p + 1) * numGroups)));
  }

  // Draw groups
  const groups: InternationalGroup[] = [];
  for (let g = 0; g < numGroups; g++) {
    const teams = pots.map(pot => pot[g]);
    const groupName = `Group ${String.fromCharCode(65 + g)}`;

    // Generate round-robin fixtures (each team plays every other once)
    const fixtures: InternationalFixture[] = [];
    const weekOffset = 47; // international weeks start at 47
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // Spread across weeks 47-49 (3 group stage matchdays)
        const matchday = fixtures.length % 3;
        fixtures.push({
          id: nextFixtureId(),
          homeNation: teams[i],
          awayNation: teams[j],
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          week: weekOffset + matchday,
        });
      }
    }

    const table: InternationalGroupEntry[] = teams.map(t => ({
      nationality: t,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    }));

    groups.push({ name: groupName, teams, fixtures, table });
  }

  const name = type === 'world-cup'
    ? `World Cup Season ${season}`
    : `Continental Cup Season ${season}`;

  return {
    type,
    name,
    season,
    phase: 'group',
    groups,
    knockoutTies: [],
    currentRound: null,
    playerEliminated: false,
    winner: null,
    currentWeek: 47,
  };
}

/** Simulate a single international match between two nations (AI vs AI or with player nation) */
export function simulateInternationalMatch(
  homeNation: string,
  awayNation: string,
): { homeGoals: number; awayGoals: number } {
  const home = getNation(homeNation);
  const away = getNation(awayNation);

  // Strength based on inverse ranking (rank 1 = strongest)
  const homeStrength = home ? (52 - home.baseRanking) / 51 : 0.5;
  const awayStrength = away ? (52 - away.baseRanking) / 51 : 0.5;

  // Home advantage
  const homeAdv = 0.08;

  const homeAttack = homeStrength + homeAdv + (Math.random() * 0.3 - 0.15);
  const awayAttack = awayStrength + (Math.random() * 0.3 - 0.15);

  // Expected goals roughly 0-4 range
  const homeExpected = Math.max(0, homeAttack * 3);
  const awayExpected = Math.max(0, awayAttack * 3);

  // Poisson-ish random goals
  const homeGoals = poissonGoals(homeExpected);
  const awayGoals = poissonGoals(awayExpected);

  return { homeGoals, awayGoals };
}

function poissonGoals(expected: number): number {
  // Simple Poisson approximation
  const L = Math.exp(-expected);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return Math.min(k - 1, 7); // cap at 7
}

/** Process all group fixtures for a given week, return updated groups */
export function processGroupWeek(
  groups: InternationalGroup[],
  week: number,
  playerNationality: string,
): { groups: InternationalGroup[]; playerMatchThisWeek: InternationalFixture | null } {
  let playerMatchThisWeek: InternationalFixture | null = null;

  const updatedGroups = groups.map(group => {
    const updatedFixtures = group.fixtures.map(fix => {
      if (fix.played || fix.week !== week) return fix;

      // Check if this involves the player's nation
      const isPlayerMatch = fix.homeNation === playerNationality || fix.awayNation === playerNationality;

      if (isPlayerMatch) {
        // Don't auto-sim player matches — mark for player to play
        playerMatchThisWeek = fix;
        return fix;
      }

      // AI vs AI: simulate
      const result = simulateInternationalMatch(fix.homeNation, fix.awayNation);
      return { ...fix, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals };
    });

    // Rebuild table from all played fixtures
    const table = rebuildGroupTable(group.teams, updatedFixtures);

    return { ...group, fixtures: updatedFixtures, table };
  });

  return { groups: updatedGroups, playerMatchThisWeek };
}

/** Rebuild group table from fixtures */
function rebuildGroupTable(teams: string[], fixtures: InternationalFixture[]): InternationalGroupEntry[] {
  const entries: Record<string, InternationalGroupEntry> = {};
  teams.forEach(t => {
    entries[t] = { nationality: t, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
  });

  fixtures.filter(f => f.played).forEach(f => {
    const home = entries[f.homeNation];
    const away = entries[f.awayNation];
    if (!home || !away) return;

    home.played++;
    away.played++;
    home.goalsFor += f.homeGoals;
    home.goalsAgainst += f.awayGoals;
    away.goalsFor += f.awayGoals;
    away.goalsAgainst += f.homeGoals;

    if (f.homeGoals > f.awayGoals) {
      home.won++; home.points += 3;
      away.lost++;
    } else if (f.homeGoals < f.awayGoals) {
      away.won++; away.points += 3;
      home.lost++;
    } else {
      home.drawn++; home.points += 1;
      away.drawn++; away.points += 1;
    }
  });

  return Object.values(entries).sort((a, b) =>
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor
  );
}

/** After group stage: determine which nations advance, generate knockout bracket */
export function generateKnockoutBracket(
  groups: InternationalGroup[],
): InternationalKnockoutTie[] {
  // Top 2 from each group advance
  const advancers: { nation: string; groupIndex: number; position: number }[] = [];
  groups.forEach((group, gi) => {
    group.table.slice(0, 2).forEach((entry, pos) => {
      advancers.push({ nation: entry.nationality, groupIndex: gi, position: pos + 1 });
    });
  });

  // R16 matchups: 1st of Group A vs 2nd of Group B, etc.
  const ties: InternationalKnockoutTie[] = [];
  const numGroups = groups.length;

  if (numGroups >= 8) {
    // World Cup style R16
    for (let g = 0; g < numGroups; g += 2) {
      const winner1 = advancers.find(a => a.groupIndex === g && a.position === 1);
      const runner2 = advancers.find(a => a.groupIndex === g + 1 && a.position === 2);
      const winner2 = advancers.find(a => a.groupIndex === g + 1 && a.position === 1);
      const runner1 = advancers.find(a => a.groupIndex === g && a.position === 2);

      if (winner1 && runner2) {
        ties.push(createKnockoutTie('R16', winner1.nation, runner2.nation, 50));
      }
      if (winner2 && runner1) {
        ties.push(createKnockoutTie('R16', winner2.nation, runner1.nation, 50));
      }
    }
  } else {
    // Continental cup — 4 groups → QF directly
    for (let g = 0; g < numGroups; g += 2) {
      const winner1 = advancers.find(a => a.groupIndex === g && a.position === 1);
      const runner2 = advancers.find(a => a.groupIndex === g + 1 && a.position === 2);
      const winner2 = advancers.find(a => a.groupIndex === g + 1 && a.position === 1);
      const runner1 = advancers.find(a => a.groupIndex === g && a.position === 2);

      if (winner1 && runner2) {
        ties.push(createKnockoutTie('QF', winner1.nation, runner2.nation, 50));
      }
      if (winner2 && runner1) {
        ties.push(createKnockoutTie('QF', winner2.nation, runner1.nation, 50));
      }
    }
  }

  return ties;
}

function createKnockoutTie(
  round: InternationalKnockoutRound,
  home: string,
  away: string,
  week: number,
): InternationalKnockoutTie {
  return {
    id: nextFixtureId(),
    round,
    homeNation: home,
    awayNation: away,
    played: false,
    homeGoals: 0,
    awayGoals: 0,
    week,
  };
}

/** Get the next knockout round */
function nextRound(round: InternationalKnockoutRound): InternationalKnockoutRound | null {
  const order: InternationalKnockoutRound[] = ['R16', 'QF', 'SF', 'F'];
  const idx = order.indexOf(round);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

/** Process knockout round: sim AI ties, generate next round ties */
export function processKnockoutRound(
  ties: InternationalKnockoutTie[],
  currentRound: InternationalKnockoutRound,
  playerNationality: string,
): {
  updatedTies: InternationalKnockoutTie[];
  nextRoundTies: InternationalKnockoutTie[];
  playerTie: InternationalKnockoutTie | null;
  roundComplete: boolean;
  tournamentComplete: boolean;
  winner: string | null;
} {
  let playerTie: InternationalKnockoutTie | null = null;
  const roundTies = ties.filter(t => t.round === currentRound);

  const updatedRoundTies = roundTies.map(tie => {
    if (tie.played) return tie;

    const isPlayerMatch = tie.homeNation === playerNationality || tie.awayNation === playerNationality;
    if (isPlayerMatch) {
      playerTie = tie;
      return tie;
    }

    // AI vs AI
    const result = simulateInternationalMatch(tie.homeNation, tie.awayNation);
    let updated = { ...tie, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals };

    // If draw, penalty shootout
    if (result.homeGoals === result.awayGoals) {
      const homeWins = Math.random() > 0.5;
      updated = {
        ...updated,
        penaltyShootout: { home: homeWins ? 5 : 3, away: homeWins ? 3 : 5 },
        winnerId: homeWins ? tie.homeNation : tie.awayNation,
      };
    } else {
      updated.winnerId = result.homeGoals > result.awayGoals ? tie.homeNation : tie.awayNation;
    }
    return updated;
  });

  // Replace round ties in full array
  const updatedTies = ties.map(t => {
    const updated = updatedRoundTies.find(u => u.id === t.id);
    return updated || t;
  });

  const roundComplete = updatedRoundTies.every(t => t.played);

  // Generate next round if complete
  const nextRoundTies: InternationalKnockoutTie[] = [];
  let tournamentComplete = false;
  let winner: string | null = null;

  if (roundComplete) {
    const nr = nextRound(currentRound);
    if (nr) {
      const winners = updatedRoundTies.map(t => t.winnerId!).filter(Boolean);
      for (let i = 0; i < winners.length; i += 2) {
        if (winners[i + 1]) {
          nextRoundTies.push(createKnockoutTie(nr, winners[i], winners[i + 1], 51));
        }
      }
    } else {
      // Final is complete
      tournamentComplete = true;
      const final = updatedRoundTies[0];
      if (final) winner = final.winnerId || null;
    }
  }

  return { updatedTies, nextRoundTies, playerTie, roundComplete, tournamentComplete, winner };
}

/** Auto-select the best 23 players of a nationality from all players in the game */
export function autoSelectNationalSquad(
  nationality: string,
  allPlayers: Record<string, Player>,
): string[] {
  const eligible = Object.values(allPlayers)
    .filter(p => p.nationality === nationality && !p.injured && p.age >= 17)
    .sort((a, b) => b.overall - a.overall);

  // Pick best 23, ensuring position coverage
  const squad: Player[] = [];
  const positionCounts: Record<string, number> = {};

  // First pass: fill minimum positions (2 GK, 5 DEF, 4 MID, 2 FWD)
  const minimums: Record<string, { positions: string[]; min: number }> = {
    gk: { positions: ['GK'], min: 2 },
    def: { positions: ['CB', 'LB', 'RB'], min: 5 },
    mid: { positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'], min: 4 },
    fwd: { positions: ['LW', 'RW', 'ST'], min: 2 },
  };

  for (const [, group] of Object.entries(minimums)) {
    const available = eligible.filter(
      p => group.positions.includes(p.position) && !squad.includes(p)
    );
    const toTake = Math.min(group.min, available.length);
    for (let i = 0; i < toTake; i++) {
      squad.push(available[i]);
      positionCounts[available[i].position] = (positionCounts[available[i].position] || 0) + 1;
    }
  }

  // Fill remaining spots with best available
  const remaining = eligible.filter(p => !squad.includes(p));
  for (const p of remaining) {
    if (squad.length >= NATIONAL_SQUAD_SIZE) break;
    squad.push(p);
  }

  return squad.map(p => p.id);
}
