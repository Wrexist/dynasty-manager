import { Player, PlayerAttributes } from '@/types/game';
import { clamp } from '@/utils/helpers';
import { calculateOverall } from '@/utils/playerGen';
import { getDevelopmentMultiplier } from '@/utils/personality';
import {
  MAX_SEASON_GROWTH, POSITION_DEV_BONUS,
  GROWTH_AGE_THRESHOLD, GROWTH_BASE_CHANCE, GROWTH_POTENTIAL_GAP_FACTOR,
  PLAYING_TIME_BONUS_MAX, PLAYING_TIME_BONUS_PER_APP,
  DECLINE_AGE_THRESHOLD, STEEP_DECLINE_AGE_THRESHOLD,
  DECLINE_FACTOR_NORMAL, DECLINE_FACTOR_STEEP, DECLINE_BASE_CHANCE, DECLINE_ATTR_MULTIPLIERS,
  VALUE_AGE_MULTIPLIERS,
  TRAINING_FOCUS_BONUS, TRAINING_FOCUS_ATTR_MAP,
} from '@/config/gameBalance';
import { VALUE_OVERALL_MULTIPLIER, VALUE_RANDOM_RANGE } from '@/config/playerGeneration';

// Per-season growth tracking to cap total growth
export const seasonGrowthTracker: Record<string, number> = {};

export function applyPlayerDevelopment(p: Player, trainingFocus: string, mentorBonus: number = 0): Player {
  const updated = { ...p, attributes: { ...p.attributes }, growthDelta: 0 };
  const oldOverall = p.overall;

  if (p.age < GROWTH_AGE_THRESHOLD) {
    // Check season growth cap
    const priorGrowth = seasonGrowthTracker[p.id] || 0;
    if (priorGrowth < MAX_SEASON_GROWTH) {
      const potentialGap = p.potential - p.overall;
      // Playing time scales growth: 0% at 0 apps, up to +8% at 20+ apps
      const playingTimeBonus = Math.min(PLAYING_TIME_BONUS_MAX, p.appearances * PLAYING_TIME_BONUS_PER_APP);
      const devMultiplier = getDevelopmentMultiplier(p.personality);
      const growthChance = (GROWTH_BASE_CHANCE + potentialGap * GROWTH_POTENTIAL_GAP_FACTOR + playingTimeBonus + mentorBonus) * devMultiplier;
      const posBonus = POSITION_DEV_BONUS[p.position] || {};
      const trainedAttrs = TRAINING_FOCUS_ATTR_MAP[trainingFocus] || [];
      const attrs = Object.keys(updated.attributes) as (keyof PlayerAttributes)[];
      for (const attr of attrs) {
        const positionBonus = posBonus[attr] || 0;
        const trainingBonus = trainedAttrs.includes(attr) ? TRAINING_FOCUS_BONUS : 0;
        if (Math.random() < growthChance + positionBonus + trainingBonus) {
          updated.attributes[attr] = clamp(updated.attributes[attr] + 1);
        }
      }
    }
  } else if (p.age >= DECLINE_AGE_THRESHOLD) {
    // Physical attributes decline faster; mental can hold
    const ageFactor = p.age >= STEEP_DECLINE_AGE_THRESHOLD ? (p.age - DECLINE_AGE_THRESHOLD) * DECLINE_FACTOR_STEEP : (p.age - DECLINE_AGE_THRESHOLD) * DECLINE_FACTOR_NORMAL;
    const attrs = Object.keys(updated.attributes) as (keyof PlayerAttributes)[];
    for (const attr of attrs) {
      // Physical/pace decline faster, mental declines slowest
      const attrMult = DECLINE_ATTR_MULTIPLIERS[attr];
      const declineChance = (DECLINE_BASE_CHANCE + ageFactor) * attrMult;
      if (Math.random() < declineChance) {
        updated.attributes[attr] = clamp(updated.attributes[attr] - 1);
      }
    }
  }

  updated.overall = calculateOverall(updated.attributes, updated.position);
  updated.growthDelta = updated.overall - oldOverall;

  // Track season growth
  if (updated.growthDelta > 0) {
    seasonGrowthTracker[p.id] = (seasonGrowthTracker[p.id] || 0) + updated.growthDelta;
  }

  // Age-adjusted value: peak at 25-28, discount young and old
  let ageMult = 0.25;
  for (const tier of VALUE_AGE_MULTIPLIERS) {
    if (p.age <= tier.maxAge) { ageMult = tier.multiplier; break; }
  }
  updated.value = Math.round(updated.overall * updated.overall * VALUE_OVERALL_MULTIPLIER * ageMult + Math.random() * VALUE_RANDOM_RANGE);
  return updated;
}

/** Reset growth tracker at season end */
export function resetSeasonGrowth() {
  Object.keys(seasonGrowthTracker).forEach(k => delete seasonGrowthTracker[k]);
}
