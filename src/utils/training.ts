import { Player, PlayerAttributes, TrainingState, TrainingModule, TrainingStreaks, TrainingReport } from '@/types/game';
import { clamp } from './helpers';
import { calculateOverall } from './playerGen';
import { getTrainingMultiplier } from './personality';
import {
  MODULE_ATTR_MAP as CONFIG_MODULE_ATTR_MAP,
  INTENSITY_MULTIPLIER as CONFIG_INTENSITY_MULTIPLIER,
  INTENSITY_FITNESS_COST as CONFIG_INTENSITY_FITNESS_COST,
  INTENSITY_INJURY_RISK as CONFIG_INTENSITY_INJURY_RISK,
  BASE_GAIN_CHANCE, DIMINISHING_RETURNS_CEILING, DIMINISHING_RETURNS_DIVISOR,
  INDIVIDUAL_TRAINING_BONUS, STAFF_BONUS_MULTIPLIER,
  FITNESS_RECOVERY_PER_DAY, FITNESS_RECOVERY_BASE, FITNESS_MIN,
  TRAINING_INJURY_AGE_THRESHOLD, TRAINING_INJURY_AGE_FACTOR,
  TACTICAL_FAMILIARITY_GAIN_PER_DAY, TACTICAL_FAMILIARITY_DECAY, TACTICAL_FAMILIARITY_MAX, TACTICAL_FAMILIARITY_MIN,
  TRAINING_DRILLS,
  STREAK_THRESHOLDS, STREAK_MULTIPLIERS, STREAK_MAX,
  FITNESS_ZONE_GREEN, FITNESS_ZONE_YELLOW,
} from '@/config/training';
import { calculatePlayerValue } from '@/config/playerGeneration';
import { seasonGrowthTracker } from '@/store/helpers/development';
import { MAX_SEASON_GROWTH, RECOVERY_FITNESS_BONUS_PER_LEVEL } from '@/config/gameBalance';

const MODULE_ATTR_MAP = CONFIG_MODULE_ATTR_MAP;
const INTENSITY_MULTIPLIER = CONFIG_INTENSITY_MULTIPLIER;
const INTENSITY_FITNESS_COST = CONFIG_INTENSITY_FITNESS_COST;
const INTENSITY_INJURY_RISK = CONFIG_INTENSITY_INJURY_RISK;

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;

/** Look up a drill by ID */
function getDrill(drillId: string) {
  return TRAINING_DRILLS.find(d => d.id === drillId);
}

/** Get the attribute weights for a specific day, considering drill selection */
function getDayAttrWeights(module: TrainingModule, drillId?: string): Partial<Record<keyof PlayerAttributes, number>> {
  if (drillId) {
    const drill = getDrill(drillId);
    if (drill && drill.moduleId === module) return drill.attrWeights;
  }
  // Default: equal weights across module's attributes
  const attrs = MODULE_ATTR_MAP[module];
  if (!attrs || attrs.length === 0) return {};
  const weight = 1.0 / attrs.length;
  const weights: Partial<Record<keyof PlayerAttributes, number>> = {};
  for (const attr of attrs) weights[attr] = weight;
  return weights;
}

