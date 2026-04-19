import type { Player, ContractOffer } from '@/types/game';
import {
  CONTRACT_NEAR_EXPIRY_SEASONS,
  CONTRACT_AGE_BRACKETS, CONTRACT_DEFAULT_AGE_FACTOR,
  CONTRACT_QUALITY_BASE_OVERALL, CONTRACT_QUALITY_SCALE,
  CONTRACT_FORM_HIGH, CONTRACT_FORM_LOW, CONTRACT_FORM_HIGH_FACTOR, CONTRACT_FORM_LOW_FACTOR,
  CONTRACT_MORALE_LOW, CONTRACT_MORALE_HIGH, CONTRACT_MORALE_LOW_FACTOR, CONTRACT_MORALE_HIGH_FACTOR,
  CONTRACT_REP_MULTIPLIER, CONTRACT_MINIMUM_WAGE,
  CONTRACT_AGENT_FEE_BASE, CONTRACT_AGENT_FEE_RANGE, CONTRACT_WAGE_WEEKS_PER_YEAR,
  CONTRACT_WILLINGNESS_BASE, CONTRACT_WILLINGNESS_MORALE_FACTOR, CONTRACT_WILLINGNESS_FORM_FACTOR,
  CONTRACT_WILLINGNESS_REP_FACTOR, CONTRACT_WILLINGNESS_LOW_CONTRACT_PENALTY,
  CONTRACT_WILLINGNESS_YOUNG_BONUS, CONTRACT_WILLINGNESS_STAR_PENALTY,
  CONTRACT_WILLINGNESS_LOW_CONTRACT_THRESHOLD, CONTRACT_WILLINGNESS_YOUNG_AGE,
  CONTRACT_WILLINGNESS_STAR_OVERALL, CONTRACT_WILLINGNESS_MIN, CONTRACT_WILLINGNESS_MAX,
  CONTRACT_YEARS_BRACKETS, CONTRACT_DEFAULT_YEARS,
  CONTRACT_INITIAL_OFFER_MULTIPLIER, CONTRACT_LOYALTY_BONUS_RATE,
  CONTRACT_MAX_ROUNDS,
  CONTRACT_GAP_ACCEPT, CONTRACT_GAP_VERY_CLOSE_ACCEPT, CONTRACT_GAP_MOOD_ACCEPT, CONTRACT_GAP_HIGH_MOOD_ACCEPT,
  CONTRACT_VERY_CLOSE_MOOD_THRESHOLD, CONTRACT_MOOD_ACCEPT_THRESHOLD, CONTRACT_HIGH_MOOD_THRESHOLD,
  CONTRACT_COMPROMISE_BASE, CONTRACT_COMPROMISE_MOOD_SCALE,
  CONTRACT_LOWBALL_GAP, CONTRACT_MODERATE_GAP,
  CONTRACT_MOOD_HIT_LOWBALL, CONTRACT_MOOD_HIT_MODERATE, CONTRACT_MOOD_HIT_CLOSE,
  CONTRACT_MOOD_FLOOR,
  CONTRACT_PREFERRED_YEARS_BRACKETS, CONTRACT_PREFERRED_YEARS_DEFAULT,
  CONTRACT_YEARS_ACCEPTANCE_BONUS, CONTRACT_YEARS_ACCEPTANCE_PENALTY,
  CONTRACT_YEARS_MOOD_PENALTY, CONTRACT_YEARS_MOOD_BONUS,
  CONTRACT_VETERAN_AGE, CONTRACT_VETERAN_YEARS_BONUS_MULT,
} from '@/config/contracts';

export type ContractUrgency = 'expired' | 'near' | null;

/** Determine the urgency level of a player's contract relative to the current season. */
export function getContractUrgency(contractEnd: number, season: number): ContractUrgency {
  if (contractEnd <= season) return 'expired';
  if (contractEnd <= season + CONTRACT_NEAR_EXPIRY_SEASONS) return 'near';
  return null;
}

/**
 * Generate a player's wage demand based on their attributes, age, and current contract.
 * Players demand more when they're in form, young and high-potential, or at peak age.
 */
