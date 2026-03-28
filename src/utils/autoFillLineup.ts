import type { Player, FormationType, Position, PlayerAttributes, TacticalInstructions, AIManagerStyle } from '@/types/game';
import { FORMATION_POSITIONS, POSITION_COMPATIBILITY } from '@/types/game';
import { POSITION_WEIGHTS } from '@/config/playerGeneration';
import { MAX_SUBS } from '@/config/playerGeneration';
import { LOW_FITNESS_THRESHOLD } from '@/config/gameBalance';
import {
  LINEUP_POSITIONAL_OVERALL_WEIGHT as POSITIONAL_OVERALL_WEIGHT,
  LINEUP_FORM_WEIGHT as FORM_WEIGHT,
  LINEUP_FITNESS_WEIGHT as FITNESS_WEIGHT,
  LINEUP_MORALE_WEIGHT as MORALE_WEIGHT,
  LINEUP_NATURAL_POSITION_BONUS as NATURAL_POSITION_BONUS,
  LINEUP_COMPATIBLE_POSITION_BONUS as COMPATIBLE_POSITION_BONUS,
  LINEUP_INCOMPATIBLE_POSITION_PENALTY as INCOMPATIBLE_POSITION_PENALTY,
  LINEUP_LOW_FITNESS_EXTRA_PENALTY as LOW_FITNESS_EXTRA_PENALTY,
  LINEUP_LOW_MORALE_THRESHOLD as LOW_MORALE_THRESHOLD,
  LINEUP_LOW_MORALE_EXTRA_PENALTY as LOW_MORALE_EXTRA_PENALTY,
  LINEUP_WANTS_TO_LEAVE_PENALTY as WANTS_TO_LEAVE_PENALTY,
  LINEUP_YELLOW_CARD_LOW_PENALTY as YELLOW_CARD_LOW_PENALTY,
  LINEUP_YELLOW_CARD_HIGH_PENALTY as YELLOW_CARD_HIGH_PENALTY,
  LINEUP_YELLOW_CARD_HIGH_THRESHOLD as YELLOW_CARD_HIGH_THRESHOLD,
  LINEUP_REINJURY_RISK_PENALTY_SCALE as REINJURY_RISK_PENALTY_SCALE,
  LINEUP_CHEMISTRY_SCORE_SCALE as CHEMISTRY_SCORE_SCALE,
  LINEUP_SWAP_OPTIMIZATION_PASSES as SWAP_OPTIMIZATION_PASSES,
  LINEUP_BENCH_POSITION_PRIORITY as BENCH_POSITION_PRIORITY,
  POSITION_FITNESS_OVERRIDE,
  BENCH_VERSATILITY_BONUS_PER_SLOT,
  BENCH_FRESHNESS_DIFF_WEIGHT,
  BENCH_HIGH_FORM_THRESHOLD,
  BENCH_HIGH_FORM_BONUS,
  BENCH_YELLOW_CARD_COVER_BONUS,
  BENCH_REINJURY_COVER_BONUS,
  BENCH_ATTACKER_IMPACT_BONUS,
  BENCH_DEFENDER_INSURANCE_BONUS,
  BENCH_ATTRIBUTE_IMPACT_WEIGHT,
  BENCH_YOUNG_ENERGY_THRESHOLD,
  BENCH_YOUNG_ENERGY_BONUS,
  BENCH_VULNERABLE_STARTER_COUNT,
  BENCH_STARTER_TIRED_THRESHOLD,
  CONTEXT_DERBY_TEMPERAMENT_PENALTY_PER_INTENSITY,
  CONTEXT_DERBY_TEMPERAMENT_THRESHOLD,
  CONTEXT_AWAY_DEFENSIVE_BONUS,
  CONTEXT_AWAY_MORALE_EXTRA_WEIGHT,
  CONTEXT_CUP_EXPERIENCE_BONUS,
  CONTEXT_CUP_EXPERIENCE_THRESHOLD,
  CONTEXT_CONGESTED_FITNESS_PENALTY_THRESHOLD,
  CONTEXT_CONGESTED_FITNESS_PENALTY,
  CONTEXT_VS_ATTACKING_DEFENSIVE_BONUS,
  CONTEXT_VS_DEFENSIVE_CREATIVE_BONUS,
  CONTEXT_VS_POSSESSION_PRESSING_BONUS,
  CONTEXT_VS_COUNTER_DEFENSIVE_BONUS,
  CONTEXT_LEADERSHIP_BONUS_THRESHOLD,
  CONTEXT_LEADERSHIP_STARTER_BONUS,
  BENCH_DERBY_CALM_BONUS_PER_INTENSITY,
  BENCH_DERBY_CALM_THRESHOLD,
  BENCH_CONGESTED_HIGH_FITNESS_BONUS,
  BENCH_CONGESTED_FITNESS_THRESHOLD,
  BENCH_CUP_ATTACKER_BONUS,
  BENCH_AWAY_DEFENDER_BONUS,
} from '@/config/lineupOptimization';
import { getChemistryBonus, getChemistryLabel } from '@/utils/chemistry';

