/**
 * Personality System Configuration
 * Trait ranges, label thresholds, multiplier bounds, and transfer demand constants.
 */

// ── Trait Generation ──
export const PERSONALITY_TRAIT_MIN = 1;
export const PERSONALITY_TRAIT_MAX = 20;

// ── Personality Label Thresholds ──
export const LABEL_MODEL_PRO_PROF = 16;
export const LABEL_MODEL_PRO_TEMP = 14;
export const LABEL_BORN_LEADER_LEAD = 16;
export const LABEL_BORN_LEADER_PROF = 12;
export const LABEL_CLUB_LEGEND_LOYALTY = 16;
export const LABEL_CLUB_LEGEND_LEAD = 14;
export const LABEL_MAVERICK_AMB = 16;
export const LABEL_MAVERICK_PROF_BELOW = 10;
export const LABEL_LOYAL_SERVANT_LOYALTY = 16;
export const LABEL_LOYAL_SERVANT_AMB_BELOW = 10;
export const LABEL_STEADY_HAND_TEMP = 16;
export const LABEL_STEADY_HAND_AMB_BELOW = 10;
export const LABEL_HOT_HEAD_TEMP_BELOW = 6;
export const LABEL_ENIGMA_PROF_BELOW = 5;
export const LABEL_ENIGMA_AMB_BELOW = 5;
export const LABEL_AMBITIOUS_AMB = 14;
export const LABEL_LAID_BACK_AMB_BELOW = 8;
export const LABEL_LAID_BACK_PROF_BELOW = 8;

// ── Training Effectiveness Multiplier ──
export const TRAINING_MULT_MIN = 0.7;
export const TRAINING_MULT_RANGE = 0.6;

// ── Development Speed Multiplier ──
export const DEV_MULT_MIN = 0.8;
export const DEV_MULT_RANGE = 0.4;

// ── Card Risk Multiplier ──
export const CARD_RISK_MULT_MIN = 1.0;
export const CARD_RISK_MULT_RANGE = 0.8;

// ── Morale Stability Multiplier ──
export const MORALE_STABILITY_MIN = 0.6;
export const MORALE_STABILITY_RANGE = 0.6;

// ── Leadership Bonus ──
export const LEADERSHIP_THRESHOLD = 14;
export const LEADERSHIP_MAX_BONUS = 0.15;

// ── Transfer Demand ──
export const TRANSFER_DEMAND_MIN_AMBITION = 14;
export const TRANSFER_DEMAND_MAX_LOYALTY = 12;
export const TRANSFER_DEMAND_REP_MULTIPLIER = 12;
export const TRANSFER_DEMAND_REP_OFFSET = 15;
export const TRANSFER_DEMAND_CHANCE_FACTOR = 0.02;
