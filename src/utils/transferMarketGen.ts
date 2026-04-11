/**
 * Transfer Market Generation
 *
 * Generates realistic transfer-listed players and free agents for all divisions.
 * Called at game init to populate the market and weekly to replenish it.
 */

import type { Player, TransferListing, Position } from '@/types/game';
import { generatePlayer } from '@/utils/playerGen';
import { calculatePlayerValue, calculatePlayerWage } from '@/config/playerGeneration';
import {
  DIVISION_QUALITY_RANGES, DIVISION_MARKET_WEIGHTS,
  MARKET_AGE_BUCKETS, AGE_PRICE_MULTIPLIER,
  INITIAL_MARKET_GEN_MIN, INITIAL_MARKET_GEN_RANGE,
  INITIAL_FREE_AGENTS_MIN, INITIAL_FREE_AGENTS_RANGE,
  FREE_AGENT_QUALITY_MIN, FREE_AGENT_QUALITY_MAX,
  MARKET_REPLENISH_BATCH_MIN, MARKET_REPLENISH_BATCH_RANGE,
  FREE_AGENT_SPAWN_MIN, FREE_AGENT_SPAWN_RANGE,
  PRE_SEASON_EXTRA_MARKET_MIN, PRE_SEASON_EXTRA_MARKET_RANGE,
  PRE_SEASON_QUALITY_BOOST, PRE_SEASON_DIVISION_WEIGHTS,
  PRE_SEASON_REPLENISH_BATCH_MIN, PRE_SEASON_REPLENISH_BATCH_RANGE,
} from '@/config/transfers';

// Position distribution weights (mirrors realistic squad composition)
const POSITION_WEIGHTS: { pos: Position; weight: number }[] = [
  { pos: 'GK', weight: 0.06 },
  { pos: 'CB', weight: 0.14 },
  { pos: 'LB', weight: 0.06 },
  { pos: 'RB', weight: 0.06 },
  { pos: 'CDM', weight: 0.06 },
  { pos: 'CM', weight: 0.14 },
  { pos: 'CAM', weight: 0.06 },
  { pos: 'LM', weight: 0.04 },
  { pos: 'RM', weight: 0.04 },
  { pos: 'LW', weight: 0.10 },
  { pos: 'RW', weight: 0.10 },
  { pos: 'ST', weight: 0.14 },
];

function pickWeightedPosition(): Position {
  const total = POSITION_WEIGHTS.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const pw of POSITION_WEIGHTS) {
    r -= pw.weight;
    if (r <= 0) return pw.pos;
  }
  return 'CM';
}

function pickWeightedAge(): number {
  const total = MARKET_AGE_BUCKETS.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  for (const bucket of MARKET_AGE_BUCKETS) {
    r -= bucket.weight;
    if (r <= 0) return bucket.min + Math.floor(Math.random() * (bucket.max - bucket.min + 1));
  }
  return 25;
}

/** Generic weighted random selection from a Record<string, number> */
function pickWeightedFromRecord(weights: Record<string, number>, fallback: string): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return fallback;
}

/** Get the age-based price multiplier with interpolation for missing ages */
function getAgePriceMultiplier(age: number): number {
  const key = String(Math.min(36, Math.max(17, age)));
  return AGE_PRICE_MULTIPLIER[key] ?? 1.0;
}

/**
 * Generate a single external (unattached) player for the transfer market.
 * @param qualityBoost — raise the minimum quality floor (pre-season gets better players)
 */
