/**
 * Sponsorship System Configuration
 * Defines sponsor slots, sponsor pool, and all balancing constants.
 */

import type { SponsorSlotDef, SponsorDef, SponsorBonusCondition, SponsorSlotId } from '@/types/game';
import { pick } from '@/utils/helpers';

// ── Sponsor Slots ──

export const SPONSOR_SLOTS: SponsorSlotDef[] = [
  { id: 'kit_main',       label: 'Kit Main Sponsor',     valueTier: 1.0,  unlock: null },
  { id: 'digital',        label: 'Digital Partner',       valueTier: 0.15, unlock: null },
  { id: 'kit_sleeve',     label: 'Kit Sleeve Sponsor',    valueTier: 0.35, unlock: { facilityType: 'stadium', level: 3 } },
  { id: 'match_ball',     label: 'Match Ball Partner',    valueTier: 0.2,  unlock: { facilityType: 'stadium', level: 4 } },
  { id: 'training_kit',   label: 'Training Kit Sponsor',  valueTier: 0.3,  unlock: { facilityType: 'training', level: 4 } },
  { id: 'academy',        label: 'Academy Partner',       valueTier: 0.25, unlock: { facilityType: 'youth', level: 5 } },
  { id: 'stadium_naming', label: 'Stadium Naming Rights', valueTier: 1.2,  unlock: { facilityType: 'stadium', level: 6 } },
];

// ── Timing & Generation ──

export const SPONSOR_OFFER_INTERVAL = 2;       // generate offers every N weeks
export const SPONSOR_OFFERS_PER_CYCLE = 2;      // max offers generated per cycle
export const SPONSOR_OFFER_EXPIRY = 3;          // weeks before an offer expires
export const SPONSOR_SLOT_COOLDOWN = 4;         // weeks cooldown after termination

// ── Satisfaction ──

export const SPONSOR_SATISFACTION_START = 70;
export const SPONSOR_SAT_WIN = 2;
export const SPONSOR_SAT_DRAW = 0;
export const SPONSOR_SAT_LOSS = -3;
export const SPONSOR_SAT_REP_UP = 5;
export const SPONSOR_SAT_REP_DOWN = -10;
export const SPONSOR_SAT_WARNING_THRESHOLD = 30;
export const SPONSOR_SAT_TERMINATE_THRESHOLD = 15;
export const SPONSOR_SAT_BONUS_MET = 15;

// ── Bonus payment as multiplier of weekly payment × weeks in season ──
const SPONSOR_BONUS_WEEKS_MULTIPLIER = 8; // bonus ≈ 8 weeks of payment

// ── Buyout cost: weeks of payment per remaining season ──
const SPONSOR_BUYOUT_WEEKS_PER_SEASON = 4;

// ── Sponsor Pool (40 sponsors) ──

