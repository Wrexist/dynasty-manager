/**
 * Reusable test fixtures for season-related tests.
 *
 * Builds deterministic Club, LeagueTableEntry, and full country-pyramid setups
 * so each test can start from a valid state without re-deriving boilerplate.
 *
 * All builders use plain data — no store, no async. Combine with
 * withSeededRandom() to make tests that touch simulatePlayoff or
 * generateReplacementClub deterministic.
 */

import type {
  Club,
  LeagueInfo,
  LeagueTableEntry,
  Player,
  Position,
} from '@/types/game';
import { LEAGUES, getLeaguesByCountry } from '@/data/league';

// ── Club builders ──

export interface ClubBuildOpts extends Partial<Club> {
  id: string;
  divisionId: string;
}

/** Build a Club with sane defaults for tests. */
export function buildClub(opts: ClubBuildOpts): Club {
  return {
    id: opts.id,
    name: opts.name ?? `Club ${opts.id}`,
    shortName: opts.shortName ?? opts.id.slice(0, 3).toUpperCase(),
    color: opts.color ?? '#FFFFFF',
    secondaryColor: opts.secondaryColor ?? '#000000',
    budget: opts.budget ?? 10_000_000,
    wageBill: opts.wageBill ?? 100_000,
    reputation: opts.reputation ?? 3,
    facilities: opts.facilities ?? 5,
    youthRating: opts.youthRating ?? 5,
    fanBase: opts.fanBase ?? 30,
    boardPatience: opts.boardPatience ?? 60,
    playerIds: opts.playerIds ?? [],
    formation: opts.formation ?? '4-3-3',
    lineup: opts.lineup ?? [],
    subs: opts.subs ?? [],
    divisionId: opts.divisionId,
    aiManagerProfile: opts.aiManagerProfile,
    setPieceTakerId: opts.setPieceTakerId,
    penaltyTakerId: opts.penaltyTakerId,
    stadiumName: opts.stadiumName,
    stadiumCapacity: opts.stadiumCapacity,
  };
}

// ── Player builders ──

export interface PlayerBuildOpts extends Partial<Player> {
  id: string;
  position?: Position;
}

/** Build a Player with sane defaults for tests. */
export function buildPlayer(opts: PlayerBuildOpts): Player {
  return {
    id: opts.id,
    firstName: opts.firstName ?? 'Test',
    lastName: opts.lastName ?? `Player${opts.id}`,
    age: opts.age ?? 25,
    nationality: opts.nationality ?? 'England',
    position: opts.position ?? 'CM',
    attributes: opts.attributes ?? {
      pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70,
    },
    overall: opts.overall ?? 70,
    potential: opts.potential ?? 75,
    clubId: opts.clubId ?? 'test-club',
    wage: opts.wage ?? 50_000,
    value: opts.value ?? 5_000_000,
    contractEnd: opts.contractEnd ?? 5,
    fitness: opts.fitness ?? 100,
    morale: opts.morale ?? 75,
    form: opts.form ?? 70,
    injured: opts.injured ?? false,
    injuryWeeks: opts.injuryWeeks ?? 0,
    injuryDetails: opts.injuryDetails,
    goals: opts.goals ?? 0,
    assists: opts.assists ?? 0,
    appearances: opts.appearances ?? 0,
    careerGoals: opts.careerGoals ?? 0,
    careerAssists: opts.careerAssists ?? 0,
    careerAppearances: opts.careerAppearances ?? 0,
    yellowCards: opts.yellowCards ?? 0,
    redCards: opts.redCards ?? 0,
    suspendedUntilWeek: opts.suspendedUntilWeek,
    onLoan: opts.onLoan ?? false,
    loanFromClubId: opts.loanFromClubId,
    loanToClubId: opts.loanToClubId,
    listedForSale: opts.listedForSale ?? false,
    joinedSeason: opts.joinedSeason,
    isFromYouthAcademy: opts.isFromYouthAcademy,
    alternatePositions: opts.alternatePositions,
  };
}

// ── League table builders ──

/**
 * Build a finished league table with N clubs. Clubs are placed in given order
 * (index 0 = champions). Points/GD are deterministically derived from index so
 * sort behavior is predictable in tests.
 *
 * pointsForFirst defaults to 90; each subsequent place loses 3 points.
 */
