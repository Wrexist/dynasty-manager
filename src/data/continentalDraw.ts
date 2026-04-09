/**
 * Continental tournament draw generation.
 * Creates virtual clubs from league data and generates group-stage draws.
 */
import type { VirtualClub, ContinentalGroup, ContinentalGroupMatch, ContinentalGroupStanding, ContinentalTournamentState, ContinentalCompetition, LeagueTableEntry } from '@/types/game';
import { ALL_LEAGUES, CLUBS_BY_LEAGUE, ALL_CLUBS_DATA } from './leagues';
import {
  CHAMPIONS_CUP_SPOTS, CHAMPIONS_CUP_TIER3_MAX, CHAMPIONS_CUP_GROUPS, CHAMPIONS_CUP_TEAMS_PER_GROUP,
  SHIELD_CUP_SPOTS, SHIELD_CUP_TIER3_MAX, SHIELD_CUP_TIER4_MAX, SHIELD_CUP_TOTAL_TEAMS,
  CONTINENTAL_GROUP_WEEKS, GROUP_FIXTURE_TEMPLATE,
} from '@/config/continental';
import { shuffle } from '@/utils/helpers';

/**
 * Build virtual clubs from a league's club data, sorted by reputation (highest first).
 * For the player's league, we use real club IDs; for other leagues, we use the data as-is.
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
 * Determine which clubs qualify for the Champions Cup.
 * For the player's league, use actual league table positions.
 * For other leagues, pick top N clubs by reputation from static data.
 */
export function getChampionsCupQualifiers(
  playerLeagueId: string,
  playerLeagueTable: LeagueTableEntry[],
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
): { qualifiers: string[]; virtualClubs: Record<string, VirtualClub> } {
  const qualifiers: string[] = [];
  const virtualClubs: Record<string, VirtualClub> = {};

  const tier3Leagues = ALL_LEAGUES.filter(l => l.qualityTier === 3);
  // Sort tier 3 leagues by average club reputation to determine top 4
  const tier3Sorted = tier3Leagues
    .map(l => ({ league: l, avgRep: (CLUBS_BY_LEAGUE[l.id] || []).reduce((s, c) => s + c.reputation, 0) / (CLUBS_BY_LEAGUE[l.id]?.length || 1) }))
    .sort((a, b) => b.avgRep - a.avgRep);
  const topTier3Ids = new Set(tier3Sorted.slice(0, CHAMPIONS_CUP_TIER3_MAX).map(t => t.league.id));

  for (const league of ALL_LEAGUES) {
    const spots = CHAMPIONS_CUP_SPOTS[league.qualityTier] || 0;
    if (spots === 0) continue;
    // Tier 3 leagues: only top N get a spot
    if (league.qualityTier === 3 && !topTier3Ids.has(league.id)) continue;

    if (league.id === playerLeagueId) {
      // Use actual league table positions
      const topClubs = playerLeagueTable.slice(0, spots);
      for (const entry of topClubs) {
        qualifiers.push(entry.clubId);
        const c = playerClubs[entry.clubId];
        if (c) {
          const clubData = ALL_CLUBS_DATA.find(cd => cd.id === entry.clubId);
          virtualClubs[entry.clubId] = {
            id: entry.clubId,
            name: c.name,
            shortName: c.shortName,
            color: c.color,
            secondaryColor: clubData?.secondaryColor || c.color,
            leagueId: playerLeagueId,
            reputation: c.reputation,
            country: league.country,
            countryCode: league.countryCode,
          };
        }
      }
    } else {
      // Use static data — top clubs by reputation
      const vClubs = buildVirtualClubsForLeague(league.id);
      for (let i = 0; i < Math.min(spots, vClubs.length); i++) {
        qualifiers.push(vClubs[i].id);
        virtualClubs[vClubs[i].id] = vClubs[i];
      }
    }
  }

  return { qualifiers, virtualClubs };
}

/**
 * Determine which clubs qualify for the Shield Cup.
 * Takes positions just below Champions Cup qualifiers + domestic cup winners.
 */