export function calculateWageDemand(player: Player, clubReputation: number): number {
  const baseDemand = player.wage;

  // Age factor: peak earners at 26-29, young players accept less, older accept slight discount
  const ageBracket = CONTRACT_AGE_BRACKETS.find(b => player.age < b.maxAge);
  const ageFactor = ageBracket ? ageBracket.factor : CONTRACT_DEFAULT_AGE_FACTOR;

  // Quality factor: higher overall = higher demands
  const qualityFactor = 1 + (player.overall - CONTRACT_QUALITY_BASE_OVERALL) * CONTRACT_QUALITY_SCALE;

  // Form factor: in-form players know their worth
  const formFactor = player.form > CONTRACT_FORM_HIGH ? CONTRACT_FORM_HIGH_FACTOR
    : player.form < CONTRACT_FORM_LOW ? CONTRACT_FORM_LOW_FACTOR : 1.0;

  // Morale factor: unhappy players demand more (compensation) or less (want to leave)
  const moraleFactor = player.morale < CONTRACT_MORALE_LOW ? CONTRACT_MORALE_LOW_FACTOR
    : player.morale > CONTRACT_MORALE_HIGH ? CONTRACT_MORALE_HIGH_FACTOR : 1.0;

  // Club reputation: bigger clubs = higher wage expectations
  const repFactor = 1 + clubReputation * CONTRACT_REP_MULTIPLIER;

  const demand = Math.round(baseDemand * ageFactor * qualityFactor * formFactor * moraleFactor * repFactor);
  // Round to nearest 1000 so demands align with the UI slider step
  const rounded = Math.round(demand / 1000) * 1000;
  return Math.max(CONTRACT_MINIMUM_WAGE, rounded || demand);
}

/** Get the player's preferred contract length based on age. */
export function getPreferredYears(age: number): number {
  const bracket = CONTRACT_PREFERRED_YEARS_BRACKETS.find(b => age < b.maxAge);
  return bracket ? bracket.preferredYears : CONTRACT_PREFERRED_YEARS_DEFAULT;
}

/** Calculate agent fee based on player value and deal complexity. */
function calculateAgentFee(player: Player): number {
  const feeRate = CONTRACT_AGENT_FEE_BASE + Math.random() * CONTRACT_AGENT_FEE_RANGE;
  const annualWage = player.wage * CONTRACT_WAGE_WEEKS_PER_YEAR;
  return Math.round(annualWage * feeRate);
}

/**
 * Determine player's willingness to negotiate (0-100).
 * Higher = more willing to accept lower offers.
 */
export function getPlayerWillingness(player: Player, clubReputation: number, isRenewal: boolean, currentSeason: number = 1): number {
  let willingness = CONTRACT_WILLINGNESS_BASE;

  // Happy players more willing to renew
  if (isRenewal) {
    willingness += (player.morale - 50) * CONTRACT_WILLINGNESS_MORALE_FACTOR;
    willingness += (player.form - 50) * CONTRACT_WILLINGNESS_FORM_FACTOR;
  }

  // Club reputation matters for new signings
  if (!isRenewal) {
    willingness += clubReputation * CONTRACT_WILLINGNESS_REP_FACTOR;
  }

  // Contract running down = more leverage for player
  if (player.contractEnd <= currentSeason + CONTRACT_WILLINGNESS_LOW_CONTRACT_THRESHOLD) willingness -= CONTRACT_WILLINGNESS_LOW_CONTRACT_PENALTY;

  // Young players are more flexible
  if (player.age < CONTRACT_WILLINGNESS_YOUNG_AGE) willingness += CONTRACT_WILLINGNESS_YOUNG_BONUS;

  // Stars are harder to negotiate with
  if (player.overall >= CONTRACT_WILLINGNESS_STAR_OVERALL) willingness -= CONTRACT_WILLINGNESS_STAR_PENALTY;

  return Math.max(CONTRACT_WILLINGNESS_MIN, Math.min(CONTRACT_WILLINGNESS_MAX, Math.round(willingness)));
}

/**
 * Create initial contract offer for negotiation.
 */
export function createContractOffer(
  player: Player,
  clubReputation: number,
  isRenewal: boolean,
  currentSeason: number = 1,
): ContractOffer {
  const demandedWage = calculateWageDemand(player, clubReputation);
  const agentFee = calculateAgentFee(player);
  const willingness = getPlayerWillingness(player, clubReputation, isRenewal, currentSeason);
  const loyaltyBonus = isRenewal ? Math.round(player.value * CONTRACT_LOYALTY_BONUS_RATE) : 0;

  const yearsBracket = CONTRACT_YEARS_BRACKETS.find(b => player.age < b.maxAge);
  const contractYears = yearsBracket ? yearsBracket.years : CONTRACT_DEFAULT_YEARS;

  return {
    id: crypto.randomUUID(),
    playerId: player.id,
    type: isRenewal ? 'renewal' : 'new',
    offeredWage: Math.round(Math.round(demandedWage * CONTRACT_INITIAL_OFFER_MULTIPLIER) / 1000) * 1000 || Math.round(demandedWage * CONTRACT_INITIAL_OFFER_MULTIPLIER),
    demandedWage,
    agentFee,
    loyaltyBonus,
    contractYears,
    playerAge: player.age,
    round: 1,
    status: 'in_progress',
    playerMood: willingness,
  };
}

