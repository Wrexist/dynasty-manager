import type { Player, ContractOffer } from '@/types/game';
import {
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
  CONTRACT_GAP_ACCEPT, CONTRACT_GAP_MOOD_ACCEPT, CONTRACT_GAP_HIGH_MOOD_ACCEPT,
  CONTRACT_MOOD_ACCEPT_THRESHOLD, CONTRACT_HIGH_MOOD_THRESHOLD,
  CONTRACT_COMPROMISE_BASE, CONTRACT_COMPROMISE_MOOD_SCALE,
  CONTRACT_LOWBALL_GAP, CONTRACT_MODERATE_GAP,
  CONTRACT_MOOD_HIT_LOWBALL, CONTRACT_MOOD_HIT_MODERATE, CONTRACT_MOOD_HIT_CLOSE,
  CONTRACT_MOOD_FLOOR,
} from '@/config/contracts';

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
  return Math.max(CONTRACT_MINIMUM_WAGE, demand);
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
    offeredWage: Math.round(demandedWage * CONTRACT_INITIAL_OFFER_MULTIPLIER),
    demandedWage,
    agentFee,
    loyaltyBonus,
    contractYears,
    round: 1,
    status: 'in_progress',
    playerMood: willingness,
  };
}

/**
 * Process a negotiation round. Player responds to the offered wage.
 * Returns updated offer with new demanded wage (player may compromise) or rejection.
 */
export function negotiateRound(offer: ContractOffer): ContractOffer {
  if (offer.demandedWage <= 0) return { ...offer, status: 'accepted', round: offer.round + 1 };
  const gap = offer.offeredWage / offer.demandedWage;

  // Player accepts if offer meets or exceeds demand, or close enough + willing
  if (
    gap >= CONTRACT_GAP_ACCEPT ||
    (gap >= CONTRACT_GAP_MOOD_ACCEPT && offer.playerMood >= CONTRACT_MOOD_ACCEPT_THRESHOLD) ||
    (gap >= CONTRACT_GAP_HIGH_MOOD_ACCEPT && offer.playerMood >= CONTRACT_HIGH_MOOD_THRESHOLD)
  ) {
    return { ...offer, status: 'accepted', round: offer.round + 1 };
  }

  // Max rounds reached
  if (offer.round >= CONTRACT_MAX_ROUNDS) {
    return { ...offer, status: 'rejected', round: offer.round + 1 };
  }

  // Player compromises partially based on mood
  const compromise = CONTRACT_COMPROMISE_BASE + (offer.playerMood / 100) * CONTRACT_COMPROMISE_MOOD_SCALE;
  const newDemand = Math.round(offer.demandedWage * (1 - compromise));

  // Player mood decreases if lowballed
  const moodChange = gap < CONTRACT_LOWBALL_GAP ? CONTRACT_MOOD_HIT_LOWBALL
    : gap < CONTRACT_MODERATE_GAP ? CONTRACT_MOOD_HIT_MODERATE : CONTRACT_MOOD_HIT_CLOSE;

  return {
    ...offer,
    demandedWage: newDemand,
    playerMood: Math.max(CONTRACT_MOOD_FLOOR, offer.playerMood + moodChange),
    round: offer.round + 1,
    status: 'in_progress',
  };
}

/**
 * Format wage for display.
 */
export function formatWage(wage: number): string {
  if (wage >= 1_000_000) return `£${(wage / 1_000_000).toFixed(1)}M/wk`;
  if (wage >= 1_000) return `£${(wage / 1_000).toFixed(0)}K/wk`;
  return `£${wage}/wk`;
}
