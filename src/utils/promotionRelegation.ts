/**
 * Promotion & Relegation system for Dynasty Manager.
 * Handles real movement of clubs between tiers within a country's league pyramid.
 * Bottom-tier fallback: clubs without a lower tier are replaced procedurally.
 */

import * as Sentry from '@sentry/react';

import { LeagueId, LeagueInfo, LeagueTableEntry, SeasonTurnover, Club } from '@/types/game';
import { LEAGUES, getLeaguesByCountry } from '@/data/league';
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
 * Decide one playoff tie. `homeClubId` is the better-placed side, which hosts.
 * Returns the winner's club id.
 *
 * Injected rather than imported so this module stays free of the match engine
 * (and so the existing pure tests can keep running it without squads).
 */
export type PlayoffTieResolver = (homeClubId: string, awayClubId: string) => string;

/** Fallback when no resolver is supplied: the better-placed side goes through
 *  this often. Only used by callers that have no squads to simulate with. */
export const PLAYOFF_HIGHER_SEED_WIN_CHANCE = 0.6;

/**
 * Run a promotion playoff among candidates, given in league-position order
 * (best first). Returns the winning club ID.
 *
 * Seeding is 1vN, 2v(N-1), … with the better-placed side hosting, and winners
 * are re-sorted by original seed between rounds so the bracket stays stable.
 * The previous general case paired adjacent entries — 1v2 and 3v4 — which is
 * not a bracket, and handed the BYE to the worst-placed side on an odd count.
 * The bye now goes to the top seed. (The old four-team special case was
 * correct; this generalises it.)
 *
 * Without a `resolveTie` the result is a flat coin flip that ignores squads,
 * form and home advantage entirely. Callers that can simulate — i.e. anything
 * with access to players — should pass one.
 */
