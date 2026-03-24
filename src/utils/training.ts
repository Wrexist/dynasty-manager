import { Player, PlayerAttributes, TrainingState, TrainingModule } from '@/types/game';
import { clamp } from './helpers';
import { calculateOverall } from './playerGen';
import { getTrainingMultiplier } from './personality';
import {
  MODULE_ATTR_MAP as CONFIG_MODULE_ATTR_MAP,
  INTENSITY_MULTIPLIER as CONFIG_INTENSITY_MULTIPLIER,
  INTENSITY_FITNESS_COST as CONFIG_INTENSITY_FITNESS_COST,
  INTENSITY_INJURY_RISK as CONFIG_INTENSITY_INJURY_RISK,
  BASE_GAIN_CHANCE, INDIVIDUAL_TRAINING_BONUS, STAFF_BONUS_MULTIPLIER,
  FITNESS_RECOVERY_PER_DAY, FITNESS_RECOVERY_BASE, FITNESS_MIN,
  TRAINING_INJURY_AGE_THRESHOLD, TRAINING_INJURY_AGE_FACTOR,
  TACTICAL_FAMILIARITY_GAIN_PER_DAY, TACTICAL_FAMILIARITY_DECAY, TACTICAL_FAMILIARITY_MAX, TACTICAL_FAMILIARITY_MIN,
} from '@/config/training';
import { VALUE_OVERALL_MULTIPLIER, VALUE_RANDOM_RANGE } from '@/config/playerGeneration';
import { seasonGrowthTracker } from '@/store/helpers/development';
import { MAX_SEASON_GROWTH, RECOVERY_FITNESS_BONUS_PER_LEVEL } from '@/config/gameBalance';

const MODULE_ATTR_MAP = CONFIG_MODULE_ATTR_MAP;
const INTENSITY_MULTIPLIER = CONFIG_INTENSITY_MULTIPLIER;
const INTENSITY_FITNESS_COST = CONFIG_INTENSITY_FITNESS_COST;
const INTENSITY_INJURY_RISK = CONFIG_INTENSITY_INJURY_RISK;

export function applyWeeklyTraining(
  player: Player,
  training: TrainingState,
  staffBonus: number, // fitness-coach or first-team-coach quality 0-10
  recoveryLevel: number = 0,
): Player {
  const updated = { ...player, attributes: { ...player.attributes } };

  // Count how many days each module is trained
  const days = [training.schedule.mon, training.schedule.tue, training.schedule.wed, training.schedule.thu, training.schedule.fri];
  const moduleCounts: Partial<Record<TrainingModule, number>> = {};
  days.forEach(mod => { moduleCounts[mod] = (moduleCounts[mod] || 0) + 1; });

  const mult = INTENSITY_MULTIPLIER[training.intensity];
  const staffMult = 1 + staffBonus * STAFF_BONUS_MULTIPLIER; // up to 1.5x with quality 10

  // Apply attribute gains per module (respecting season growth cap)
  const gains: Partial<Record<keyof PlayerAttributes, number>> = {};
  const priorGrowth = seasonGrowthTracker[player.id] || 0;
  if (priorGrowth < MAX_SEASON_GROWTH) {
    for (const [mod, count] of Object.entries(moduleCounts) as [TrainingModule, number][]) {
      const attrs = MODULE_ATTR_MAP[mod];
      if (!attrs || attrs.length === 0) continue;

      for (const attr of attrs) {
        // Individual training focus: +50% gain if player's individual plan matches this module
        const individualBonus = (training.individualPlans || []).some(
          plan => plan.playerId === player.id && MODULE_ATTR_MAP[plan.focus]?.includes(attr)
        ) ? INDIVIDUAL_TRAINING_BONUS : 1.0;
        const personalityMult = getTrainingMultiplier(player.personality);
        const gainChance = BASE_GAIN_CHANCE * count * mult * staffMult * individualBonus * personalityMult;
        if (Math.random() < gainChance) {
          updated.attributes[attr] = clamp(updated.attributes[attr] + 1);
          gains[attr] = (gains[attr] || 0) + 1;
        }
      }
    }
  }
  updated.lastTrainingGains = Object.keys(gains).length > 0 ? gains : undefined;

  // Fitness recovery/drain (recovery facility bonus: +0.5 fitness per level per week)
  const fitnessDays = moduleCounts['fitness'] || 0;
  const recoveryBonus = recoveryLevel * RECOVERY_FITNESS_BONUS_PER_LEVEL;
  updated.fitness = Math.max(FITNESS_MIN, Math.min(100, updated.fitness + fitnessDays * FITNESS_RECOVERY_PER_DAY + FITNESS_RECOVERY_BASE + recoveryBonus + INTENSITY_FITNESS_COST[training.intensity]));

  // Recalculate overall
  const newOverall = calculateOverall(updated.attributes, updated.position);
  updated.growthDelta = newOverall - player.overall;
  updated.overall = newOverall;
  updated.value = Math.round(updated.overall * updated.overall * VALUE_OVERALL_MULTIPLIER + Math.random() * VALUE_RANDOM_RANGE);

  // Track training growth toward season cap
  if (updated.growthDelta > 0) {
    seasonGrowthTracker[player.id] = (seasonGrowthTracker[player.id] || 0) + updated.growthDelta;
  }

  return updated;
}

