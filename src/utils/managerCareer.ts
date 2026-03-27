/**
 * Manager Career Mode Utilities
 * Helper functions for manager creation, reputation, job market, stat growth, and modifiers.
 */

import type {
  CareerManager,
  ManagerAttributes,
  ManagerTraitId,
  ReputationTier,
  JobVacancy,
  JobOffer,
  ManagerBonus,
  Club,
} from '@/types/game';
import {
  STARTING_ATTRIBUTE_MIN,
  STARTING_ATTRIBUTE_MAX,
  REP_TIER_THRESHOLDS,
  REP_MIN,
  REP_MAX,
  STAT_MIN,
  STAT_MAX,
  DEFAULT_RETIREMENT_AGE,
  LEGENDARY_RETIREMENT_EXTENSION,
  MAX_VACANCIES,
  VACANCY_DURATION_WEEKS,
  STARTING_JOB_OFFERS,
  CAREER_START_QUALITY_TIERS,
  LEGACY_TITLE_WEIGHT,
  LEGACY_PROMOTION_WEIGHT,
  LEGACY_CUP_WEIGHT,
  LEGACY_MATCH_WIN_WEIGHT,
  LEGACY_REPUTATION_WEIGHT,
  LEGACY_AWARD_WEIGHT,
  MANAGER_TRAITS,
  AI_SACKING_POSITION_THRESHOLD,
  MAX_NEGOTIATION_ROUNDS,
  SALARY_COUNTER_MAX_INCREASE,
  BOARD_ACCEPTANCE_BASE,
  BOARD_PATIENCE_MODIFIER,
  NEGOTIATION_PUSHBACK_FACTOR,
  NEGOTIATION_SKILL_MODIFIER,
} from '@/config/managerCareer';
import { LEAGUES, CLUBS_DATA } from '@/data/league';
import { VALUE_EXP_BASE, VALUE_EXP_RATE } from '@/config/playerGeneration';

// ── Helpers ──

/** Local clamp without rounding (unlike helpers.ts clamp which rounds to integer) */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Manager Creation ──

export function generateStartingAttributes(traits: ManagerTraitId[]): ManagerAttributes {
  const attrs: ManagerAttributes = {
    tacticalKnowledge: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
    motivation: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
    negotiation: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
    scoutingEye: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
    youthDevelopment: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
    discipline: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
    mediaHandling: randInt(STARTING_ATTRIBUTE_MIN, STARTING_ATTRIBUTE_MAX),
  };

  // Apply trait bonuses
  for (const traitId of traits) {
    const trait = MANAGER_TRAITS[traitId];
    if (!trait) continue;
    for (const [key, bonus] of Object.entries(trait.attributeBonus)) {
      const attrKey = key as keyof ManagerAttributes;
      attrs[attrKey] = clamp(attrs[attrKey] + (bonus as number), STAT_MIN, STAT_MAX);
    }
  }

  return attrs;
}

export function createDefaultManager(
  name: string,
  nationality: string,
  age: number,
  traits: ManagerTraitId[]
): CareerManager {
  const attributes = generateStartingAttributes(traits);
  const reputationScore = 30; // Start just above unknown tier
  const reputationTier = calculateReputationTier(reputationScore);
  const retirementAge = DEFAULT_RETIREMENT_AGE;

  return {
    name,
    nationality,
    age,
    retirementAge,
    attributes,
    traits,
    contract: null,
    careerHistory: [],
    reputationScore,
    reputationTier,
    totalCareerWins: 0,
    totalCareerDraws: 0,
    totalCareerLosses: 0,
    totalCareerMatches: 0,
    promotionsWon: 0,
    titlesWon: 0,
    cupsWon: 0,
    sackedCount: 0,
    resignedCount: 0,
    awardsWon: [],
    legacyScore: 0,
    unemployedWeeks: 0,
  };
}

// ── Reputation ──