/**
 * Process a negotiation round. Player responds to the offered wage.
 * Returns updated offer with new demanded wage (player may compromise) or rejection.
 * Contract years affect the effective gap: offering more years than the player prefers
 * gives a bonus, fewer years gives a penalty.
 */
export function negotiateRound(offer: ContractOffer, iconStatusBonus = 0): ContractOffer {
  if (offer.demandedWage <= 0) return { ...offer, status: 'accepted', round: offer.round + 1 };

  // Fast-path: meeting or exceeding all demands with reasonable mood = guaranteed acceptance
  const preferredYears = getPreferredYears(offer.playerAge);
  if (offer.offeredWage >= offer.demandedWage && offer.contractYears >= preferredYears && offer.playerMood >= CONTRACT_MOOD_FLOOR) {
    return { ...offer, status: 'accepted', round: offer.round + 1 };
  }

  const gap = offer.offeredWage / offer.demandedWage;

  // Years deviation adjusts the effective acceptance gap.
  // Veterans (age > CONTRACT_VETERAN_AGE) don't value extra years as much — the bonus is muted
  // so handing a 33-year-old a 5-year deal no longer farms a +25% advantage.
  const yearsDiff = offer.contractYears - preferredYears;
  const isVeteran = offer.playerAge > CONTRACT_VETERAN_AGE;
  const yearsAdjustment = yearsDiff > 0
    ? yearsDiff * CONTRACT_YEARS_ACCEPTANCE_BONUS * (isVeteran ? CONTRACT_VETERAN_YEARS_BONUS_MULT : 1)
    : yearsDiff * CONTRACT_YEARS_ACCEPTANCE_PENALTY;
  const adjustedGap = gap + yearsAdjustment + iconStatusBonus;

  // Player accepts if offer meets or exceeds demand (adjusted for years), or close enough + willing.
  // Tiered by how close the offer is — the closer to demand, the more forgiving mood can be.
  if (
    adjustedGap >= CONTRACT_GAP_ACCEPT ||
    (adjustedGap >= CONTRACT_GAP_VERY_CLOSE_ACCEPT && offer.playerMood >= CONTRACT_VERY_CLOSE_MOOD_THRESHOLD) ||
    (adjustedGap >= CONTRACT_GAP_MOOD_ACCEPT && offer.playerMood >= CONTRACT_MOOD_ACCEPT_THRESHOLD) ||
    (adjustedGap >= CONTRACT_GAP_HIGH_MOOD_ACCEPT && offer.playerMood >= CONTRACT_HIGH_MOOD_THRESHOLD)
  ) {
    return { ...offer, status: 'accepted', round: offer.round + 1 };
  }

  // Max rounds reached
  if (offer.round >= CONTRACT_MAX_ROUNDS) {
    return { ...offer, status: 'rejected', round: offer.round + 1 };
  }

  // Player compromises partially based on mood
  const compromise = CONTRACT_COMPROMISE_BASE + (offer.playerMood / 100) * CONTRACT_COMPROMISE_MOOD_SCALE;
  const rawDemand = Math.round(offer.demandedWage * (1 - compromise));
  const newDemand = Math.round(rawDemand / 1000) * 1000 || rawDemand;

  // Player mood decreases if lowballed
  const wageMoodChange = gap < CONTRACT_LOWBALL_GAP ? CONTRACT_MOOD_HIT_LOWBALL
    : gap < CONTRACT_MODERATE_GAP ? CONTRACT_MOOD_HIT_MODERATE : CONTRACT_MOOD_HIT_CLOSE;

  // Years deviation also affects mood — offering fewer years than preferred frustrates players.
  // Veterans get a muted bonus for extra years (they're less thrilled about long commitments).
  const yearsMoodChange = yearsDiff > 0
    ? yearsDiff * CONTRACT_YEARS_MOOD_BONUS * (isVeteran ? CONTRACT_VETERAN_YEARS_BONUS_MULT : 1)
    : yearsDiff * CONTRACT_YEARS_MOOD_PENALTY;
  const moodChange = wageMoodChange + yearsMoodChange;

  return {
    ...offer,
    demandedWage: newDemand,
    playerMood: Math.max(CONTRACT_MOOD_FLOOR, offer.playerMood + moodChange),
    round: offer.round + 1,
    status: 'in_progress',
  };
}

