import { StaffMember, StaffRole, StaffTrait, StaffPerformance } from '@/types/game';
import { pick } from './helpers';
import {
  STAFF_WAGE_PER_QUALITY, STAFF_WAGE_RANDOM_RANGE, STAFF_QUALITY_MIN, STAFF_QUALITY_MAX,
  INITIAL_BASE_QUALITY_BONUS, INITIAL_BASE_QUALITY_CAP,
  ASSISTANT_MANAGER_VARIANCE, FITNESS_COACH_OFFSET, FITNESS_COACH_VARIANCE,
  SCOUT_MIN_REPUTATION, SCOUT_OFFSET, SCOUT_VARIANCE,
  YOUTH_COACH_MIN_REPUTATION, YOUTH_COACH_OFFSET, YOUTH_COACH_VARIANCE,
  MARKET_QUALITY_BASE, MARKET_QUALITY_RANGE,
  STAFF_DEFAULT_MORALE, STAFF_CONTRACT_YEARS,
  STAFF_TRAIT_CHANCE_ONE, STAFF_TRAIT_CHANCE_TWO,
  STAFF_MORALE_FLOOR_MULT, STAFF_MORALE_CEILING_MULT,
} from '@/config/staff';

const FIRST_NAMES = ['James', 'Carlos', 'Marco', 'Stefan', 'Pierre', 'Antonio', 'Rui', 'Hans', 'Igor', 'Luis', 'Erik', 'Sergio', 'Fabio', 'Nuno', 'Andre'];
const LAST_NAMES = ['Silva', 'Martinez', 'Weber', 'Rossi', 'Dupont', 'Andersen', 'Kowalski', 'Fernandez', 'Santos', 'Nielsen', 'Bianchi', 'Mueller', 'Costa', 'Pereira', 'Garcia'];

const ALL_TRAITS: StaffTrait[] = [
  'tactician', 'motivator', 'talent_spotter', 'innovator',
  'disciplinarian', 'veteran', 'rising_star',
];

/** Per-role trait pool — biases generation toward role-relevant traits. */
const ROLE_TRAITS: Record<StaffRole, StaffTrait[]> = {
  'assistant-manager': ['tactician', 'motivator', 'veteran', 'innovator'],
  'first-team-coach': ['tactician', 'innovator', 'motivator', 'veteran', 'rising_star'],
  'fitness-coach': ['innovator', 'disciplinarian', 'motivator', 'rising_star'],
  'goalkeeping-coach': ['tactician', 'disciplinarian', 'veteran'],
  'scout': ['talent_spotter', 'innovator', 'rising_star', 'veteran'],
  'youth-coach': ['talent_spotter', 'motivator', 'rising_star', 'innovator'],
  'physio': ['disciplinarian', 'motivator', 'veteran'],
};

function rollTraits(role: StaffRole): StaffTrait[] {
  const traits: StaffTrait[] = [];
  if (Math.random() < STAFF_TRAIT_CHANCE_ONE) {
    traits.push(pick(ROLE_TRAITS[role]));
  }
  if (traits.length === 1 && Math.random() < STAFF_TRAIT_CHANCE_TWO) {
    // Pick a second trait, biased to the role pool but allowing any
    const pool = Math.random() < 0.7 ? ROLE_TRAITS[role] : ALL_TRAITS;
    const second = pick(pool);
    if (!traits.includes(second)) traits.push(second);
  }
  return traits;
}

function freshPerformance(): StaffPerformance {
  return { trainingGains: 0, youthPromotions: 0, scoutFinds: 0, injuriesPrevented: 0, weeksAtClub: 0 };
}

function generateStaffMember(role: StaffRole, quality: number): StaffMember {
  const q = Math.max(STAFF_QUALITY_MIN, Math.min(STAFF_QUALITY_MAX, quality));
  return {
    id: crypto.randomUUID(),
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    role,
    quality: q,
    wage: Math.round(q * STAFF_WAGE_PER_QUALITY + Math.random() * STAFF_WAGE_RANDOM_RANGE),
    morale: STAFF_DEFAULT_MORALE,
    traits: rollTraits(role),
    contractYearsRemaining: STAFF_CONTRACT_YEARS,
    seasonsAtClub: 0,
    performance: freshPerformance(),
    lastInteractionWeek: -99,
    lastRenewalWeek: -99,
  };
}

export function generateInitialStaff(reputation: number): StaffMember[] {
  const baseQuality = Math.min(INITIAL_BASE_QUALITY_CAP, reputation + INITIAL_BASE_QUALITY_BONUS);
  const staff: StaffMember[] = [
    generateStaffMember('assistant-manager', baseQuality + Math.floor(Math.random() * ASSISTANT_MANAGER_VARIANCE)),
    generateStaffMember('fitness-coach', baseQuality + FITNESS_COACH_OFFSET + Math.floor(Math.random() * FITNESS_COACH_VARIANCE)),
  ];
  if (reputation >= SCOUT_MIN_REPUTATION) {
    staff.push(generateStaffMember('scout', baseQuality + SCOUT_OFFSET + Math.floor(Math.random() * SCOUT_VARIANCE)));
  }
  if (reputation >= YOUTH_COACH_MIN_REPUTATION) {
    staff.push(generateStaffMember('youth-coach', baseQuality + YOUTH_COACH_OFFSET + Math.floor(Math.random() * YOUTH_COACH_VARIANCE)));
  }
  return staff;
}