function generateMarketPlayer(
  season: number,
  divisionId: string,
  qualityBoost: number = 0,
): { player: Player; listing: TransferListing } {
  const range = DIVISION_QUALITY_RANGES[divisionId] || DIVISION_QUALITY_RANGES['div-3'];
  const effectiveMin = qualityBoost > 0
    ? Math.min(range.min + qualityBoost, range.max)
    : range.min;
  const quality = effectiveMin + Math.floor(Math.random() * (range.max - effectiveMin + 1));
  const position = pickWeightedPosition();
  const age = pickWeightedAge();

  const player = generatePlayer(position, quality, '', season, divisionId);
  player.age = age;

  // Recalculate value/wage with age — younger players worth more, vets less
  const baseValue = calculatePlayerValue(player.overall);
  const ageMultiplier = getAgePriceMultiplier(age);
  player.value = Math.round(baseValue * ageMultiplier);
  player.wage = calculatePlayerWage(player.overall);

  // Adjust potential based on age
  if (age <= 22) {
    player.potential = Math.min(99, player.overall + 5 + Math.floor(Math.random() * 12));
  } else if (age <= 26) {
    player.potential = Math.min(99, player.overall + Math.floor(Math.random() * 6));
  } else {
    player.potential = player.overall + Math.floor(Math.random() * 2);
  }

  // Contract: external players have short contracts (buyer inherits)
  player.contractEnd = season + 1 + Math.floor(Math.random() * 3);

  // Asking price: value * markup with some variance
  const markup = 1.1 + Math.random() * 0.4; // 1.1x to 1.5x value
  const askingPrice = Math.max(50_000, Math.round(player.value * markup));

  const listing: TransferListing = {
    playerId: player.id,
    askingPrice,
    sellerClubId: '', // external — no selling club
    externalPlayer: true,
    divisionId,
  };

  return { player, listing };
}

/** Generate a free agent player */
function generateFreeAgentPlayer(season: number): Player {
  const quality = FREE_AGENT_QUALITY_MIN + Math.floor(Math.random() * (FREE_AGENT_QUALITY_MAX - FREE_AGENT_QUALITY_MIN + 1));
  const position = pickWeightedPosition();
  const age = pickWeightedAge();

  // Free agents skew slightly older
  const adjustedAge = Math.min(36, age + Math.floor(Math.random() * 3));

  const player = generatePlayer(position, quality, '', season);
  player.age = adjustedAge;
  player.clubId = '';
  player.listedForSale = false;

  // Free agents accept lower wages
  player.wage = Math.round(calculatePlayerWage(player.overall) * (0.6 + Math.random() * 0.3));
  player.value = Math.round(calculatePlayerValue(player.overall) * getAgePriceMultiplier(adjustedAge));

  // Adjust potential based on age
  if (adjustedAge <= 22) {
    player.potential = Math.min(99, player.overall + 5 + Math.floor(Math.random() * 10));
  } else if (adjustedAge <= 26) {
    player.potential = Math.min(99, player.overall + Math.floor(Math.random() * 5));
  } else {
    player.potential = player.overall;
  }

  // No contract
  player.contractEnd = season;

  return player;
}

// ── Shared batch generation ──

/**
 * Generate a batch of market players with configurable size, division weights, and quality.
 * All public market-generation functions delegate to this.
 */
function generateMarketBatch(
  season: number,
  week: number,
  batchMin: number,
  batchRange: number,
  divisionWeights: Record<string, number>,
  qualityBoost: number = 0,
): { players: Record<string, Player>; listings: TransferListing[] } {
  const count = batchMin + Math.floor(Math.random() * batchRange);
  const players: Record<string, Player> = {};
  const listings: TransferListing[] = [];

  for (let i = 0; i < count; i++) {
    const divisionId = pickWeightedFromRecord(divisionWeights, 'div-3');
    const { player, listing } = generateMarketPlayer(season, divisionId, qualityBoost);
    listing.listedWeek = week;
    listing.listedSeason = season;
    players[player.id] = player;
    listings.push(listing);
  }

  return { players, listings };
}

// ── Public API ──

/**
 * Generate initial transfer market population at game start.
 * Returns new players to add to the players record and transfer listings.
 */
export function generateInitialMarket(
  season: number,
  week: number,
): { players: Record<string, Player>; listings: TransferListing[] } {
  return generateMarketBatch(season, week, INITIAL_MARKET_GEN_MIN, INITIAL_MARKET_GEN_RANGE, DIVISION_MARKET_WEIGHTS);
}

/**
 * Generate initial free agent pool at game start.
 */
export function generateInitialFreeAgents(
  season: number,
): { players: Record<string, Player>; freeAgentIds: string[] } {
  const count = INITIAL_FREE_AGENTS_MIN + Math.floor(Math.random() * INITIAL_FREE_AGENTS_RANGE);
  const players: Record<string, Player> = {};
  const freeAgentIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const player = generateFreeAgentPlayer(season);
    players[player.id] = player;
    freeAgentIds.push(player.id);
  }

  return { players, freeAgentIds };
}

