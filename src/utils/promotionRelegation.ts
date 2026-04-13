/**
 * Promotion & Relegation system for Dynasty Manager.
 * Handles real movement of clubs between tiers within a country's league pyramid.
 * Bottom-tier fallback: clubs without a lower tier are replaced procedurally.
 */

import { LeagueId, LeagueInfo, LeagueTableEntry, SeasonTurnover, Club } from '@/types/game';
import { LEAGUES, getLeaguesByCountry, getLeagueBelow, getLeagueAbove } from '@/data/league';
import type { ClubData } from '@/types/game';

// ── Determine promotion/relegation zones from final table ──

export interface ProRelZones {
  promoted: string[];          // Auto-promoted clubs (top N)
  playoffCandidates: string[]; // Clubs entering promotion playoffs
  safe: string[];              // Mid-table clubs staying in this tier
  relegated: string[];         // Auto-relegated clubs (bottom N)
}

/**
 * Determine promotion and relegation zones from final standings.
 */
export function determineProRelZones(table: LeagueTableEntry[], league: LeagueInfo): ProRelZones {
  const ids = table.map(e => e.clubId);
  const n = ids.length;
  const { promotionSpots, playoffSpots, relegationSpots } = league;

  const promoted = ids.slice(0, promotionSpots);
  const playoffCandidates = ids.slice(promotionSpots, promotionSpots + playoffSpots);
  const relegated = relegationSpots > 0 ? ids.slice(n - relegationSpots) : [];
  const safeStart = promotionSpots + playoffSpots;
  const safeEnd = relegationSpots > 0 ? n - relegationSpots : n;
  const safe = ids.slice(safeStart, safeEnd);

  return { promoted, playoffCandidates, safe, relegated };
}

/** @deprecated Backward-compatible wrapper — use determineProRelZones instead */
export function determineZones(table: LeagueTableEntry[], league: LeagueInfo) {
  const zones = determineProRelZones(table, league);
  return {
    safe: [...zones.promoted, ...zones.playoffCandidates, ...zones.safe],
    replaced: zones.relegated,
  };
}

// ── Run a simple playoff tournament (best 2 of the playoff candidates) ──

/**
 * Simulate a promotion playoff among candidates.
 * Returns the winning club ID (promoted via playoffs).
 */
export function simulatePlayoff(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Simple bracket: 3rd vs 6th, 4th vs 5th, then winners play final
  // Higher-placed team wins 60% of the time
  const matchup = (a: string, b: string) => Math.random() < 0.6 ? a : b;

  if (candidates.length === 2) {
    return matchup(candidates[0], candidates[1]);
  }
  if (candidates.length === 4) {
    // Semi-finals: 3rd vs 6th, 4th vs 5th
    const sf1 = matchup(candidates[0], candidates[3]);
    const sf2 = matchup(candidates[1], candidates[2]);
    return matchup(sf1, sf2);
  }

  // General case: bracket tournament
  let remaining = [...candidates];
  while (remaining.length > 1) {
    const next = [];
    for (let i = 0; i < remaining.length - 1; i += 2) {
      next.push(matchup(remaining[i], remaining[i + 1]));
    }
    if (remaining.length % 2 === 1) {
      next.push(remaining[remaining.length - 1]);
    }
    remaining = next;
  }
  return remaining[0];
}

// ── Apply promotion/relegation across a country's league pyramid ──

/**
 * Apply promotion and relegation for ALL tiers in a country.
 * Returns updated division club assignments and turnovers per league.
 */