/**
 * Compute the years adjustment percentage for display in the UI.
 * Positive = bonus (offering more years), negative = penalty (offering fewer).
 */
export function getYearsAdjustment(age: number, offeredYears: number): number {
  const preferred = getPreferredYears(age);
  const diff = offeredYears - preferred;
  if (diff > 0) {
    const mult = age > CONTRACT_VETERAN_AGE ? CONTRACT_VETERAN_YEARS_BONUS_MULT : 1;
    return diff * CONTRACT_YEARS_ACCEPTANCE_BONUS * mult;
  }
  if (diff < 0) return diff * CONTRACT_YEARS_ACCEPTANCE_PENALTY;
  return 0;
}

/**
 * Get an acceptance hint that accounts for BOTH wage gap AND years deviation.
 * Each branch cites the real acceptance thresholds so what the UI says matches
 * what `negotiateRound` will actually do. When mood is the blocker, the hint
 * names the mood floor that would flip the decision.
 */
export function getAcceptanceHint(
  wageGap: number,
  playerAge: number,
  offeredYears: number,
  playerMood: number,
  offeredWage?: number,
): { text: string; colorClass: string } {
  const yearsAdj = getYearsAdjustment(playerAge, offeredYears);
  const adjustedGap = wageGap + yearsAdj;

  const wagePreview = offeredWage != null ? formatWage(offeredWage) : null;
  const yearsLabel = `${offeredYears} yr${offeredYears === 1 ? '' : 's'}`;
  const acceptText = wagePreview
    ? `Will sign ${wagePreview} for ${yearsLabel}`
    : 'Will accept this deal';

  // Accepted now
  if (
    adjustedGap >= CONTRACT_GAP_ACCEPT ||
    (adjustedGap >= CONTRACT_GAP_VERY_CLOSE_ACCEPT && playerMood >= CONTRACT_VERY_CLOSE_MOOD_THRESHOLD) ||
    (adjustedGap >= CONTRACT_GAP_MOOD_ACCEPT && playerMood >= CONTRACT_MOOD_ACCEPT_THRESHOLD) ||
    (adjustedGap >= CONTRACT_GAP_HIGH_MOOD_ACCEPT && playerMood >= CONTRACT_HIGH_MOOD_THRESHOLD)
  ) {
    return { text: acceptText, colorClass: 'text-emerald-400' };
  }

  // Mood-blocked branches: offer is in an acceptance band but mood falls short.
  // Surface the exact mood floor that would tip it over.
  if (adjustedGap >= CONTRACT_GAP_VERY_CLOSE_ACCEPT) {
    return {
      text: `Very close — needs mood ${CONTRACT_VERY_CLOSE_MOOD_THRESHOLD}+`,
      colorClass: 'text-amber-400/80',
    };
  }
  if (adjustedGap >= CONTRACT_GAP_MOOD_ACCEPT) {
    return {
      text: `Close — needs mood ${CONTRACT_MOOD_ACCEPT_THRESHOLD}+`,
      colorClass: 'text-amber-400/80',
    };
  }
  if (adjustedGap >= CONTRACT_GAP_HIGH_MOOD_ACCEPT) {
    return {
      text: `Below expectations — needs mood ${CONTRACT_HIGH_MOOD_THRESHOLD}+`,
      colorClass: 'text-amber-400/80',
    };
  }

  // Gap-blocked: no reasonable mood rescues the offer.
  if (adjustedGap >= 0.75) {
    return { text: 'Poor offer — mood will drop', colorClass: 'text-red-400/80' };
  }
  return { text: 'Insulting offer — mood will tank', colorClass: 'text-red-400' };
}

/**
 * Format wage for display.
 */
export function formatWage(wage: number): string {
  if (wage >= 1_000_000) return `£${(wage / 1_000_000).toFixed(1)}M/wk`;
  if (wage >= 1_000) return `£${Math.floor(wage / 1_000)}K/wk`;
  return `£${wage}/wk`;
}
