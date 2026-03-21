import type { Player, FormationType, Position, PlayerAttributes } from '@/types/game';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY } from '@/types/game';
import { POSITION_WEIGHTS } from '@/config/playerGeneration';
import { MAX_SUBS } from '@/config/playerGeneration';
import { LOW_FITNESS_THRESHOLD } from '@/config/gameBalance';
import { getChemistryBonus, getChemistryLabel } from '@/utils/chemistry';

// ── Scoring constants ──
const POSITIONAL_OVERALL_WEIGHT = 0.55;
const FORM_WEIGHT = 20;
const FITNESS_WEIGHT = 15;
const MORALE_WEIGHT = 10;
const NATURAL_POSITION_BONUS = 5;
const COMPATIBLE_POSITION_BONUS = 2;
const INCOMPATIBLE_POSITION_PENALTY = -20;
const LOW_FITNESS_EXTRA_PENALTY = -8;
const LOW_MORALE_THRESHOLD = 40;
const LOW_MORALE_EXTRA_PENALTY = -6;
const WANTS_TO_LEAVE_PENALTY = -5;
const YELLOW_CARD_LOW_PENALTY = -1;
const YELLOW_CARD_HIGH_PENALTY = -8;
const YELLOW_CARD_HIGH_THRESHOLD = 2;
const REINJURY_RISK_PENALTY_SCALE = -5;
const CHEMISTRY_SCORE_SCALE = 50;
const SWAP_OPTIMIZATION_PASSES = 3;

// Bench selection position priority (higher = more important to have on bench)
const BENCH_POSITION_PRIORITY: Record<string, number> = {
  'GK': 10, 'CB': 6, 'LB': 4, 'RB': 4,
  'CDM': 3, 'CM': 3, 'CAM': 2,
  'LM': 2, 'RM': 2, 'LW': 1, 'RW': 1, 'ST': 2,
};

export interface AutoFillResult {
  lineup: Player[];
  subs: Player[];
  chemistryBonus: number;
  chemistryLabel: string;
}

/**
 * Calculate a player's effective overall for a specific target position
 * using that position's attribute weights (not the player's natural position weights).
 */
function positionalOverall(attrs: PlayerAttributes, targetPosition: Position): number {
  const weights = POSITION_WEIGHTS[targetPosition] || POSITION_WEIGHTS['CM'];
  const attrValues = [attrs.pace, attrs.shooting, attrs.passing, attrs.defending, attrs.physical, attrs.mental];
  let score = 0;
  for (let i = 0; i < 6; i++) {
    score += attrValues[i] * weights[i];
  }
  return score;
}

/**
 * Determine position fit bonus/penalty for a player in a target slot.
 * Natural position: +5, Compatible: +2, Incompatible: -20
 */
function positionFitScore(playerPosition: Position, slotPosition: Position): number {
  if (playerPosition === slotPosition) return NATURAL_POSITION_BONUS;
  const compat = POSITION_COMPATIBILITY[playerPosition];
  if (compat && compat.includes(slotPosition)) return COMPATIBLE_POSITION_BONUS;
  return INCOMPATIBLE_POSITION_PENALTY;
}

/**
 * Score a player for a specific formation slot.
 * Considers: positional overall, form, fitness, morale, position fit,
 * wantsToLeave, yellow card suspension risk, re-injury risk, and threshold penalties.
 */