export function calculateReputationTier(score: number): ReputationTier {
  if (score >= REP_TIER_THRESHOLDS.legendary) return 'legendary';
  if (score >= REP_TIER_THRESHOLDS.world_class) return 'world_class';
  if (score >= REP_TIER_THRESHOLDS.continental) return 'continental';
  if (score >= REP_TIER_THRESHOLDS.national) return 'national';
  if (score >= REP_TIER_THRESHOLDS.regional) return 'regional';
  return 'unknown';
}

export function clampReputation(score: number): number {
  return clamp(score, REP_MIN, REP_MAX);
}

export function getReputationTierLabel(tier: ReputationTier): string {
  const labels: Record<ReputationTier, string> = {
    unknown: 'Unknown',
    regional: 'Regional',
    national: 'National',
    continental: 'Continental',
    world_class: 'World Class',
    legendary: 'Legendary',
  };
  return labels[tier];
}

export function getReputationColor(tier: ReputationTier): string {
  const colors: Record<ReputationTier, string> = {
    unknown: 'text-muted-foreground',
    regional: 'text-blue-400',
    national: 'text-emerald-400',
    continental: 'text-purple-400',
    world_class: 'text-amber-400',
    legendary: 'text-primary',
  };
  return colors[tier];
}

// ── Job Market ──

export function generateJobVacancies(
  clubs: Record<string, Club>,
  managerReputation: number,
  season: number,
  week: number,
): JobVacancy[] {
  const allClubs = Object.values(clubs);
  const candidates = allClubs.filter(club => {
    // Find which league this club belongs to
    const league = LEAGUES.find(l => l.id === club.divisionId);
    if (!league) return false;
    // Filter to clubs the manager could realistically manage
    const minRep = getMinReputationForLeague(league.qualityTier);
    return managerReputation >= minRep * 0.5; // Show vacancies slightly above reach too
  });

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, MAX_VACANCIES);

  return selected.map(club => {
    const league = LEAGUES.find(l => l.id === club.divisionId);
    const minRep = getMinReputationForLeague(league?.qualityTier || 4);

    return {
      id: `vacancy-${club.id}-${season}-${week}`,
      clubId: club.id,
      clubName: club.name,
      divisionId: club.divisionId || '',
      minReputation: minRep,
      salary: generateManagerSalary(league?.qualityTier || 4, club.reputation),
      contractLength: randInt(1, 3),
      boardExpectations: generateBoardExpectation(league?.qualityTier || 4, club.reputation),
      expiresWeek: week + VACANCY_DURATION_WEEKS,
      expiresSeason: season,
      applied: false,
    };
  });
}

// ── Squad Value Estimation ──

/** Estimate total squad market value from squadQuality (deterministic, no random). */
export function estimateSquadValue(squadQuality: number, squadSize: number = 25): number {
  let total = 0;
  for (let i = 0; i < squadSize; i++) {
    // Distribute players around squadQuality with fixed variance
    const offset = (i % 5) * 3 - 6; // -6, -3, 0, 3, 6
    const ovr = clamp(squadQuality + offset, 30, 99);
    total += Math.round(VALUE_EXP_BASE * Math.exp(VALUE_EXP_RATE * ovr));
  }
  return total;
}

/** Calculate expected league position range based on squadQuality relative to peers. */
export function calculateExpectedPosition(clubId: string, leagueId: string): string {
  const leagueClubs = CLUBS_DATA.filter(c => c.divisionId === leagueId);
  if (leagueClubs.length === 0) return 'Unknown';

  const sorted = [...leagueClubs].sort((a, b) => b.squadQuality - a.squadQuality);
  const rank = sorted.findIndex(c => c.id === clubId) + 1;
  const total = sorted.length;

  if (rank <= 2) return '1st - 2nd';
  if (rank <= Math.ceil(total * 0.25)) return `${rank - 1}th - ${rank + 1}th`;
  if (rank <= Math.ceil(total * 0.5)) return 'Top half';
  if (rank <= Math.ceil(total * 0.75)) return 'Lower half';
  return 'Bottom quarter';
}

