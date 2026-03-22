/**
 * Merchandise System Utilities
 * Revenue calculation, marketability scoring, unlock checks, campaign eligibility.
 */

import type {
  Club, Player, DivisionId, FacilitiesState, ManagerProgression,
  MerchProductLine, MerchState, MerchCampaignType,
} from '@/types/game';
import {
  MERCH_PRODUCT_LINES, MERCH_PRICING_TIERS, MERCH_BASE_INCOME_PER_FAN,
  MERCH_DIVISION_SCALE, MERCH_TOTAL_REVENUE_FACTORS,
  STAR_PLAYER_MERCH_FACTOR, STAR_PLAYER_COUNT,
  STAR_PLAYER_SALE_DIP_FACTOR, STAR_SIGNING_BUZZ_FACTOR,
  MERCH_CAMPAIGNS, DIVISION_TIER,
  CAMPAIGN_KIT_LAUNCH_MAX_WEEK, CAMPAIGN_TITLE_RACE_MAX_POSITION,
  CAMPAIGN_END_OF_SEASON_MIN_WEEK, CAMPAIGN_HOLIDAY_MIN_WEEK, CAMPAIGN_HOLIDAY_MAX_WEEK,
  CAMPAIGN_STAR_SIGNING_MIN_VALUE,
} from '@/config/merchandise';
import { hasPerk } from '@/utils/managerPerks';

/** Calculate a player's marketability score (higher = more shirt sales) */
export function getPlayerMarketability(player: Player): number {
  // Base from overall rating (0-100)
  let score = player.overall * 0.4;
  // Performance: goals + assists this season
  score += (player.goals + player.assists) * 2;
  // Must actually play to be marketable
  if (player.appearances < 3) return 0;
  score += Math.min(player.appearances, 20) * 0.5;
  // Wonderkid premium: young stars (18-25) get a bonus
  if (player.age >= 18 && player.age <= 25) score += 10;
  return Math.round(score);
}

/** Get top N most marketable players for a club */
export function getStarPlayerMerch(
  club: Club, players: Record<string, Player>, count: number = STAR_PLAYER_COUNT
): { playerId: string; name: string; marketability: number; merchBonus: number }[] {
  return club.playerIds
    .map(id => players[id])
    .filter(Boolean)
    .map(p => ({
      playerId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      marketability: getPlayerMarketability(p),
      merchBonus: getPlayerMarketability(p) * STAR_PLAYER_MERCH_FACTOR,
    }))
    .sort((a, b) => b.marketability - a.marketability)
    .slice(0, count)
    .filter(p => p.marketability > 0);
}

/** Check if a product line is unlocked for a given club */
export function isProductLineUnlocked(
  line: MerchProductLine, club: Club, division: DivisionId, facilities: FacilitiesState
): boolean {
  const req = MERCH_PRODUCT_LINES[line].unlockRequirement;
  // Division check: the club's division must be at or above the required tier
  if (req.minDivision) {
    const clubTier = DIVISION_TIER[division];
    const reqTier = DIVISION_TIER[req.minDivision];
    // Both rep and division can unlock — need at least one
    const divOk = clubTier <= reqTier;
    const repOk = req.minReputation ? club.reputation >= req.minReputation : false;
    if (!divOk && !repOk) return false;
  } else if (req.minReputation && club.reputation < req.minReputation) {
    return false;
  }
  if (req.minStadiumLevel && facilities.stadiumLevel < req.minStadiumLevel) return false;
  return true;
}

/** Get total weekly operating cost of active product lines */
export function getMerchOperatingCost(activeLines: MerchProductLine[]): number {
  return activeLines.reduce((sum, line) => sum + MERCH_PRODUCT_LINES[line].weeklyOperatingCost, 0);
}