export const SPONSOR_POOL: SponsorDef[] = [
  // ── Tier 5 (rep 5 required) — 6 sponsors ──
  { id: 'apex_tech',       name: 'Apex Technologies',       industry: 'Tech',        tier: 5, weeklyPaymentRange: [400_000, 600_000], preferredDuration: [2, 3], bonusConditions: ['win_league', 'top_2'],           minReputation: 5 },
  { id: 'monarch_air',     name: 'Monarch Airways',         industry: 'Airlines',     tier: 5, weeklyPaymentRange: [350_000, 500_000], preferredDuration: [2, 3], bonusConditions: ['top_2', 'win_cup'],              minReputation: 5 },
  { id: 'titan_auto',      name: 'Titan Automotive',        industry: 'Automotive',   tier: 5, weeklyPaymentRange: [380_000, 550_000], preferredDuration: [1, 2], bonusConditions: ['win_cup', 'win_league'],          minReputation: 5 },
  { id: 'platinum_fin',    name: 'Platinum Finance Group',  industry: 'Banking',      tier: 5, weeklyPaymentRange: [420_000, 580_000], preferredDuration: [3],    bonusConditions: ['top_4', 'win_league'],            minReputation: 5 },
  { id: 'vanguard_energy', name: 'Vanguard Energy',         industry: 'Energy',       tier: 5, weeklyPaymentRange: [360_000, 520_000], preferredDuration: [2],    bonusConditions: ['score_80_goals', 'top_2'],        minReputation: 5 },
  { id: 'luxe_apparel',    name: 'Luxe Apparel',            industry: 'Fashion',      tier: 5, weeklyPaymentRange: [340_000, 480_000], preferredDuration: [1, 2], bonusConditions: ['cup_final', 'top_4'],             minReputation: 5 },

  // ── Tier 4 (rep 4+ required) — 8 sponsors ──
  { id: 'stratos_tel',     name: 'Stratos Telecom',         industry: 'Telecom',      tier: 4, weeklyPaymentRange: [200_000, 350_000], preferredDuration: [2],    bonusConditions: ['top_6', 'top_4'],                 minReputation: 4 },
  { id: 'nova_ins',        name: 'Nova Insurance',          industry: 'Insurance',    tier: 4, weeklyPaymentRange: [180_000, 300_000], preferredDuration: [2, 3], bonusConditions: ['avoid_relegation', 'top_6'],      minReputation: 4 },
  { id: 'summit_brew',     name: 'Summit Brewing Co.',      industry: 'Food & Drink', tier: 4, weeklyPaymentRange: [170_000, 280_000], preferredDuration: [1, 2], bonusConditions: ['win_20_matches', 'top_4'],        minReputation: 4 },
  { id: 'pinnacle_motors', name: 'Pinnacle Motors',         industry: 'Automotive',   tier: 4, weeklyPaymentRange: [190_000, 320_000], preferredDuration: [2],    bonusConditions: ['top_4', 'top_2'],                 minReputation: 4 },
  { id: 'cloudsync',       name: 'CloudSync',               industry: 'Tech',         tier: 4, weeklyPaymentRange: [210_000, 340_000], preferredDuration: [1],    bonusConditions: ['clean_sheets_15', 'top_6'],       minReputation: 4 },
  { id: 'emerald_bank',    name: 'Emerald Bank',            industry: 'Banking',      tier: 4, weeklyPaymentRange: [200_000, 310_000], preferredDuration: [2, 3], bonusConditions: ['goal_diff_30', 'top_4'],          minReputation: 4 },
  { id: 'atlas_log',       name: 'Atlas Logistics',         industry: 'Transport',    tier: 4, weeklyPaymentRange: [160_000, 260_000], preferredDuration: [2],    bonusConditions: ['unbeaten_home_10', 'top_6'],      minReputation: 4 },
  { id: 'sovereign_hotel', name: 'Sovereign Hotels',        industry: 'Hospitality',  tier: 4, weeklyPaymentRange: [180_000, 290_000], preferredDuration: [1, 2], bonusConditions: ['cup_semi', 'cup_final'],           minReputation: 4 },

  // ── Tier 3 (rep 3+ required) — 10 sponsors ──
  { id: 'freshfit',        name: 'FreshFit Nutrition',      industry: 'Food & Drink', tier: 3, weeklyPaymentRange: [80_000, 160_000],  preferredDuration: [1, 2], bonusConditions: ['top_6', 'win_20_matches'],        minReputation: 3 },
  { id: 'quickbet',        name: 'QuickBet',                industry: 'Betting',      tier: 3, weeklyPaymentRange: [90_000, 170_000],  preferredDuration: [1],    bonusConditions: ['top_4', 'score_80_goals'],        minReputation: 3 },
  { id: 'bluewave',        name: 'Bluewave Mobile',         industry: 'Telecom',      tier: 3, weeklyPaymentRange: [70_000, 140_000],  preferredDuration: [2],    bonusConditions: ['avoid_relegation', 'top_6'],      minReputation: 3 },
  { id: 'green_earth',     name: 'Green Earth Energy',      industry: 'Energy',       tier: 3, weeklyPaymentRange: [75_000, 150_000],  preferredDuration: [2, 3], bonusConditions: ['promotion', 'top_4'],             minReputation: 3 },
  { id: 'cityscape',       name: 'Cityscape Properties',    industry: 'Real Estate',  tier: 3, weeklyPaymentRange: [85_000, 155_000],  preferredDuration: [2],    bonusConditions: ['top_6', 'goal_diff_30'],          minReputation: 3 },
  { id: 'fastlane',        name: 'FastLane Delivery',       industry: 'Logistics',    tier: 3, weeklyPaymentRange: [70_000, 130_000],  preferredDuration: [1, 2], bonusConditions: ['win_20_matches', 'top_6'],        minReputation: 3 },
  { id: 'harmony_health',  name: 'Harmony Healthcare',      industry: 'Healthcare',   tier: 3, weeklyPaymentRange: [80_000, 145_000],  preferredDuration: [2],    bonusConditions: ['avoid_relegation', 'cup_semi'],   minReputation: 3 },
  { id: 'steelworks',      name: 'Steelworks Construction', industry: 'Construction', tier: 3, weeklyPaymentRange: [75_000, 140_000],  preferredDuration: [1, 2], bonusConditions: ['promotion', 'top_6'],             minReputation: 3 },
  { id: 'digital_arena',   name: 'Digital Arena',           industry: 'Tech',         tier: 3, weeklyPaymentRange: [90_000, 160_000],  preferredDuration: [1],    bonusConditions: ['top_4', 'clean_sheets_15'],       minReputation: 3 },
  { id: 'crestview',       name: 'Crestview Investments',   industry: 'Finance',      tier: 3, weeklyPaymentRange: [85_000, 150_000],  preferredDuration: [2, 3], bonusConditions: ['top_6', 'avoid_relegation'],      minReputation: 3 },

  // ── Tier 2 (rep 2+ required) — 8 sponsors ──
  { id: 'local_motors',    name: 'Local Motors',            industry: 'Automotive',   tier: 2, weeklyPaymentRange: [30_000, 70_000],   preferredDuration: [1, 2], bonusConditions: ['promotion', 'top_6'],             minReputation: 2 },
  { id: 'county_build',    name: 'County Builders',         industry: 'Construction', tier: 2, weeklyPaymentRange: [25_000, 60_000],   preferredDuration: [2],    bonusConditions: ['avoid_relegation', 'promotion'],  minReputation: 2 },
  { id: 'riverside_brew',  name: 'Riverside Brewery',       industry: 'Food & Drink', tier: 2, weeklyPaymentRange: [28_000, 65_000],   preferredDuration: [1, 2], bonusConditions: ['win_20_matches', 'top_6'],        minReputation: 2 },
  { id: 'valley_ins',      name: 'Valley Insurance',        industry: 'Insurance',    tier: 2, weeklyPaymentRange: [30_000, 68_000],   preferredDuration: [2],    bonusConditions: ['avoid_relegation', 'top_6'],      minReputation: 2 },
  { id: 'horizon_tel',     name: 'Horizon Telecom',         industry: 'Telecom',      tier: 2, weeklyPaymentRange: [25_000, 55_000],   preferredDuration: [1, 2], bonusConditions: ['promotion', 'cup_semi'],           minReputation: 2 },
  { id: 'maple_fin',       name: 'Maple Finance',           industry: 'Banking',      tier: 2, weeklyPaymentRange: [32_000, 72_000],   preferredDuration: [2, 3], bonusConditions: ['top_6', 'goal_diff_30'],          minReputation: 2 },
  { id: 'greenfield',      name: 'Greenfield Farms',        industry: 'Agriculture',  tier: 2, weeklyPaymentRange: [20_000, 50_000],   preferredDuration: [2],    bonusConditions: ['avoid_relegation', 'promotion'],  minReputation: 2 },
  { id: 'township_media',  name: 'Township Media',          industry: 'Media',        tier: 2, weeklyPaymentRange: [22_000, 55_000],   preferredDuration: [1],    bonusConditions: ['promotion', 'top_6'],             minReputation: 2 },

  // ── Tier 1 (any rep) — 8 sponsors ──
  { id: 'petes_pizza',     name: "Pete's Pizza",            industry: 'Food & Drink', tier: 1, weeklyPaymentRange: [5_000, 20_000],    preferredDuration: [1],    bonusConditions: ['promotion', 'avoid_relegation'],  minReputation: 1 },
  { id: 'daves_motors',    name: "Dave's Motors",           industry: 'Automotive',   tier: 1, weeklyPaymentRange: [8_000, 22_000],    preferredDuration: [1, 2], bonusConditions: ['promotion', 'win_20_matches'],    minReputation: 1 },
  { id: 'corner_ins',      name: 'Corner Shop Insurance',   industry: 'Insurance',    tier: 1, weeklyPaymentRange: [6_000, 18_000],    preferredDuration: [1],    bonusConditions: ['avoid_relegation', 'promotion'],  minReputation: 1 },
  { id: 'local_radio',     name: 'Local Radio FM',          industry: 'Media',        tier: 1, weeklyPaymentRange: [4_000, 15_000],    preferredDuration: [1],    bonusConditions: ['avoid_relegation', 'cup_semi'],   minReputation: 1 },
  { id: 'community_bank',  name: 'Community Bank',          industry: 'Banking',      tier: 1, weeklyPaymentRange: [7_000, 20_000],    preferredDuration: [1, 2], bonusConditions: ['promotion', 'top_6'],             minReputation: 1 },
  { id: 'sunday_sports',   name: 'Sunday League Sports',    industry: 'Sports Retail',tier: 1, weeklyPaymentRange: [5_000, 16_000],    preferredDuration: [1],    bonusConditions: ['promotion', 'win_20_matches'],    minReputation: 1 },
  { id: 'grassroots_en',   name: 'Grassroots Energy',       industry: 'Energy',       tier: 1, weeklyPaymentRange: [6_000, 18_000],    preferredDuration: [1, 2], bonusConditions: ['avoid_relegation', 'promotion'],  minReputation: 1 },
  { id: 'town_country',    name: 'Town & Country Builders', industry: 'Construction', tier: 1, weeklyPaymentRange: [5_000, 15_000],    preferredDuration: [1],    bonusConditions: ['promotion', 'avoid_relegation'],  minReputation: 1 },
];