export function buildOrderedTable(
  clubIds: string[],
  opts: { played?: number; pointsForFirst?: number } = {},
): LeagueTableEntry[] {
  const played = opts.played ?? 46;
  const pointsForFirst = opts.pointsForFirst ?? 90;
  return clubIds.map((clubId, i) => {
    const won = Math.max(0, 28 - i);
    const lost = i + 2;
    const drawn = Math.max(0, played - won - lost);
    const goalsFor = Math.max(10, 80 - i * 2);
    const goalsAgainst = 20 + i * 2;
    return {
      clubId,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      points: Math.max(0, pointsForFirst - i * 3),
      form: [],
      cleanSheets: Math.max(0, 14 - i),
    };
  });
}

// ── Country pyramid setup ──

export interface CountrySetup {
  countryId: string;
  /** Tier-ordered league info (tier 1 first) */
  leagues: LeagueInfo[];
  /** All clubs created across the pyramid, keyed by id */
  clubs: Record<string, Club>;
  /** clubIds per division id (matches game state shape) */
  divisionClubs: Record<string, string[]>;
  /** Finished tables per division id (matches game state shape) */
  divisionTables: Record<string, LeagueTableEntry[]>;
}

/**
 * Build a complete country pyramid: clubs, division assignments, and final
 * tables for every tier. Club IDs follow the pattern `${tierId}-club-${i}`
 * so tests can reason about them by name.
 *
 * Override `tableOrder` per league to pin specific clubs to specific
 * positions (useful for testing player-club promotion/relegation outcomes).
 */
export function setupCountryPyramid(
  countryId: string,
  overrides: { tableOrder?: Record<string, string[]> } = {},
): CountrySetup {
  const leagues = getLeaguesByCountry(countryId);
  if (leagues.length === 0) {
    throw new Error(`No leagues found for country '${countryId}'`);
  }

  const clubs: Record<string, Club> = {};
  const divisionClubs: Record<string, string[]> = {};
  const divisionTables: Record<string, LeagueTableEntry[]> = {};

  for (const league of leagues) {
    const ids: string[] = [];
    for (let i = 0; i < league.teamCount; i++) {
      const id = `${league.id}-club-${i + 1}`;
      ids.push(id);
      clubs[id] = buildClub({
        id,
        divisionId: league.id,
        budget: 5_000_000 * (5 - league.tier),
        reputation: Math.max(1, 5 - league.tier),
      });
    }
    divisionClubs[league.id] = ids;
    const tableIds = overrides.tableOrder?.[league.id] ?? ids;
    divisionTables[league.id] = buildOrderedTable(tableIds, { played: league.totalWeeks });
  }

  return { countryId, leagues, clubs, divisionClubs, divisionTables };
}

/**
 * Pin a specific club to a specific table position for a given division
 * within a CountrySetup. Returns a NEW setup with the table reshuffled.
 */
export function placeClubAt(
  setup: CountrySetup,
  divisionId: string,
  clubId: string,
  position: number,
): CountrySetup {
  const table = setup.divisionTables[divisionId];
  if (!table) throw new Error(`Division '${divisionId}' not in setup`);
  const ids = table.map(e => e.clubId);
  const filtered = ids.filter(id => id !== clubId);
  if (position < 0 || position > filtered.length) {
    throw new Error(`Invalid position ${position} for table of size ${ids.length}`);
  }
  filtered.splice(position, 0, clubId);
  return {
    ...setup,
    divisionTables: {
      ...setup.divisionTables,
      [divisionId]: buildOrderedTable(filtered, { played: table[0]?.played ?? 46 }),
    },
  };
}

// ── Deterministic RNG for tests ──

/**
 * Run a function with Math.random replaced by a seeded mulberry32 PRNG.
 * Restores the original Math.random afterwards (even on throw).
 *
 * Use this when a test calls into code that uses Math.random (simulatePlayoff,
 * generateReplacementClub, fixture generation) and you need reproducible output.
 */
export function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// ── Convenience: known countries ──

export function countryHasMultipleTiers(countryId: string): boolean {
  return LEAGUES.filter(l => l.countryId === countryId).length > 1;
}

/** Find any country with the given number of tiers (for parametrized tests). */
export function findCountryWithTiers(tierCount: number): string | null {
  const byCountry: Record<string, number> = {};
  for (const league of LEAGUES) {
    byCountry[league.countryId] = (byCountry[league.countryId] ?? 0) + 1;
  }
  for (const [country, n] of Object.entries(byCountry)) {
    if (n === tierCount) return country;
  }
  return null;
}
