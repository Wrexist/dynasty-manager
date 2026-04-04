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

function pickWeightedDivision(): string {
  const entries = Object.entries(DIVISION_MARKET_WEIGHTS);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [div, weight] of entries) {
    r -= weight;
    if (r <= 0) return div;
  }
  return 'div-3';
}

/** Get the age-based price multiplier with interpolation for missing ages */
function getAgePriceMultiplier(age: number): number {
  const key = String(Math.min(36, Math.max(17, age)));
  return AGE_PRICE_MULTIPLIER[key] ?? 1.0;
}

/** Generate a single external (unattached) player for the transfer market */
function generateMarketPlayer(
  season: number,
  divisionId: string,
): { player: Player; listing: TransferListing } {
  const range = DIVISION_QUALITY_RANGES[divisionId] || DIVISION_QUALITY_RANGES['div-3'];
  const quality = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
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

/**
 * Generate initial transfer market population at game start.
 * Returns new players to add to the players record and transfer listings.
 */
export function generateInitialMarket(
  season: number,
  week: number,
): { players: Record<string, Player>; listings: TransferListing[] } {
  const count = INITIAL_MARKET_GEN_MIN + Math.floor(Math.random() * INITIAL_MARKET_GEN_RANGE);
  const players: Record<string, Player> = {};
  const listings: TransferListing[] = [];

  for (let i = 0; i < count; i++) {
    const divisionId = pickWeightedDivision();
    const { player, listing } = generateMarketPlayer(season, divisionId);
    listing.listedWeek = week;
    listing.listedSeason = season;
    players[player.id] = player;
    listings.push(listing);
  }

  return { players, listings };
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
  const count = MARKET_REPLENISH_BATCH_MIN + Math.floor(Math.random() * MARKET_REPLENISH_BATCH_RANGE);
  const players: Record<string, Player> = {};
  const listings: TransferListing[] = [];

  for (let i = 0; i < count; i++) {
    const divisionId = pickWeightedDivision();
    const { player, listing } = generateMarketPlayer(season, divisionId);
    listing.listedWeek = week;
    listing.listedSeason = season;
    players[player.id] = player;
    listings.push(listing);
  }

  return { players, listings };
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
 * Returns updated market and list of expired external player IDs for cleanup.
 */
export function processListingExpiry(
  transferMarket: TransferListing[],
  currentWeek: number,
  currentSeason: number,
  totalWeeks: number,
  expiryWeeks: number,
  relistChance: number,
  relistDiscount: number,
): { market: TransferListing[]; expiredPlayerIds: string[] } {
  const expiredPlayerIds: string[] = [];
  const market = transferMarket.reduce<TransferListing[]>((acc, listing) => {
    // Listings without listedWeek or from clubs (non-external) don't expire
    if (!listing.externalPlayer || !listing.listedWeek) {
      acc.push(listing);
      return acc;
    }

    // Season-aware elapsed week calculation
    const seasonDiff = currentSeason - (listing.listedSeason || currentSeason);
    const weeksListed = seasonDiff * totalWeeks + (currentWeek - (listing.listedWeek || currentWeek));
    if (weeksListed < expiryWeeks) {
      acc.push(listing);
      return acc;
    }

    // Expired — chance to relist at reduced price
    if (Math.random() < relistChance) {
      acc.push({
        ...listing,
        askingPrice: Math.max(25_000, Math.round(listing.askingPrice * (1 - relistDiscount))),
        listedWeek: currentWeek,
        listedSeason: currentSeason,
      });
    } else {
      // Player withdrawn — track for cleanup
      expiredPlayerIds.push(listing.playerId);
    }
    return acc;
  }, []);
  return { market, expiredPlayerIds };
}
