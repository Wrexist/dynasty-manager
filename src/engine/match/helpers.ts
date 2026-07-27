/**
 * Pure helpers extracted from `src/engine/match.ts`.
 *
 * Each function here is deterministic w.r.t. its inputs (modulo `Math.random()`)
 * and reaches into no module-level state. They cover three buckets:
 *   - Player picks (scorer / penalty taker / assist / fouler).
 *   - Strength + matchup math (tactics, formation, defense quality, GK ability).
 *   - Match-meta utilities (stoppage time, injury generation, squad validity,
 *     and the generic weighted-pick.)
 */
import type {
  Player,
  Club,
  TacticalInstructions,
  FormationType,
  MatchEvent,
  InjuryType,
  InjurySeverity,
  InjuryDetails,
} from '@/types/game';
import { FORMATION_POSITIONS, canPlayPosition } from '@/types/game';
import {
  INJURY_TYPES,
  FOUL_INJURY_TYPE_WEIGHTS,
  NON_FOUL_INJURY_TYPE_WEIGHTS,
  INJURY_SEVERITY_WEIGHTS,
  MEDICAL_INJURY_PREVENTION_PER_LEVEL,
  UNHAPPY_PERFORMANCE_PENALTY,
  FIRST_MATCH_ATTACK_BOOST,
  FIRST_MATCH_DEFENSE_BOOST,
  LINEUP_SIZE,
} from '@/config/gameBalance';
import {
  GOAL_SCORING_TYPES,
  FORMATION_FIT_MAX_BONUS,
  MIDFIELDER_POSITIONS,
  SCORER_POSITION_WEIGHTS, SCORER_SHOOTING_INFLUENCE, SCORER_FITNESS_INFLUENCE, SCORER_FORM_INFLUENCE,
  ASSIST_CHANCE, ASSIST_PASSING_WEIGHT, ASSIST_MENTAL_WEIGHT,
  MENTALITY_ATTACK_MOD, MENTALITY_DEFENSE_MOD,
  TEMPO_SHOT_MOD, DEFENSIVE_LINE_COUNTER_VULN, WIDTH_POSSESSION_MOD,
  DEFENSIVE_LINE_COMPRESSION, PRESSING_TURNOVER_PER_POINT, PRESSING_TURNOVER_BASELINE,
  PRESSING_THRESHOLD, PRESSING_VS_SLOW_BONUS, WIDE_VS_NARROW_BONUS,
  DEEP_VS_HIGH_BONUS, FAST_VS_CAUTIOUS_BONUS, ALL_OUT_VS_DEFENSIVE_BONUS,
  PRESSING_FOUL_MULTIPLIER, PRESSING_FOUL_BASELINE,
  DEFENDER_POSITIONS, DEFENSE_DEFENDING_WEIGHT, DEFENSE_PHYSICAL_WEIGHT, DEFENSE_MENTAL_WEIGHT, DEFENSE_QUALITY_FALLBACK,
  GK_DEFENDING_WEIGHT, GK_MENTAL_WEIGHT, GK_PHYSICAL_WEIGHT, GK_SAVE_BASE, GK_SAVE_RANGE,
  EMERGENCY_KEEPER_SAVE_MULT,
  TACTICAL_FAMILIARITY_MULTIPLIER, HOME_ADVANTAGE,
  FORMATION_ATTACK_BONUS, FORMATION_DEFENSE_BONUS,
  STOPPAGE_TIME_BASE, STOPPAGE_TIME_MAX_EXTRA, STOPPAGE_TIME_INJURY_ADD, STOPPAGE_TIME_CARD_ADD, STOPPAGE_TIME_GOAL_ADD, STOPPAGE_TIME_MAX,
  FOULER_DEFENDER_WEIGHT, FOULER_MIDFIELDER_WEIGHT, FOULER_ATTACKER_WEIGHT,
  FORMATION_MATCHUP,
  DEFENSE_MODIFIER_SCALE,
  MORALE_PERFORMANCE_WEIGHT, MORALE_BASELINE,
  PENALTY_TAKER_SHOOTING_WEIGHT, PENALTY_TAKER_MENTAL_WEIGHT,
  RED_CARD_STRENGTH_PENALTY_PER_PLAYER,
} from '@/config/matchEngine';
import { getTeamStrength } from '@/utils/playerGen';
import { getChemistryBonus } from '@/utils/chemistry';

