/**
 * Merchandise System Utilities
 * Revenue calculation, marketability scoring, unlock checks, campaign eligibility.
 */

import type {
  Club, Player, LeagueId, FacilitiesState, ManagerProgression,
  MerchProductLine, MerchState, MerchCampaignType,
} from '@/types/game';
import { LEAGUES } from '@/data/league';
import { getEffectiveStadiumLevel } from '@/utils/facilities';
import {
  MERCH_PRODUCT_LINES, MERCH_PRICING_TIERS, MERCH_BASE_INCOME_PER_FAN,
  MERCH_QUALITY_TIER_SCALE, MERCH_TOTAL_REVENUE_FACTORS,
  STAR_PLAYER_MERCH_FACTOR, STAR_PLAYER_COUNT,
  STAR_PLAYER_SALE_DIP_FACTOR, STAR_SIGNING_BUZZ_FACTOR,
  MERCH_CAMPAIGNS,
  CAMPAIGN_KIT_LAUNCH_MAX_WEEK, CAMPAIGN_TITLE_RACE_MAX_POSITION,
  CAMPAIGN_END_OF_SEASON_MIN_WEEK, CAMPAIGN_END_OF_SEASON_WEEK_FRACTION,
  CAMPAIGN_HOLIDAY_MIN_WEEK, CAMPAIGN_HOLIDAY_MAX_WEEK,
  CAMPAIGN_STAR_SIGNING_MIN_VALUE,
  WIN_STREAK_BONUS_THRESHOLD, WIN_STREAK_BONUS_PER_WIN, WIN_STREAK_BONUS_CAP,
  DERBY_BUZZ_FACTOR,
  SIGNATURE_DROP_BASE_BONUS, SIGNATURE_DROP_BONUS_PER_MARKET,
  MARKETABILITY_PER_CONTRIBUTION, MARKETABILITY_CONTRIBUTION_CAP,
} from '@/config/merchandise';
import { hasPerk } from '@/utils/managerPerks';

/**
 * Calculate a player's marketability score (higher = more shirt sales).
 *
 * Returns roughly 30-100 for a playing squad member. The goals+assists term is
 * CAPPED: it used to be uncapped `(goals + assists) * 2`, which — because the
 * score is multiplied by `STAR_PLAYER_MERCH_FACTOR` — bought a permanent slice
 * of weekly revenue for every goal scored, forever. A 40-goal season alone
 * added 80 points of marketability, more than the rest of the formula combined.
 */
export function getPlayerMarketability(player: Player): number {
  // Must actually play to be marketable
  if (player.appearances < 3) return 0;
  // Base from overall rating (0-100)
  let score = player.overall * 0.4;
  // Performance: goals + assists this season, capped so a hot streak can't
  // compound without limit.
  score += Math.min(
    MARKETABILITY_CONTRIBUTION_CAP,
    (player.goals + player.assists) * MARKETABILITY_PER_CONTRIBUTION,
  );
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
  line: MerchProductLine, club: Club, _division: LeagueId, facilities: FacilitiesState
): boolean {
  const req = MERCH_PRODUCT_LINES[line].unlockRequirement;
  // Reputation-based unlock (division-based tiers removed in league migration)
  if (req.minReputation && club.reputation < req.minReputation) {
    return false;
  }
  if (req.minStadiumLevel && getEffectiveStadiumLevel(facilities) < req.minStadiumLevel) return false;
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
  division: LeagueId,
  managerProgression: ManagerProgression,
): number {
  if (merch.activeProductLines.length === 0) return 0;

  const leagueInfo = LEAGUES.find(l => l.id === division);
  const qualityTier = leagueInfo?.qualityTier || 3;
  const divisionScale = MERCH_QUALITY_TIER_SCALE[qualityTier] || 0.4;
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

  // Win streak — kicks in at threshold, capped
  const streakLen = merch.winStreak ?? 0;
  const streakMult = streakLen >= WIN_STREAK_BONUS_THRESHOLD
    ? 1 + Math.min(WIN_STREAK_BONUS_CAP, (streakLen - WIN_STREAK_BONUS_THRESHOLD + 1) * WIN_STREAK_BONUS_PER_WIN)
    : 1;

  // Derby buzz — auto-applied for a few weeks after a derby
  const derbyMult = (merch.derbyBuzzWeeks ?? 0) > 0 ? DERBY_BUZZ_FACTOR : 1;

  // ── Star player + signature-drop demand ──
  // These are ADDENDS TO THE REVENUE BASE, not bolt-ons to the final figure.
  // They used to be added AFTER the whole multiplicative chain, so they
  // bypassed the league tier scale, the active product lines, pricing strategy
  // and campaigns entirely — three star players in the Championship generated
  // more untouchable weekly revenue than the club's whole wage bill, and no
  // merchandising decision the player made could affect it.
  //
  // Folded into the base (and tier-scaled the same way `baseRevenue` is) they
  // now flow through every multiplier: you only monetise your stars as well as
  // your product lines, pricing and campaigns let you.
  const starPlayers = getStarPlayerMerch(club, players);
  const starPlayerDemand = starPlayers.reduce((sum, sp) => sum + sp.merchBonus, 0) * divisionScale;

  const sigDrop = merch.signatureDrop ?? null;
  const signatureDemand = (sigDrop && sigDrop.weeksRemaining > 0 ? sigDrop.weeklyBonus : 0) * divisionScale;

  // Operating costs
  const operatingCosts = getMerchOperatingCost(merch.activeProductLines);

  const grossRevenue = (baseRevenue + starPlayerDemand + signatureDemand)
    * productLineFactor * pricingMult * campaignBoost * dipBuzzMult * fanFavMult * streakMult * derbyMult;
  // NOT clamped at 0: a merchandising operation whose running costs exceed its
  // revenue is a real loss and must show up as one. The old `Math.max(0, …)`
  // made merchandise a risk-free bet and desynced the finance breakdown's
  // reported gross from the money actually applied.
  return Math.round(grossRevenue - operatingCosts);
}

