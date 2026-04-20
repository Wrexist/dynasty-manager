/**
 * Continental tournament draw generation.
 * Creates virtual clubs from league data and generates group-stage draws.
 *
 * Qualification is rank-based: leagues are ranked 1-30 by coefficient/reputation,
 * and spots per competition are assigned by rank (mirroring real UEFA coefficients).
 */
import type { VirtualClub, ContinentalGroup, ContinentalGroupMatch, ContinentalGroupStanding, ContinentalTournamentState, ContinentalCompetition, LeagueTableEntry, ContinentalCoefficient } from '@/types/game';
import { ALL_LEAGUES, CLUBS_BY_LEAGUE, ALL_CLUBS_DATA } from './leagues';
import {
  CONTINENTAL_GROUPS, CONTINENTAL_TEAMS_PER_GROUP,
  CONTINENTAL_TOTAL_TEAMS,
  CONTINENTAL_GROUP_WEEKS, GROUP_FIXTURE_TEMPLATE,
} from '@/config/continental';
import { shuffle } from '@/utils/helpers';
import { getSeedingScore } from '@/utils/continentalCoefficients';
import { getLeagueRankings, type RankedLeague } from '@/utils/leagueRanking';

/**
 * Build virtual clubs from a league's club data, sorted by reputation (highest first).
 */
function buildVirtualClubsForLeague(leagueId: string): VirtualClub[] {
  const clubs = CLUBS_BY_LEAGUE[leagueId] || [];
  const league = ALL_LEAGUES.find(l => l.id === leagueId);
  return clubs
    .sort((a, b) => b.reputation - a.reputation)
    .map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      color: c.color,
      secondaryColor: c.secondaryColor || c.color,
      leagueId: c.divisionId,
      reputation: c.reputation,
      country: league?.country || '',
      countryCode: league?.countryCode || '',
    }));
}

/**
 * Create a VirtualClub entry from the player's club data.
 */
function makePlayerVirtualClub(
  clubId: string,
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
  leagueId: string,
  country: string,
  countryCode: string,
): VirtualClub | null {
  const c = playerClubs[clubId];
  if (!c) return null;
  const clubData = ALL_CLUBS_DATA.find(cd => cd.id === clubId);
  return {
    id: clubId,
    name: c.name,
    shortName: c.shortName,
    color: c.color,
    secondaryColor: clubData?.secondaryColor || c.color,
    leagueId,
    reputation: c.reputation,
    country,
    countryCode,
  };
}

/**
 * Generic qualifier builder — collects clubs from all leagues based on rank-based spot allocations.
 *
 * @param rankings          Precomputed league rankings
 * @param spotsKey          Which spot count to read from each ranking entry
 * @param playerLeagueId    The player's league
 * @param playerLeagueTable Actual league table for the player's league
 * @param playerClubs       Club info map from state
 * @param skipPositions     How many top positions to skip (e.g., skip CL spots when building Shield)
 * @param alreadyQualified  Set of club IDs already qualified for a higher competition
 * @param cupWinnerId       Optional: cup winner from a lower competition who earns a spot
 * @param totalTeams        Target number of qualifiers (default 32)
 */