// ── Helpers ──

/** Get a sponsor definition by ID */
export function getSponsorById(id: string): SponsorDef | undefined {
  return SPONSOR_POOL.find(s => s.id === id);
}

/** Get the slot definition by ID */
function getSlotDef(slotId: SponsorSlotId): SponsorSlotDef | undefined {
  return SPONSOR_SLOTS.find(s => s.id === slotId);
}

/** Check if a sponsor slot is unlocked given current facility levels */
export function isSlotUnlocked(
  slotId: SponsorSlotId,
  facilities: { trainingLevel: number; youthLevel: number; stadiumLevel: number; medicalLevel: number }
): boolean {
  const slot = getSlotDef(slotId);
  if (!slot) return false;
  if (!slot.unlock) return true;
  const { facilityType, level } = slot.unlock;
  const facilityMap: Record<string, number> = {
    stadium: facilities.stadiumLevel,
    training: facilities.trainingLevel,
    youth: facilities.youthLevel,
    medical: facilities.medicalLevel,
  };
  return (facilityMap[facilityType] || 0) >= level;
}

/** Human-readable description for a bonus condition */
export function getBonusConditionLabel(condition: SponsorBonusCondition): string {
  const labels: Record<SponsorBonusCondition, string> = {
    win_league: 'Win the league',
    top_2: 'Finish in top 2',
    top_4: 'Finish in top 4',
    top_6: 'Finish in top 6',
    avoid_relegation: 'Avoid relegation',
    win_cup: 'Win the cup',
    cup_final: 'Reach cup final',
    cup_semi: 'Reach cup semi-finals',
    win_20_matches: 'Win 20+ league matches',
    score_80_goals: 'Score 80+ league goals',
    clean_sheets_15: 'Keep 15+ clean sheets',
    goal_diff_30: 'Goal difference of +30',
    promotion: 'Win promotion',
    unbeaten_home_10: '10+ match unbeaten at home',
  };
  return labels[condition];
}