export function getShieldCupQualifiers(
  playerLeagueId: string,
  playerLeagueTable: LeagueTableEntry[],
  playerClubs: Record<string, { name: string; shortName: string; color: string; reputation: number }>,
  championsCupIds: Set<string>,
  domesticCupWinnerId: string | null,
): { qualifiers: string[]; virtualClubs: Record<string, VirtualClub> } {
  const qualifiers: string[] = [];
  const virtualClubs: Record<string, VirtualClub> = {};

  const tier3Leagues = ALL_LEAGUES.filter(l => l.qualityTier === 3);
  const tier3Sorted = tier3Leagues
    .map(l => ({ league: l, avgRep: (CLUBS_BY_LEAGUE[l.id] || []).reduce((s, c) => s + c.reputation, 0) / (CLUBS_BY_LEAGUE[l.id]?.length || 1) }))
    .sort((a, b) => b.avgRep - a.avgRep);
  // Tier 3 leagues NOT in Champions Cup get Shield spots
  const champTier3Ids = new Set(tier3Sorted.slice(0, CHAMPIONS_CUP_TIER3_MAX).map(t => t.league.id));
  const shieldTier3 = tier3Sorted.filter(t => !champTier3Ids.has(t.league.id)).slice(0, SHIELD_CUP_TIER3_MAX);
  const shieldTier3Ids = new Set(shieldTier3.map(t => t.league.id));

  const tier4Leagues = ALL_LEAGUES.filter(l => l.qualityTier === 4);
  const tier4Sorted = tier4Leagues
    .map(l => ({ league: l, avgRep: (CLUBS_BY_LEAGUE[l.id] || []).reduce((s, c) => s + c.reputation, 0) / (CLUBS_BY_LEAGUE[l.id]?.length || 1) }))
    .sort((a, b) => b.avgRep - a.avgRep);
  const shieldTier4Ids = new Set(tier4Sorted.slice(0, SHIELD_CUP_TIER4_MAX).map(t => t.league.id));

  for (const league of ALL_LEAGUES) {
    const spots = SHIELD_CUP_SPOTS[league.qualityTier] || 0;
    if (spots === 0) continue;
    if (league.qualityTier === 3 && !shieldTier3Ids.has(league.id)) continue;
    if (league.qualityTier === 4 && !shieldTier4Ids.has(league.id)) continue;

    if (league.id === playerLeagueId) {
      // Get next N positions after Champions Cup qualifiers
      const champSpots = CHAMPIONS_CUP_SPOTS[league.qualityTier] || 0;
      const startPos = champSpots;
      const candidates = playerLeagueTable.slice(startPos, startPos + spots);
      for (const entry of candidates) {
        if (championsCupIds.has(entry.clubId)) continue;
        qualifiers.push(entry.clubId);
        const c = playerClubs[entry.clubId];
        if (c) {
          const clubData = ALL_CLUBS_DATA.find(cd => cd.id === entry.clubId);
          virtualClubs[entry.clubId] = {
            id: entry.clubId, name: c.name, shortName: c.shortName,
            color: c.color, secondaryColor: clubData?.secondaryColor || c.color,
            leagueId: playerLeagueId, reputation: c.reputation,
            country: league.country, countryCode: league.countryCode,
          };
        }
      }
      // Also add domestic cup winner if not already qualified
      if (domesticCupWinnerId && !championsCupIds.has(domesticCupWinnerId) && !qualifiers.includes(domesticCupWinnerId)) {
        qualifiers.push(domesticCupWinnerId);
        const c = playerClubs[domesticCupWinnerId];
        if (c) {
          const clubData = ALL_CLUBS_DATA.find(cd => cd.id === domesticCupWinnerId);
          virtualClubs[domesticCupWinnerId] = {
            id: domesticCupWinnerId, name: c.name, shortName: c.shortName,
            color: c.color, secondaryColor: clubData?.secondaryColor || c.color,
            leagueId: playerLeagueId, reputation: c.reputation,
            country: league.country, countryCode: league.countryCode,
          };
        }
      }
    } else {
      const vClubs = buildVirtualClubsForLeague(league.id);
      // Take clubs after champions qualifiers
      const available = vClubs.filter(vc => !championsCupIds.has(vc.id));
      for (let i = 0; i < Math.min(spots, available.length); i++) {
        qualifiers.push(available[i].id);
        virtualClubs[available[i].id] = available[i];
      }
    }
  }

  // Cap at total teams
  while (qualifiers.length > SHIELD_CUP_TOTAL_TEAMS) qualifiers.pop();

  return { qualifiers, virtualClubs };
}

/**
 * Generate a continental tournament draw with seeded groups.
 * Pot 1: top 8 by reputation, Pot 2: next 8, etc.
 */
export function generateContinentalDraw(
  competition: ContinentalCompetition,
  season: number,
  qualifierIds: string[],
  virtualClubs: Record<string, VirtualClub>,
  playerClubId: string,
): ContinentalTournamentState {
  // Sort by reputation for seeding
  const sorted = [...qualifierIds].sort((a, b) => {
    const repA = virtualClubs[a]?.reputation || 0;
    const repB = virtualClubs[b]?.reputation || 0;
    return repB - repA;
  });

  // Fill to 32 if needed (shouldn't happen, but safety)
  while (sorted.length < CHAMPIONS_CUP_GROUPS * CHAMPIONS_CUP_TEAMS_PER_GROUP) {
    // Generate a placeholder - use a remaining club from data
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

  for (let g = 0; g < CHAMPIONS_CUP_GROUPS; g++) {
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
