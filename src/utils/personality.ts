import { Player, PlayerPersonality, PersonalityLabel } from '@/types/game';

/** Generate random personality traits for a player */
export function generatePersonality(): PlayerPersonality {
  const rand = () => 1 + Math.floor(Math.random() * 20); // 1-20 full range
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

  if (professionalism >= 16 && temperament >= 14) return 'Model Professional';
  if (leadership >= 16 && professionalism >= 12) return 'Born Leader';
  if (loyalty >= 16 && leadership >= 14) return 'Club Legend';
  if (ambition >= 16 && professionalism < 10) return 'Maverick';
  if (loyalty >= 16 && ambition < 10) return 'Loyal Servant';
  if (temperament >= 16 && ambition < 10) return 'Steady Hand';
  if (temperament < 6) return 'Hot Head';
  if (professionalism < 5 && ambition < 5) return 'Enigma';
  if (ambition >= 14) return 'Ambitious';
  if (ambition < 8 && professionalism < 8) return 'Laid Back';
  return 'Determined';
}

/** Training effectiveness multiplier based on professionalism (0.7 to 1.3) */
export function getTrainingMultiplier(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return 0.7 + (personality.professionalism / 20) * 0.6;
}

/** Development speed multiplier based on ambition (0.8 to 1.2) */
export function getDevelopmentMultiplier(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return 0.8 + (personality.ambition / 20) * 0.4;
}

/** Card risk multiplier based on temperament. Low temperament = more cards (1.0 to 1.8) */
export function getCardRiskMultiplier(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return 1.0 + ((20 - personality.temperament) / 20) * 0.8;
}

/** Morale stability: high temperament = less morale swing (0.6 to 1.2) */
export function getMoraleStability(personality?: PlayerPersonality): number {
  if (!personality) return 1.0;
  return 0.6 + (personality.temperament / 20) * 0.6;
}

/** Leadership influence on team morale (0 to 0.15 bonus) */
export function getLeadershipBonus(personality?: PlayerPersonality): number {
  if (!personality) return 0;
  return personality.leadership >= 14 ? (personality.leadership / 20) * 0.15 : 0;
}

/** Whether player is likely to demand a transfer (high ambition + low loyalty at weak club) */
export function wantsTransfer(player: Player, clubReputation: number): boolean {
  if (!player.personality) return false;
  const { ambition, loyalty } = player.personality;
  // Only high-ambition, low-loyalty players at clubs below their level
  if (ambition < 14 || loyalty > 12) return false;
  if (player.overall > clubReputation * 12 + 15) {
    return Math.random() < (ambition - loyalty) * 0.02;
  }
  return false;
}