export function applyPromotionRelegation(
  countryId: string,
  divisionClubs: Record<string, string[]>,
  divisionTables: Record<string, LeagueTableEntry[]>,
  clubs: Record<string, Club>,
  playerClubId: string,
): {
  turnovers: Record<string, SeasonTurnover>;
  updatedDivisionClubs: Record<string, string[]>;
  updatedClubs: Record<string, Club>;
  playerNewDivision: string | null; // non-null if player's division changed
} {
  const tiers = getLeaguesByCountry(countryId);
  if (tiers.length === 0) {
    return { turnovers: {}, updatedDivisionClubs: divisionClubs, updatedClubs: clubs, playerNewDivision: null };
  }

  const workingClubs = { ...clubs };
  const workingDivisionClubs: Record<string, string[]> = {};
  for (const tier of tiers) {
    workingDivisionClubs[tier.id] = [...(divisionClubs[tier.id] || [])];
  }

  const turnovers: Record<string, SeasonTurnover> = {};
  let playerNewDivision: string | null = null;

  // Process each adjacent tier pair (top-down)
  for (let i = 0; i < tiers.length - 1; i++) {
    const upperLeague = tiers[i];
    const lowerLeague = tiers[i + 1];
    const upperTable = divisionTables[upperLeague.id] || [];
    const lowerTable = divisionTables[lowerLeague.id] || [];

    if (upperTable.length === 0 || lowerTable.length === 0) continue;

    const upperZones = determineProRelZones(upperTable, upperLeague);
    const lowerZones = determineProRelZones(lowerTable, lowerLeague);

    // Clubs relegated from upper tier (player's club CAN be relegated)
    const relegatedDown = upperZones.relegated;
    // Clubs promoted from lower tier (player's club CAN be promoted)
    const promotedUp = lowerZones.promoted;

    // Run playoffs for lower tier if configured
    const playoffWinners: string[] = [];
    if (lowerLeague.playoffSpots > 0 && lowerZones.playoffCandidates.length > 0) {
      const winner = simulatePlayoff(lowerZones.playoffCandidates);
      if (winner) playoffWinners.push(winner);
    }

    // Move relegated clubs down
    for (const clubId of relegatedDown) {
      workingDivisionClubs[upperLeague.id] = workingDivisionClubs[upperLeague.id].filter(id => id !== clubId);
      workingDivisionClubs[lowerLeague.id].push(clubId);
      if (workingClubs[clubId]) {
        workingClubs[clubId] = { ...workingClubs[clubId], divisionId: lowerLeague.id };
      }
      if (clubId === playerClubId) playerNewDivision = lowerLeague.id;
    }

    // Move promoted clubs up
    for (const clubId of [...promotedUp, ...playoffWinners]) {
      workingDivisionClubs[lowerLeague.id] = workingDivisionClubs[lowerLeague.id].filter(id => id !== clubId);
      workingDivisionClubs[upperLeague.id].push(clubId);
      if (workingClubs[clubId]) {
        workingClubs[clubId] = { ...workingClubs[clubId], divisionId: upperLeague.id };
      }
      if (clubId === playerClubId) playerNewDivision = upperLeague.id;
    }

    // Record turnovers — each league tracks clubs entering and leaving
    if (!turnovers[upperLeague.id]) {
      turnovers[upperLeague.id] = { leagueId: upperLeague.id, promotedClubs: [], relegatedClubs: [], playoffWinners: [] };
    }
    if (!turnovers[lowerLeague.id]) {
      turnovers[lowerLeague.id] = { leagueId: lowerLeague.id, promotedClubs: [], relegatedClubs: [], playoffWinners: [] };
    }

    // Upper tier turnover: who arrived (promoted from below), who left (relegated)
    turnovers[upperLeague.id].promotedClubs.push(...promotedUp, ...playoffWinners);
    turnovers[upperLeague.id].relegatedClubs.push(...relegatedDown);

    // Lower tier turnover: who left via promotion, playoff winners
    turnovers[lowerLeague.id].promotedClubs.push(...promotedUp);
    turnovers[lowerLeague.id].playoffWinners.push(...playoffWinners);

    // Adjust budgets and reputation for moved clubs
    const upperLeagueInfo = LEAGUES.find(l => l.id === upperLeague.id);
    const lowerLeagueInfo = LEAGUES.find(l => l.id === lowerLeague.id);
    for (const clubId of relegatedDown) {
      if (workingClubs[clubId] && lowerLeagueInfo) {
        // Relegated: lose ~30% budget, lose 1 reputation
        workingClubs[clubId] = {
          ...workingClubs[clubId],
          budget: Math.round(workingClubs[clubId].budget * 0.7),
          reputation: Math.max(1, workingClubs[clubId].reputation - 1),
        };
      }
    }
    for (const clubId of [...promotedUp, ...playoffWinners]) {
      if (workingClubs[clubId] && upperLeagueInfo) {
        // Promoted: gain ~40% budget, gain 1 reputation
        workingClubs[clubId] = {
          ...workingClubs[clubId],
          budget: Math.round(workingClubs[clubId].budget * 1.4),
          reputation: Math.min(5, workingClubs[clubId].reputation + 1),
        };
      }
    }
  }

  // Handle bottom-tier replacement (clubs relegated from the bottom tier with no lower tier)
  const bottomLeague = tiers[tiers.length - 1];
  if (bottomLeague.replacedSlots > 0) {
    const bottomTable = divisionTables[bottomLeague.id] || [];
    if (bottomTable.length > 0) {
      const bottomIds = bottomTable.map(e => e.clubId);
      const replacedIds = bottomIds.slice(bottomIds.length - bottomLeague.replacedSlots);

      // Don't replace the player's club
      const actuallyReplaced = replacedIds.filter(id => id !== playerClubId);

      for (const cid of actuallyReplaced) {
        workingDivisionClubs[bottomLeague.id] = workingDivisionClubs[bottomLeague.id].filter(id => id !== cid);
        delete workingClubs[cid];
      }

      if (!turnovers[bottomLeague.id]) {
        turnovers[bottomLeague.id] = { leagueId: bottomLeague.id, promotedClubs: [], relegatedClubs: [], playoffWinners: [] };
      }
      turnovers[bottomLeague.id].relegatedClubs.push(...actuallyReplaced);
    }
  }

  // Verify league balance — each league should maintain its teamCount
  for (const tier of tiers) {
    const expected = tier.teamCount;
    const actual = workingDivisionClubs[tier.id]?.length || 0;
    if (actual !== expected && process.env.NODE_ENV !== 'production') {
      console.warn(`[ProRel] League ${tier.id} has ${actual} teams, expected ${expected}`);
    }
  }

  return { turnovers, updatedDivisionClubs: workingDivisionClubs, updatedClubs: workingClubs, playerNewDivision };
}

