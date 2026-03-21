import { YouthProspect, Position } from '@/types/game';
import { generatePlayer } from './playerGen';
import { pick } from './helpers';
import {
  YOUTH_BASE_QUALITY, YOUTH_RATING_MULTIPLIER, YOUTH_COACH_MULTIPLIER, YOUTH_QUALITY_RANDOM_RANGE,
  YOUTH_QUALITY_MIN, YOUTH_QUALITY_MAX,
  YOUTH_BASE_AGE, YOUTH_AGE_RANGE,
  YOUTH_POTENTIAL_BASE_BONUS, YOUTH_POTENTIAL_MAX,
  YOUTH_READY_OVERALL_THRESHOLD, YOUTH_DEV_SCORE_BASE, YOUTH_DEV_SCORE_RANGE,
  INTAKE_PREVIEW_MIN, INTAKE_PREVIEW_RANGE,
  INTAKE_PREVIEW_POTENTIAL_BASE, INTAKE_PREVIEW_POTENTIAL_RANGE,
} from '@/config/youth';

const YOUTH_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

export function generateYouthProspects(
  clubId: string,
  youthRating: number, // 1-10
  youthCoachQuality: number, // 0-10
  season: number,
  count: number = 3,
): { prospects: YouthProspect[]; players: ReturnType<typeof generatePlayer>[] } {
  const prospects: YouthProspect[] = [];
  const newPlayers: ReturnType<typeof generatePlayer>[] = [];

  for (let i = 0; i < count; i++) {
    const pos = pick(YOUTH_POSITIONS);
    // Youth players are lower quality but with higher potential gap
    const baseQuality = YOUTH_BASE_QUALITY + youthRating * YOUTH_RATING_MULTIPLIER + youthCoachQuality * YOUTH_COACH_MULTIPLIER + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE);
    const quality = Math.min(YOUTH_QUALITY_MAX, Math.max(YOUTH_QUALITY_MIN, Math.round(baseQuality)));

    const player = generatePlayer(pos, quality, clubId, season);
    // Force young age
    player.age = YOUTH_BASE_AGE + Math.floor(Math.random() * YOUTH_AGE_RANGE);
    player.isFromYouthAcademy = true;
    // Ensure decent potential
    player.potential = Math.min(YOUTH_POTENTIAL_MAX, player.overall + YOUTH_POTENTIAL_BASE_BONUS + youthRating + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE));

    const prospect: YouthProspect = {
      playerId: player.id,
      readyToPromote: player.overall >= YOUTH_READY_OVERALL_THRESHOLD,
      developmentScore: Math.floor(Math.random() * YOUTH_DEV_SCORE_RANGE) + YOUTH_DEV_SCORE_BASE,
    };

    prospects.push(prospect);
    newPlayers.push(player);
  }

  return { prospects, players: newPlayers };
}

export function generateIntakePreview(youthRating: number): { position: Position; estimatedPotential: number }[] {
  const count = INTAKE_PREVIEW_MIN + Math.floor(Math.random() * INTAKE_PREVIEW_RANGE);
  const previews: { position: Position; estimatedPotential: number }[] = [];
  for (let i = 0; i < count; i++) {
    previews.push({
      position: pick(YOUTH_POSITIONS),
      estimatedPotential: INTAKE_PREVIEW_POTENTIAL_BASE + youthRating * YOUTH_RATING_MULTIPLIER + Math.floor(Math.random() * INTAKE_PREVIEW_POTENTIAL_RANGE),
    });
  }
  return previews;
}