/** Injury risk from training — scales with player age */
export function getInjuryRisk(training: TrainingState, playerAge?: number): number {
  const baseRisk = INTENSITY_INJURY_RISK[training.intensity];
  const ageFactor = playerAge && playerAge > TRAINING_INJURY_AGE_THRESHOLD ? 1 + (playerAge - TRAINING_INJURY_AGE_THRESHOLD) * TRAINING_INJURY_AGE_FACTOR : 1;
  return baseRisk * ageFactor;
}

/** Returns the most-scheduled training module across the 5-day week (ties broken by earliest day) */
export function getDominantTrainingFocus(schedule: TrainingState['schedule']): TrainingModule {
  const days: TrainingModule[] = [schedule.mon, schedule.tue, schedule.wed, schedule.thu, schedule.fri];
  const counts: Partial<Record<TrainingModule, number>> = {};
  days.forEach(mod => { counts[mod] = (counts[mod] || 0) + 1; });
  let maxMod: TrainingModule = days[0];
  let maxCount = 0;
  for (const [mod, count] of Object.entries(counts) as [TrainingModule, number][]) {
    if (count > maxCount) { maxCount = count; maxMod = mod; }
  }
  return maxMod;
}

/** Suggests a training module based on the squad's weakest attribute area */
export function getTrainingRecommendation(squadPlayers: Player[]): { module: TrainingModule; reason: string } | null {
  if (squadPlayers.length === 0) return null;

  const attrAvgs: Record<string, number> = {};
  const attrKeys: (keyof PlayerAttributes)[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];
  for (const attr of attrKeys) {
    const sum = squadPlayers.reduce((acc, p) => acc + (p.attributes[attr] || 0), 0);
    attrAvgs[attr] = sum / squadPlayers.length;
  }

  // Find the weakest attribute and map it to a training module
  let weakestAttr = attrKeys[0];
  let weakestAvg = attrAvgs[weakestAttr];
  for (const attr of attrKeys) {
    if (attrAvgs[attr] < weakestAvg) {
      weakestAvg = attrAvgs[attr];
      weakestAttr = attr;
    }
  }

  // Map attribute to best training module
  const attrToModule: Record<string, TrainingModule> = {
    pace: 'fitness', shooting: 'attacking', passing: 'mentality',
    defending: 'defending', physical: 'fitness', mental: 'mentality',
  };
  const moduleLabels: Record<TrainingModule, string> = {
    fitness: 'Fitness', attacking: 'Attacking', defending: 'Defending',
    mentality: 'Mentality', 'set-pieces': 'Set Pieces', tactical: 'Tactical',
  };
  const attrLabels: Record<string, string> = {
    pace: 'pace', shooting: 'shooting', passing: 'passing',
    defending: 'defending', physical: 'physicality', mental: 'mentality',
  };

  const module = attrToModule[weakestAttr];
  return {
    module,
    reason: `${moduleLabels[module]} — squad ${attrLabels[weakestAttr]} average is ${weakestAvg.toFixed(1)}`,
  };
}

export function updateTacticalFamiliarity(training: TrainingState, current: number): number {
  const days = [training.schedule.mon, training.schedule.tue, training.schedule.wed, training.schedule.thu, training.schedule.fri];
  const tacticalDays = days.filter(d => d === 'tactical').length;
  const gain = tacticalDays * TACTICAL_FAMILIARITY_GAIN_PER_DAY;
  const decay = TACTICAL_FAMILIARITY_DECAY;
  return Math.min(TACTICAL_FAMILIARITY_MAX, Math.max(TACTICAL_FAMILIARITY_MIN, current + gain - decay));
}