export interface AutoFillResult {
  lineup: Player[];
  subs: Player[];
  chemistryBonus: number;
  chemistryLabel: string;
}

/** Match context for opponent-aware and situation-aware lineup optimization. */
export interface AutoFillContext {
  tactics?: TacticalInstructions;
  opponentFormation?: FormationType;
  opponentStyle?: AIManagerStyle;
  opponentReputation?: number;
  isHome?: boolean;
  derbyIntensity?: number;
  isCupMatch?: boolean;
  hasMatchNextWeek?: boolean;
}

// Position role sets (mirrors match engine categories)
const ATTACKING_POSITIONS: Position[] = ['ST', 'LW', 'RW', 'CAM'];
const DEFENSIVE_POSITIONS: Position[] = ['CB', 'CDM', 'LB', 'RB'];

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
 * Natural position: +8, Compatible: +4, Incompatible: -30
 */
function positionFitScore(playerPosition: Position, slotPosition: Position): number {
  if (playerPosition === slotPosition) return NATURAL_POSITION_BONUS;
  const compat = POSITION_COMPATIBILITY[playerPosition];
  if (compat && compat.includes(slotPosition)) return COMPATIBLE_POSITION_BONUS;
  return INCOMPATIBLE_POSITION_PENALTY;
}

/**
 * Score a player for a specific formation slot.
 * Considers: positional overall, form, fitness (position-specific), morale, position fit,
 * wantsToLeave, yellow card suspension risk, re-injury risk, threshold penalties,
 * and match context (opponent style, derby, home/away, cup, congestion, leadership).
 */