/** Negotiate salary counter-offer. Returns updated offer. */
export function negotiateSalary(
  offer: JobOffer,
  requestedSalary: number,
  managerNegotiationSkill: number = 5,
): JobOffer {
  const round = (offer.negotiationRound || 0) + 1;
  if (round > MAX_NEGOTIATION_ROUNDS) {
    return { ...offer, negotiationStatus: 'final' };
  }

  const initialSalary = offer.initialSalary || offer.salary;
  const maxAllowed = initialSalary * (1 + SALARY_COUNTER_MAX_INCREASE);
  const capped = Math.min(requestedSalary, maxAllowed);

  const increaseRatio = (capped - initialSalary) / initialSalary;
  const boardPatience = offer.boardPatience || 5;

  // Acceptance probability
  let acceptChance = BOARD_ACCEPTANCE_BASE
    + boardPatience * BOARD_PATIENCE_MODIFIER
    + managerNegotiationSkill * NEGOTIATION_SKILL_MODIFIER
    - increaseRatio * 2 // higher ask = lower chance
    - (round - 1) * NEGOTIATION_PUSHBACK_FACTOR;
  acceptChance = clamp(acceptChance, 0.1, 0.95);

  const roll = Math.random();

  if (roll < acceptChance) {
    // Board accepts
    return {
      ...offer,
      salary: Math.round(capped),
      negotiationRound: round,
      negotiationStatus: 'accepted',
    };
  } else if (roll < acceptChance + 0.3) {
    // Board compromises — meet halfway between current and requested
    const compromise = Math.round((offer.salary + capped) / 2);
    return {
      ...offer,
      salary: compromise,
      negotiationRound: round,
      negotiationStatus: round >= MAX_NEGOTIATION_ROUNDS ? 'final' : 'pending',
    };
  } else {
    // Board rejects — keep current salary
    return {
      ...offer,
      negotiationRound: round,
      negotiationStatus: round >= MAX_NEGOTIATION_ROUNDS ? 'final' : 'pending',
    };
  }
}

// ── Starting Offers (enriched) ──

export function generateStartingOffers(
  clubs: Record<string, Pick<Club, 'id' | 'name' | 'divisionId' | 'reputation'>>,
): JobOffer[] {
  const allClubs = Object.values(clubs);

  // Filter to clubs in lower-tier leagues only
  const lowerTierClubs = allClubs.filter(club => {
    const league = LEAGUES.find(l => l.id === club.divisionId);
    return league && CAREER_START_QUALITY_TIERS.includes(league.qualityTier);
  });

  if (lowerTierClubs.length === 0) return [];

  const shuffled = [...lowerTierClubs].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, STARTING_JOB_OFFERS);

  return selected.map(club => {
    const league = LEAGUES.find(l => l.id === club.divisionId);
    const qualityTier = league?.qualityTier || 4;
    const salary = generateManagerSalary(qualityTier, club.reputation);

    // Find full ClubData for enrichment
    const clubData = CLUBS_DATA.find(c => c.id === club.id);

    return {
      id: `start-offer-${club.id}`,
      clubId: club.id,
      clubName: club.name,
      divisionId: club.divisionId || '',
      salary,
      contractLength: 2,
      bonuses: generateDefaultBonuses(qualityTier),
      boardExpectations: generateBoardExpectation(qualityTier, club.reputation),
      expiresWeek: 99,
      expiresSeason: 1,

      // Enriched club profile
      leagueName: league?.name || '',
      country: league?.country || '',
      clubColor: clubData?.color || '#888888',
      reputation: club.reputation,
      budget: clubData?.budget || 0,
      estimatedSquadValue: estimateSquadValue(clubData?.squadQuality || 50),
      expectedPosition: calculateExpectedPosition(club.id, club.divisionId || ''),
      facilities: clubData?.facilities || 5,
      youthRating: clubData?.youthRating || 5,
      boardPatience: clubData?.boardPatience || 5,
      stadiumName: clubData?.stadiumName || '',
      stadiumCapacity: clubData?.stadiumCapacity || 0,
      fanBase: clubData?.fanBase || 50,

      // Negotiation defaults
      initialSalary: salary,
      negotiationRound: 0,
      negotiationStatus: 'pending',
    };
  });
}