/** Default balanced tactics for AI teams */
export const AI_DEFAULT_TACTICS: TacticalInstructions = {
  mentality: 'balanced',
  width: 'normal',
  tempo: 'normal',
  defensiveLine: 'normal',
  pressingIntensity: 50,
};

// ── Generic weighted pick ─────────────────────────────────────────────────

/** Pick from a weighted pool of string-keyed entries. */
export function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w as number), 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight as number;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ── Player picks ──────────────────────────────────────────────────────────

/** Pick a goal scorer weighted by position role, shooting skill, fitness, and current form.
 *  Forwards >> midfielders >> defenders. GKs are excluded from open-play scoring unless
 *  they are the only players left (extreme red-card edge case). */
export function pickAttacker(players: Player[]): Player {
  // Exclude GKs — they don't score in open play
  const pool = players.filter(p => p.position !== 'GK');
  const candidates = pool.length > 0 ? pool : players;
  if (candidates.length === 1) return candidates[0];

  const weights = candidates.map(p => {
    const posWeight = SCORER_POSITION_WEIGHTS[p.position] ?? 0.3;
    const shootingBonus = (p.attributes.shooting / 100) * SCORER_SHOOTING_INFLUENCE;
    const fitnessBonus = (p.fitness / 100) * SCORER_FITNESS_INFLUENCE;
    const formBonus = ((p.form - 50) / 100) * SCORER_FORM_INFLUENCE;
    return Math.max(0.01, posWeight + shootingBonus + fitnessBonus + formBonus);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Pick the best penalty taker weighted by shooting + mental */
export function pickPenaltyTaker(players: Player[]): Player {
  if (players.length <= 1) return players[0];
  const weights = players.map(p => (p.attributes.shooting * PENALTY_TAKER_SHOOTING_WEIGHT + p.attributes.mental * PENALTY_TAKER_MENTAL_WEIGHT) / 100);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return players[Math.floor(Math.random() * players.length)];
  let r = Math.random() * totalWeight;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

/** Pick an assist provider weighted by passing quality */
export function pickAssist(players: Player[], scorerId: string): Player | undefined {
  const others = players.filter(p => p.id !== scorerId);
  if (others.length === 0) return undefined;
  if (Math.random() < ASSIST_CHANCE) {
    const weights = others.map(p => (p.attributes.passing * ASSIST_PASSING_WEIGHT + p.attributes.mental * ASSIST_MENTAL_WEIGHT) / 100);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return others[Math.floor(Math.random() * others.length)];
    let r = Math.random() * totalWeight;
    for (let i = 0; i < others.length; i++) {
      r -= weights[i];
      if (r <= 0) return others[i];
    }
    return others[others.length - 1];
  }
  return undefined;
}

/** Pick a fouler weighted by position — defenders/CDMs 3x more likely than attackers */
export function pickFouler(players: Player[]): Player | null {
  if (players.length === 0) return null;
  const weights = players.map(p => {
    if ((DEFENDER_POSITIONS as readonly string[]).includes(p.position)) return FOULER_DEFENDER_WEIGHT;
    if ((MIDFIELDER_POSITIONS as readonly string[]).includes(p.position)) return FOULER_MIDFIELDER_WEIGHT;
    return FOULER_ATTACKER_WEIGHT;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

// ── Strength + matchup math ──────────────────────────────────────────────

/**
 * Formation fit bonus: 0.0 to FORMATION_FIT_MAX_BONUS.
 *
 * This is an ASSIGNMENT problem, not a set-cover one. The previous version
 * asked "does ANY player in the pool cover this slot?" without consuming the
 * player, so one versatile midfielder satisfied every midfield slot and an
 * essentially random XI scored 0.100 out of a 0.250 ceiling — a genuinely
 * optimal XI was worth only 2.5x a shambles.
 *
 * Now each slot is matched to a distinct player and the per-slot compatibility
 * is averaged, so playing people out of position costs real strength. Greedy
 * over slots by scarcity (fewest natural candidates first) — an exact
 * assignment would need Hungarian matching for a payoff far below the noise
 * floor of a single match.
 */
export function getFormationFitBonus(players: Player[], formation: FormationType): number {
  const slots = FORMATION_POSITIONS[formation];
  if (!slots || players.length === 0) return 0;
  const outfieldSlots = slots.filter(s => s.pos !== 'GK');
  const outfieldPlayers = players.filter(p => p.position !== 'GK');
  if (outfieldSlots.length === 0) return FORMATION_FIT_MAX_BONUS;
  if (outfieldPlayers.length === 0) return 0;

  /** 1.0 natural, 0.7 listed alternate, 0.3 out of position. */
  const compat = (p: Player, pos: (typeof outfieldSlots)[number]['pos']): number => {
    if (p.position === pos) return 1;
    if (canPlayPosition(p, pos)) return 0.7;
    return 0.3;
  };

  // Hardest slots first: a slot with no natural fit should not lose its only
  // alternate-position candidate to a slot that had a natural option.
  const orderedSlots = [...outfieldSlots].sort(
    (a, b) =>
      outfieldPlayers.filter(p => p.position === a.pos).length -
      outfieldPlayers.filter(p => p.position === b.pos).length,
  );

  const taken = new Set<string>();
  let score = 0;
  for (const slot of orderedSlots) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of outfieldPlayers) {
      if (taken.has(p.id)) continue;
      const c = compat(p, slot.pos);
      if (c > bestScore) { bestScore = c; best = p; }
      if (c === 1) break; // can't beat a natural fit
    }
    if (!best) continue; // fewer players than slots — unfilled slots score 0
    taken.add(best.id);
    score += bestScore;
  }
  const fitRatio = Math.min(1, score / outfieldSlots.length);
  return fitRatio * FORMATION_FIT_MAX_BONUS;
}

/** Tactical matchup bonus: certain styles counter others */
export function getTacticalMatchupBonus(myTactics?: TacticalInstructions, oppTactics?: TacticalInstructions): number {
  if (!myTactics || !oppTactics) return 0;
  let bonus = 0;
  if (myTactics.pressingIntensity >= PRESSING_THRESHOLD && oppTactics.tempo === 'slow') bonus += PRESSING_VS_SLOW_BONUS;
  if (myTactics.width === 'wide' && oppTactics.width === 'narrow') bonus += WIDE_VS_NARROW_BONUS;
  if (myTactics.defensiveLine === 'deep' && oppTactics.defensiveLine === 'high') bonus += DEEP_VS_HIGH_BONUS;
  if (myTactics.tempo === 'fast' && (oppTactics.mentality === 'cautious' || oppTactics.mentality === 'defensive')) bonus += FAST_VS_CAUTIOUS_BONUS;
  if (myTactics.mentality === 'all-out-attack' && oppTactics.mentality === 'defensive') bonus += ALL_OUT_VS_DEFENSIVE_BONUS;
  return bonus;
}

/** Formation-vs-formation matchup bonus (e.g. 3-back weak vs wingers) */
export function getFormationMatchupBonus(myFormation: FormationType, oppFormation: FormationType): number {
  return FORMATION_MATCHUP[myFormation]?.[oppFormation] ?? 0;
}

export function getTacticsModifiers(tactics?: TacticalInstructions) {
  if (!tactics) return { attackMod: 0, defenseMod: 0, shotMod: 0, foulMod: 0, counterVuln: 0, widthMod: 0, territoryMod: 0 };
  return {
    attackMod: MENTALITY_ATTACK_MOD[tactics.mentality] || 0,
    defenseMod: MENTALITY_DEFENSE_MOD[tactics.mentality] || 0,
    shotMod: TEMPO_SHOT_MOD[tactics.tempo] || 0,
    foulMod: (tactics.pressingIntensity - PRESSING_FOUL_BASELINE) * PRESSING_FOUL_MULTIPLIER,
    counterVuln: DEFENSIVE_LINE_COUNTER_VULN[tactics.defensiveLine] || 0,
    widthMod: WIDTH_POSSESSION_MOD[tactics.width] || 0,
    // Territory = where the ball is won and how much of the pitch you own.
    // A high line and heavy pressing both buy territory (more event share);
    // they are paid for by counter-vulnerability, fouls and fitness drain.
    // Mentality deliberately does NOT feed this channel — see the strength
    // formula note below.
    territoryMod:
      (DEFENSIVE_LINE_COMPRESSION[tactics.defensiveLine] || 0) +
      (tactics.pressingIntensity - PRESSING_TURNOVER_BASELINE) * PRESSING_TURNOVER_PER_POINT,
  };
}

/** Compute average defensive quality of a squad's defenders (morale-adjusted) */
export function getDefenseQuality(squad: Player[]): number {
  const defenders = squad.filter(p => (DEFENDER_POSITIONS as readonly string[]).includes(p.position));
  if (defenders.length === 0) return DEFENSE_QUALITY_FALLBACK;
  return defenders.reduce((s, p) => {
    const base = (p.attributes.defending * DEFENSE_DEFENDING_WEIGHT + p.attributes.physical * DEFENSE_PHYSICAL_WEIGHT + p.attributes.mental * DEFENSE_MENTAL_WEIGHT) / 100;
    const moraleMod = (p.morale - MORALE_BASELINE) / 100 * MORALE_PERFORMANCE_WEIGHT;
    return s + base + moraleMod;
  }, 0) / defenders.length;
}

/** Get the GK's save ability (0.30 to 0.70) */
export function getGKSaveChance(squad: Player[]): number {
  const gk = squad.find(p => p.position === 'GK');
  if (gk) {
    const quality = (gk.attributes.defending * GK_DEFENDING_WEIGHT + gk.attributes.mental * GK_MENTAL_WEIGHT + gk.attributes.physical * GK_PHYSICAL_WEIGHT) / 100;
    return GK_SAVE_BASE + quality * GK_SAVE_RANGE;
  }
  // Emergency keeper: an outfielder in goal. Derive from the best available
  // outfielder so a strong squad in crisis still isn't identical to a weak one,
  // then apply a heavy penalty. Previously this case forfeited the match outright.
  if (squad.length === 0) return GK_SAVE_BASE * EMERGENCY_KEEPER_SAVE_MULT;
  const best = squad.reduce((a, b) => (b.overall > a.overall ? b : a));
  const quality = (best.attributes.defending * GK_DEFENDING_WEIGHT + best.attributes.mental * GK_MENTAL_WEIGHT + best.attributes.physical * GK_PHYSICAL_WEIGHT) / 100;
  return (GK_SAVE_BASE + quality * GK_SAVE_RANGE) * EMERGENCY_KEEPER_SAVE_MULT;
}

/**
 * Slot-align a compacted player pool to the club's saved lineup for the
 * chemistry calculation. Engine callers pass compacted arrays (unavailable
 * players filtered out), which would otherwise shift players onto the wrong
 * formation slots inside calculateChemistryLinks. When every pool player is
 * found in the saved lineup we rebuild a (Player | null)[] in lineup order
 * (sent-off/injured players become null holes); otherwise (ad-hoc AI lineups
 * built from squad availability) slot identity is meaningless, so we fall
 * back to natural-position adjacency by omitting the formation.
 */
function getAlignedChemistryBonus(club: Club, pool: Player[], currentSeason?: number): number {
  const lineup = club.lineup || [];
  if (lineup.length > 0 && pool.length > 0) {
    const byId = new Map(pool.map(p => [p.id, p]));
    const aligned = lineup.map(id => byId.get(id) ?? null);
    const matched = aligned.reduce((n, p) => n + (p ? 1 : 0), 0);
    if (matched === pool.length) {
      return getChemistryBonus(aligned, club.formation, currentSeason);
    }
  }
  return getChemistryBonus(pool, undefined, currentSeason);
}

/**
 * Compute attack/defense strength for both sides factoring in:
 * player attributes, tactical modifiers, formation fit, familiarity,
 * home advantage, and rock-paper-scissors tactical matchups.
 */
export function computeStrengths(
  homeClub: Club, awayClub: Club,
  homePlayers: Player[], awayPlayers: Player[],
  homeTactics?: TacticalInstructions, awayTactics?: TacticalInstructions,
  tacticalFamiliarity?: number, playerClubId?: string, currentSeason?: number,
) {
  const homeMods = getTacticsModifiers(homeTactics);
  const awayMods = getTacticsModifiers(awayTactics);
  const homeFamBonus = (playerClubId === homeClub.id && tacticalFamiliarity) ? tacticalFamiliarity * TACTICAL_FAMILIARITY_MULTIPLIER : 0;
  const awayFamBonus = (playerClubId === awayClub.id && tacticalFamiliarity) ? tacticalFamiliarity * TACTICAL_FAMILIARITY_MULTIPLIER : 0;
  const homeFormBonus = getFormationFitBonus(homePlayers, homeClub.formation);
  const awayFormBonus = getFormationFitBonus(awayPlayers, awayClub.formation);
  // Defensive formation fit also contributes to defensive strength
  const homeDefFitBonus = homeClub.defensiveFormation ? getFormationFitBonus(homePlayers, homeClub.defensiveFormation) * 0.5 : 0;
  const awayDefFitBonus = awayClub.defensiveFormation ? getFormationFitBonus(awayPlayers, awayClub.defensiveFormation) * 0.5 : 0;
  const homeMatchup = getTacticalMatchupBonus(homeTactics, awayTactics);
  const awayMatchup = getTacticalMatchupBonus(awayTactics, homeTactics);
  // Chemistry bonus (0-8%) based on squad composition (slot-aligned to the
  // saved lineup so compacted pools don't shift players onto wrong slots)
  const homeChemistry = getAlignedChemistryBonus(homeClub, homePlayers, currentSeason);
  const awayChemistry = getAlignedChemistryBonus(awayClub, awayPlayers, currentSeason);
  // Formation-specific attack/defense profiles (e.g. 3-4-3 = +10% attack, -8% defense)
  // Use defensiveFormation for defense bonus when set, otherwise fall back to main formation
  const homeFormAtk = FORMATION_ATTACK_BONUS[homeClub.formation] || 0;
  const awayFormAtk = FORMATION_ATTACK_BONUS[awayClub.formation] || 0;
  const homeDefFormation = homeClub.defensiveFormation || homeClub.formation;
  const awayDefFormation = awayClub.defensiveFormation || awayClub.formation;
  const homeFormDef = FORMATION_DEFENSE_BONUS[homeDefFormation] || 0;
  const awayFormDef = FORMATION_DEFENSE_BONUS[awayDefFormation] || 0;
  // Formation matchup bonus (e.g. 3-back vs wingers)
  const homeFormMatchup = getFormationMatchupBonus(homeClub.formation, awayClub.formation);
  const awayFormMatchup = getFormationMatchupBonus(awayClub.formation, homeClub.formation);
  // Unhappy players perform worse — reduce team strength proportionally
  const homeUnhappyCount = homePlayers.filter(p => p.wantsToLeave).length;
  const awayUnhappyCount = awayPlayers.filter(p => p.wantsToLeave).length;
  const homeUnhappyMod = 1 - (homeUnhappyCount / Math.max(homePlayers.length, 1)) * UNHAPPY_PERFORMANCE_PENALTY;
  const awayUnhappyMod = 1 - (awayUnhappyCount / Math.max(awayPlayers.length, 1)) * UNHAPPY_PERFORMANCE_PENALTY;
  // First-season confidence boost for the player's team (subtle help during
  // season 1). The defense boost is ADDED to the player's own defense-damping
  // term below — it was previously subtracted, which INCREASED the opponent's
  // attack instead of helping.
  const homeFirstMatchBoost = (currentSeason === 1 && playerClubId === homeClub.id) ? FIRST_MATCH_ATTACK_BOOST : 0;
  const awayFirstMatchBoost = (currentSeason === 1 && playerClubId === awayClub.id) ? FIRST_MATCH_ATTACK_BOOST : 0;
  const homeFirstDefBoost = (currentSeason === 1 && playerClubId === homeClub.id) ? FIRST_MATCH_DEFENSE_BOOST : 0;
  const awayFirstDefBoost = (currentSeason === 1 && playerClubId === awayClub.id) ? FIRST_MATCH_DEFENSE_BOOST : 0;
  // Numerical disadvantage: penalize teams with fewer than full squad (red cards / injuries)
  const homeMissing = Math.max(0, LINEUP_SIZE - homePlayers.length);
  const awayMissing = Math.max(0, LINEUP_SIZE - awayPlayers.length);
  const homeNumericalMod = 1 - homeMissing * RED_CARD_STRENGTH_PENALTY_PER_PLAYER;
  const awayNumericalMod = 1 - awayMissing * RED_CARD_STRENGTH_PENALTY_PER_PLAYER;
  // Strength = base * (territory/quality modifiers) reduced by opponent's
  // structural defensive modifiers. Strength drives EVENT SHARE only (who has
  // the ball), which is very nearly zero-sum: scaling both sides equally
  // changes nothing.
  //
  // MENTALITY IS DELIBERATELY ABSENT HERE. It used to appear as
  // `homeMods.attackMod` in this expression AND additively in the per-shot
  // conversion formula in match.ts, while its counterweight
  // (`MENTALITY_DEFENSE_MOD`) was applied once, damped by
  // DEFENSE_MODIFIER_SCALE (0.3), and never touched the opponent's conversion.
  // Net effect: `all-out-attack` scored 2.9x more AND conceded less than
  // `balanced` on identical squads (measured 2.33 vs 1.27 pts/g) — a strictly
  // dominant strategy. Mentality now lives ONLY in the conversion channel,
  // symmetrically (own attackMod up, opponent's defenseMod down), so it trades
  // goals-for against goals-against instead of being free points.
  // Clamped to a minimum of 0.01 to prevent negative/zero strength from extreme modifier combinations
  const homeStr = Math.max(0.01, getTeamStrength(homePlayers) * homeUnhappyMod * homeNumericalMod * (HOME_ADVANTAGE + homeMods.territoryMod + homeMods.widthMod + homeFamBonus + homeFormBonus + homeMatchup + homeChemistry + homeFormAtk + homeFormMatchup + homeFirstMatchBoost) * (1 - (awayFormDef + awayDefFitBonus + awayFirstDefBoost) * DEFENSE_MODIFIER_SCALE));
  const awayStr = Math.max(0.01, getTeamStrength(awayPlayers) * awayUnhappyMod * awayNumericalMod * (1 + awayMods.territoryMod + awayMods.widthMod + awayFamBonus + awayFormBonus + awayMatchup + awayChemistry + awayFormAtk + awayFormMatchup + awayFirstMatchBoost) * (1 - (homeFormDef + homeDefFitBonus + homeFirstDefBoost) * DEFENSE_MODIFIER_SCALE));
  return { homeStr, awayStr, homeMods, awayMods };
}

// ── Match-meta utilities ──────────────────────────────────────────────────

/** Calculate stoppage time based on events in a half */
export function calcStoppageTime(events: MatchEvent[], halfStart: number, halfEnd: number): number {
  const halfEvents = events.filter(e => e.minute >= halfStart && e.minute <= halfEnd);
  const injuries = halfEvents.filter(e => e.type === 'injury').length;
  const cards = halfEvents.filter(e => e.type === 'yellow_card' || e.type === 'red_card').length;
  const goals = halfEvents.filter(e => (GOAL_SCORING_TYPES as readonly string[]).includes(e.type)).length;
  const extra = STOPPAGE_TIME_BASE + Math.random() * STOPPAGE_TIME_MAX_EXTRA + injuries * STOPPAGE_TIME_INJURY_ADD + cards * STOPPAGE_TIME_CARD_ADD + goals * STOPPAGE_TIME_GOAL_ADD;
  return Math.round(Math.min(extra, STOPPAGE_TIME_MAX));
}

/** Generate injury details based on whether it was foul-related and medical facility level */
export function generateInjuryDetails(isFoulRelated: boolean, medicalLevel: number = 5): InjuryDetails {
  const typeWeights = isFoulRelated ? FOUL_INJURY_TYPE_WEIGHTS : NON_FOUL_INJURY_TYPE_WEIGHTS;
  const type = weightedPick(typeWeights) as InjuryType;
  const severity = weightedPick(INJURY_SEVERITY_WEIGHTS) as InjurySeverity;
  const config = INJURY_TYPES[type];
  const [minWeeks, maxWeeks] = config.weeks[severity];
  const weeksRaw = minWeeks + Math.floor(Math.random() * (maxWeeks - minWeeks + 1));
  // Medical facility reduces recovery slightly (better facilities = faster recovery)
  const medicalReduction = Math.max(0, Math.floor(medicalLevel / 5));
  const weeks = Math.max(1, weeksRaw - medicalReduction);
  const reinjuryRisk = Math.max(0, config.reinjuryRisk[severity] - medicalLevel * MEDICAL_INJURY_PREVENTION_PER_LEVEL);

  return {
    type,
    severity,
    weeksRemaining: weeks,
    totalWeeks: weeks,
    reinjuryRisk,
    reinjuryWeeksRemaining: config.reinjuryDuration[severity],
    fitnessOnReturn: config.fitnessOnReturn[severity],
  };
}

/** Validate a squad has enough players to field a team.
 *  Player's team requires 11; AI teams allow down to 7 (injury-depleted squads).
 *  Also rejects squads with duplicate player IDs — data corruption from a
 *  botched transfer can leave the same player on both clubs' lineups,
 *  and the match engine would double-count their events. */
export function isSquadValid(players: Player[], isPlayerTeam = false): boolean {
  const minPlayers = isPlayerTeam ? 11 : 7;
  if (players.length < minPlayers) return false;
  // NOTE: deliberately does NOT require a recognised goalkeeper. It used to, and
  // that turned an injury crisis into a 3-0 walkover: measured mid-season, 9 of
  // 92 clubs had every keeper injured simultaneously, which forfeited ~20% of all
  // AI fixtures and made league tables, promotion, prize money and every balance
  // measurement taken on a live save fiction. A keeperless XI now plays with an
  // emergency keeper (see `getGKSaveChance` / EMERGENCY_KEEPER_SAVE_MULT), which
  // is what actually happens in football.
  const ids = new Set<string>();
  for (const p of players) {
    if (ids.has(p.id)) return false;
    ids.add(p.id);
  }
  return true;
}