function scorePlayerForSlot(player: Player, slotPosition: Position, context?: AutoFillContext): number {
  const posOverall = positionalOverall(player.attributes, slotPosition);

  // Position-specific fitness weight: attackers need more fitness (40% of goal selection in match engine)
  const fitnessWeight = POSITION_FITNESS_OVERRIDE[slotPosition] ?? FITNESS_WEIGHT;

  let score =
    posOverall * POSITIONAL_OVERALL_WEIGHT +
    (player.form / 100) * FORM_WEIGHT +
    (player.fitness / 100) * fitnessWeight +
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

  // ── Match Context Adjustments ──
  if (context) {
    // Derby: penalize hot-headed players (low temperament → more cards in derby matches)
    if (context.derbyIntensity && context.derbyIntensity > 0 && player.personality?.temperament != null) {
      if (player.personality.temperament < CONTEXT_DERBY_TEMPERAMENT_THRESHOLD) {
        const tempGap = CONTEXT_DERBY_TEMPERAMENT_THRESHOLD - player.personality.temperament;
        score -= tempGap * context.derbyIntensity * CONTEXT_DERBY_TEMPERAMENT_PENALTY_PER_INTENSITY;
      }
    }

    // Away matches: boost defensive positions + reward high morale (mental resilience)
    if (context.isHome === false) {
      if (DEFENSIVE_POSITIONS.includes(slotPosition)) score += CONTEXT_AWAY_DEFENSIVE_BONUS;
      score += (player.morale / 100) * CONTEXT_AWAY_MORALE_EXTRA_WEIGHT;
    }

    // Cup matches: experienced players handle pressure better
    if (context.isCupMatch && player.appearances >= CONTEXT_CUP_EXPERIENCE_THRESHOLD) {
      score += CONTEXT_CUP_EXPERIENCE_BONUS;
    }

    // Congested fixtures: penalize fatigued players who'll be exhausted for next match
    if (context.hasMatchNextWeek && player.fitness < CONTEXT_CONGESTED_FITNESS_PENALTY_THRESHOLD) {
      score += CONTEXT_CONGESTED_FITNESS_PENALTY;
    }

    // Opponent style counter bonuses
    if (context.opponentStyle) {
      const isDefPos = DEFENSIVE_POSITIONS.includes(slotPosition);
      const isCreativePos = slotPosition === 'CAM' || slotPosition === 'CM';
      const isMidfield = ['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(slotPosition);

      switch (context.opponentStyle) {
        case 'attacking':
        case 'direct':
          // Need defensive solidity against attacking teams
          if (isDefPos) score += CONTEXT_VS_ATTACKING_DEFENSIVE_BONUS;
          break;
        case 'defensive':
          // Need creative players to break down defensive teams
          if (isCreativePos) score += CONTEXT_VS_DEFENSIVE_CREATIVE_BONUS;
          break;
        case 'possession':
          // Need physical + mentally strong midfielders to press and disrupt
          if (isMidfield && player.attributes.physical > 65 && player.attributes.mental > 65) {
            score += CONTEXT_VS_POSSESSION_PRESSING_BONUS;
          }
          break;
        case 'counter-attack':
          // Need solid defence to prevent counters
          if (isDefPos) score += CONTEXT_VS_COUNTER_DEFENSIVE_BONUS;
          break;
      }
    }

    // Leadership bonus: high-leadership players boost team cohesion
    if (player.personality?.leadership != null && player.personality.leadership >= CONTEXT_LEADERSHIP_BONUS_THRESHOLD) {
      score += CONTEXT_LEADERSHIP_STARTER_BONUS;
    }
  }

  return score;
}

/**
 * Optimize the positions of current starters within their formation slots.
 * Does NOT swap bench players in — only rearranges the given starters for best positional fit.
 * Safe to use mid-match since it doesn't change WHO is playing, only WHERE they play.
 *
 * Uses a greedy assignment (constrained-slots-first) + pairwise swap optimization.
 * Returns a new lineup array (same player IDs, potentially reordered).
 */
export function optimizeStarterPositions(
  starterIds: string[],
  playersMap: Record<string, Player>,
  formation: FormationType,
): string[] {
  const slots = FORMATION_POSITIONS[formation];
  if (!slots || slots.length === 0) return starterIds;

  const starters = starterIds.map(id => playersMap[id]).filter(Boolean);
  if (starters.length === 0) return starterIds;

  // Score every starter for every slot
  const scores: number[][] = [];
  for (let si = 0; si < slots.length; si++) {
    scores[si] = [];
    for (let pi = 0; pi < starters.length; pi++) {
      scores[si][pi] = scorePlayerForSlot(starters[pi], slots[si].pos as Position);
    }
  }

  // Greedy assignment: constrained slots first (fewest high-scoring players)
  const assigned: (Player | null)[] = new Array(slots.length).fill(null);
  const used = new Set<number>();

  // Order slots by number of compatible players (ascending = most constrained first)
  const slotOrder = slots.map((_, i) => i).sort((a, b) => {
    const countA = starters.filter((p, pi) => !used.has(pi) && scores[a][pi] > 0).length;
    const countB = starters.filter((p, pi) => !used.has(pi) && scores[b][pi] > 0).length;
    return countA - countB;
  });

  for (const si of slotOrder) {
    let bestPi = -1;
    let bestScore = -Infinity;
    for (let pi = 0; pi < starters.length; pi++) {
      if (used.has(pi)) continue;
      if (scores[si][pi] > bestScore) {
        bestScore = scores[si][pi];
        bestPi = pi;
      }
    }
    if (bestPi >= 0) {
      assigned[si] = starters[bestPi];
      used.add(bestPi);
    }
  }

  // Pairwise swap optimization (3 passes)
  for (let pass = 0; pass < SWAP_OPTIMIZATION_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const pi = assigned[i];
        const pj = assigned[j];
        if (!pi || !pj) continue;
        const piIdx = starters.indexOf(pi);
        const pjIdx = starters.indexOf(pj);
        const currentScore = scores[i][piIdx] + scores[j][pjIdx];
        const swappedScore = scores[i][pjIdx] + scores[j][piIdx];
        if (swappedScore > currentScore) {
          assigned[i] = pj;
          assigned[j] = pi;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  // Build result: maintain original IDs for any unassigned slots
  return assigned.map((p, i) => p?.id || starterIds[i]);
}

/**
 * Smart auto-fill: produces the optimal starting XI and bench for a given formation.
 *
 * Algorithm:
 * 1. Score every available player for every formation slot (context-aware)
 * 2. Greedy assignment (constrained slots first: GK, then fewest-candidate slots)
 * 3. Chemistry-aware pairwise swap optimization
 * 4. Chemistry-aware bench-to-starter refinement
 * 5. Smart bench selection: tiered ordering, vulnerability coverage, match context
 */
export function autoFillBestTeam(
  players: Player[],
  formation: FormationType,
  currentWeek?: number,
  currentSeason?: number,
  context?: AutoFillContext,
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

  // ── Phase 1: Precompute scores (context-aware) ──
  const scores: Map<string, number>[] = slots.map(slot => {
    const map = new Map<string, number>();
    for (const p of available) {
      map.set(p.id, scorePlayerForSlot(p, slot.pos, context));
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
    total += getChemistryBonus(lp, undefined, currentSeason) * CHEMISTRY_SCORE_SCALE;
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

  // ── Phase 5: Smart bench selection with strategic ordering ──
  const finalLineup = lineup.filter(Boolean) as Player[];
  const lineupPositions = new Set(finalLineup.map(p => p.position));
  const remaining = available.filter(p => !used.has(p.id));

  // Positions used in the current formation
  const formationPositions = new Set(slots.map(s => s.pos));
  const uniqueFormationPositions = [...formationPositions] as Position[];

  // ── Starter vulnerability analysis ──
  const starterInSlot: { player: Player; slotPos: Position }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const p = lineup[i];
    if (p) starterInSlot.push({ player: p, slotPos: slots[i].pos });
  }

  const starterVulnerability = starterInSlot.map(({ player: p, slotPos }) => {
    let vulnerability = 0;
    if (p.fitness < BENCH_STARTER_TIRED_THRESHOLD) vulnerability += (BENCH_STARTER_TIRED_THRESHOLD - p.fitness);
    if (p.yellowCards >= YELLOW_CARD_HIGH_THRESHOLD) vulnerability += 20;
    if (p.injuryDetails?.reinjuryWeeksRemaining && p.injuryDetails.reinjuryWeeksRemaining > 0) vulnerability += 15;
    if (p.morale < LOW_MORALE_THRESHOLD) vulnerability += 10;
    return { player: p, slotPos, vulnerability };
  }).sort((a, b) => b.vulnerability - a.vulnerability);

  const mostVulnerableStarters = starterVulnerability.slice(0, BENCH_VULNERABLE_STARTER_COUNT);
  const subNeedPositions = new Set(mostVulnerableStarters.map(s => s.slotPos));

  const yellowCardRiskSlots = starterInSlot
    .filter(s => s.player.yellowCards >= YELLOW_CARD_HIGH_THRESHOLD)
    .map(s => s.slotPos);

  const reinjuryRiskSlots = starterInSlot
    .filter(s => s.player.injuryDetails?.reinjuryWeeksRemaining && s.player.injuryDetails.reinjuryWeeksRemaining > 0)
    .map(s => s.slotPos);

  const hasGKInLineup = finalLineup.some(p => p.position === 'GK');

  // ── Helper: check if a player can cover a specific formation slot position ──
  const canCoverPosition = (playerPos: Position, targetPos: Position): boolean => {
    if (playerPos === targetPos) return true;
    const compat = POSITION_COMPATIBILITY[playerPos];
    return compat ? compat.includes(targetPos) : false;
  };

  // ── Helper: count how many unique formation positions this player can fill ──
  const countFormationCoverage = (playerPos: Position): number => {
    let count = 0;
    for (const pos of uniqueFormationPositions) {
      if (canCoverPosition(playerPos, pos)) count++;
    }
    return count;
  };

  // ── Helper: best freshness differential vs starters this player could replace ──
  const getBestFreshnessDiff = (player: Player): number => {
    let bestDiff = 0;
    for (const { player: starter, slotPos } of starterInSlot) {
      if (canCoverPosition(player.position, slotPos)) {
        const diff = player.fitness - starter.fitness;
        if (diff > bestDiff) bestDiff = diff;
      }
    }
    return bestDiff;
  };

  // ── Helper: attribute-based impact score based on position role in match engine ──
  const getAttributeImpact = (p: Player): number => {
    const a = p.attributes;
    if (ATTACKING_POSITIONS.includes(p.position)) {
      return (a.shooting + a.pace) * BENCH_ATTRIBUTE_IMPACT_WEIGHT;
    }
    if (DEFENSIVE_POSITIONS.includes(p.position)) {
      return (a.defending + a.physical) * BENCH_ATTRIBUTE_IMPACT_WEIGHT;
    }
    // Midfield (CM, LM, RM)
    return (a.passing + a.mental) * BENCH_ATTRIBUTE_IMPACT_WEIGHT;
  };

  // Compute average lineup overall for tier 2 threshold
  const avgLineupOverall = finalLineup.length > 0
    ? finalLineup.reduce((sum, s) => sum + s.overall, 0) / finalLineup.length
    : 0;

  // ── Score every bench candidate ──
  const benchCandidates = remaining.map(p => {
    const isGKBackup = p.position === 'GK' && hasGKInLineup;

    // Base quality rating
    const baseRating = p.overall * 0.7 + (p.form / 100) * 15 + (p.fitness / 100) * 10 + (p.morale / 100) * 5;

    // Positional versatility: how many formation slots can this player cover?
    const formationCoverage = countFormationCoverage(p.position);
    const versatilityScore = formationCoverage * BENCH_VERSATILITY_BONUS_PER_SLOT;

    // Freshness differential
    const freshnessDiff = getBestFreshnessDiff(p);
    const freshnessScore = Math.max(0, freshnessDiff) * BENCH_FRESHNESS_DIFF_WEIGHT;

    // Form momentum
    const formBonus = p.form >= BENCH_HIGH_FORM_THRESHOLD ? BENCH_HIGH_FORM_BONUS : 0;

    // Yellow card insurance
    const coversYellowRisk = yellowCardRiskSlots.some(pos => canCoverPosition(p.position, pos));
    const yellowCoverScore = coversYellowRisk ? BENCH_YELLOW_CARD_COVER_BONUS : 0;

    // Reinjury risk coverage
    const coversReinjury = reinjuryRiskSlots.some(pos => canCoverPosition(p.position, pos));
    const reinjuryCoverScore = coversReinjury ? BENCH_REINJURY_COVER_BONUS : 0;

    // Tactical role bonus
    const isAttacker = ATTACKING_POSITIONS.includes(p.position);
    const isDefender = DEFENSIVE_POSITIONS.includes(p.position);
    const tacticalRoleBonus = isAttacker ? BENCH_ATTACKER_IMPACT_BONUS : isDefender ? BENCH_DEFENDER_INSURANCE_BONUS : 0;

    // Attribute-based impact
    const attributeImpact = getAttributeImpact(p);

    // Sub-need coverage
    const coversSubNeed = [...subNeedPositions].some(pos => canCoverPosition(p.position, pos));

    // Formation gap
    const coversFormationGap = !lineupPositions.has(p.position) && formationPositions.has(p.position);

    // Position priority
    const positionPriority = BENCH_POSITION_PRIORITY[p.position] || 1;

    // Young energy
    const youngBonus = p.age <= BENCH_YOUNG_ENERGY_THRESHOLD ? BENCH_YOUNG_ENERGY_BONUS : 0;

    // ── Match context bench adjustments ──
    let contextBenchBonus = 0;
    if (context) {
      // Derby: calm subs are valuable (won't get carded when brought on)
      if (context.derbyIntensity && context.derbyIntensity > 0 && p.personality?.temperament != null) {
        if (p.personality.temperament >= BENCH_DERBY_CALM_THRESHOLD) {
          contextBenchBonus += context.derbyIntensity * BENCH_DERBY_CALM_BONUS_PER_INTENSITY;
        }
      }

      // Congested fixtures: high-fitness bench players stay fresh for next match
      if (context.hasMatchNextWeek && p.fitness >= BENCH_CONGESTED_FITNESS_THRESHOLD) {
        contextBenchBonus += BENCH_CONGESTED_HIGH_FITNESS_BONUS;
      }

      // Cup matches: attacking bench options for late-game drama
      if (context.isCupMatch && isAttacker) {
        contextBenchBonus += BENCH_CUP_ATTACKER_BONUS;
      }

      // Away matches: defensive depth is crucial
      if (context.isHome === false && isDefender) {
        contextBenchBonus += BENCH_AWAY_DEFENDER_BONUS;
      }
    }

    // ── Total bench score ──
    const totalScore =
      (isGKBackup ? 1000 : 0) +
      baseRating +
      versatilityScore +
      freshnessScore +
      formBonus +
      yellowCoverScore +
      reinjuryCoverScore +
      tacticalRoleBonus +
      attributeImpact +
      (coversSubNeed ? 8 : 0) +
      (coversFormationGap ? 15 : 0) +
      positionPriority +
      youngBonus +
      contextBenchBonus;

    // ── Determine bench tier for strategic ordering ──
    let tier = 3;
    if (isGKBackup) {
      tier = 0;
    } else if (
      (coversYellowRisk || coversReinjury || coversSubNeed) &&
      formationCoverage >= 2
    ) {
      tier = 1;
    } else if (
      (p.form >= BENCH_HIGH_FORM_THRESHOLD || freshnessDiff >= 15) &&
      p.overall >= avgLineupOverall - 5
    ) {
      tier = 2;
    }

    return { player: p, totalScore, tier };
  });

  // Sort: by tier (ascending = GK first, then emergency, then impact, then depth),
  // then within each tier by totalScore (descending = best first)
  benchCandidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.totalScore - a.totalScore;
  });

  // ── Greedy bench filling with positional diversity ──
  const finalSubs: Player[] = [];
  const benchPositionCounts: Record<string, number> = {};

  for (const c of benchCandidates) {
    if (finalSubs.length >= MAX_SUBS) break;

    const pos = c.player.position;

    // Allow max 2 of any non-GK position on bench (GK always gets exactly 1 slot)
    if (pos === 'GK') {
      if (benchPositionCounts['GK']) continue;
    } else if ((benchPositionCounts[pos] || 0) >= 2) {
      continue;
    }

    finalSubs.push(c.player);
    benchPositionCounts[pos] = (benchPositionCounts[pos] || 0) + 1;
  }

  // If we still have room after diversity cap, fill with remaining best scorers
  if (finalSubs.length < MAX_SUBS) {
    const subsSet = new Set(finalSubs.map(s => s.id));
    for (const c of benchCandidates) {
      if (finalSubs.length >= MAX_SUBS) break;
      if (subsSet.has(c.player.id)) continue;
      finalSubs.push(c.player);
      subsSet.add(c.player.id);
    }
  }

  const chemBonus = getChemistryBonus(finalLineup, formation, currentSeason);
  const chemLabel = getChemistryLabel(chemBonus);

  return {
    lineup: finalLineup,
    subs: finalSubs,
    chemistryBonus: chemBonus,
    chemistryLabel: chemLabel.label,
  };
}