function scorePlayerForSlot(player: Player, slotPosition: Position): number {
  const posOverall = positionalOverall(player.attributes, slotPosition);
  let score =
    posOverall * POSITIONAL_OVERALL_WEIGHT +
    (player.form / 100) * FORM_WEIGHT +
    (player.fitness / 100) * FITNESS_WEIGHT +
    (player.morale / 100) * MORALE_WEIGHT +
    positionFitScore(player.position, slotPosition);

  // Extra penalty for low fitness — match engine applies -0.15 shot penalty below 50
  if (player.fitness < LOW_FITNESS_THRESHOLD) {
    score += LOW_FITNESS_EXTRA_PENALTY;
  }

  // Extra penalty for low morale — match engine applies (morale-50)/100 * 0.10 modifier
  if (player.morale < LOW_MORALE_THRESHOLD) {
    score += LOW_MORALE_EXTRA_PENALTY;
  }

  // Unhappy players reduce team strength ~1.4% per unhappy player (15% / 11)
  if (player.wantsToLeave) {
    score += WANTS_TO_LEAVE_PENALTY;
  }

  // Yellow card suspension risk — non-linear: 2+ cards = imminent ban risk
  if (player.yellowCards >= YELLOW_CARD_HIGH_THRESHOLD) {
    score += YELLOW_CARD_HIGH_PENALTY;
  } else if (player.yellowCards > 0) {
    score += YELLOW_CARD_LOW_PENALTY;
  }

  // Re-injury risk for players recently returned from injury
  if (player.injuryDetails?.reinjuryWeeksRemaining && player.injuryDetails.reinjuryWeeksRemaining > 0) {
    score += REINJURY_RISK_PENALTY_SCALE * (player.injuryDetails.reinjuryRisk || 0);
  }

  return score;
}

/**
 * Smart auto-fill: produces the optimal starting XI and bench for a given formation.
 *
 * Algorithm:
 * 1. Score every available player for every formation slot
 * 2. Greedy assignment (constrained slots first: GK, then fewest-candidate slots)
 * 3. Chemistry-aware pairwise swap optimization
 * 4. Chemistry-aware bench-to-starter refinement
 * 5. Smart bench selection: GK priority, formation-aware coverage, sub-need awareness
 */
