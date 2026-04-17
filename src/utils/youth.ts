import { YouthProspect, Position, YouthTier, Player } from '@/types/game';
import { generatePlayer } from './playerGen';
import { pick } from './helpers';
import {
  YOUTH_BASE_QUALITY, YOUTH_RATING_MULTIPLIER, YOUTH_COACH_MULTIPLIER, YOUTH_QUALITY_RANDOM_RANGE,
  YOUTH_QUALITY_MIN, YOUTH_QUALITY_MAX,
  YOUTH_BASE_AGE, YOUTH_AGE_RANGE,
  YOUTH_POTENTIAL_BASE_BONUS, YOUTH_POTENTIAL_MAX,
  YOUTH_CLUB_QUALITY_WEIGHT,
  YOUTH_READY_OVERALL_THRESHOLD, YOUTH_DEV_SCORE_BASE, YOUTH_DEV_SCORE_RANGE,
  INTAKE_PREVIEW_MIN, INTAKE_PREVIEW_RANGE,
  INTAKE_PREVIEW_POTENTIAL_BASE, INTAKE_PREVIEW_POTENTIAL_RANGE,
  YOUTH_TIER_DEV_MULT, YOUTH_TIER_AGE_PROMOTION, YOUTH_TIER_OVR_PROMOTION,
} from '@/config/youth';

const YOUTH_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

export function generateYouthProspects(
  clubId: string,
  youthRating: number, // 1-10
  youthCoachQuality: number, // 0-10
  season: number,
  count: number = 3,
  clubSquadQuality?: number,
): { prospects: YouthProspect[]; players: ReturnType<typeof generatePlayer>[] } {
  const prospects: YouthProspect[] = [];
  const newPlayers: ReturnType<typeof generatePlayer>[] = [];

  for (let i = 0; i < count; i++) {
    const pos = pick(YOUTH_POSITIONS);
    // Youth players are lower quality but with higher potential gap
    let baseQuality = YOUTH_BASE_QUALITY + youthRating * YOUTH_RATING_MULTIPLIER + youthCoachQuality * YOUTH_COACH_MULTIPLIER + Math.floor(Math.random() * YOUTH_QUALITY_RANDOM_RANGE);
    if (clubSquadQuality !== undefined) {
      baseQuality = Math.round(baseQuality * (1 - YOUTH_CLUB_QUALITY_WEIGHT) + clubSquadQuality * YOUTH_CLUB_QUALITY_WEIGHT);
    }
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
      tier: 'u18',
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

/** Development multiplier for a prospect's weekly training gains, keyed by tier. */
export function getYouthTierDevMultiplier(tier: YouthTier | undefined): number {
  return YOUTH_TIER_DEV_MULT[tier ?? 'u18'];
}

/**
 * Promote a prospect to the next tier if age or rating thresholds are met.
 * Called at season-end for every prospect still in the academy.
 * Returns the updated prospect (same reference if no promotion happened).
 */
export function promoteYouthTier(prospect: YouthProspect, player: Player | undefined): YouthProspect {
  if (!player) return prospect;
  const currentTier: YouthTier = prospect.tier ?? 'u18';
  let nextTier: YouthTier = currentTier;

  if (currentTier === 'u18') {
    if (player.age >= YOUTH_TIER_AGE_PROMOTION.u18_to_u21 || player.overall >= YOUTH_TIER_OVR_PROMOTION.u18_to_u21) {
      nextTier = 'u21';
    }
  } else if (currentTier === 'u21') {
    if (player.age >= YOUTH_TIER_AGE_PROMOTION.u21_to_bteam || player.overall >= YOUTH_TIER_OVR_PROMOTION.u21_to_bteam) {
      nextTier = 'bteam';
    }
  }

  if (nextTier === currentTier) return prospect;
  return { ...prospect, tier: nextTier };
}

/** Default tier for a prospect that doesn't yet have one (save-migration helper). */
export function inferYouthTier(player: Player | undefined): YouthTier {
  if (!player) return 'u18';
  if (player.age >= YOUTH_TIER_AGE_PROMOTION.u21_to_bteam || player.overall >= YOUTH_TIER_OVR_PROMOTION.u21_to_bteam) return 'bteam';
  if (player.age >= YOUTH_TIER_AGE_PROMOTION.u18_to_u21 || player.overall >= YOUTH_TIER_OVR_PROMOTION.u18_to_u21) return 'u21';
  return 'u18';
}
