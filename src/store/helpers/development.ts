import { Player, PlayerAttributes } from '@/types/game';
import { clamp } from '@/utils/helpers';
import { calculateOverall } from '@/utils/playerGen';
import { getDevelopmentMultiplier } from '@/utils/personality';
import {
  MAX_SEASON_GROWTH, POSITION_DEV_BONUS,
  GROWTH_AGE_THRESHOLD, GROWTH_BASE_CHANCE, GROWTH_POTENTIAL_GAP_FACTOR,
  DEV_DIMINISHING_RETURNS_CEILING, DEV_DIMINISHING_RETURNS_DIVISOR,
  PLAYING_TIME_BONUS_MAX, PLAYING_TIME_BONUS_PER_APP, MINUTES_PER_APPEARANCE,
  DEV_RATING_BASELINE, DEV_RATING_BONUS_PER_POINT,
  DEV_RATING_BONUS_MAX, DEV_RATING_BONUS_MIN, DEV_RATING_MIN_MATCHES,
  DECLINE_AGE_THRESHOLD, STEEP_DECLINE_AGE_THRESHOLD,
  DECLINE_FACTOR_NORMAL, DECLINE_FACTOR_STEEP, DECLINE_BASE_CHANCE, DECLINE_ATTR_MULTIPLIERS,
} from '@/config/gameBalance';
import { TRAINING_FOCUS_BONUS, MODULE_ATTR_MAP } from '@/config/training';
import { recomputePlayerValueOnly } from '@/utils/playerEconomics';

// Per-season growth tracking to cap total growth
export const seasonGrowthTracker: Record<string, number> = {};

/**
 * Playing-time term for the growth roll, measured in MINUTES rather than
 * appearances. `appearances` counted an 87th-minute cameo exactly the same as a
 * 90-minute shift, so squad players developed like regulars. Saves written
 * before minutes tracking existed (schema < 75) have no `minutesPlayed`, so
 * fall back to `appearances` so migrated saves don't suddenly stop developing.
 */
export function getPlayingTimeBonus(p: Player): number {
  // `appearances` is reset at season end, and minutes/90 can never exceed
  // appearances within a season — so the min() also makes this term immune to a
  // `minutesPlayed` counter that failed to reset at rollover.
  const effectiveApps = p.minutesPlayed != null
    ? Math.min(p.appearances, p.minutesPlayed / MINUTES_PER_APPEARANCE)
    : p.appearances;
  return Math.min(PLAYING_TIME_BONUS_MAX, effectiveApps * PLAYING_TIME_BONUS_PER_APP);
}

/**
 * Performance term for the growth roll, derived from the per-match ratings the
 * engine already computes. Before this existed a 4.0 and a 9.0 developed
 * identically — ratings were spent on the Ballon d'Or and nothing else.
 *
 * Returns 0 (not a penalty) until the player has a meaningful sample, and is
 * clamped so it can never dominate the playing-time term.
 */
export function getRatingDevelopmentBonus(p: Player): number {
  const rated = p.seasonRatedMatches || 0;
  if (rated < DEV_RATING_MIN_MATCHES) return 0;
  const avg = (p.seasonRatingTotal || 0) / rated;
  const raw = (avg - DEV_RATING_BASELINE) * DEV_RATING_BONUS_PER_POINT;
  return Math.max(DEV_RATING_BONUS_MIN, Math.min(DEV_RATING_BONUS_MAX, raw));
}

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
      // Playing time scales growth, measured in minutes (see getPlayingTimeBonus)
      const playingTimeBonus = getPlayingTimeBonus(p);
      // Performance scales growth: how well he actually played, not just how often
      const ratingBonus = getRatingDevelopmentBonus(p);
      const devMultiplier = getDevelopmentMultiplier(p.personality);
      const growthChance = Math.max(0, GROWTH_BASE_CHANCE + potentialGap * GROWTH_POTENTIAL_GAP_FACTOR + playingTimeBonus + ratingBonus + mentorBonus) * devMultiplier * (1 + trainingGroundBoost);
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