/** Calculate weekly merchandise revenue */
export function calculateWeeklyMerchRevenue(
  merch: MerchState,
  club: Club,
  players: Record<string, Player>,
  division: DivisionId,
  managerProgression: ManagerProgression,
): number {
  if (merch.activeProductLines.length === 0) return 0;

  const divisionScale = MERCH_DIVISION_SCALE[division] || 0.4;
  const baseRevenue = club.fanBase * MERCH_BASE_INCOME_PER_FAN * divisionScale;

  // Product line factor: fraction of total possible revenue factors
  const activeRevenueFactor = merch.activeProductLines.reduce(
    (sum, line) => sum + MERCH_PRODUCT_LINES[line].baseRevenueFactor, 0
  );
  const productLineFactor = activeRevenueFactor / MERCH_TOTAL_REVENUE_FACTORS;

  // Pricing multiplier
  const pricingMult = MERCH_PRICING_TIERS[merch.pricingTier].revenueMultiplier;

  // Campaign boost
  const campaignBoost = merch.activeCampaign ? (1 + merch.activeCampaign.revenueBoost) : 1;

  // Star player dip / signing buzz
  let dipBuzzMult = 1;
  if (merch.starPlayerDip > 0) dipBuzzMult = STAR_PLAYER_SALE_DIP_FACTOR;
  else if (merch.starSigningBuzz > 0) dipBuzzMult = STAR_SIGNING_BUZZ_FACTOR;

  // Fan favourite perk
  const fanFavMult = hasPerk(managerProgression, 'fan_favourite') ? 1.15 : 1;

  // Star player bonus
  const starPlayers = getStarPlayerMerch(club, players);
  const starPlayerBonus = starPlayers.reduce((sum, sp) => sum + sp.merchBonus, 0);

  // Operating costs
  const operatingCosts = getMerchOperatingCost(merch.activeProductLines);

  const grossRevenue = baseRevenue * productLineFactor * pricingMult * campaignBoost * dipBuzzMult * fanFavMult;
  return Math.max(0, Math.round(grossRevenue + starPlayerBonus - operatingCosts));
}

/** Check if a campaign can be launched */
export function canLaunchCampaign(
  type: MerchCampaignType,
  opts: {
    merch: MerchState;
    budget: number;
    week: number;
    leaguePosition: number;
    cupEliminated: boolean;
    cupCurrentRound: string | null;
    hasRecentBigSigning: boolean;
    kitLaunchUsedThisSeason: boolean;
  }
): { eligible: boolean; reason?: string } {
  const { merch, budget, week } = opts;
  const def = MERCH_CAMPAIGNS[type];

  if (merch.activeCampaign) return { eligible: false, reason: 'A campaign is already running' };
  if (merch.campaignCooldownWeeks > 0) return { eligible: false, reason: `Cooldown: ${merch.campaignCooldownWeeks} weeks remaining` };
  if (budget < def.setupCost) return { eligible: false, reason: `Need £${(def.setupCost / 1e6).toFixed(1)}M budget` };

  switch (type) {
    case 'kit_launch':
      if (opts.kitLaunchUsedThisSeason) return { eligible: false, reason: 'Already launched this season' };
      if (week > CAMPAIGN_KIT_LAUNCH_MAX_WEEK) return { eligible: false, reason: `Only available weeks 1-${CAMPAIGN_KIT_LAUNCH_MAX_WEEK}` };
      break;
    case 'title_race':
      if (opts.leaguePosition > CAMPAIGN_TITLE_RACE_MAX_POSITION) return { eligible: false, reason: `Must be top ${CAMPAIGN_TITLE_RACE_MAX_POSITION} in the league` };
      break;
    case 'cup_run': {
      if (opts.cupEliminated) return { eligible: false, reason: 'Eliminated from the cup' };
      const roundOrder = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];
      const currentIdx = roundOrder.indexOf(opts.cupCurrentRound || '');
      const requiredIdx = roundOrder.indexOf('QF');
      if (currentIdx < requiredIdx) return { eligible: false, reason: 'Must reach cup quarter-finals' };
      break;
    }
    case 'end_of_season_sale':
      if (week < CAMPAIGN_END_OF_SEASON_MIN_WEEK) return { eligible: false, reason: `Only available from week ${CAMPAIGN_END_OF_SEASON_MIN_WEEK}` };
      break;
    case 'star_signing':
      if (!opts.hasRecentBigSigning) return { eligible: false, reason: `Need a recent signing worth £${(CAMPAIGN_STAR_SIGNING_MIN_VALUE / 1e6).toFixed(0)}M+` };
      break;
    case 'holiday_special':
      if (week < CAMPAIGN_HOLIDAY_MIN_WEEK || week > CAMPAIGN_HOLIDAY_MAX_WEEK) return { eligible: false, reason: `Only available weeks ${CAMPAIGN_HOLIDAY_MIN_WEEK}-${CAMPAIGN_HOLIDAY_MAX_WEEK}` };
      break;
  }

  return { eligible: true };
}

/** Get the default merchandise state for a new game */
export function getDefaultMerchState(): MerchState {
  return {
    activeProductLines: ['matchday_essentials'],
    pricingTier: 'standard',
    activeCampaign: null,
    campaignCooldownWeeks: 0,
    lastSeasonRevenue: 0,
    currentSeasonRevenue: 0,
    starPlayerDip: 0,
    starSigningBuzz: 0,
  };
}
