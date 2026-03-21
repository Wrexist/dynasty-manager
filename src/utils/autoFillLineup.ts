import type { Player, FormationType, Position, PlayerAttributes } from '@/types/game';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY } from '@/types/game';
import { POSITION_WEIGHTS } from '@/config/playerGeneration';
import { MAX_SUBS } from '@/config/playerGeneration';
import { LOW_FITNESS_THRESHOLD } from '@/config/gameBalance';
import { getChemistryBonus } from '@/utils/chemistry';

// ── Scoring constants ──
const POSITIONAL_OVERALL_WEIGHT = 0.55;
const FORM_WEIGHT = 20;
const FITNESS_WEIGHT = 15;
const MORALE_WEIGHT = 10;
const NATURAL_POSITION_BONUS = 5;
const COMPATIBLE_POSITION_BONUS = 0;
const INCOMPATIBLE_POSITION_PENALTY = -15;
const LOW_FITNESS_EXTRA_PENALTY = -8;
const CHEMISTRY_SCORE_SCALE = 150; // scales 0-0.08 bonus to ~0-12 points for comparison
const SWAP_OPTIMIZATION_PASSES = 3;

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
 */
function positionFitScore(playerPosition: Position, slotPosition: Position): number {
  if (playerPosition === slotPosition) return NATURAL_POSITION_BONUS;
  const compat = POSITION_COMPATIBILITY[playerPosition];
  if (compat && compat.includes(slotPosition)) return COMPATIBLE_POSITION_BONUS;
  return INCOMPATIBLE_POSITION_PENALTY;
}

/**
 * Score a player for a specific formation slot.
 * Higher = better fit for that slot.
 */
function scorePlayerForSlot(player: Player, slotPosition: Position): number {
  const posOverall = positionalOverall(player.attributes, slotPosition);
  let score =
    posOverall * POSITIONAL_OVERALL_WEIGHT +
    (player.form / 100) * FORM_WEIGHT +
    (player.fitness / 100) * FITNESS_WEIGHT +
    (player.morale / 100) * MORALE_WEIGHT +
    positionFitScore(player.position, slotPosition);

  // Extra penalty for very low fitness
  if (player.fitness < LOW_FITNESS_THRESHOLD) {
    score += LOW_FITNESS_EXTRA_PENALTY;
  }

  return score;
}

/**
 * Smart auto-fill: produces the optimal starting XI and bench for a given formation.
 *
 * Algorithm:
 * 1. Score every available player for every formation slot
 * 2. Greedy assignment (constrained slots first: GK, then fewest-candidate slots)
 * 3. Pairwise swap optimization to improve total score
 * 4. Chemistry-aware refinement (swap bench players in if chemistry improves enough)
 * 5. Smart bench selection prioritizing positional coverage
 */
export function autoFillBestTeam(
  players: Player[],
  formation: FormationType,
  currentWeek?: number,
): { lineup: Player[]; subs: Player[] } {
  const slots = FORMATION_POSITIONS[formation];
  if (!slots || slots.length === 0) return { lineup: [], subs: [] };

  // Filter available players
  const available = players.filter(
    p => !p.injured && !(p.suspendedUntilWeek && currentWeek !== undefined && p.suspendedUntilWeek > currentWeek)
  );

  if (available.length === 0) return { lineup: [], subs: [] };

  // ── Phase 1: Precompute scores ──
  // scores[slotIndex][playerId] = score
  const scores: Map<string, number>[] = slots.map(slot => {
    const map = new Map<string, number>();
    for (const p of available) {
      map.set(p.id, scorePlayerForSlot(p, slot.pos));
    }
    return map;
  });

  // ── Phase 2: Greedy assignment (constrained slots first) ──
  // Sort slot indices by number of compatible players (ascending) to fill hardest slots first
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

  // ── Phase 3: Pairwise swap optimization ──
  for (let pass = 0; pass < SWAP_OPTIMIZATION_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < lineup.length; i++) {
      for (let j = i + 1; j < lineup.length; j++) {
        const pi = lineup[i];
        const pj = lineup[j];
        if (!pi || !pj) continue;

        const currentScore =
          (scores[i].get(pi.id) || 0) + (scores[j].get(pj.id) || 0);
        const swappedScore =
          (scores[i].get(pj.id) || 0) + (scores[j].get(pi.id) || 0);

        if (swappedScore > currentScore) {
          lineup[i] = pj;
          lineup[j] = pi;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  // ── Phase 4: Chemistry-aware refinement ──
  const lineupPlayers = lineup.filter(Boolean) as Player[];
  const bench = available.filter(p => !used.has(p.id));

  // Calculate baseline team score (sum of slot scores + chemistry)
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

  let currentTeamScore = getTeamScore(lineup);

  // Try swapping each bench player with each starter
  for (const benchPlayer of bench) {
    let bestSwapIdx = -1;
    let bestNewScore = currentTeamScore;

    for (let i = 0; i < lineup.length; i++) {
      const starter = lineup[i];
      if (!starter) continue;

      // Temporarily swap
      lineup[i] = benchPlayer;
      const newScore = getTeamScore(lineup);
      lineup[i] = starter; // restore

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

  // ── Phase 5: Smart bench selection ──
  const finalLineup = lineup.filter(Boolean) as Player[];
  const lineupPositions = new Set(finalLineup.map(p => p.position));
  const remaining = available.filter(p => !used.has(p.id));

  // Prioritize positional coverage, then effective rating
  const benchCandidates = remaining.map(p => ({
    player: p,
    coversGap: !lineupPositions.has(p.position) ? 1 : 0,
    rating: p.overall * 0.5 + (p.form / 100) * 25 + (p.fitness / 100) * 15 + (p.morale / 100) * 10,
  }));

  benchCandidates.sort((a, b) => {
    if (b.coversGap !== a.coversGap) return b.coversGap - a.coversGap;
    return b.rating - a.rating;
  });

  const finalSubs = benchCandidates.slice(0, MAX_SUBS).map(c => c.player);

  return { lineup: finalLineup, subs: finalSubs };
}
