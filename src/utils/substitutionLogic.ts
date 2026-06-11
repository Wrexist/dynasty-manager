import { canPlayPosition, type Position, type Player } from '@/types/game';
import { SMART_SUB_MIN_MINUTE, SMART_SUB_LOSING_MINUTE, SMART_SUB_WINNING_LATE_MINUTE } from '@/config/matchEngine';

interface SmartSubParams {
  lineup: string[];
  subs: string[];
  slots: { pos: string }[];
  players: Record<string, Player>;
  week: number;
  matchMinute?: number;
  playerGoals?: number;
  opponentGoals?: number;
  injuredPlayerIds?: string[];
  /** Live in-match fitness snapshot (from HalfState.playerFitness).
   *  Preferred over the stale pre-match `Player.fitness` when present. */
  matchFitness?: Record<string, number>;
  /** Players sent off this match (from HalfState.sentOff) — they can't be
   *  replaced via substitution and can't come on. */
  sentOffIds?: string[];
}

interface SmartSubResult {
  outId: string;
  inId: string;
  reason: string;
}

const ATTACKING_POSITIONS: Position[] = ['ST', 'LW', 'RW', 'CAM'];
const DEFENSIVE_POSITIONS: Position[] = ['CB', 'CDM', 'LB', 'RB'];

function posCompat(player: { position: Position; alternatePositions?: Position[] }, slotPos: Position): number {
  if (player.position === slotPos) return 1.0;
  if (canPlayPosition(player, slotPos)) return 0.8;
  return 0.4;
}

function effectiveStrength(p: Player, compat: number, fitness: number): number {
  return p.overall * compat + fitness * 0.15 + p.form * 0.1;
}

function isAvailableSub(p: Player, week: number): boolean {
  return !!p && !p.injured && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week);
}

export function computeSmartSub(params: SmartSubParams): SmartSubResult | null {
  const { lineup, subs, slots, players, week, matchMinute, playerGoals, opponentGoals, injuredPlayerIds, matchFitness, sentOffIds } = params;

  const injuredSet = new Set(injuredPlayerIds || []);
  const sentOffSet = new Set(sentOffIds || []);
  const isLosing = (playerGoals ?? 0) < (opponentGoals ?? 0);
  const isWinning = (playerGoals ?? 0) > (opponentGoals ?? 0);
  const minute = matchMinute ?? 0;
  // Live in-match fitness when available; pre-match value otherwise.
  const liveFitness = (p: Player): number => matchFitness?.[p.id] ?? p.fitness;

  // Get available bench players (sent-off players can never come on)
  const availableSubs = subs.filter(id => {
    const p = players[id];
    return isAvailableSub(p, week) && !sentOffSet.has(id);
  });

  if (availableSubs.length === 0) return null;

  let bestScore = -Infinity;
  let best: SmartSubResult | null = null;

  for (let i = 0; i < lineup.length; i++) {
    const outId = lineup[i];
    const outP = outId ? players[outId] : null;
    if (!outP) continue;
    // A red-carded player has left the pitch — they cannot be "replaced".
    if (sentOffSet.has(outId)) continue;
    const slotPos = slots[i]?.pos as Position;

    const isInjured = injuredSet.has(outId);
    const outFitness = liveFitness(outP);

    // Before min 45, only suggest subs for injured or very tired (< 50%) players
    if (!isInjured && minute < SMART_SUB_MIN_MINUTE && outFitness >= 50) continue;

    for (const inId of availableSubs) {
      const inP = players[inId];
      if (!inP) continue;

      const compat = posCompat(inP, slotPos);
      const effIn = effectiveStrength(inP, compat, liveFitness(inP));
      const effOut = effectiveStrength(outP, 1.0, outFitness); // current starter plays at natural compat in their slot

      // 1. Injured starters — highest priority, always recommend
      if (isInjured) {
        // For injured, pick best available replacement (ignore downgrade check)
        const score = 1000 + effIn;
        if (score > bestScore) {
          bestScore = score;
          best = { outId, inId, reason: `${outP.lastName} is injured — replace with ${inP.lastName}` };
        }
        continue;
      }

      // 2. Never recommend a downgrade for non-injured players
      if (effIn <= effOut) continue;

      // 3. Compute need score based on fitness/form
      const fitnessNeed = Math.max(0, 80 - outFitness) * 1.5;
      const formNeed = Math.max(0, 55 - outP.form) * 0.5;
      const needScore = fitnessNeed + formNeed;

      // 4. Improvement score (how much better the sub is)
      const improvementScore = effIn - effOut;

      // 5. Match context bonus
      let contextBonus = 0;
      if (isLosing && minute >= SMART_SUB_LOSING_MINUTE) {
        // Bonus for bringing on attackers
        if (ATTACKING_POSITIONS.includes(inP.position as Position)) contextBonus += 10;
        // Bonus for taking off defenders when losing
        if (DEFENSIVE_POSITIONS.includes(outP.position as Position) && !DEFENSIVE_POSITIONS.includes(inP.position as Position)) contextBonus += 5;
      }
      if (isWinning && minute >= SMART_SUB_WINNING_LATE_MINUTE) {
        // Bonus for bringing on defenders/CDMs
        if (DEFENSIVE_POSITIONS.includes(inP.position as Position)) contextBonus += 10;
      }

      const score = needScore + improvementScore + contextBonus;

      if (score > bestScore) {
        bestScore = score;

        // Determine reason
        let reason: string;
        if (outFitness < 60) {
          reason = `${outP.lastName} tired (${Math.round(outFitness)}%) → ${inP.lastName}`;
        } else if (outP.form < 55) {
          reason = `${outP.lastName} poor form → ${inP.lastName}`;
        } else if (contextBonus >= 10 && isLosing) {
          reason = `Attacking change: ${inP.lastName} for ${outP.lastName}`;
        } else if (contextBonus >= 10 && isWinning) {
          reason = `Shore up: ${inP.lastName} for ${outP.lastName}`;
        } else {
          reason = `Upgrade: ${inP.lastName} for ${outP.lastName}`;
        }
        best = { outId, inId, reason };
      }
    }
  }

  return best;
}