/** Random number in range [min, max] */
function randRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


/** Generate a weekly payment for a sponsor in a given slot */
export function generateSponsorPayment(sponsor: SponsorDef, slotValueTier: number): number {
  const base = randRange(sponsor.weeklyPaymentRange[0], sponsor.weeklyPaymentRange[1]);
  return Math.round(base * slotValueTier);
}

/** Generate a performance bonus amount based on weekly payment */
export function generatePerformanceBonus(weeklyPayment: number): number {
  return Math.round(weeklyPayment * SPONSOR_BONUS_WEEKS_MULTIPLIER);
}

/** Generate a buyout cost based on weekly payment and duration */
export function generateBuyoutCost(weeklyPayment: number, seasonDuration: number): number {
  return Math.round(weeklyPayment * SPONSOR_BUYOUT_WEEKS_PER_SEASON * seasonDuration);
}

/** Get eligible sponsors for a club's reputation that aren't already active */
export function getEligibleSponsors(reputation: number, activeSponsorIds: string[]): SponsorDef[] {
  return SPONSOR_POOL.filter(s => s.minReputation <= reputation && !activeSponsorIds.includes(s.id));
}

/** Generate a sponsor offer for a specific slot */
export function generateOffer(
  slotId: SponsorSlotId,
  reputation: number,
  activeSponsorIds: string[],
  currentWeek: number,
  _currentSeason: number,
): {
  sponsorId: string;
  slotId: SponsorSlotId;
  weeklyPayment: number;
  seasonDuration: number;
  performanceBonus: number;
  bonusCondition: SponsorBonusCondition;
  buyoutCost: number;
  expiresWeek: number;
} | null {
  const slot = getSlotDef(slotId);
  if (!slot) return null;

  const eligible = getEligibleSponsors(reputation, activeSponsorIds);
  if (eligible.length === 0) return null;

  // Weight toward sponsors whose tier is closest to reputation
  const weighted = eligible.filter(s => s.tier <= reputation);
  const pool = weighted.length > 0 ? weighted : eligible;

  const sponsor = pick(pool);
  const duration = pick(sponsor.preferredDuration);
  const weeklyPayment = generateSponsorPayment(sponsor, slot.valueTier);
  const performanceBonus = generatePerformanceBonus(weeklyPayment);
  const bonusCondition = pick(sponsor.bonusConditions);
  const buyoutCost = generateBuyoutCost(weeklyPayment, duration);

  return {
    sponsorId: sponsor.id,
    slotId,
    weeklyPayment,
    seasonDuration: duration,
    performanceBonus,
    bonusCondition,
    buyoutCost,
    expiresWeek: currentWeek + SPONSOR_OFFER_EXPIRY,
  };
}