export function generateStaffMarket(): StaffMember[] {
  const roles: StaffRole[] = ['first-team-coach', 'fitness-coach', 'goalkeeping-coach', 'scout', 'youth-coach', 'physio'];
  return roles.map(role => generateStaffMember(role, MARKET_QUALITY_BASE + Math.floor(Math.random() * MARKET_QUALITY_RANGE)));
}

/**
 * Convert a staff member's morale into an effectiveness multiplier
 * (0.6 at 0 morale → 1.2 at 100 morale).
 */
export function getMoraleMultiplier(morale: number | undefined): number {
  const m = typeof morale === 'number' ? Math.max(0, Math.min(100, morale)) : STAFF_DEFAULT_MORALE;
  const t = m / 100;
  return STAFF_MORALE_FLOOR_MULT + (STAFF_MORALE_CEILING_MULT - STAFF_MORALE_FLOOR_MULT) * t;
}

/**
 * Trait-driven effective quality bonus for a member in their role.
 * Returns whole numbers added to base quality (e.g. tactician on first-team-coach = +1).
 */
export function getTraitBonus(member: StaffMember): number {
  const traits = member.traits || [];
  if (traits.length === 0) return 0;
  let bonus = 0;
  if ((member.role === 'assistant-manager' || member.role === 'first-team-coach') && traits.includes('tactician')) bonus += 1;
  if ((member.role === 'first-team-coach' || member.role === 'fitness-coach') && traits.includes('innovator')) bonus += 1;
  if ((member.role === 'scout' || member.role === 'youth-coach') && traits.includes('talent_spotter')) bonus += 1;
  if (member.role === 'physio' && traits.includes('disciplinarian')) bonus += 1;
  return bonus;
}

/**
 * Effective quality combining base + traits + morale multiplier.
 * Used by all engine systems via `getStaffBonus` so improvements ripple
 * through training, scouting, youth, injury risk, etc.
 */
export function getEffectiveQuality(member: StaffMember): number {
  const base = (member.quality ?? 0) + getTraitBonus(member);
  const eff = base * getMoraleMultiplier(member.morale);
  return Math.round(eff * 10) / 10;
}

export function getStaffBonus(staff: StaffMember[], role: StaffRole): number {
  const member = staff.filter(s => s.role === role).sort((a, b) => b.quality - a.quality)[0];
  return member ? getEffectiveQuality(member) : 0;
}

/** Combined training staff bonus used by the engine: first-team-coach + fitness-coach * 0.5 */
export function getTrainingStaffBonus(staff: StaffMember[]): number {
  return getStaffBonus(staff, 'first-team-coach') + getStaffBonus(staff, 'fitness-coach') * 0.5;
}

const TRAIT_LABEL: Record<StaffTrait, string> = {
  tactician: 'Tactician',
  motivator: 'Motivator',
  talent_spotter: 'Talent Spotter',
  innovator: 'Innovator',
  disciplinarian: 'Disciplinarian',
  veteran: 'Veteran',
  rising_star: 'Rising Star',
};

const TRAIT_DESC: Record<StaffTrait, string> = {
  tactician: 'Sharper tactical work — boosts assistant manager and head coach output.',
  motivator: 'Lifts the dressing room. Higher morale floor and bigger praise gains.',
  talent_spotter: 'Eye for raw talent — better youth prospects and scout reports.',
  innovator: 'Modern training methods — extra training effectiveness on the staff.',
  disciplinarian: 'Tough on standards — fewer injuries when assigned as physio.',
  veteran: 'Steady hand. Morale decays slower; more reliable week to week.',
  rising_star: 'Young and improving — gains +1 quality every two seasons (capped).',
};

export function getTraitLabel(t: StaffTrait): string { return TRAIT_LABEL[t]; }
export function getTraitDescription(t: StaffTrait): string { return TRAIT_DESC[t]; }

/**
 * Backfill missing optional fields so older saves and freshly-loaded staff
 * always have morale/traits/contract years present at runtime. Safe no-op
 * for already-complete members.
 */
export function ensureStaffFields(member: StaffMember): StaffMember {
  if (
    typeof member.morale === 'number' &&
    Array.isArray(member.traits) &&
    typeof member.contractYearsRemaining === 'number' &&
    typeof member.seasonsAtClub === 'number' &&
    member.performance &&
    typeof member.lastInteractionWeek === 'number' &&
    typeof member.lastRenewalWeek === 'number'
  ) {
    return member;
  }
  return {
    ...member,
    morale: member.morale ?? STAFF_DEFAULT_MORALE,
    traits: Array.isArray(member.traits) ? member.traits : rollTraits(member.role),
    contractYearsRemaining: member.contractYearsRemaining ?? STAFF_CONTRACT_YEARS,
    seasonsAtClub: member.seasonsAtClub ?? 0,
    performance: member.performance ?? freshPerformance(),
    lastInteractionWeek: member.lastInteractionWeek ?? -99,
    lastRenewalWeek: member.lastRenewalWeek ?? -99,
  };
}
