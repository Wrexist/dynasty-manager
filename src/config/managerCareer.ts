/**
 * Manager Career Mode Configuration
 * All balance constants, trait definitions, and reputation thresholds.
 */

import type { ManagerTraitId, ManagerAttributes } from '@/types/game';

// ── Manager Creation ──
export const STARTING_ATTRIBUTE_MIN = 3;
export const STARTING_ATTRIBUTE_MAX = 8;
export const STARTING_AGE_MIN = 30;
export const STARTING_AGE_MAX = 55;
export const TRAITS_TO_PICK = 2;
const TRAIT_ATTRIBUTE_BONUS = 3;

// ── Reputation Tiers (0-1000 scale) ──
export const REP_TIER_THRESHOLDS = {
  unknown: 0,
  regional: 100,
  national: 250,
  continental: 500,
  world_class: 750,
  legendary: 900,
} as const;

// ── Reputation Deltas ──
export const REP_WIN = 2;
export const REP_DRAW = 0.5;
export const REP_LOSS = -1;
export const REP_PROMOTION = 50;
export const REP_TITLE = 80;
export const REP_CUP_WIN = 40;
export const REP_RELEGATION = -60;
export const REP_SACKING = -30;
export const REP_OVERACHIEVE_BONUS = 3;   // per position above expected
export const REP_UNDERACHIEVE_PENALTY = -2; // per position below expected
export const REP_MIN = 0;
export const REP_MAX = 1000;

// ── Manager Stat Growth Per Activity ──
export const GROWTH_TACTICAL_PER_MATCH = 0.15;
export const GROWTH_MOTIVATION_PER_MORALE_EVENT = 0.1;
export const GROWTH_NEGOTIATION_PER_TRANSFER = 0.3;
export const GROWTH_SCOUTING_PER_ASSIGNMENT = 0.15;
export const GROWTH_YOUTH_PER_PROMOTION = 0.4;
export const GROWTH_DISCIPLINE_PER_CLEAN_MATCH = 0.05;
export const GROWTH_MEDIA_PER_CONFERENCE = 0.2;
export const STAT_MIN = 1;
export const STAT_MAX = 20;

// ── Gameplay Modifiers Per Attribute Point ──
export const MOD_TACTICAL_FAMILIARITY = 0.02;     // +2% familiarity gain per point
export const MOD_MOTIVATION_MORALE = 0.025;        // +2.5% morale effect per point
export const MOD_SCOUTING_SPEED = 0.03;             // -3% scouting time per point
export const MOD_YOUTH_GROWTH = 0.015;              // +1.5% youth growth per point
export const MOD_DISCIPLINE_CARDS = 0.015;          // -1.5% card chance per point
export const MOD_MEDIA_PRESS = 0.04;                // +4% press effects per point

// ── Job Market ──
export const MAX_VACANCIES = 5;
export const VACANCY_DURATION_WEEKS = 8;
export const JOB_MARKET_REFRESH_WEEKS = [1, 24, 46];
export const STARTING_JOB_OFFERS = 3;

// ── Starting Offer Negotiation ──
export const MAX_NEGOTIATION_ROUNDS = 2;
export const SALARY_COUNTER_MAX_INCREASE = 0.40;    // can ask up to 40% more
export const BOARD_ACCEPTANCE_BASE = 0.6;            // 60% base chance to accept
export const BOARD_PATIENCE_MODIFIER = 0.05;         // +5% per boardPatience point
export const NEGOTIATION_PUSHBACK_FACTOR = 0.15;     // per round, acceptance drops 15%
export const NEGOTIATION_SKILL_MODIFIER = 0.02;      // +2% per manager negotiation attribute point

// ── Manager Contract ──

// ── Retirement ──
export const DEFAULT_RETIREMENT_AGE = 65;
export const LEGENDARY_RETIREMENT_EXTENSION = 10;
export const FORCED_RETIREMENT_UNEMPLOYED_WEEKS = 24;

// ── Legacy Score Weights ──
export const LEGACY_TITLE_WEIGHT = 100;
export const LEGACY_PROMOTION_WEIGHT = 40;
export const LEGACY_CUP_WEIGHT = 60;
export const LEGACY_MATCH_WIN_WEIGHT = 1;
export const LEGACY_REPUTATION_WEIGHT = 0.5;
export const LEGACY_AWARD_WEIGHT = 15;
export const LEGACY_CONTINENTAL_CUP_WEIGHT = 95;
export const LEGACY_LEAGUE_CUP_WEIGHT = 30;

// ── Manager of the Month/Season ──
export const MOTM_CHECK_INTERVAL = 4; // every 4 weeks
export const MOTM_MIN_MATCHES = 3;    // minimum matches to qualify

// ── Career Start Leagues (quality tiers 3 and 4 only) ──
export const CAREER_START_QUALITY_TIERS: (1 | 2 | 3 | 4)[] = [3, 4];

// ── Trait Definitions ──
interface ManagerTraitDef {
  id: ManagerTraitId;
  name: string;
  description: string;
  icon: string;
  attributeBonus: Partial<Record<keyof ManagerAttributes, number>>;
  passiveEffect: string;
}

export const MANAGER_TRAITS: Record<ManagerTraitId, ManagerTraitDef> = {
  tactician: {
    id: 'tactician',
    name: 'Tactician',
    description: 'Deep understanding of formations and tactical setups',
    icon: 'ClipboardList',
    attributeBonus: { tacticalKnowledge: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'Formation changes give extra tactical familiarity',
  },
  motivator: {
    id: 'motivator',
    name: 'Motivator',
    description: 'Inspires players to give their best every match',
    icon: 'Megaphone',
    attributeBonus: { motivation: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'Team talks always give minimum +2 morale',
  },
  youth_developer: {
    id: 'youth_developer',
    name: 'Youth Developer',
    description: 'Nurtures young talent into world-class players',
    icon: 'Sprout',
    attributeBonus: { youthDevelopment: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'Youth academy prospects develop 15% faster',
  },
  transfer_guru: {
    id: 'transfer_guru',
    name: 'Transfer Guru',
    description: 'Master negotiator who always gets the best deal',
    icon: 'Handshake',
    attributeBonus: { negotiation: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'See true player value with no hidden range',
  },
  disciplinarian: {
    id: 'disciplinarian',
    name: 'Disciplinarian',
    description: 'Keeps the squad focused and professional',
    icon: 'ShieldCheck',
    attributeBonus: { discipline: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'Captain leadership bonus doubled',
  },
  media_darling: {
    id: 'media_darling',
    name: 'Media Darling',
    description: 'Commands the press room with charm and authority',
    icon: 'Mic',
    attributeBonus: { mediaHandling: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'Fan mood recovers 20% faster after losses',
  },
  fitness_fanatic: {
    id: 'fitness_fanatic',
    name: 'Fitness Fanatic',
    description: 'Demands peak physical conditioning from every player',
    icon: 'Dumbbell',
    attributeBonus: { discipline: 2, motivation: 1 },
    passiveEffect: 'Training injury risk reduced by 15%',
  },
  scout_master: {
    id: 'scout_master',
    name: 'Scout Master',
    description: 'An eye for talent that others miss',
    icon: 'Search',
    attributeBonus: { scoutingEye: TRAIT_ATTRIBUTE_BONUS },
    passiveEffect: 'Scouting reveals player potential accurately',
  },
};