/**
 * Replenish the transfer market when it gets thin.
 * Called weekly from advanceWeek.
 */
export function replenishMarket(
  season: number,
  week: number,
): { players: Record<string, Player>; listings: TransferListing[] } {
  return generateMarketBatch(season, week, MARKET_REPLENISH_BATCH_MIN, MARKET_REPLENISH_BATCH_RANGE, DIVISION_MARKET_WEIGHTS);
}

/**
 * Generate extra higher-quality players for the pre-season transfer market.
 * Called at season start alongside generateInitialMarket to flood the market
 * with better talent during the friendlies period.
 */
export function generatePreSeasonMarket(
  season: number,
  week: number,
): { players: Record<string, Player>; listings: TransferListing[] } {
  return generateMarketBatch(season, week, PRE_SEASON_EXTRA_MARKET_MIN, PRE_SEASON_EXTRA_MARKET_RANGE, PRE_SEASON_DIVISION_WEIGHTS, PRE_SEASON_QUALITY_BOOST);
}

/**
 * Replenish the transfer market during pre-season with larger batches and higher quality.
 */
export function replenishMarketPreSeason(
  season: number,
  week: number,
): { players: Record<string, Player>; listings: TransferListing[] } {
  return generateMarketBatch(season, week, PRE_SEASON_REPLENISH_BATCH_MIN, PRE_SEASON_REPLENISH_BATCH_RANGE, PRE_SEASON_DIVISION_WEIGHTS, PRE_SEASON_QUALITY_BOOST);
}

/**
 * Spawn new free agents to keep the pool fresh.
 */
export function spawnFreeAgents(
  season: number,
): { players: Record<string, Player>; freeAgentIds: string[] } {
  const count = FREE_AGENT_SPAWN_MIN + Math.floor(Math.random() * FREE_AGENT_SPAWN_RANGE);
  const players: Record<string, Player> = {};
  const freeAgentIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const player = generateFreeAgentPlayer(season);
    players[player.id] = player;
    freeAgentIds.push(player.id);
  }

  return { players, freeAgentIds };
}

/**
 * Process listing expiry — remove stale listings and optionally relist at discount.
 * Returns updated market, expired external player IDs for cleanup, and expired
 * club player IDs so their listedForSale flag can be reset.
 */
export function processListingExpiry(
  transferMarket: TransferListing[],
  currentWeek: number,
  currentSeason: number,
  totalWeeks: number,
  expiryWeeks: number,
  relistChance: number,
  relistDiscount: number,
  clubExpiryWeeks: number,
): { market: TransferListing[]; expiredPlayerIds: string[]; expiredClubPlayerIds: string[] } {
  const expiredPlayerIds: string[] = [];
  const expiredClubPlayerIds: string[] = [];
  const market = transferMarket.reduce<TransferListing[]>((acc, listing) => {
    // Listings without listedWeek can't be age-checked — keep them
    if (!listing.listedWeek) {
      acc.push(listing);
      return acc;
    }

    // Season-aware elapsed week calculation
    const seasonDiff = currentSeason - (listing.listedSeason || currentSeason);
    const weeksListed = seasonDiff * totalWeeks + (currentWeek - (listing.listedWeek || currentWeek));

    const isExternal = !!listing.externalPlayer;
    const maxWeeks = isExternal ? expiryWeeks : clubExpiryWeeks;

    if (weeksListed < maxWeeks) {
      acc.push(listing);
      return acc;
    }

    // Expired — external players may relist at discount, club players are simply withdrawn
    if (isExternal) {
      if (Math.random() < relistChance) {
        acc.push({
          ...listing,
          askingPrice: Math.max(25_000, Math.round(listing.askingPrice * (1 - relistDiscount))),
          listedWeek: currentWeek,
          listedSeason: currentSeason,
        });
      } else {
        expiredPlayerIds.push(listing.playerId);
      }
    } else {
      // Club listing expired — player withdrawn from market
      expiredClubPlayerIds.push(listing.playerId);
    }
    return acc;
  }, []);
  return { market, expiredPlayerIds, expiredClubPlayerIds };
}