function collectQualifiers(
  rankings: RankedLeague[],
  spotsKey: 'championsCupSpots' | 'shieldCupSpots' | 'conferenceCupSpots',
  playerLeagueId: string,
  playerLeagueTable: LeagueTableEntry[],
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
  skipPositions: (ranking: RankedLeague) => number,
  alreadyQualified: Set<string>,
  cupWinnerId: string | null,
  totalTeams: number = CONTINENTAL_TOTAL_TEAMS,
): { qualifiers: string[]; virtualClubs: Record<string, VirtualClub> } {
  const qualifiers: string[] = [];
  const virtualClubs: Record<string, VirtualClub> = {};

  // Add cup winner first (guaranteed spot) if not already in a higher competition
  if (cupWinnerId && !alreadyQualified.has(cupWinnerId) && !qualifiers.includes(cupWinnerId)) {
    qualifiers.push(cupWinnerId);
    const c = playerClubs[cupWinnerId];
    if (c) {
      // Cup winner is a player-league club
      const league = ALL_LEAGUES.find(l => l.id === playerLeagueId);
      const vc = makePlayerVirtualClub(cupWinnerId, playerClubs, playerLeagueId, league?.country || '', league?.countryCode || '');
      if (vc) virtualClubs[cupWinnerId] = vc;
    } else {
      // Cup winner is from a non-player league — look up in static data
      for (const lg of ALL_LEAGUES) {
        const staticClub = buildVirtualClubsForLeague(lg.id).find(vc => vc.id === cupWinnerId);
        if (staticClub) {
          virtualClubs[cupWinnerId] = staticClub;
          break;
        }
      }
    }
  }

  for (const ranking of rankings) {
    const spots = ranking[spotsKey];
    if (spots === 0) continue;

    const league = ALL_LEAGUES.find(l => l.id === ranking.leagueId);
    if (!league) continue;

    const skip = skipPositions(ranking);

    if (ranking.leagueId === playerLeagueId) {
      // Use actual league table positions for the player's league
      const candidates = playerLeagueTable.slice(skip, skip + spots);
      for (const entry of candidates) {
        if (alreadyQualified.has(entry.clubId) || qualifiers.includes(entry.clubId)) continue;
        qualifiers.push(entry.clubId);
        const vc = makePlayerVirtualClub(entry.clubId, playerClubs, playerLeagueId, league.country, league.countryCode);
        if (vc) virtualClubs[entry.clubId] = vc;
      }
    } else {
      // Use static data — skip positions BEFORE filtering to get correct league positions
      const vClubs = buildVirtualClubsForLeague(ranking.leagueId);
      const afterSkip = vClubs.slice(skip);
      const available = afterSkip.filter(vc => !alreadyQualified.has(vc.id) && !qualifiers.includes(vc.id));
      for (let i = 0; i < Math.min(spots, available.length); i++) {
        qualifiers.push(available[i].id);
        virtualClubs[available[i].id] = available[i];
      }
    }

    if (qualifiers.length >= totalTeams) break;
  }

  // Cap at target
  while (qualifiers.length > totalTeams) qualifiers.pop();

  return { qualifiers, virtualClubs };
}

/**
 * Determine which clubs qualify for the Champions Cup (top tier).
 * Uses rank-based spots. Shield Cup winner earns a guaranteed spot.
 */
export function getChampionsCupQualifiers(
  playerLeagueId: string,
  playerLeagueTable: LeagueTableEntry[],
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
  coefficients?: Record<string, ContinentalCoefficient>,
  shieldCupWinnerId?: string | null,
): { qualifiers: string[]; virtualClubs: Record<string, VirtualClub> } {
  const rankings = getLeagueRankings(coefficients);
  return collectQualifiers(
    rankings,
    'championsCupSpots',
    playerLeagueId,
    playerLeagueTable,
    playerClubs,
    () => 0, // start from position 1
    new Set(), // no one to skip (this is the top competition)
    shieldCupWinnerId || null,
  );
}

/**
 * Determine which clubs qualify for the Shield Cup (second tier).
 * Takes positions just below Champions Cup qualifiers.
 * Conference Cup winner earns a guaranteed spot.
 */
export function getShieldCupQualifiers(
  playerLeagueId: string,
  playerLeagueTable: LeagueTableEntry[],
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
  championsCupIds: Set<string>,
  coefficients?: Record<string, ContinentalCoefficient>,
  conferenceCupWinnerId?: string | null,
): { qualifiers: string[]; virtualClubs: Record<string, VirtualClub> } {
  const rankings = getLeagueRankings(coefficients);
  return collectQualifiers(
    rankings,
    'shieldCupSpots',
    playerLeagueId,
    playerLeagueTable,
    playerClubs,
    (r) => r.championsCupSpots, // skip CL positions
    championsCupIds,
    conferenceCupWinnerId || null,
  );
}

/**
 * Determine which clubs qualify for the Conference Cup (third tier).
 * Takes positions below Shield Cup qualifiers.
 * Domestic cup winner earns a spot if not already qualified for higher competitions.
 */
