/**
 * Transfer Offer Utilities
 * Performance multipliers, contract factors, and bid calculations for AI offer generation.
 */

import { Player, Position } from '@/types/game';
import {
  PERFORMANCE_GOAL_PREMIUM, PERFORMANCE_ASSIST_PREMIUM, PERFORMANCE_FORM_PREMIUM,
  PERFORMANCE_APPEARANCE_THRESHOLD, PERFORMANCE_MAX_MULTIPLIER,
  PERFORMANCE_FWD_GOAL_WEIGHT, PERFORMANCE_MID_GOAL_WEIGHT, PERFORMANCE_DEF_GOAL_WEIGHT,
  PERFORMANCE_EXPECTED_SEASON_APPEARANCES,
  CONTRACT_1YR_BID_FACTOR, CONTRACT_2YR_BID_FACTOR,
} from '@/config/transfers';

const FWD_POSITIONS: Position[] = ['ST', 'LW', 'RW'];
const MID_POSITIONS: Position[] = ['CM', 'CDM', 'CAM', 'LM', 'RM'];

/**
 * Calculate a fee multiplier based on a player's season performance.
 * Uses per-game rates normalized to a full season equivalent so that
 * summer-window (few games) and winter-window (many games) produce
 * comparable multipliers for the same quality of performance.
 */
export function getPerformanceMultiplier(player: Player): number {
  const goalWeight = FWD_POSITIONS.includes(player.position)
    ? PERFORMANCE_FWD_GOAL_WEIGHT
    : MID_POSITIONS.includes(player.position)
      ? PERFORMANCE_MID_GOAL_WEIGHT
      : PERFORMANCE_DEF_GOAL_WEIGHT;

  // Per-game rates, scaled to a full-season equivalent
  const gamesPlayed = player.appearances;
  const goalsPerGame = gamesPlayed > 0 ? player.goals / gamesPlayed : 0;
  const assistsPerGame = gamesPlayed > 0 ? player.assists / gamesPlayed : 0;

  const goalBonus = goalsPerGame * PERFORMANCE_EXPECTED_SEASON_APPEARANCES * PERFORMANCE_GOAL_PREMIUM * goalWeight;
  const assistBonus = assistsPerGame * PERFORMANCE_EXPECTED_SEASON_APPEARANCES * PERFORMANCE_ASSIST_PREMIUM;
  const formBonus = player.form > 50 ? (player.form - 50) * PERFORMANCE_FORM_PREMIUM : 0;

  // Dampen bonus for small sample sizes
  const appearanceScale = gamesPlayed >= PERFORMANCE_APPEARANCE_THRESHOLD
    ? 1.0
    : gamesPlayed / PERFORMANCE_APPEARANCE_THRESHOLD;

  const rawMultiplier = 1 + (goalBonus + assistBonus + formBonus) * appearanceScale;
  return Math.min(rawMultiplier, PERFORMANCE_MAX_MULTIPLIER);
}

/**
 * Discount factor based on remaining contract length.
 * Clubs bid less for players with expiring contracts.
 */
export function getContractLengthFactor(contractEnd: number, currentSeason: number): number {
  const yearsRemaining = contractEnd - currentSeason;
  if (yearsRemaining <= 1) return CONTRACT_1YR_BID_FACTOR;
  if (yearsRemaining === 2) return CONTRACT_2YR_BID_FACTOR;
  return 1.0;
}