function getMinReputationForLeague(qualityTier: 1 | 2 | 3 | 4): number {
  const thresholds: Record<number, number> = {
    1: 500,
    2: 250,
    3: 100,
    4: 0,
  };
  return thresholds[qualityTier] || 0;
}

function generateManagerSalary(qualityTier: 1 | 2 | 3 | 4, clubRep: number): number {
  const baseSalaries: Record<number, number> = {
    1: 25000,
    2: 12000,
    3: 5000,
    4: 2000,
  };
  const base = baseSalaries[qualityTier] || 2000;
  return Math.round(base * (0.8 + Math.random() * 0.4 + clubRep * 0.1));
}

function generateBoardExpectation(qualityTier: 1 | 2 | 3 | 4, clubRep: number): string {
  if (qualityTier <= 1 && clubRep >= 4) return 'Challenge for the title';
  if (qualityTier <= 1) return 'Finish in the top half';
  if (qualityTier === 2 && clubRep >= 3) return 'Push for promotion';
  if (qualityTier === 2) return 'Comfortable mid-table finish';
  if (qualityTier === 3 && clubRep >= 3) return 'Fight for promotion';
  if (qualityTier === 3) return 'Avoid the bottom half';
  if (clubRep >= 2) return 'Push for promotion';
  return 'Survive and stabilize the club';
}

export function generateDefaultBonuses(qualityTier: 1 | 2 | 3 | 4): ManagerBonus[] {
  const bonuses: ManagerBonus[] = [];

  if (qualityTier >= 2) {
    bonuses.push({
      condition: 'promotion',
      amount: qualityTier === 4 ? 25000 : qualityTier === 3 ? 50000 : 100000,
      met: false,
    });
  }

  bonuses.push({
    condition: 'avoid_relegation',
    amount: qualityTier === 4 ? 10000 : 25000,
    met: false,
  });

  return bonuses;
}

// ── Manager Stat Growth ──

export function growAttribute(currentValue: number, growthAmount: number): number {
  // Fractional growth: accumulate and apply when integer threshold crossed
  const newValue = currentValue + growthAmount;
  return clamp(newValue, STAT_MIN, STAT_MAX);
}

// ── Legacy Score ──

export function calculateLegacyScore(manager: CareerManager): number {
  return Math.round(
    manager.titlesWon * LEGACY_TITLE_WEIGHT +
    manager.promotionsWon * LEGACY_PROMOTION_WEIGHT +
    manager.cupsWon * LEGACY_CUP_WEIGHT +
    manager.totalCareerWins * LEGACY_MATCH_WIN_WEIGHT +
    manager.reputationScore * LEGACY_REPUTATION_WEIGHT +
    manager.awardsWon.length * LEGACY_AWARD_WEIGHT
  );
}

// ── AI Manager Sacking ──

export function shouldAIManagerGetSacked(
  position: number,
  expectedPosition: number,
): boolean {
  return position > expectedPosition + AI_SACKING_POSITION_THRESHOLD;
}

// ── Retirement ──

export function getRetirementAge(manager: CareerManager): number {
  if (manager.reputationTier === 'legendary') {
    return DEFAULT_RETIREMENT_AGE + LEGENDARY_RETIREMENT_EXTENSION;
  }
  return DEFAULT_RETIREMENT_AGE;
}

export function isRetired(manager: CareerManager): boolean {
  return manager.age >= getRetirementAge(manager);
}