export function autoFillBestTeam(
  players: Player[],
  formation: FormationType,
  currentWeek?: number,
): AutoFillResult {
  const slots = FORMATION_POSITIONS[formation];
  if (!slots || slots.length === 0) {
    return { lineup: [], subs: [], chemistryBonus: 0, chemistryLabel: 'Low' };
  }

  // Filter available players: not injured, not suspended, not on loan
  const available = players.filter(
    p => !p.injured &&
      !p.onLoan &&
      !(p.suspendedUntilWeek && currentWeek !== undefined && p.suspendedUntilWeek > currentWeek)
  );

  if (available.length === 0) {
    return { lineup: [], subs: [], chemistryBonus: 0, chemistryLabel: 'Low' };
  }

  // ── Phase 1: Precompute scores ──
  const scores: Map<string, number>[] = slots.map(slot => {
    const map = new Map<string, number>();
    for (const p of available) {
      map.set(p.id, scorePlayerForSlot(p, slot.pos));
    }
    return map;
  });

  // ── Phase 2: Greedy assignment (constrained slots first) ──
  const slotOrder = slots.map((slot, idx) => ({
    idx,
    compatCount: available.filter(p => {
      const compat = POSITION_COMPATIBILITY[p.position];
      return p.position === slot.pos || (compat && compat.includes(slot.pos));
    }).length,
  }));
  slotOrder.sort((a, b) => a.compatCount - b.compatCount);

  const lineup: (Player | null)[] = new Array(slots.length).fill(null);
  const used = new Set<string>();

  for (const { idx } of slotOrder) {
    const slotScores = scores[idx];
    let bestPlayer: Player | null = null;
    let bestScore = -Infinity;

    for (const p of available) {
      if (used.has(p.id)) continue;
      const s = slotScores.get(p.id) || 0;
      if (s > bestScore) {
        bestScore = s;
        bestPlayer = p;
      }
    }

    if (bestPlayer) {
      lineup[idx] = bestPlayer;
      used.add(bestPlayer.id);
    }
  }

  // ── Helper: total team score including chemistry ──
  const getTeamScore = (currentLineup: (Player | null)[]) => {
    let total = 0;
    for (let i = 0; i < currentLineup.length; i++) {
      const p = currentLineup[i];
      if (p) total += scores[i].get(p.id) || 0;
    }
    const lp = currentLineup.filter(Boolean) as Player[];
    total += getChemistryBonus(lp) * CHEMISTRY_SCORE_SCALE;
    return total;
  };

  // ── Phase 3: Chemistry-aware pairwise swap optimization ──
  let currentTeamScore = getTeamScore(lineup);

  for (let pass = 0; pass < SWAP_OPTIMIZATION_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < lineup.length; i++) {
      for (let j = i + 1; j < lineup.length; j++) {
        const pi = lineup[i];
        const pj = lineup[j];
        if (!pi || !pj) continue;

        lineup[i] = pj;
        lineup[j] = pi;
        const swappedTeamScore = getTeamScore(lineup);

        if (swappedTeamScore > currentTeamScore) {
          currentTeamScore = swappedTeamScore;
          improved = true;
        } else {
          lineup[i] = pi;
          lineup[j] = pj;
        }
      }
    }
    if (!improved) break;
  }

  // ── Phase 4: Chemistry-aware bench-to-starter refinement ──
  const bench = available.filter(p => !used.has(p.id));

  if (bench.length > 0) {
    for (const benchPlayer of bench) {
      let bestSwapIdx = -1;
      let bestNewScore = currentTeamScore;

      for (let i = 0; i < lineup.length; i++) {
        const starter = lineup[i];
        if (!starter) continue;

        lineup[i] = benchPlayer;
        const newScore = getTeamScore(lineup);
        lineup[i] = starter;

        if (newScore > bestNewScore) {
          bestNewScore = newScore;
          bestSwapIdx = i;
        }
      }

      if (bestSwapIdx >= 0) {
        const displaced = lineup[bestSwapIdx]!;
        lineup[bestSwapIdx] = benchPlayer;
        used.add(benchPlayer.id);
        used.delete(displaced.id);
        currentTeamScore = bestNewScore;
      }
    }
  }

  // ── Phase 5: Smart bench selection ──
  const finalLineup = lineup.filter(Boolean) as Player[];
  const lineupPositions = new Set(finalLineup.map(p => p.position));
  const remaining = available.filter(p => !used.has(p.id));

  // Positions used in the current formation (for formation-aware gap detection)
  const formationPositions = new Set(slots.map(s => s.pos));

  // Find starters with lowest fitness (most likely to need subbing)
  const startersByFitness = [...finalLineup].sort((a, b) => a.fitness - b.fitness);
  const subNeedPositions = new Set(startersByFitness.slice(0, 3).map(p => p.position));

  // Ensure GK backup
  const hasGKInLineup = finalLineup.some(p => p.position === 'GK');
  const backupGKAvailable = remaining.find(p => p.position === 'GK');

  const benchCandidates = remaining.map(p => {
    const isGKBackup = p.position === 'GK' && hasGKInLineup;

    // Only count as covering a gap if the position is actually used in the formation
    const coversFormationGap = !lineupPositions.has(p.position) && formationPositions.has(p.position);

    // Can substitute for a low-fitness starter
    const coversSubNeed = subNeedPositions.has(p.position) ||
      (POSITION_COMPATIBILITY[p.position] || []).some(pos => subNeedPositions.has(pos));

    const positionPriority = BENCH_POSITION_PRIORITY[p.position] || 1;

    const priority =
      (isGKBackup ? 100 : 0) +
      (coversFormationGap ? 15 : 0) +
      (coversSubNeed ? 8 : 0) +
      positionPriority;

    // Bench rating: overall-dominant since bench players are insurance
    const rating = p.overall * 0.7 + (p.form / 100) * 15 + (p.fitness / 100) * 10 + (p.morale / 100) * 5;

    return { player: p, priority, rating };
  });

  benchCandidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.rating - a.rating;
  });

  // Always include backup GK first if available
  const finalSubs: Player[] = [];
  if (backupGKAvailable && hasGKInLineup) {
    finalSubs.push(backupGKAvailable);
  }

  for (const c of benchCandidates) {
    if (finalSubs.length >= MAX_SUBS) break;
    if (finalSubs.some(s => s.id === c.player.id)) continue;
    finalSubs.push(c.player);
  }

  const chemBonus = getChemistryBonus(finalLineup);
  const chemLabel = getChemistryLabel(chemBonus);

  return {
    lineup: finalLineup,
    subs: finalSubs,
    chemistryBonus: chemBonus,
    chemistryLabel: chemLabel.label,
  };
}
