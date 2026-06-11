import { Player, PlayerAttributes } from '@/types/game';
import { clamp } from '@/utils/helpers';
import { calculateOverall } from '@/utils/playerGen';
import { getDevelopmentMultiplier } from '@/utils/personality';
import {
  MAX_SEASON_GROWTH, POSITION_DEV_BONUS,
  GROWTH_AGE_THRESHOLD, GROWTH_BASE_CHANCE, GROWTH_POTENTIAL_GAP_FACTOR,
  DEV_DIMINISHING_RETURNS_CEILING, DEV_DIMINISHING_RETURNS_DIVISOR,
  PLAYING_TIME_BONUS_MAX, PLAYING_TIME_BONUS_PER_APP,
  DECLINE_AGE_THRESHOLD, STEEP_DECLINE_AGE_THRESHOLD,
  DECLINE_FACTOR_NORMAL, DECLINE_FACTOR_STEEP, DECLINE_BASE_CHANCE, DECLINE_ATTR_MULTIPLIERS,
} from '@/config/gameBalance';
import { TRAINING_FOCUS_BONUS, MODULE_ATTR_MAP } from '@/config/training';
import { recomputePlayerValueOnly } from '@/utils/playerEconomics';

// Per-season growth tracking to cap total growth
export const seasonGrowthTracker: Record<string, number> = {};

export function applyPlayerDevelopment(p: Player, trainingFocus: string, mentorBonus: number = 0, trainingGroundBoost: number = 0): Player {
  // Preserve any upstream growthDelta (set by applyWeeklyTraining when it ran
  // earlier in the week pipeline). Previously this function overwrote that
  // delta with just the development gain, so the UI showed only half the
  // story when both passes produced gains. We now accumulate onto it.
  const trainingDelta = p.growthDelta || 0;
  const updated = { ...p, attributes: { ...p.attributes }, growthDelta: trainingDelta };
  const oldOverall = p.overall;

  if (p.age < GROWTH_AGE_THRESHOLD) {
    // Check season growth cap
    const priorGrowth = seasonGrowthTracker[p.id] || 0;
    // Hard ceiling: a player at (or above) their scouted potential stops
    // developing. The gap factor alone never zeroed the chance (base 0.05 +
    // playing-time bonus stayed positive at gap <= 0), so high-minutes
    // youngsters overshot potential by up to MAX_SEASON_GROWTH every season
    // and `potential` stopped meaning anything.
    if (priorGrowth < MAX_SEASON_GROWTH && p.overall < p.potential) {
      const potentialGap = p.potential - p.overall;
      // Playing time scales growth: 0% at 0 apps, up to +8% at 20+ apps
      const playingTimeBonus = Math.min(PLAYING_TIME_BONUS_MAX, p.appearances * PLAYING_TIME_BONUS_PER_APP);
      const devMultiplier = getDevelopmentMultiplier(p.personality);
      const growthChance = (GROWTH_BASE_CHANCE + potentialGap * GROWTH_POTENTIAL_GAP_FACTOR + playingTimeBonus + mentorBonus) * devMultiplier * (1 + trainingGroundBoost);
      const posBonus = POSITION_DEV_BONUS[p.position] || {};
      const trainedAttrs = MODULE_ATTR_MAP[trainingFocus as keyof typeof MODULE_ATTR_MAP] || [];
      const attrs = Object.keys(updated.attributes) as (keyof PlayerAttributes)[];
      for (const attr of attrs) {
        const positionBonus = posBonus[attr] || 0;
        const trainingBonus = trainedAttrs.includes(attr) ? TRAINING_FOCUS_BONUS : 0;
        const currentVal = updated.attributes[attr] || 0;
        const diminishingFactor = Math.max(0.05, (DEV_DIMINISHING_RETURNS_CEILING - currentVal) / DEV_DIMINISHING_RETURNS_DIVISOR);
        if (Math.random() < (growthChance + positionBonus + trainingBonus) * diminishingFactor) {
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
  const devDelta = updated.overall - oldOverall;
  updated.growthDelta = trainingDelta + devDelta;

  // Only track the development portion against the season cap — applyWeeklyTraining
  // already credits its own gains into seasonGrowthTracker, so adding the combined
  // delta would double-count and trigger the cap prematurely.
  if (devDelta > 0) {
    seasonGrowthTracker[p.id] = (seasonGrowthTracker[p.id] || 0) + devDelta;
  }

  // Single-helper recompute keeps development pricing identical to training,
  // packs, and transfers — rarity, age curve, and Ballon d'Or placement
  // premium all factored in. Wage is unchanged here (it's contract-driven,
  // not attribute-driven).
  recomputePlayerValueOnly(updated);
  return updated;
}

/** Reset growth tracker at season end */
export function resetSeasonGrowth() {
  Object.keys(seasonGrowthTracker).forEach(k => delete seasonGrowthTracker[k]);
}

/** Hydrate growth tracker from persisted state on load */
export function hydrateSeasonGrowth(data: Record<string, number>) {
  Object.keys(seasonGrowthTracker).forEach(k => delete seasonGrowthTracker[k]);
  Object.assign(seasonGrowthTracker, data);
}
