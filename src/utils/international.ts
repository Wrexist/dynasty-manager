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
  Position,
} from '@/types/game';
import { NATIONS, getNation, CONTINENTAL_TOURNAMENT_NAMES } from '@/data/nations';
import { TOTAL_WEEKS, INTL_PENALTY_GK_BASE, INTL_PENALTY_GK_SCALE } from '@/config/gameBalance';
import { simulatePenaltyShootout } from '@/utils/penaltyShootout';
import {
  WORLD_CUP_TEAMS_PER_GROUP,
  CONTINENTAL_CUP_GROUPS,
  NATIONAL_SQUAD_SIZE,
  NT_CANDIDATE_POOL_TARGET,
  LOW_FITNESS_THRESHOLD,
} from '@/config/gameBalance';
import { generatePlayer, pickNameForNationality, buildPlayerFromTemplate } from '@/utils/playerGen';
import { generatePlayerAppearance } from '@/config/playerAppearance';
import { getNationalPoolSync } from '@/data/nationalPlayerPoolAccess';

/**
 * Nationality aliases — maps the game's canonical nation names (src/data/nations.ts)
 * to equivalent labels used by FC26 data (club squads + NATIONAL_PLAYER_POOL).
 * Required because the CSV uses e.g. "Côte d'Ivoire"/"Holland"/"Korea Republic"
 * while the game's NATIONS list uses "Ivory Coast"/"Netherlands"/"South Korea".
 */
const NATIONALITY_ALIASES: Record<string, string[]> = {
  'Ivory Coast': ["Côte d'Ivoire"],
  'Netherlands': ['Holland'],
  'South Korea': ['Korea Republic'],
  'North Korea': ['Korea DPR'],
  'USA': ['United States'],
  'Ireland': ['Republic of Ireland'],
  'UAE': ['United Arab Emirates'],
  'China': ['China PR'],
  'Cape Verde': ['Cape Verde Islands'],
  'DR Congo': ['Congo DR'],
};

/** Return the canonical nationality plus any FC26-side aliases. */
export function resolveNationalityAliases(nationality: string): string[] {
  const aliases = NATIONALITY_ALIASES[nationality] ?? [];
  return [nationality, ...aliases];
}