// ── Legacy: apply season turnover for a single league (backward compat) ──

export function applySeasonTurnover(
  leagueId: LeagueId,
  leagueClubs: string[],
  leagueTable: LeagueTableEntry[],
  clubs: Record<string, Club>,
): { turnover: SeasonTurnover; updatedClubs: Record<string, Club>; updatedLeagueClubs: string[] } {
  const league = LEAGUES.find(l => l.id === leagueId);
  if (!league) {
    return {
      turnover: { leagueId, promotedClubs: [], relegatedClubs: [], playoffWinners: [] },
      updatedClubs: clubs,
      updatedLeagueClubs: leagueClubs,
    };
  }

  const zones = determineProRelZones(leagueTable, league);
  const turnover: SeasonTurnover = {
    leagueId,
    promotedClubs: [],
    relegatedClubs: zones.relegated,
    playoffWinners: [],
  };

  const newClubs = { ...clubs };
  const updatedLeagueClubs = leagueClubs.filter(id => !zones.relegated.includes(id));

  for (const cid of zones.relegated) {
    delete newClubs[cid];
  }

  return { turnover, updatedClubs: newClubs, updatedLeagueClubs };
}

// ── Generate replacement clubs (bottom-tier fallback) ──

/** Replacement pools — only non-league clubs not in any game division */
const REPLACEMENT_POOLS: Record<string, { name: string; shortName: string; color: string; secondaryColor: string }[]> = {
  eng: [
    { name: 'Oldham Athletic', shortName: 'OLD', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Scunthorpe Utd', shortName: 'SCU', color: '#8B0000', secondaryColor: '#FFFFFF' },
    { name: 'Southend United', shortName: 'SOU', color: '#003DA5', secondaryColor: '#FFD700' },
    { name: 'Macclesfield Town', shortName: 'MAC', color: '#003DA5', secondaryColor: '#FFFFFF' },
  ],
  ger: [
    { name: 'Rot-Weiss Essen', shortName: 'RWE', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Wehen Wiesbaden', shortName: 'WEH', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'VfB Lübeck', shortName: 'LUB', color: '#008C45', secondaryColor: '#FFFFFF' },
  ],
  esp: [
    { name: 'Ponferradina', shortName: 'PON', color: '#003DA5', secondaryColor: '#FFFFFF' },
    { name: 'Numancia', shortName: 'NUM', color: '#E30613', secondaryColor: '#FFFFFF' },
    { name: 'Lugo', shortName: 'LUG', color: '#003DA5', secondaryColor: '#FFFFFF' },
  ],
  ita: [
    { name: 'Ternana', shortName: 'TER', color: '#E30613', secondaryColor: '#008C45' },
    { name: 'Ascoli', shortName: 'ASC', color: '#000000', secondaryColor: '#FFFFFF' },
    { name: 'Avellino', shortName: 'AVE', color: '#008C45', secondaryColor: '#FFFFFF' },
  ],
  fra: [
    { name: 'Châteauroux', shortName: 'CHA', color: '#003DA5', secondaryColor: '#E30613' },
    { name: 'Niort', shortName: 'NIO', color: '#008C45', secondaryColor: '#FFFFFF' },
    { name: 'Sochaux', shortName: 'SOC', color: '#FFD700', secondaryColor: '#003DA5' },
  ],
};

const DEFAULT_REPLACEMENTS = [
  { name: 'Promoted FC A', shortName: 'PFA', color: '#4A90D9', secondaryColor: '#FFFFFF' },
  { name: 'Promoted FC B', shortName: 'PFB', color: '#D94A4A', secondaryColor: '#FFFFFF' },
  { name: 'Promoted FC C', shortName: 'PFC', color: '#4AD94A', secondaryColor: '#FFFFFF' },
];

const replacementCounters: Record<string, number> = {};

export function generateReplacementClub(season: number, leagueId: LeagueId): { clubData: ClubData; clubId: string } {
  // For bottom-tier leagues, use the countryId to find the pool
  const league = LEAGUES.find(l => l.id === leagueId);
  const poolKey = league?.countryId || leagueId;
  const pool = REPLACEMENT_POOLS[poolKey] || DEFAULT_REPLACEMENTS;
  if (!replacementCounters[leagueId]) replacementCounters[leagueId] = 0;
  const idx = replacementCounters[leagueId] % pool.length;
  replacementCounters[leagueId]++;

  const template = pool[idx];

  const id = `replaced-${leagueId}-${season}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
  const tierFloor = league?.qualityTier === 1 ? 58 : league?.qualityTier === 2 ? 48 : league?.qualityTier === 3 ? 40 : 33;
  const baseQuality = tierFloor + Math.floor(Math.random() * 8) - 2;

  const clubData: ClubData = {
    id,
    name: template.name,
    shortName: template.shortName,
    color: template.color,
    secondaryColor: template.secondaryColor,
    budget: Math.floor((league?.prizeMoney || 300_000) * (0.8 + Math.random() * 0.4)),
    reputation: 2,
    facilities: 3 + Math.floor(Math.random() * 2),
    youthRating: 3 + Math.floor(Math.random() * 2),
    fanBase: 15 + Math.floor(Math.random() * 20),
    boardPatience: 8,
    squadQuality: baseQuality + Math.floor(Math.random() * 6),
    league: leagueId,
    divisionId: leagueId,
    stadiumName: `${template.name} Stadium`,
    stadiumCapacity: 8000 + Math.floor(Math.random() * 15000),
  };

  return { clubData, clubId: id };
}