export function getConferenceCupQualifiers(
  playerLeagueId: string,
  playerLeagueTable: LeagueTableEntry[],
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
  championsCupIds: Set<string>,
  shieldCupIds: Set<string>,
  coefficients?: Record<string, ContinentalCoefficient>,
  domesticCupWinnerId?: string | null,
): { qualifiers: string[]; virtualClubs: Record<string, VirtualClub> } {
  const rankings = getLeagueRankings(coefficients);
  const alreadyQualified = new Set([...championsCupIds, ...shieldCupIds]);
  return collectQualifiers(
    rankings,
    'conferenceCupSpots',
    playerLeagueId,
    playerLeagueTable,
    playerClubs,
    (r) => r.championsCupSpots + r.shieldCupSpots, // skip CL + Shield positions
    alreadyQualified,
    domesticCupWinnerId || null,
  );
}

/**
 * Generate a continental tournament draw with seeded groups.
 * Seeding uses a blend of multi-season coefficient and reputation.
 * Pot 1: top 8 by seeding score, Pot 2: next 8, etc.
 */
export function generateContinentalDraw(
  competition: ContinentalCompetition,
  season: number,
  qualifierIds: string[],
  virtualClubs: Record<string, VirtualClub>,
  playerClubId: string,
  coefficients?: Record<string, ContinentalCoefficient>,
): ContinentalTournamentState {
  // Sort by coefficient-blended seeding score (falls back to reputation if no coefficients)
  const coeffs = coefficients || {};
  const sorted = [...qualifierIds].sort((a, b) => {
    const repA = virtualClubs[a]?.reputation || 0;
    const repB = virtualClubs[b]?.reputation || 0;
    return getSeedingScore(b, repB, coeffs) - getSeedingScore(a, repA, coeffs);
  });

  // Fill to 32 if needed (shouldn't happen, but safety)
  while (sorted.length < CONTINENTAL_GROUPS * CONTINENTAL_TEAMS_PER_GROUP) {
    const placeholderId = `placeholder-${sorted.length}`;
    sorted.push(placeholderId);
    virtualClubs[placeholderId] = {
      id: placeholderId, name: `Qualifier ${sorted.length}`, shortName: `Q${sorted.length}`,
      color: '#666666', secondaryColor: '#999999', leagueId: 'unknown',
      reputation: 1, country: 'Unknown', countryCode: 'XX',
    };
  }

  // Create 4 pots of 8 teams each
  const pots = [
    sorted.slice(0, 8),
    sorted.slice(8, 16),
    sorted.slice(16, 24),
    sorted.slice(24, 32),
  ];

  // Shuffle within pots
  pots.forEach(pot => {
    const shuffled = shuffle([...pot]);
    pot.splice(0, pot.length, ...shuffled);
  });

  // Draw groups: one team per pot per group
  const groups: ContinentalGroup[] = [];
  let playerGroupId: string | null = null;

  for (let g = 0; g < CONTINENTAL_GROUPS; g++) {
    const groupId = String.fromCharCode(65 + g); // A-H
    const clubIds = [pots[0][g], pots[1][g], pots[2][g], pots[3][g]];

    if (clubIds.includes(playerClubId)) {
      playerGroupId = groupId;
    }

    // Generate group fixtures from template
    const matches: ContinentalGroupMatch[] = [];
    for (let md = 0; md < GROUP_FIXTURE_TEMPLATE.length; md++) {
      for (const [hi, ai] of GROUP_FIXTURE_TEMPLATE[md]) {
        matches.push({
          id: crypto.randomUUID(),
          matchday: md + 1,
          week: CONTINENTAL_GROUP_WEEKS[md],
          homeClubId: clubIds[hi],
          awayClubId: clubIds[ai],
          played: false,
          homeGoals: 0,
          awayGoals: 0,
        });
      }
    }

    // Initial standings
    const standings: ContinentalGroupStanding[] = clubIds.map(cid => ({
      clubId: cid, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    }));

    groups.push({ id: groupId, clubIds, matches, standings });
  }

  return {
    competition,
    season,
    groups,
    knockoutTies: [],
    currentPhase: 'group',
    currentRound: 'group',
    playerEliminated: !playerGroupId,
    playerGroupId,
    winnerId: null,
  };
}