/** Combined pool of real FC26 templates for a nationality, merged across all aliases. */
function getRealPoolForNationality(nationality: string) {
  const names = resolveNationalityAliases(nationality);
  const NATIONAL_PLAYER_POOL = getNationalPoolSync();
  const merged = names.flatMap(n => NATIONAL_PLAYER_POOL[n] ?? []);
  // Dedup by fn+ln+pos (some names appear in multiple alias entries)
  const seen = new Set<string>();
  return merged.filter(t => {
    const key = `${t.fn}|${t.ln}|${t.pos}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let fixtureCounter = 0;
function nextFixtureId(): string {
  return `intl-${++fixtureCounter}-${Date.now().toString(36)}`;
}

/** Determine which international tournament (if any) happens at end of the given season.
 *
 * 3-year cycle, repeating from season 1 onwards:
 *   year 1 → World Cup
 *   year 2 → Continental Cup (Euros / Copa America / AFCON / Asian Cup / Gold Cup)
 *   year 3 → no tournament (off year)
 *   year 4 → World Cup again, etc.
 *
 * `WORLD_CUP_FREQUENCY` and `CONTINENTAL_CUP_FREQUENCY` are kept for legacy
 * code paths but the cycle now drives scheduling directly.
 */
export function getTournamentForSeason(season: number): InternationalTournamentType | null {
  if (season < 1) return null;
  const cycleIndex = ((season - 1) % 3 + 3) % 3;
  if (cycleIndex === 0) return 'world-cup';
  if (cycleIndex === 1) return 'continental';
  return null;
}

/** Information about the next national tournament a manager will participate in.
 *  `weeksAway` is approximate (counts in regular season weeks of TOTAL_WEEKS each)
 *  and is 0 if the tournament is already running. */
export interface UpcomingTournamentInfo {
  type: InternationalTournamentType;
  /** Season the tournament takes place in. */
  season: number;
  /** Week of `season` the first match kicks off (always 47 for now). */
  startWeek: number;
  /** Approximate regular-season weeks until first match (capped at >=0). */
  weeksAway: number;
  /** Pretty display name for the cup (confederation-aware for continental). */
  name: string;
  /** True if the tournament window has already begun (week >= 47 in target season). */
  inProgress: boolean;
}

/** Compute the upcoming tournament for a manager given current season/week and
 *  optional player nationality (used to label continental tournaments).
 *
 *  Looks ahead up to 4 seasons. Returns null if no tournament is on the
 *  horizon (shouldn't happen given the 3-year cycle, but defensive). */
export function getUpcomingTournament(
  currentSeason: number,
  currentWeek: number,
  playerNationality: string | null,
): UpcomingTournamentInfo | null {
  const FIRST_INTL_WEEK = 47;
  for (let lookahead = 0; lookahead <= 4; lookahead++) {
    const targetSeason = currentSeason + lookahead;
    const type = getTournamentForSeason(targetSeason);
    if (!type) continue;

    let weeksAway: number;
    let inProgress = false;
    if (lookahead === 0) {
      if (currentWeek >= FIRST_INTL_WEEK) {
        weeksAway = 0;
        inProgress = true;
      } else {
        weeksAway = FIRST_INTL_WEEK - currentWeek;
      }
    } else {
      weeksAway = (TOTAL_WEEKS - currentWeek) + (lookahead - 1) * TOTAL_WEEKS + FIRST_INTL_WEEK - 1;
    }

    const name = type === 'world-cup'
      ? `World Cup ${targetSeason}`
      : continentalTournamentName(playerNationality);

    return {
      type,
      season: targetSeason,
      startWeek: FIRST_INTL_WEEK,
      weeksAway: Math.max(0, weeksAway),
      name,
      inProgress,
    };
  }
  return null;
}

/** Confederation-aware name for the continental cup. Defaults to "Continental Cup". */
export function continentalTournamentName(playerNationality: string | null | undefined): string {
  if (!playerNationality) return 'Continental Cup';
  const nation = getNation(playerNationality);
  if (!nation) return 'Continental Cup';
  return CONTINENTAL_TOURNAMENT_NAMES[nation.confederation] ?? 'Continental Cup';
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
/**
 * The real 2026 FIFA World Cup group-stage draw — 12 groups (A–L) of 4 nations,
 * 48 teams. World Cup mode ALWAYS starts from this exact draw so the tournament
 * mirrors the real thing. (Names must match `data/nations.ts`.)
 */
export const WORLD_CUP_DRAW: string[][] = [
  ['Mexico', 'South Korea', 'Czechia', 'South Africa'],          // A
  ['Canada', 'Switzerland', 'Bosnia and Herzegovina', 'Qatar'],  // B
  ['Brazil', 'Morocco', 'Scotland', 'Haiti'],                    // C
  ['USA', 'Australia', 'Paraguay', 'Türkiye'],                   // D
  ['Germany', 'Ivory Coast', 'Ecuador', 'Curaçao'],              // E
  ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],                 // F
  ['New Zealand', 'Iran', 'Belgium', 'Egypt'],                   // G
  ['Uruguay', 'Saudi Arabia', 'Spain', 'Cabo Verde'],            // H
  ['Norway', 'France', 'Senegal', 'Iraq'],                       // I
  ['Argentina', 'Austria', 'Jordan', 'Algeria'],                 // J
  ['Colombia', 'DR Congo', 'Portugal', 'Uzbekistan'],            // K
  ['England', 'Ghana', 'Panama', 'Croatia'],                     // L
];

export function generateTournament(
  type: InternationalTournamentType,
  season: number,
  playerNationality: string,
): InternationalTournamentState {
  const teamsPerGroup = WORLD_CUP_TEAMS_PER_GROUP;

  // Determine each group's teams. World Cup uses the fixed real 2026 draw;
  // continental tournaments draw from the confederation's ranked pool.
  let groupTeamsList: string[][];
  if (type === 'world-cup') {
    groupTeamsList = WORLD_CUP_DRAW.map(g => [...g]);
    // The player must be in the draw. If they picked a non-qualifier, swap them
    // in for the lowest-ranked drawn team so they still get a real World Cup.
    const inDraw = groupTeamsList.some(g => g.includes(playerNationality));
    if (playerNationality && !inDraw) {
      let worst = { gi: 0, ti: 0, rank: -1 };
      groupTeamsList.forEach((g, gi) => g.forEach((t, ti) => {
        const r = getNation(t)?.baseRanking ?? 999;
        if (r > worst.rank) worst = { gi, ti, rank: r };
      }));
      groupTeamsList[worst.gi][worst.ti] = playerNationality;
    }
  } else {
    const numGroups = CONTINENTAL_CUP_GROUPS;
    const totalTeams = numGroups * teamsPerGroup;
    const sorted = [...NATIONS].sort((a, b) => a.baseRanking - b.baseRanking);
    const playerNation = getNation(playerNationality);
    const confed = playerNation?.confederation ?? null;
    const inConfed = confed
      ? sorted.filter(n => n.confederation === confed).map(n => n.name)
      : sorted.map(n => n.name);
    let qualified = inConfed.slice(0, totalTeams);
    if (qualified.length < totalTeams) {
      const filler = sorted.filter(n => !qualified.includes(n.name)).map(n => n.name).slice(0, totalTeams - qualified.length);
      qualified = qualified.concat(filler);
    }
    if (!qualified.includes(playerNationality)) {
      qualified[qualified.length - 1] = playerNationality;
    }
    const pots: string[][] = [];
    for (let p = 0; p < teamsPerGroup; p++) {
      pots.push(shuffle(qualified.slice(p * numGroups, (p + 1) * numGroups)));
    }
    groupTeamsList = [];
    for (let g = 0; g < numGroups; g++) groupTeamsList.push(pots.map(pot => pot[g]));
  }

  // Build groups (round-robin fixtures + empty table) from the team lists.
  const groups: InternationalGroup[] = [];
  for (let g = 0; g < groupTeamsList.length; g++) {
    const teams = groupTeamsList[g];
    const groupName = `Group ${String.fromCharCode(65 + g)}`;

    // Generate round-robin fixtures (each team plays every other once)
    const fixtures: InternationalFixture[] = [];
    const weekOffset = 47; // international weeks start at 47
    // Round-robin via the circle method so each team plays exactly once per matchday.
    // The old `fixtures.length % 3` put two of a team's matches on the same matchday/week,
    // so one of them was silently never played (it stayed unscheduled forever).
    const n = teams.length;
    const rotation = teams.map((_, i) => i).slice(1); // indices of all but the fixed team 0
    const rounds = Math.max(1, n - 1);
    for (let r = 0; r < rounds; r++) {
      const matchday = r % 3; // 3 group matchdays → weeks 47-49
      const dayOrder = [0, ...rotation];
      for (let k = 0; k < Math.floor(n / 2); k++) {
        const a = dayOrder[k];
        const b = dayOrder[n - 1 - k];
        fixtures.push({
          id: nextFixtureId(),
          homeNation: teams[a],
          awayNation: teams[b],
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          week: weekOffset + matchday,
        });
      }
      rotation.unshift(rotation.pop()!); // rotate for the next matchday
    }

    const table: InternationalGroupEntry[] = teams.map(t => ({
      nationality: t,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    }));

    groups.push({ name: groupName, teams, fixtures, table });
  }

  const name = type === 'world-cup'
    ? `World Cup ${season}`
    : `${continentalTournamentName(playerNationality)} ${season}`;

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
    squadConfirmed: false,
  };
}

/** Simulate a single international match between two nations (AI vs AI or with player nation) */
/** Nation strength 0–1 from inverse FIFA-style ranking (rank 1 = strongest, max 65). */
function nationStrength(nationName: string): number {
  const nation = getNation(nationName);
  return nation ? Math.max(0, (66 - nation.baseRanking) / 65) : 0.5;
}

/** GK quality (0–1) for a nation, on the same scale getClubGKQuality uses for
 *  clubs, so AI international shootouts run through the canonical
 *  simulatePenaltyShootout instead of a coin flip. */
function nationPenaltyGKQuality(nationName: string): number {
  return INTL_PENALTY_GK_BASE + nationStrength(nationName) * INTL_PENALTY_GK_SCALE;
}

function simulateInternationalMatch(
  homeNation: string,
  awayNation: string,
): { homeGoals: number; awayGoals: number } {
  const homeStrength = nationStrength(homeNation);
  const awayStrength = nationStrength(awayNation);

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
  if (!Number.isFinite(expected) || expected <= 0) return 0;
  // Simple Poisson approximation
  const L = Math.exp(-expected);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
    if (k > 20) break;
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

  const ties: InternationalKnockoutTie[] = [];
  const numGroups = groups.length;

  // 2026 World Cup format: 12 groups → Round of 32. The 12 group winners + 12
  // runners-up + the 8 best third-placed sides (32 teams) seed a bracket.
  if (numGroups >= 12) {
    const rankCmp = (a: InternationalGroupEntry, b: InternationalGroupEntry) =>
      b.points - a.points
      || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
      || b.goalsFor - a.goalsFor;
    const winners: InternationalGroupEntry[] = [];
    const runners: InternationalGroupEntry[] = [];
    const thirds: InternationalGroupEntry[] = [];
    groups.forEach(group => {
      if (group.table[0]) winners.push(group.table[0]);
      if (group.table[1]) runners.push(group.table[1]);
      if (group.table[2]) thirds.push(group.table[2]);
    });
    const bestThirds = [...thirds].sort(rankCmp).slice(0, 8);
    // Seed strongest→weakest (winners, then runners, then best thirds) and pair
    // top vs bottom so group winners get the kinder Round-of-32 ties.
    const seeds = [
      ...winners.sort(rankCmp),
      ...runners.sort(rankCmp),
      ...bestThirds.sort(rankCmp),
    ].map(e => e.nationality);
    const half = Math.floor(seeds.length / 2);
    for (let i = 0; i < half; i++) {
      ties.push(createKnockoutTie('R32', seeds[i], seeds[seeds.length - 1 - i], 50));
    }
    return ties;
  }

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
  const order: InternationalKnockoutRound[] = ['R32', 'R16', 'QF', 'SF', 'F'];
  const idx = order.indexOf(round);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

/**
 * Simulate every remaining knockout round AI-only until a champion is crowned.
 *
 * Used when the player is already eliminated (group or knockout) and there's
 * no club season to return to — World Cup mode jumps straight to the final
 * result rather than making the player tap through games they aren't in, so
 * the tournament always produces a winner (like the real World Cup, where the
 * competition plays on without you). Any unplayed player tie in the starting
 * round is treated as already decided against the player.
 *
 * Returns the completed tie list (all rounds appended) and the champion.
 */
export function simulateKnockoutToCompletion(
  ties: InternationalKnockoutTie[],
  fromRound: InternationalKnockoutRound,
  playerNationality: string,
): { knockoutTies: InternationalKnockoutTie[]; winner: string | null } {
  let allTies = [...ties];
  let round: InternationalKnockoutRound | null = fromRound;
  let winner: string | null = null;
  // The player isn't in any remaining round, so pass a sentinel nationality so
  // processKnockoutRound never parks on a "player tie" and sims everything.
  const aiOnly = `__ai__${playerNationality}`;
  // Cap iterations defensively — there are at most 4 KO rounds (R16→F).
  for (let guard = 0; guard < 6 && round; guard++) {
    const res = processKnockoutRound(allTies, round, aiOnly);
    allTies = [...res.updatedTies, ...res.nextRoundTies];
    if (res.tournamentComplete) { winner = res.winner; break; }
    if (!res.roundComplete) break; // malformed bracket — bail rather than spin
    round = res.nextRoundTies.length > 0 ? res.nextRoundTies[0].round : null;
  }
  return { knockoutTies: allTies, winner };
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

    // If draw, penalty shootout — canonical GK-quality-aware sim, not a coin
    // flip with a fabricated 5-3 scoreline.
    if (result.homeGoals === result.awayGoals) {
      const shootout = simulatePenaltyShootout({
        homeName: tie.homeNation,
        awayName: tie.awayNation,
        homeGKQuality: nationPenaltyGKQuality(tie.homeNation),
        awayGKQuality: nationPenaltyGKQuality(tie.awayNation),
      });
      updated = {
        ...updated,
        penaltyShootout: { home: shootout.homeScore, away: shootout.awayScore },
        winnerId: shootout.winner === 'home' ? tie.homeNation : tie.awayNation,
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

/** Auto-select the best 23 players of a nationality from all players in the game.
 *
 *  Eligibility filters:
 *    - Nationality match (with FC26 alias resolution)
 *    - Not currently injured
 *    - Age >= 17
 *    - Not currently suspended (suspendedUntilWeek <= currentWeek)
 *    - Fitness above the LOW_FITNESS_THRESHOLD floor — a player at 30%
 *      fitness is exhausted and shouldn't be picked over a fresh 75 OVR
 *      backup. Optional `currentWeek` param keeps the function callable
 *      from places that don't have a week handy (tests, sandbox init);
 *      when undefined the suspension check is skipped but fitness still
 *      applies.
 */
export function autoSelectNationalSquad(
  nationality: string,
  allPlayers: Record<string, Player>,
  currentWeek?: number,
): string[] {
  const nats = new Set(resolveNationalityAliases(nationality));
  // Suspended players miss the next match window — but only knowable when the
  // caller supplied the current week (legacy callers omit it).
  const isSuspendedNow = (p: Player) =>
    currentWeek !== undefined && !!p.suspendedUntilWeek && p.suspendedUntilWeek > currentWeek;
  const eligible = Object.values(allPlayers)
    .filter(p => {
      if (!nats.has(p.nationality)) return false;
      if (p.injured) return false;
      if (p.age < 17) return false;
      if (isSuspendedNow(p)) return false;
      // Low-fitness exhaustion. Treat undefined fitness as max (legacy
      // saves don't always track it on every code path).
      const fit = p.fitness ?? 100;
      if (fit < LOW_FITNESS_THRESHOLD) return false;
      return true;
    })
    .sort((a, b) => b.overall - a.overall);

  // Pick best 23, ensuring position coverage
  const squad: Player[] = [];

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
    }
  }

  // Fill remaining spots with best available
  const remaining = eligible.filter(p => !squad.includes(p));
  for (const p of remaining) {
    if (squad.length >= NATIONAL_SQUAD_SIZE) break;
    squad.push(p);
  }

  // Pad to a full squad by relaxing the soft filters, hardest constraint last.
  // This function used to return fewer than 23 ids without comment, which meant
  // it could not rescue a player stuck on the squad picker — and the picker's
  // Confirm requires exactly 23. End of season is exactly when fitness is at its
  // lowest, so the `fitness < LOW_FITNESS_THRESHOLD` filter alone could empty the
  // pool. A tired or suspended 23rd man is always better than a dead save.
  if (squad.length < NATIONAL_SQUAD_SIZE) {
    const picked = new Set(squad.map(p => p.id));
    // The ladder must actually be a ladder: pass 1 said "allow low fitness" but
    // its predicate did not exclude suspension, so a suspended star was pulled
    // in ahead of an available tired player on the *first* relaxation. Fitness
    // is the cheaper concession — a tired player can be sent out, a suspended
    // one cannot — so it gives way first, and suspension only on pass 2.
    const relaxedPasses: ((p: Player) => boolean)[] = [
      // Pass 1: allow low fitness only.
      p => nats.has(p.nationality) && !p.injured && p.age >= 17 && !isSuspendedNow(p),
      // Pass 2: allow suspended too.
      p => nats.has(p.nationality) && !p.injured && p.age >= 17,
      // Pass 3: anyone of the nationality at all.
      p => nats.has(p.nationality),
    ];
    for (const accept of relaxedPasses) {
      if (squad.length >= NATIONAL_SQUAD_SIZE) break;
      const extra = Object.values(allPlayers)
        .filter(p => !picked.has(p.id) && accept(p))
        .sort((a, b) => b.overall - a.overall);
      for (const p of extra) {
        if (squad.length >= NATIONAL_SQUAD_SIZE) break;
        squad.push(p);
        picked.add(p.id);
      }
    }
  }

  return squad.map(p => p.id);
}

// Position template for national team pool generation (mirrors realistic squad shape)
const NT_POOL_POSITIONS: Position[] = [
  'GK', 'GK', 'GK',
  'CB', 'CB', 'CB', 'CB', 'CB', 'CB',
  'LB', 'LB', 'RB', 'RB',
  'CDM', 'CDM', 'CM', 'CM', 'CM', 'CM', 'CM',
  'CAM', 'CAM',
  'LW', 'LW', 'RW', 'RW',
  'ST', 'ST', 'ST', 'ST',
];

// Quality tiers: a few stars, mostly solid internationals, some young prospects
const NT_QUALITY_TIERS = [
  { min: 82, max: 88, count: 5 },   // star players
  { min: 74, max: 81, count: 20 },  // solid internationals
  { min: 68, max: 73, count: 15 },  // squad depth
  { min: 60, max: 67, count: 10 },  // young prospects
];

/** Max attempts to re-roll a procedural name when its surname collides with a
 *  real-pool entry already added to the national team. Keeps the loop bounded
 *  while still avoiding the "Ryan James / Reece James" near-duplicate effect. */
const NT_PROCEDURAL_NAME_RETRIES = 8;

/**
 * Generate a pool of national team candidate players for a given nationality.
 * Called when the user accepts the national team coaching job, to ensure
 * enough eligible real-name candidates exist for squad selection.
 *
 * Strategy:
 *   1. Always inject real FC26 players from NATIONAL_PLAYER_POOL first.
 *      With community pack enabled, we add the FULL pool (uncapped) so the
 *      manager sees every real international, not just the top NT_CANDIDATE_
 *      POOL_TARGET. With it disabled, we cap at NT_CANDIDATE_POOL_TARGET to
 *      keep parity with the procedural-flavoured experience.
 *   2. Fall back to procedural generation only if the combined pool falls
 *      below NATIONAL_SQUAD_SIZE (community pack on) or NT_CANDIDATE_POOL_
 *      TARGET (community pack off). Procedural players are surname-deduped
 *      against the real pool so we never end up with "Ryan James" sitting
 *      next to "Reece James" or "Ben White" next to "Benjamin White".
 */
export function generateNationalTeamPool(
  nationality: string,
  existingPlayers: Record<string, Player>,
  season: number,
  options: { communityPackEnabled?: boolean } = {},
): Record<string, Player> {
  const communityPackEnabled = options.communityPackEnabled === true;
  const nats = new Set(resolveNationalityAliases(nationality));
  const existing = Object.values(existingPlayers)
    .filter(p => nats.has(p.nationality) && !p.injured && p.age >= 17);

  const newPlayers: Record<string, Player> = {};

  // ── Step 1: Inject real FC26 pool entries ──
  // `inGameNameKeys` snapshots names that already exist as in-game players so
  // we never re-add them from the real pool. `blockedSurnames` captures
  // surnames the procedural fallback must avoid colliding with. Both are
  // initialised from `existing` only — the real-pool loop intentionally does
  // not add to `inGameNameKeys`, otherwise two distinct FC26 players sharing
  // a display name (e.g. multiple "Lucas Silva"s, "Lukas Müller"s) would
  // silently drop the second one and break the community-pack promise of
  // exposing every real candidate.
  const inGameNameKeys = new Set(
    existing.map(p => `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}`)
  );
  const blockedSurnames = new Set(existing.map(p => p.lastName.toLowerCase()));
  // Names already accumulated in the resulting pool — used by the procedural
  // fallback below to avoid re-stamping a name that's just been added (real
  // OR existing). Distinct from `inGameNameKeys` because we add to it freely
  // for procedural-dedup purposes without affecting real-pool dedup.
  const accumulatedNameKeys = new Set(inGameNameKeys);

  const realPool = getRealPoolForNationality(nationality);
  // With the community pack on, every real international is fair game — no
  // cap. With it off, retain the legacy NT_CANDIDATE_POOL_TARGET ceiling so
  // procedural players still feature heavily.
  const realCap = communityPackEnabled ? Infinity : NT_CANDIDATE_POOL_TARGET;
  // Within-loop dedup keyed on fcId so distinct real players who happen to
  // share a display name both pass through. Falls back to a name-based key
  // for templates without an fcId (legacy CLUB_TEMPLATES entries).
  const seenRealKeys = new Set<string>();
  let realAdded = 0;
  for (const t of realPool) {
    if (realAdded >= realCap) break;
    const nameKey = `${t.fn.toLowerCase()}|${t.ln.toLowerCase()}`;
    if (inGameNameKeys.has(nameKey)) continue; // already in-game via club squad
    const dedupKey = t.fcId ? `id:${t.fcId}` : `n:${nameKey}`;
    if (seenRealKeys.has(dedupKey)) continue;
    seenRealKeys.add(dedupKey);
    accumulatedNameKeys.add(nameKey);
    blockedSurnames.add(t.ln.toLowerCase());
    // Pass canonical nationality so appearance generation uses the game's
    // nation name rather than the FC26 alias (e.g. "Netherlands" not "Holland")
    const player = buildPlayerFromTemplate(t, '', season, nationality);
    newPlayers[player.id] = player;
    realAdded++;
  }

  // ── Step 2: Procedural fallback (only when the real pool is short) ──
  // With the community pack on, the user explicitly opted into "all real
  // players". Only invoke procedural generation as a safety net when the
  // combined pool can't even fill a 23-man squad — which only happens for
  // very small nations with skeletal FC26 data. With it off, fill up to the
  // legacy NT_CANDIDATE_POOL_TARGET so squad selection has room to breathe.
  const totalAfter = existing.length + realAdded;
  const fallbackTarget = communityPackEnabled ? NATIONAL_SQUAD_SIZE : NT_CANDIDATE_POOL_TARGET;
  const remaining = Math.max(0, fallbackTarget - totalAfter);
  if (remaining <= 0) return newPlayers;

  let posIndex = 0;
  const qualitySlots: number[] = [];
  for (const tier of NT_QUALITY_TIERS) {
    for (let i = 0; i < tier.count; i++) {
      qualitySlots.push(tier.min + Math.floor(Math.random() * (tier.max - tier.min + 1)));
    }
  }
  for (let i = qualitySlots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [qualitySlots[i], qualitySlots[j]] = [qualitySlots[j], qualitySlots[i]];
  }

  for (let i = 0; i < remaining; i++) {
    const position = NT_POOL_POSITIONS[posIndex % NT_POOL_POSITIONS.length];
    posIndex++;
    const quality = qualitySlots[i % qualitySlots.length];

    const player = generatePlayer(position, quality, '', season);
    player.nationality = nationality;

    // Pick a name whose surname doesn't collide with a real-pool entry.
    // Re-roll up to NT_PROCEDURAL_NAME_RETRIES times to avoid pseudo-duplicates
    // like "Nathan Pope" appearing alongside real "Nicholas Pope".
    let firstName = '';
    let lastName = '';
    for (let attempt = 0; attempt < NT_PROCEDURAL_NAME_RETRIES; attempt++) {
      const candidate = pickNameForNationality(nationality);
      const fullKey = `${candidate.firstName.toLowerCase()}|${candidate.lastName.toLowerCase()}`;
      const surnameKey = candidate.lastName.toLowerCase();
      if (accumulatedNameKeys.has(fullKey)) continue;
      if (blockedSurnames.has(surnameKey)) continue;
      firstName = candidate.firstName;
      lastName = candidate.lastName;
      break;
    }
    if (!firstName || !lastName) {
      // Couldn't find a non-real-colliding name in the budget — skip this slot.
      // Better to ship a slightly smaller pool than an obvious dupe.
      continue;
    }
    // Only block the full name (so we don't stamp out the same fake person
    // twice). Surnames are NOT added to blockedSurnames — multiple procedural
    // players can share a surname; the surname block is reserved for real-
    // pool entries to prevent the "Ryan James / Reece James" effect.
    accumulatedNameKeys.add(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`);

    player.firstName = firstName;
    player.lastName = lastName;
    player.clubId = '';
    player.appearance = generatePlayerAppearance(nationality, position);

    const ageRoll = Math.random();
    if (ageRoll < 0.15) player.age = 18 + Math.floor(Math.random() * 3);
    else if (ageRoll < 0.70) player.age = 23 + Math.floor(Math.random() * 7);
    else player.age = 30 + Math.floor(Math.random() * 4);

    newPlayers[player.id] = player;
  }

  return newPlayers;
}