export function simulatePlayoff(candidates: string[], resolveTie?: PlayoffTieResolver): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const seedOf = new Map(candidates.map((id, i) => [id, i]));
  const decide = (home: string, away: string): string =>
    resolveTie
      ? resolveTie(home, away)
      : (Math.random() < PLAYOFF_HIGHER_SEED_WIN_CHANCE ? home : away);

  let remaining = [...candidates];
  while (remaining.length > 1) {
    remaining.sort((a, b) => (seedOf.get(a) ?? 0) - (seedOf.get(b) ?? 0));
    const next: string[] = [];
    let lo = 0;
    let hi = remaining.length - 1;
    // Odd field: the top seed sits the round out rather than the bottom one.
    if (remaining.length % 2 === 1) { next.push(remaining[0]); lo = 1; }
    while (lo < hi) {
      // Better-placed side (lower seed index) is the home team.
      next.push(decide(remaining[lo], remaining[hi]));
      lo++;
      hi--;
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
  /** Optional real-match resolver for playoff ties. Omitted, ties fall back to
   *  a coin flip that ignores squads entirely — see simulatePlayoff. */
  resolveTie?: PlayoffTieResolver,
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
      const winner = simulatePlayoff(lowerZones.playoffCandidates, resolveTie);
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

    // Cap total promotions to the number of relegation slots in the upper tier
    // to prevent league size drift from config mismatches
    const allPromoted = [...promotedUp, ...playoffWinners];
    const maxPromotions = relegatedDown.length;
    const cappedPromoted = allPromoted.slice(0, maxPromotions);

    // Move promoted clubs up
    for (const clubId of cappedPromoted) {
      workingDivisionClubs[lowerLeague.id] = workingDivisionClubs[lowerLeague.id].filter(id => id !== clubId);
      workingDivisionClubs[upperLeague.id].push(clubId);
      if (workingClubs[clubId]) {
        workingClubs[clubId] = { ...workingClubs[clubId], divisionId: upperLeague.id };
      }
      if (clubId === playerClubId) playerNewDivision = upperLeague.id;
    }

    // Record turnovers — each league tracks clubs entering and leaving
    if (!turnovers[upperLeague.id]) {
      turnovers[upperLeague.id] = { leagueId: upperLeague.id, promotedClubs: [], relegatedClubs: [], playoffWinners: [], promotedOutClubs: [] };
    }
    if (!turnovers[lowerLeague.id]) {
      turnovers[lowerLeague.id] = { leagueId: lowerLeague.id, promotedClubs: [], relegatedClubs: [], playoffWinners: [], promotedOutClubs: [] };
    }

    // Upper tier turnover: who arrived (promoted from below), who left (relegated)
    turnovers[upperLeague.id].promotedClubs.push(...cappedPromoted);
    turnovers[upperLeague.id].relegatedClubs.push(...relegatedDown);

    // Lower tier turnover: who LEFT via promotion, plus playoff winners.
    // These go in `promotedOutClubs`, NOT `promotedClubs` — the latter means
    // "arrived here from below" (see the type), and pushing departures into it
    // made every middle tier's record mix the two directions. The season summary
    // then announced departing clubs as new arrivals.
    const cappedAutoPromoted = cappedPromoted.filter(id => promotedUp.includes(id));
    const cappedPlayoffWinners = cappedPromoted.filter(id => playoffWinners.includes(id));
    // BOTH routes out are departures: automatic promotion and the playoff.
    // `playoffWinners` stays as the labelled subset (the season summary calls
    // them out separately) but they also belong in `promotedOutClubs`, which is
    // the complete "left this league by going up" list. Leaving them out of it
    // was an inconsistency — a playoff winner is no less promoted than an
    // automatic one, and any consumer asking "who went up?" would have missed them.
    turnovers[lowerLeague.id].promotedOutClubs = [
      ...(turnovers[lowerLeague.id].promotedOutClubs ?? []),
      ...cappedAutoPromoted,
      ...cappedPlayoffWinners,
    ];
    turnovers[lowerLeague.id].playoffWinners.push(...cappedPlayoffWinners);

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
    for (const clubId of cappedPromoted) {
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
  let bottomTierReplacedCount = 0;
  if (bottomLeague.replacedSlots > 0) {
    const bottomTable = divisionTables[bottomLeague.id] || [];
    if (bottomTable.length > 0) {
      const bottomIds = bottomTable.map(e => e.clubId);
      // Only replace clubs that are still in the bottom tier after promotion movements
      const stillInBottomTier = new Set(workingDivisionClubs[bottomLeague.id]);
      const replacedIds = bottomIds
        .filter(id => stillInBottomTier.has(id))
        .slice(-bottomLeague.replacedSlots);

      // Don't replace the player's club
      const actuallyReplaced = replacedIds.filter(id => id !== playerClubId);
      bottomTierReplacedCount = actuallyReplaced.length;

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
  // Bottom tier with replacedSlots will be short by that many clubs until
  // orchestrationSlice generates replacement clubs after this function returns.
  const bottomTierId = tiers[tiers.length - 1]?.id;
  for (const tier of tiers) {
    const isBottom = tier.id === bottomTierId;
    const expectedAfterReplacements = tier.teamCount;
    // Use the number of clubs ACTUALLY removed (the player's club is spared
    // replacement), not the configured replacedSlots — otherwise sparing the
    // player fires a false "league size drift" warning every season.
    const pendingReplacements = isBottom ? bottomTierReplacedCount : 0;
    const expectedNow = expectedAfterReplacements - pendingReplacements;
    const actual = workingDivisionClubs[tier.id]?.length || 0;
    if (actual !== expectedNow) {
      // League-size invariant broken — replacement accounting drifted somewhere.
      // Dev surfaces it in the console; production sends a Sentry breadcrumb so
      // we can spot the drift in wild saves without bailing the season rollover.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[ProRel] League ${tier.id} has ${actual} teams, expected ${expectedNow}`);
      } else {
        Sentry.addBreadcrumb({
          category: 'promotionRelegation',
          level: 'warning',
          message: 'League size drift',
          data: { tierId: tier.id, actual, expected: expectedNow },
        });
      }
    }
  }

  return { turnovers, updatedDivisionClubs: workingDivisionClubs, updatedClubs: workingClubs, playerNewDivision };
}

// ── Legacy: apply season turnover for a single league (backward compat) ──

/** Single-league turnover for countries with no second tier (Brazil, Argentina,
 *  Saudi Arabia, South Korea, ...): the bottom clubs are replaced rather than
 *  relegated into a division that doesn't exist.
 *
 *  `playerClubId` is EXCLUDED from the relegation zone, mirroring
 *  `applyPromotionRelegation`. Without it, a player finishing in the drop zone of
 *  a single-tier league was put in `relegatedClubs` and then had every one of
 *  their players deleted by the caller's cleanup loop — you started the next
 *  season with a procedurally generated squad, no youth graduates and no
 *  chemistry. The league also drifted a club larger every time, because the
 *  caller generated one replacement per entry in `relegatedClubs` while only the
 *  other clubs had actually left. */
export function applySeasonTurnover(
  leagueId: LeagueId,
  leagueClubs: string[],
  leagueTable: LeagueTableEntry[],
  clubs: Record<string, Club>,
  playerClubId?: string,
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
  // Spare the player's club before the zone is used for ANYTHING — the turnover
  // record, the club deletion, and the caller's player-deletion and
  // replacement-generation loops all key off this list.
  const relegated = playerClubId ? zones.relegated.filter(id => id !== playerClubId) : zones.relegated;
  const turnover: SeasonTurnover = {
    leagueId,
    promotedClubs: [],
    relegatedClubs: relegated,
    playoffWinners: [],
  };

  const newClubs = { ...clubs };
  const updatedLeagueClubs = leagueClubs.filter(id => !relegated.includes(id));

  for (const cid of relegated) {
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
  // Pool must exceed the largest replacedSlots (bra = 4) so a single
  // season's replacements never duplicate names within the division.
  { name: 'Promoted FC D', shortName: 'PFD', color: '#D9A84A', secondaryColor: '#FFFFFF' },
  { name: 'Promoted FC E', shortName: 'PFE', color: '#9A4AD9', secondaryColor: '#FFFFFF' },
];

const replacementCounters: Record<string, number> = {};

export function generateReplacementClub(
  season: number,
  leagueId: LeagueId,
  existingClubNames?: Iterable<string>,
): { clubData: ClubData; clubId: string } {
  // For bottom-tier leagues, use the countryId to find the pool
  const league = LEAGUES.find(l => l.id === leagueId);
  const poolKey = league?.countryId || leagueId;
  const fullPool = REPLACEMENT_POOLS[poolKey] || DEFAULT_REPLACEMENTS;
  // Skip names already used by a live club — the small pools cycle via a
  // module-level counter (which also resets on app restart), so without this
  // filter a season-1 replacement still in the division gets duplicated
  // within a couple of seasons. Falls back to the full pool if every name is
  // somehow taken.
  const taken = new Set<string>();
  for (const name of existingClubNames || []) taken.add(name.toLowerCase());
  const availablePool = fullPool.filter(t => !taken.has(t.name.toLowerCase()));
  const pool = availablePool.length > 0 ? availablePool : fullPool;
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