/**
 * The actual weekly revenue delta a signature drop for `player` would produce,
 * i.e. the number worth showing the user. `getSignatureDropBonus` returns the
 * raw demand addend, which then flows through the tier scale, product-line
 * factor, pricing and campaign multipliers — so the raw figure overstates the
 * benefit (badly, if only one product line is active).
 */
export function getSignatureDropRevenueDelta(
  merch: MerchState,
  club: Club,
  players: Record<string, Player>,
  division: LeagueId,
  managerProgression: ManagerProgression,
  player: Player,
): number {
  const weeklyBonus = getSignatureDropBonus(player);
  const withDrop: MerchState = {
    ...merch,
    signatureDrop: {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      weeksRemaining: 1,
      totalWeeks: 1,
      weeklyBonus,
    },
  };
  const before = calculateWeeklyMerchRevenue(merch, club, players, division, managerProgression);
  const after = calculateWeeklyMerchRevenue(withDrop, club, players, division, managerProgression);
  return Math.max(0, after - before);
}

/** Compute the per-week bonus a player would generate as a signature drop. */
export function getSignatureDropBonus(player: Player): number {
  const market = getPlayerMarketability(player);
  if (market <= 0) return 0;
  return Math.round(SIGNATURE_DROP_BASE_BONUS + market * SIGNATURE_DROP_BONUS_PER_MARKET);
}

/**
 * First week the End of Season Sale becomes available, scaled to the league's
 * season length. The old hardcoded week 38 was past the final week in 33 of the
 * 45 leagues (most run 34 weeks or fewer), so the campaign was dead content for
 * the majority of the club list.
 */
export function getEndOfSeasonMinWeek(totalWeeks?: number): number {
  if (!totalWeeks || totalWeeks <= 0) return CAMPAIGN_END_OF_SEASON_MIN_WEEK;
  return Math.max(1, Math.round(totalWeeks * CAMPAIGN_END_OF_SEASON_WEEK_FRACTION));
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
    /** The player's league season length. Omit only for the 46-week baseline —
     *  the End of Season Sale window scales off it. */
    totalWeeks?: number;
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
    case 'end_of_season_sale': {
      const minWeek = getEndOfSeasonMinWeek(opts.totalWeeks);
      if (week < minWeek) return { eligible: false, reason: `Only available from week ${minWeek}` };
      break;
    }
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
    kitLaunchUsedThisSeason: false,
    signatureDrop: null,
    signatureDropCooldownWeeks: 0,
    signatureDropsUsedThisSeason: [],
    winStreak: 0,
    derbyBuzzWeeks: 0,
  };
}
