import type { Player, FormationType, Position, PlayerAttributes } from '@/types/game';
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
  BENCH_TIER_EMERGENCY,
  BENCH_TIER_IMPACT,
  BENCH_VULNERABLE_STARTER_COUNT,
  BENCH_STARTER_TIRED_THRESHOLD,
} from '@/config/lineupOptimization';
import { getChemistryBonus, getChemistryLabel } from '@/utils/chemistry';

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
  currentSeason?: number,
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
  // Map each formation slot position to the starter occupying it and their vulnerability
  const starterInSlot: { player: Player; slotPos: Position }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const p = lineup[i];
    if (p) starterInSlot.push({ player: p, slotPos: slots[i].pos });
  }

  // Find the most vulnerable starters (low fitness, yellow card risk, reinjury risk)
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

  // Starters with yellow card suspension risk
  const yellowCardRiskSlots = starterInSlot
    .filter(s => s.player.yellowCards >= YELLOW_CARD_HIGH_THRESHOLD)
    .map(s => s.slotPos);

  // Starters with reinjury risk
  const reinjuryRiskSlots = starterInSlot
    .filter(s => s.player.injuryDetails?.reinjuryWeeksRemaining && s.player.injuryDetails.reinjuryWeeksRemaining > 0)
    .map(s => s.slotPos);

  // Attacking and defensive position sets (mirrors match engine)
  const attackingPositions: Position[] = ['ST', 'LW', 'RW', 'CAM'];
  const defensivePositions: Position[] = ['CB', 'CDM', 'LB', 'RB'];

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
    if (attackingPositions.includes(p.position)) {
      return (a.shooting + a.pace) * BENCH_ATTRIBUTE_IMPACT_WEIGHT;
    }
    if (defensivePositions.includes(p.position)) {
      return (a.defending + a.physical) * BENCH_ATTRIBUTE_IMPACT_WEIGHT;
    }
    // Midfield (CM, LM, RM)
    return (a.passing + a.mental) * BENCH_ATTRIBUTE_IMPACT_WEIGHT;
  };

  // ── Score every bench candidate ──
  const benchCandidates = remaining.map(p => {
    const isGKBackup = p.position === 'GK' && hasGKInLineup;

    // Base quality rating
    const baseRating = p.overall * 0.7 + (p.form / 100) * 15 + (p.fitness / 100) * 10 + (p.morale / 100) * 5;

    // Positional versatility: how many formation slots can this player cover?
    const formationCoverage = countFormationCoverage(p.position);
    const versatilityScore = formationCoverage * BENCH_VERSATILITY_BONUS_PER_SLOT;

    // Freshness differential: how much fitter is this sub vs the weakest starter they'd replace?
    const freshnessDiff = getBestFreshnessDiff(p);
    const freshnessScore = Math.max(0, freshnessDiff) * BENCH_FRESHNESS_DIFF_WEIGHT;

    // Form momentum: in-form players are impact subs
    const formBonus = p.form >= BENCH_HIGH_FORM_THRESHOLD ? BENCH_HIGH_FORM_BONUS : 0;

    // Yellow card insurance: can this player cover a starter at suspension risk?
    const coversYellowRisk = yellowCardRiskSlots.some(pos => canCoverPosition(p.position, pos));
    const yellowCoverScore = coversYellowRisk ? BENCH_YELLOW_CARD_COVER_BONUS : 0;

    // Reinjury risk coverage: can this player cover a starter with reinjury risk?
    const coversReinjury = reinjuryRiskSlots.some(pos => canCoverPosition(p.position, pos));
    const reinjuryCoverScore = coversReinjury ? BENCH_REINJURY_COVER_BONUS : 0;

    // Tactical role bonus: attackers for chasing games, defenders for protecting leads
    const isAttacker = attackingPositions.includes(p.position);
    const isDefender = defensivePositions.includes(p.position);
    const tacticalRoleBonus = isAttacker ? BENCH_ATTACKER_IMPACT_BONUS : isDefender ? BENCH_DEFENDER_INSURANCE_BONUS : 0;

    // Attribute-based impact (mirrors match engine scoring weights)
    const attributeImpact = getAttributeImpact(p);

    // Sub-need coverage: covers one of the most vulnerable starters
    const coversSubNeed = [...subNeedPositions].some(pos => canCoverPosition(p.position, pos));

    // Formation gap: position not represented in lineup but exists in formation
    const coversFormationGap = !lineupPositions.has(p.position) && formationPositions.has(p.position);

    // Position priority (base value from config)
    const positionPriority = BENCH_POSITION_PRIORITY[p.position] || 1;

    // Young energy: younger players have more stamina for late-game impact
    const youngBonus = p.age <= BENCH_YOUNG_ENERGY_THRESHOLD ? BENCH_YOUNG_ENERGY_BONUS : 0;

    // ── Total bench score ──
    const totalScore =
      (isGKBackup ? 1000 : 0) +  // GK backup is non-negotiable
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
      youngBonus;

    // ── Determine bench tier for strategic ordering ──
    // Tier 0: Backup GK (always first)
    // Tier 1: Emergency coverage — high versatility + covers a vulnerable starter
    // Tier 2: Tactical impact — high form + quality + freshness (game-changers)
    // Tier 3: Remaining quality depth
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
      p.overall >= (finalLineup.reduce((sum, s) => sum + s.overall, 0) / finalLineup.length) - 5
    ) {
      tier = 2;
    }

    // Tier bonus ensures strategic ordering: emergency subs before impact subs before depth
    const tierBonus = tier === 0 ? 1000 : tier === 1 ? BENCH_TIER_EMERGENCY : tier === 2 ? BENCH_TIER_IMPACT : 0;

    return { player: p, totalScore, tierBonus, tier };
  });

  // Sort: by tier (ascending = GK first, then emergency, then impact, then depth),
  // then within each tier by totalScore (descending = best first)
  benchCandidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.totalScore - a.totalScore;
  });

  // ── Greedy bench filling with positional diversity ──
  // Ensure we don't stack 3+ players of the same position on the bench
  const finalSubs: Player[] = [];
  const benchPositionCounts: Record<string, number> = {};

  for (const c of benchCandidates) {
    if (finalSubs.length >= MAX_SUBS) break;

    const pos = c.player.position;

    // Allow max 2 of any non-GK position on bench (GK always gets exactly 1 slot)
    if (pos === 'GK') {
      if (benchPositionCounts['GK']) continue; // Only 1 backup GK
    } else if ((benchPositionCounts[pos] || 0) >= 2) {
      continue; // Skip if we already have 2 of this position on bench
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