export function applyWeeklyTraining(
  player: Player,
  training: TrainingState,
  staffBonus: number,
  recoveryLevel: number = 0,
  streakMultiplier: number = 1.0,
): Player {
  const updated = { ...player, attributes: { ...player.attributes } };

  // Count how many days each module is trained AND aggregate per-attribute weighted counts
  const days = DAYS.map(d => training.schedule[d]);
  const moduleCounts: Partial<Record<TrainingModule, number>> = {};
  days.forEach(mod => { moduleCounts[mod] = (moduleCounts[mod] || 0) + 1; });

  // Aggregate weighted attribute contributions across all 5 days
  const attrDayWeights: Partial<Record<keyof PlayerAttributes, number>> = {};
  for (const day of DAYS) {
    const mod = training.schedule[day];
    const drillId = training.drillSchedule?.[day];
    const weights = getDayAttrWeights(mod, drillId);
    for (const [attr, w] of Object.entries(weights)) {
      attrDayWeights[attr as keyof PlayerAttributes] = (attrDayWeights[attr as keyof PlayerAttributes] || 0) + (w || 0);
    }
  }

  const mult = INTENSITY_MULTIPLIER[training.intensity];
  const staffMult = 1 + staffBonus * STAFF_BONUS_MULTIPLIER;

  // Apply attribute gains using weighted day contributions (respecting season growth cap)
  const gains: Partial<Record<keyof PlayerAttributes, number>> = {};
  const priorGrowth = seasonGrowthTracker[player.id] || 0;
  if (priorGrowth < MAX_SEASON_GROWTH) {
    for (const [attr, weightedDays] of Object.entries(attrDayWeights) as [keyof PlayerAttributes, number][]) {
      if (!weightedDays || weightedDays <= 0) continue;

      // Individual training focus: +50% gain if player's individual plan covers this attribute
      const individualBonus = (training.individualPlans || []).some(
        plan => plan.playerId === player.id && MODULE_ATTR_MAP[plan.focus]?.includes(attr)
      ) ? INDIVIDUAL_TRAINING_BONUS : 1.0;
      const personalityMult = getTrainingMultiplier(player.personality);
      const currentVal = updated.attributes[attr] || 0;
      const diminishingFactor = Math.max(0.05, (DIMINISHING_RETURNS_CEILING - currentVal) / DIMINISHING_RETURNS_DIVISOR);
      const gainChance = BASE_GAIN_CHANCE * weightedDays * mult * staffMult * individualBonus * personalityMult * streakMultiplier * diminishingFactor;
      if (Math.random() < gainChance) {
        updated.attributes[attr] = clamp(updated.attributes[attr] + 1);
        gains[attr] = (gains[attr] || 0) + 1;
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
  updated.value = calculatePlayerValue(updated.overall);

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

// ── Streak System ──

/** Get the streak multiplier for the dominant training module */
export function getStreakMultiplier(streaks: TrainingStreaks | undefined, module: TrainingModule): number {
  const count = streaks?.[module] || 0;
  for (let i = STREAK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (count >= STREAK_THRESHOLDS[i]) return STREAK_MULTIPLIERS[i + 1];
  }
  return STREAK_MULTIPLIERS[0];
}

/** Update streak counters after a week: increment dominant, reset others */
export function updateStreaks(currentStreaks: TrainingStreaks | undefined, schedule: TrainingState['schedule']): TrainingStreaks {
  const dominant = getDominantTrainingFocus(schedule);
  const currentCount = currentStreaks?.[dominant] || 0;
  return { [dominant]: Math.min(currentCount + 1, STREAK_MAX) };
}

/** Get the current streak tier label */
export function getStreakTier(count: number): { tier: number; label: string; nextThreshold: number | null } {
  let tier = 0;
  for (let i = STREAK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (count >= STREAK_THRESHOLDS[i]) { tier = i + 1; break; }
  }
  const nextThreshold = tier < STREAK_THRESHOLDS.length ? STREAK_THRESHOLDS[tier] : null;
  return { tier, label: tier === 0 ? 'No streak' : `Tier ${tier}`, nextThreshold };
}

// ── Training Report ──

/** Generate a training report for the week */
export function generateTrainingReport(
  prePlayers: Record<string, Player>,
  postPlayers: Record<string, Player>,
  playerIds: string[],
  injuries: string[],
  streaks: TrainingStreaks,
  week: number,
  season: number,
): TrainingReport {
  const starPerformers: TrainingReport['starPerformers'] = [];
  let totalGains = 0;
  let preFitnessSum = 0;
  let postFitnessSum = 0;
  let playerCount = 0;

  for (const id of playerIds) {
    const pre = prePlayers[id];
    const post = postPlayers[id];
    if (!pre || !post) continue;
    playerCount++;
    preFitnessSum += pre.fitness;
    postFitnessSum += post.fitness;

    const gains = post.lastTrainingGains;
    if (gains) {
      for (const [attr, val] of Object.entries(gains)) {
        if (val && val > 0) {
          totalGains += val;
          starPerformers.push({
            playerId: id,
            attrGained: attr,
            newValue: post.attributes[attr as keyof PlayerAttributes],
          });
        }
      }
    }
  }

  // Sort by newValue descending, keep top 3
  starPerformers.sort((a, b) => b.newValue - a.newValue);
  const topPerformers = starPerformers.slice(0, 3);

  const fitnessChange = playerCount > 0
    ? Math.round((postFitnessSum - preFitnessSum) / playerCount * 10) / 10
    : 0;

  return {
    week,
    season,
    starPerformers: topPerformers,
    totalGains,
    injuries,
    streakProgress: { ...streaks },
    fitnessChange,
  };
}

// ── Effectiveness Preview ──

interface TrainingPreview {
  moduleGainRates: { module: TrainingModule; daysScheduled: number; expectedGainPct: number }[];
  injuryRiskPct: number;
  fitnessImpact: number;
  streakBonus: number;
}

/** Preview expected training outcomes for the current week settings */
export function getTrainingEffectivenessPreview(
  training: TrainingState,
  staffBonus: number,
  squadPlayers: Player[],
): TrainingPreview {
  const days = DAYS.map(d => training.schedule[d]);
  const moduleCounts: Partial<Record<TrainingModule, number>> = {};
  days.forEach(mod => { moduleCounts[mod] = (moduleCounts[mod] || 0) + 1; });

  const mult = INTENSITY_MULTIPLIER[training.intensity];
  const staffMult = 1 + staffBonus * STAFF_BONUS_MULTIPLIER;
  const streakMult = getStreakMultiplier(training.streaks, getDominantTrainingFocus(training.schedule));

  const moduleGainRates: TrainingPreview['moduleGainRates'] = [];
  for (const [mod, count] of Object.entries(moduleCounts) as [TrainingModule, number][]) {
    const expectedGainPct = Math.min(100, BASE_GAIN_CHANCE * count * mult * staffMult * streakMult * 100);
    moduleGainRates.push({ module: mod, daysScheduled: count, expectedGainPct: Math.round(expectedGainPct * 10) / 10 });
  }
  moduleGainRates.sort((a, b) => b.daysScheduled - a.daysScheduled);

  // Average injury risk across squad
  const avgAge = squadPlayers.length > 0 ? squadPlayers.reduce((s, p) => s + p.age, 0) / squadPlayers.length : 25;
  const injuryRiskPct = Math.round(getInjuryRisk(training, avgAge) * 1000) / 10;

  const fitnessDays = moduleCounts['fitness'] || 0;
  const fitnessImpact = fitnessDays * FITNESS_RECOVERY_PER_DAY + FITNESS_RECOVERY_BASE + INTENSITY_FITNESS_COST[training.intensity];

  return {
    moduleGainRates,
    injuryRiskPct,
    fitnessImpact,
    streakBonus: Math.round((streakMult - 1) * 100),
  };
}

// ── Squad Fitness Distribution ──

export interface FitnessDistribution {
  green: number;
  yellow: number;
  red: number;
  total: number;
  avgFitness: number;
}

/** Get squad fitness distribution across green/yellow/red zones */
export function getSquadFitnessDistribution(squadPlayers: Player[]): FitnessDistribution {
  let green = 0, yellow = 0, red = 0, fitnessSum = 0;
  for (const p of squadPlayers) {
    fitnessSum += p.fitness;
    if (p.fitness >= FITNESS_ZONE_GREEN) green++;
    else if (p.fitness >= FITNESS_ZONE_YELLOW) yellow++;
    else red++;
  }
  return {
    green, yellow, red,
    total: squadPlayers.length,
    avgFitness: squadPlayers.length > 0 ? Math.round(fitnessSum / squadPlayers.length) : 0,
  };
}
