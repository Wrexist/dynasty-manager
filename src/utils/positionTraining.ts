/**
 * Secondary-position training.
 *
 * A player may learn ONE neighbouring position at a time — only the
 * adjacencies in `POSITION_COMPATIBILITY` (a CB learns nothing; a LB can learn
 * LM). Learning moves the position from "compatible" (amber ring) to a listed
 * `alternatePositions` entry (green ring), which the lineup optimizer, the
 * substitution logic and every pitch board already read.
 *
 * Deterministic on purpose: the UI promises an ETA in weeks, and a dice roll
 * would make that promise a lie.
 *
 * Pure: no store, no React.
 */
import { POSITION_COMPATIBILITY, type Player, type Position, type PositionTrainingPlan } from '@/types/game';
import {
  POSITION_TRAINING_AGE_MULT,
  POSITION_TRAINING_BASE_WEEKS,
  POSITION_TRAINING_INJURED_MULT,
  POSITION_TRAINING_MENTAL_PIVOT,
  POSITION_TRAINING_MENTAL_SLOPE,
} from '@/config/training';

type PositionedPlayer = Pick<Player, 'position' | 'alternatePositions'>;

/** Neighbouring positions this player does not already play. */
export function getTrainablePositions(player: PositionedPlayer): Position[] {
  const known = new Set<Position>([player.position, ...(player.alternatePositions ?? [])]);
  return (POSITION_COMPATIBILITY[player.position] ?? []).filter(pos => !known.has(pos));
}

export function canTrainPosition(player: PositionedPlayer, position: Position): boolean {
  return getTrainablePositions(player).includes(position);
}

/** Progress points (0-100 scale) the player gains in one week. */
export function getWeeklyPositionProgress(player: Pick<Player, 'age' | 'attributes' | 'injured'>): number {
  const ageMult = (POSITION_TRAINING_AGE_MULT.find(b => player.age <= b.maxAge) ?? POSITION_TRAINING_AGE_MULT[POSITION_TRAINING_AGE_MULT.length - 1]).mult;
  const mental = player.attributes?.mental ?? POSITION_TRAINING_MENTAL_PIVOT;
  const mentalMult = Math.max(0.5, 1 + (mental - POSITION_TRAINING_MENTAL_PIVOT) * POSITION_TRAINING_MENTAL_SLOPE);
  const injuredMult = player.injured ? POSITION_TRAINING_INJURED_MULT : 1;
  return (100 / POSITION_TRAINING_BASE_WEEKS) * ageMult * mentalMult * injuredMult;
}

/** Whole weeks left at the CURRENT rate — an injured player's ETA is the slowed one. */
export function getPositionTrainingEta(plan: Pick<PositionTrainingPlan, 'progress'>, player: Pick<Player, 'age' | 'attributes' | 'injured'>): number {
  const perWeek = getWeeklyPositionProgress(player);
  return Math.max(1, Math.ceil((100 - plan.progress) / perWeek));
}

export interface PositionTrainingTick {
  plans: PositionTrainingPlan[];
  /** Players whose training finished this week, already carrying the new position. */
  learned: { player: Player; position: Position }[];
}

/**
 * One week of position training. Plans whose player has left `eligibleIds`
 * (sold, released, retired) or can no longer train the target are dropped.
 * Returns updated players for the finishers; the caller writes them back.
 */
export function tickPositionTraining(
  plans: PositionTrainingPlan[] | undefined,
  players: Record<string, Player>,
  eligibleIds: ReadonlySet<string>,
): PositionTrainingTick {
  const next: PositionTrainingPlan[] = [];
  const learned: PositionTrainingTick['learned'] = [];
  for (const plan of plans ?? []) {
    const player = players[plan.playerId];
    if (!player || !eligibleIds.has(plan.playerId) || !canTrainPosition(player, plan.position)) continue;
    const progress = Math.min(100, plan.progress + getWeeklyPositionProgress(player));
    if (progress >= 100) {
      learned.push({
        player: { ...player, alternatePositions: [...(player.alternatePositions ?? []), plan.position] },
        position: plan.position,
      });
    } else {
      next.push({ ...plan, progress });
    }
  }
  return { plans: next, learned };
}
