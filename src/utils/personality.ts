import { Player, PlayerPersonality, PersonalityLabel } from '@/types/game';
import {
  PERSONALITY_TRAIT_MIN, PERSONALITY_TRAIT_MAX,
  LABEL_MODEL_PRO_PROF, LABEL_MODEL_PRO_TEMP,
  LABEL_BORN_LEADER_LEAD, LABEL_BORN_LEADER_PROF,
  LABEL_CLUB_LEGEND_LOYALTY, LABEL_CLUB_LEGEND_LEAD,
  LABEL_MAVERICK_AMB, LABEL_MAVERICK_PROF_BELOW,
  LABEL_LOYAL_SERVANT_LOYALTY, LABEL_LOYAL_SERVANT_AMB_BELOW,
  LABEL_STEADY_HAND_TEMP, LABEL_STEADY_HAND_AMB_BELOW,
  LABEL_HOT_HEAD_TEMP_BELOW,
  LABEL_ENIGMA_PROF_BELOW, LABEL_ENIGMA_AMB_BELOW,
  LABEL_AMBITIOUS_AMB,
  LABEL_LAID_BACK_AMB_BELOW, LABEL_LAID_BACK_PROF_BELOW,
  TRAINING_MULT_MIN, TRAINING_MULT_RANGE,
  DEV_MULT_MIN, DEV_MULT_RANGE,
  CARD_RISK_MULT_MIN, CARD_RISK_MULT_RANGE,
  MORALE_STABILITY_MIN, MORALE_STABILITY_RANGE,
  LEADERSHIP_THRESHOLD, LEADERSHIP_MAX_BONUS,
  TRANSFER_DEMAND_MIN_AMBITION, TRANSFER_DEMAND_MAX_LOYALTY,
  TRANSFER_DEMAND_REP_MULTIPLIER, TRANSFER_DEMAND_REP_OFFSET,
  TRANSFER_DEMAND_CHANCE_FACTOR,
} from '@/config/personality';

/** Generate random personality traits for a player */
export function generatePersonality(): PlayerPersonality {
  const range = PERSONALITY_TRAIT_MAX - PERSONALITY_TRAIT_MIN + 1;
  const rand = () => PERSONALITY_TRAIT_MIN + Math.floor(Math.random() * range);
  return {
    professionalism: rand(),
    ambition: rand(),
    temperament: rand(),
    loyalty: rand(),
    leadership: rand(),
  };
}

/** Get dominant personality label based on traits */
export function getPersonalityLabel(p: PlayerPersonality): PersonalityLabel {
  const { professionalism, ambition, temperament, loyalty, leadership } = p;

  if (professionalism >= LABEL_MODEL_PRO_PROF && temperament >= LABEL_MODEL_PRO_TEMP) return 'Model Professional';
  if (leadership >= LABEL_BORN_LEADER_LEAD && professionalism >= LABEL_BORN_LEADER_PROF) return 'Born Leader';
  if (loyalty >= LABEL_CLUB_LEGEND_LOYALTY && leadership >= LABEL_CLUB_LEGEND_LEAD) return 'Club Legend';
  if (ambition >= LABEL_MAVERICK_AMB && professionalism < LABEL_MAVERICK_PROF_BELOW) return 'Maverick';
  if (loyalty >= LABEL_LOYAL_SERVANT_LOYALTY && ambition < LABEL_LOYAL_SERVANT_AMB_BELOW) return 'Loyal Servant';
  if (temperament >= LABEL_STEADY_HAND_TEMP && ambition < LABEL_STEADY_HAND_AMB_BELOW) return 'Steady Hand';
  if (temperament < LABEL_HOT_HEAD_TEMP_BELOW) return 'Hot Head';
  if (professionalism < LABEL_ENIGMA_PROF_BELOW && ambition < LABEL_ENIGMA_AMB_BELOW) return 'Enigma';
  if (ambition >= LABEL_AMBITIOUS_AMB) return 'Ambitious';
  if (ambition < LABEL_LAID_BACK_AMB_BELOW && professionalism < LABEL_LAID_BACK_PROF_BELOW) return 'Laid Back';
  return 'Determined';
}

/** Training effectiveness multiplier based on professionalism */
export function getTrainingMultiplier(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return TRAINING_MULT_MIN + (personality.professionalism / PERSONALITY_TRAIT_MAX) * TRAINING_MULT_RANGE;
}

/** Development speed multiplier based on ambition */
export function getDevelopmentMultiplier(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return DEV_MULT_MIN + (personality.ambition / PERSONALITY_TRAIT_MAX) * DEV_MULT_RANGE;
}

/** Card risk multiplier based on temperament. Low temperament = more cards */
export function getCardRiskMultiplier(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return CARD_RISK_MULT_MIN + ((PERSONALITY_TRAIT_MAX - personality.temperament) / PERSONALITY_TRAIT_MAX) * CARD_RISK_MULT_RANGE;
}

/** Morale stability: high temperament = less morale swing */
export function getMoraleStability(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return MORALE_STABILITY_MIN + (personality.temperament / PERSONALITY_TRAIT_MAX) * MORALE_STABILITY_RANGE;
}

/** Leadership influence on team morale */
export function getLeadershipBonus(personality?: PlayerPersonality): number {
  if (!personality) return 0;
  return personality.leadership >= LEADERSHIP_THRESHOLD ? (personality.leadership / PERSONALITY_TRAIT_MAX) * LEADERSHIP_MAX_BONUS : 0;
}

/** Whether player is likely to demand a transfer (high ambition + low loyalty at weak club) */
export function wantsTransfer(player: Player, clubReputation: number): boolean {
  if (!player.personality) return false;
  const { ambition, loyalty } = player.personality;
  if (ambition < TRANSFER_DEMAND_MIN_AMBITION || loyalty > TRANSFER_DEMAND_MAX_LOYALTY) return false;
  if (player.overall > clubReputation * TRANSFER_DEMAND_REP_MULTIPLIER + TRANSFER_DEMAND_REP_OFFSET) {
    return Math.random() < (ambition - loyalty) * TRANSFER_DEMAND_CHANCE_FACTOR;
  }
  return false;
}
