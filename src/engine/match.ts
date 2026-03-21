import { Match, MatchEvent, MatchStats, Player, Club, TacticalInstructions, PlayerMatchRating, FORMATION_POSITIONS, POSITION_COMPATIBILITY, FormationType } from '@/types/game';
import { getAIReactiveTactics, AI_REACTIVITY_MINUTES } from '@/config/aiManager';
import {
  INJURY_TYPES, FOUL_INJURY_TYPE_WEIGHTS, NON_FOUL_INJURY_TYPE_WEIGHTS,
  INJURY_SEVERITY_WEIGHTS, MEDICAL_INJURY_PREVENTION_PER_LEVEL,
  UNHAPPY_PERFORMANCE_PENALTY,
} from '@/config/gameBalance';
import type { InjuryType, InjurySeverity, InjuryDetails } from '@/types/game';
import { getTeamStrength } from '@/utils/playerGen';
import { pick } from '@/utils/helpers';
import { getChemistryBonus } from '@/utils/chemistry';
import { getCardRiskMultiplier } from '@/utils/personality';
import {
  FORMATION_FIT_MAX_BONUS,
  ATTACKER_POSITIONS, MIDFIELDER_POSITIONS,
  ATTACKER_SHOOTING_WEIGHT, ATTACKER_FITNESS_WEIGHT,
  ATTACKER_SELECTION_CHANCE, MIDFIELDER_SELECTION_CHANCE,
  ASSIST_CHANCE, ASSIST_PASSING_WEIGHT, ASSIST_MENTAL_WEIGHT,
  MENTALITY_ATTACK_MOD, MENTALITY_DEFENSE_MOD,
  TEMPO_SHOT_MOD, DEFENSIVE_LINE_COUNTER_VULN, WIDTH_POSSESSION_MOD,
  PRESSING_THRESHOLD, PRESSING_VS_SLOW_BONUS, WIDE_VS_NARROW_BONUS,
  DEEP_VS_HIGH_BONUS, FAST_VS_CAUTIOUS_BONUS, ALL_OUT_VS_DEFENSIVE_BONUS,
  PRESSING_FOUL_MULTIPLIER, PRESSING_FOUL_BASELINE,
  DEFENDER_POSITIONS, DEFENSE_DEFENDING_WEIGHT, DEFENSE_PHYSICAL_WEIGHT, DEFENSE_MENTAL_WEIGHT, DEFENSE_QUALITY_FALLBACK,
  GK_DEFENDING_WEIGHT, GK_MENTAL_WEIGHT, GK_PHYSICAL_WEIGHT, GK_SAVE_BASE, GK_SAVE_RANGE,
  TACTICAL_FAMILIARITY_MULTIPLIER, HOME_ADVANTAGE,
  BASE_EVENT_CHANCE, LATE_GAME_EVENT_BONUS, LATE_GAME_THRESHOLD_MINUTE,
  SHOT_ATTEMPT_THRESHOLD, FOUL_THRESHOLD, INJURY_EVENT_THRESHOLD,
  SHOT_QUALITY_WEIGHTS, FITNESS_FACTOR_BASE, FITNESS_FACTOR_SCALE,
  GOAL_CHANCE_ATTACK_MULT, GOAL_CHANCE_DEFENSE_MULT, GOAL_CHANCE_ATTACK_MOD_SCALE, GOAL_CHANCE_COUNTER_VULN_SCALE, GOAL_CHANCE_MIN,
  CORNER_FROM_SAVE_CHANCE, CORNER_FROM_MISS_CHANCE,
  CARD_BASE_CHANCE, STRAIGHT_RED_CHANCE,
  FOUL_INJURY_CHANCE, NON_FOUL_INJURY_BASE, PHYSICAL_FRAGILITY_FACTOR, OLD_PLAYER_INJURY_BONUS, OLD_PLAYER_INJURY_AGE_THRESHOLD,
  RATING_BASE_WIN, RATING_BASE_LOSS, RATING_BASE_DRAW,
  RATING_GOAL_BONUS, RATING_ASSIST_BONUS, RATING_SAVE_BONUS, RATING_YELLOW_PENALTY, RATING_RED_PENALTY, RATING_CLEAN_SHEET_BONUS,
  RATING_DEFENDER_SCALE, RATING_DEFENDER_OFFSET, RATING_MIDFIELDER_SCALE, RATING_MIDFIELDER_OFFSET,
  RATING_EXHAUSTION_THRESHOLD, RATING_EXHAUSTION_PENALTY, RATING_VARIANCE, RATING_MIN, RATING_MAX,
  FORMATION_ATTACK_BONUS, FORMATION_DEFENSE_BONUS,
  STOPPAGE_TIME_BASE, STOPPAGE_TIME_MAX_EXTRA, STOPPAGE_TIME_INJURY_ADD, STOPPAGE_TIME_CARD_ADD,
  CORNER_GOAL_CHANCE, CORNER_GOAL_PHYSICAL_WEIGHT, CORNER_GOAL_DEFENDING_WEIGHT,
  FITNESS_DEGRADE_PER_MINUTE, FITNESS_DEGRADE_VARIANCE, LOW_FITNESS_SHOT_PENALTY, MATCH_LOW_FITNESS_THRESHOLD, LOW_FITNESS_INJURY_BONUS,
  FOULER_DEFENDER_WEIGHT, FOULER_MIDFIELDER_WEIGHT, FOULER_ATTACKER_WEIGHT,
  FORMATION_MATCHUP,
  DEFENSE_MODIFIER_SCALE,
  DERBY_EVENT_MOD_SCALE, DERBY_FOUL_MOD_SCALE, DERBY_CARD_MOD_SCALE,
  CORNER_HEADER_MIN_CHANCE, CORNER_HEADER_PHYSICAL_SCALE,
  OWN_GOAL_CHANCE, PENALTY_FROM_FOUL_CHANCE, PENALTY_CONVERSION_RATE,
  MORALE_PERFORMANCE_WEIGHT, MORALE_BASELINE,
  DISCIPLINARIAN_CARD_REDUCTION,
  MOMENTUM_GOAL_SWING, MOMENTUM_SAVE_SWING, MOMENTUM_CARD_SWING, MOMENTUM_PENALTY_SWING,
  MOMENTUM_DECAY_PER_MINUTE, MOMENTUM_STRENGTH_SCALE,
  SUB_FRESHNESS_BONUS,
} from '@/config/matchEngine';

/** State carried between halves so the second half can continue from the first */
export interface HalfState {
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeSoT: number;
  awaySoT: number;
  homeFouls: number;
  awayFouls: number;
  homeCorners: number;
  awayCorners: number;
  sentOff: string[];
  injured: string[];
  playerEvents: Record<string, { goals: number; assists: number; yellows: number; redCard: boolean; saves: number; cleanSheet: boolean; goalsAtEntry?: number }>;
  momentum: number;
  homeXG: number;
  awayXG: number;
  /** Injury details generated during the match, keyed by player ID */
  matchInjuries: Record<string, InjuryDetails>;
}

/** Formation fit bonus: 0.0 to ~0.12 — mismatched players are a real penalty */
function getFormationFitBonus(players: Player[], formation: FormationType): number {
  const slots = FORMATION_POSITIONS[formation];
  if (!slots || players.length === 0) return 0;
  let fitCount = 0;
  const outfieldSlots = slots.filter(s => s.pos !== 'GK');
  const outfieldPlayers = players.filter(p => p.position !== 'GK');
  for (const slot of outfieldSlots) {
    const compatible = POSITION_COMPATIBILITY[slot.pos] || [slot.pos];
    if (outfieldPlayers.some(p => compatible.includes(p.position))) fitCount++;
  }
  const fitRatio = Math.min(1, outfieldSlots.length > 0 ? fitCount / outfieldSlots.length : 1);
  return fitRatio * FORMATION_FIT_MAX_BONUS;
}

/** Pick an attacker weighted by shooting quality and fitness */
function pickAttacker(players: Player[]): Player {
  const attackers = players.filter(p => [...ATTACKER_POSITIONS].includes(p.position));
  const midfielders = players.filter(p => [...MIDFIELDER_POSITIONS].includes(p.position));

  // Weight selection by shooting + fitness
  const weightedPick = (candidates: Player[]): Player => {
    if (candidates.length === 0) return pick(players);
    const weights = candidates.map(p => (p.attributes.shooting * ATTACKER_SHOOTING_WEIGHT + p.fitness * ATTACKER_FITNESS_WEIGHT) / 100);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
    let r = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  };

  if (attackers.length > 0 && Math.random() < ATTACKER_SELECTION_CHANCE) return weightedPick(attackers);
  if (midfielders.length > 0 && Math.random() < MIDFIELDER_SELECTION_CHANCE) return weightedPick(midfielders);
  return weightedPick(players);
}

/** Pick an assist provider weighted by passing quality */
function pickAssist(players: Player[], scorerId: string): Player | undefined {
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
function pickFouler(players: Player[]): Player | null {
  if (players.length === 0) return null;
  const weights = players.map(p => {
    if ([...DEFENDER_POSITIONS].includes(p.position)) return FOULER_DEFENDER_WEIGHT;
    if ([...MIDFIELDER_POSITIONS].includes(p.position)) return FOULER_MIDFIELDER_WEIGHT;
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

/** Tactical matchup bonus: certain styles counter others */
function getTacticalMatchupBonus(myTactics?: TacticalInstructions, oppTactics?: TacticalInstructions): number {
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
function getFormationMatchupBonus(myFormation: FormationType, oppFormation: FormationType): number {
  return FORMATION_MATCHUP[myFormation]?.[oppFormation] ?? 0;
}

/** Calculate stoppage time based on events in a half */
function calcStoppageTime(events: MatchEvent[], halfStart: number, halfEnd: number): number {
  const halfEvents = events.filter(e => e.minute >= halfStart && e.minute <= halfEnd);
  const injuries = halfEvents.filter(e => e.type === 'injury').length;
  const cards = halfEvents.filter(e => e.type === 'yellow_card' || e.type === 'red_card').length;
  const extra = STOPPAGE_TIME_BASE + Math.random() * STOPPAGE_TIME_MAX_EXTRA + injuries * STOPPAGE_TIME_INJURY_ADD + cards * STOPPAGE_TIME_CARD_ADD;
  return Math.round(Math.min(extra, 7));
}

/** Default balanced tactics for AI teams */
const AI_DEFAULT_TACTICS: TacticalInstructions = {
  mentality: 'balanced',
  width: 'normal',
  tempo: 'normal',
  defensiveLine: 'normal',
  pressingIntensity: 50,
};

function getTacticsModifiers(tactics?: TacticalInstructions) {
  if (!tactics) return { attackMod: 0, defenseMod: 0, shotMod: 0, foulMod: 0, counterVuln: 0, widthMod: 0 };
  return {
    attackMod: MENTALITY_ATTACK_MOD[tactics.mentality] || 0,
    defenseMod: MENTALITY_DEFENSE_MOD[tactics.mentality] || 0,
    shotMod: TEMPO_SHOT_MOD[tactics.tempo] || 0,
    foulMod: (tactics.pressingIntensity - PRESSING_FOUL_BASELINE) * PRESSING_FOUL_MULTIPLIER,
    counterVuln: DEFENSIVE_LINE_COUNTER_VULN[tactics.defensiveLine] || 0,
    widthMod: WIDTH_POSSESSION_MOD[tactics.width] || 0,
  };
}

/** Compute average defensive quality of a squad's defenders (morale-adjusted) */
function getDefenseQuality(squad: Player[]): number {
  const defenders = squad.filter(p => [...DEFENDER_POSITIONS].includes(p.position));
  if (defenders.length === 0) return DEFENSE_QUALITY_FALLBACK;
  return defenders.reduce((s, p) => {
    const base = (p.attributes.defending * DEFENSE_DEFENDING_WEIGHT + p.attributes.physical * DEFENSE_PHYSICAL_WEIGHT + p.attributes.mental * DEFENSE_MENTAL_WEIGHT) / 100;
    const moraleMod = (p.morale - MORALE_BASELINE) / 100 * MORALE_PERFORMANCE_WEIGHT;
    return s + base + moraleMod;
  }, 0) / defenders.length;
}

/** Get the GK's save ability (0.30 to 0.70) */
function getGKSaveChance(squad: Player[]): number {
  const gk = squad.find(p => p.position === 'GK');
  if (!gk) return GK_SAVE_BASE;
  const quality = (gk.attributes.defending * GK_DEFENDING_WEIGHT + gk.attributes.mental * GK_MENTAL_WEIGHT + gk.attributes.physical * GK_PHYSICAL_WEIGHT) / 100;
  return GK_SAVE_BASE + quality * GK_SAVE_RANGE;
}

/**
 * Compute attack/defense strength for both sides factoring in:
 * player attributes, tactical modifiers, formation fit, familiarity,
 * home advantage, and rock-paper-scissors tactical matchups.
 */
function computeStrengths(
  homeClub: Club, awayClub: Club,
  homePlayers: Player[], awayPlayers: Player[],
  homeTactics?: TacticalInstructions, awayTactics?: TacticalInstructions,
  tacticalFamiliarity?: number, playerClubId?: string,
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
  // Chemistry bonus (0-8%) based on squad composition
  const homeChemistry = getChemistryBonus(homePlayers);
  const awayChemistry = getChemistryBonus(awayPlayers);
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
  // Strength = base * (attack modifiers) reduced by opponent's defensive modifiers
  const homeStr = getTeamStrength(homePlayers) * homeUnhappyMod * (HOME_ADVANTAGE + homeMods.attackMod + homeMods.widthMod + homeFamBonus + homeFormBonus + homeMatchup + homeChemistry + homeFormAtk + homeFormMatchup) * (1 - (awayMods.defenseMod + awayFormDef + awayDefFitBonus) * DEFENSE_MODIFIER_SCALE);
  const awayStr = getTeamStrength(awayPlayers) * awayUnhappyMod * (1 + awayMods.attackMod + awayMods.widthMod + awayFamBonus + awayFormBonus + awayMatchup + awayChemistry + awayFormAtk + awayFormMatchup) * (1 - (homeMods.defenseMod + homeFormDef + homeDefFitBonus) * DEFENSE_MODIFIER_SCALE);
  return { homeStr, awayStr, homeMods, awayMods };
}

/** Pick from a weighted pool */
function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w as number), 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight as number;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Generate injury details based on whether it was foul-related and medical facility level */
function generateInjuryDetails(isFoulRelated: boolean, medicalLevel: number = 5): InjuryDetails {
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

/**
 * Simulate one half of a match (or a full match if startMin=1, endMin=90).
 * Returns a HalfState that can be continued with a second call for the second half.
 */
export function simulateHalf(
  homeClub: Club,
  awayClub: Club,
  homePlayers: Player[],
  awayPlayers: Player[],
  startMin: number,
  endMin: number,
  homeTactics?: TacticalInstructions,
  awayTactics?: TacticalInstructions,
  tacticalFamiliarity?: number,
  playerClubId?: string,
  prevState?: HalfState,
  derbyIntensity?: number,
  disciplinarianActive?: boolean,
  homeMedicalLevel?: number,
  awayMedicalLevel?: number,
): HalfState {
  // Derby matches: more events, more fouls, more cards
  const derbyEventMod = derbyIntensity ? derbyIntensity * DERBY_EVENT_MOD_SCALE : 0;
  const derbyFoulMod = derbyIntensity ? derbyIntensity * DERBY_FOUL_MOD_SCALE : 0;
  const derbyCardMod = derbyIntensity ? derbyIntensity * DERBY_CARD_MOD_SCALE : 0;

  const _str = computeStrengths(
    homeClub, awayClub, homePlayers, awayPlayers, homeTactics, awayTactics, tacticalFamiliarity, playerClubId,
  );
  let { homeStr, awayStr } = _str;
  const { homeMods, awayMods } = _str;

  // Pre-compute defensive qualities for both teams
  const homeDefQuality = getDefenseQuality(homePlayers);
  const awayDefQuality = getDefenseQuality(awayPlayers);
  const homeGKSave = getGKSaveChance(homePlayers);
  const awayGKSave = getGKSaveChance(awayPlayers);

  // Carry forward state from previous half or start fresh
  const events: MatchEvent[] = prevState ? [...prevState.events] : [];
  let homeGoals = prevState?.homeGoals ?? 0;
  let awayGoals = prevState?.awayGoals ?? 0;
  let homeShots = prevState?.homeShots ?? 0;
  let awayShots = prevState?.awayShots ?? 0;
  let homeSoT = prevState?.homeSoT ?? 0;
  let awaySoT = prevState?.awaySoT ?? 0;
  let homeFouls = prevState?.homeFouls ?? 0;
  let awayFouls = prevState?.awayFouls ?? 0;
  let homeCorners = prevState?.homeCorners ?? 0;
  let awayCorners = prevState?.awayCorners ?? 0;
  const sentOff = new Set<string>(prevState?.sentOff ?? []);
  const injured = new Set<string>(prevState?.injured ?? []);
  const unavailable = new Set<string>([...sentOff, ...injured]);

  // Match injuries: track generated InjuryDetails per player
  const matchInjuries: Record<string, InjuryDetails> = prevState?.matchInjuries ? { ...prevState.matchInjuries } : {};

  // Momentum: positive favours home, negative favours away. Carried between halves.
  let momentum = prevState?.momentum ?? 0;
  // xG accumulators
  let homeXG = prevState?.homeXG ?? 0;
  let awayXG = prevState?.awayXG ?? 0;

  // Carry forward player events and add any new players (subs)
  const playerEvents: Record<string, { goals: number; assists: number; yellows: number; redCard: boolean; saves: number; cleanSheet: boolean; goalsAtEntry?: number }> = prevState ? { ...prevState.playerEvents } : {};
  const allMatchPlayers = [...homePlayers, ...awayPlayers];
  allMatchPlayers.forEach(p => {
    if (!playerEvents[p.id]) {
      const isHomeSide = homePlayers.some(hp => hp.id === p.id);
      const goalsAgainst = isHomeSide ? awayGoals : homeGoals;
      playerEvents[p.id] = { goals: 0, assists: 0, yellows: 0, redCard: false, saves: 0, cleanSheet: true, goalsAtEntry: p.position === 'GK' ? goalsAgainst : undefined };
    }
  });

  // Track in-match fitness for each player
  const matchFitness: Record<string, number> = {};
  allMatchPlayers.forEach(p => { matchFitness[p.id] = p.fitness; });

  // Description variants for event variety
  const goalDescs = [
    (name: string, club: string) => `GOAL! ${name} scores for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} finds the net for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} puts ${club} ahead!`,
    (name: string, club: string) => `GOAL! Brilliant finish from ${name}! ${club} score!`,
    (name: string, club: string) => `GOAL! ${name} makes no mistake for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} slots it home for ${club}!`,
    (name: string, club: string) => `GOAL! Clinical from ${name}! That's another for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} fires it into the bottom corner for ${club}!`,
    (name: string, club: string) => `GOAL! What a strike from ${name}! ${club} celebrate!`,
    (name: string, club: string) => `GOAL! ${name} taps it in for ${club}! The fans are on their feet!`,
  ];
  // Contextual goal descriptions based on scoreline
  const equalizerDescs = [
    (name: string, club: string) => `GOAL! ${name} equalises for ${club}! We're level again!`,
    (name: string, club: string) => `GOAL! ${name} draws ${club} level! What a moment!`,
    (name: string, club: string) => `GOAL! ${name} levels the score for ${club}! Game on!`,
  ];
  const goAheadDescs = [
    (name: string, club: string) => `GOAL! ${name} gives ${club} the lead!`,
    (name: string, club: string) => `GOAL! ${name} puts ${club} ahead! The crowd erupts!`,
    (name: string, club: string) => `GOAL! ${name} breaks the deadlock for ${club}!`,
  ];
  const comebackDescs = [
    (name: string, club: string) => `GOAL! ${name} pulls one back for ${club}! Can they complete the comeback?`,
    (name: string, club: string) => `GOAL! ${name} gives ${club} hope! They're back in this!`,
    (name: string, club: string) => `GOAL! ${name} reduces the deficit for ${club}! What a response!`,
  ];
  const lateDramaDescs = [
    (name: string, club: string) => `GOAL! Late drama! ${name} scores for ${club} in the dying minutes!`,
    (name: string, club: string) => `GOAL! Incredible scenes! ${name} finds the net for ${club} right at the death!`,
    (name: string, club: string) => `GOAL! Last-gasp goal from ${name}! ${club} score when it matters most!`,
  ];

  const saveDescs = [
    (shooter: string, gk: string) => `${shooter}'s shot is saved by ${gk}.`,
    (shooter: string, gk: string) => `Great save from ${gk} to deny ${shooter}!`,
    (shooter: string, gk: string) => `${gk} gets down well to stop ${shooter}'s effort.`,
    (shooter: string, gk: string) => `${shooter} is denied by a fine stop from ${gk}.`,
    (shooter: string, gk: string) => `Brilliant reflexes from ${gk}! ${shooter} can't believe it.`,
    (shooter: string, gk: string) => `${gk} stands tall and blocks ${shooter}'s strike.`,
    (shooter: string, gk: string) => `Full stretch from ${gk} to tip ${shooter}'s effort away!`,
    (shooter: string, gk: string) => `${shooter} thought he'd scored but ${gk} had other ideas.`,
  ];
  const missDescs = [
    (name: string) => `${name} fires wide.`,
    (name: string) => `${name}'s effort goes over the bar.`,
    (name: string) => `${name} drags his shot wide of the post.`,
    (name: string) => `${name} blazes over from a good position.`,
    (name: string) => `Off target from ${name}.`,
    (name: string) => `${name} hits the side netting.`,
    (name: string) => `${name}'s strike rattles the crossbar!`,
    (name: string) => `${name} snatches at the shot and skies it.`,
    (name: string) => `So close! ${name}'s effort just whistles past the post.`,
    (name: string) => `${name} pulls his shot just wide. A let-off for the defence.`,
  ];
  const foulDescs = [
    (name: string) => `Foul by ${name}.`,
    (name: string) => `${name} is penalized for a foul.`,
    (name: string) => `Free kick awarded after a foul from ${name}.`,
    (name: string) => `${name} brings down the opponent.`,
    (name: string) => `${name} catches the attacker late.`,
    (name: string) => `Cynical challenge from ${name} to stop the counter.`,
    (name: string) => `${name} clips the heels of his opponent.`,
  ];
  const yellowDescs = [
    (name: string) => `Yellow card for ${name}.`,
    (name: string) => `${name} is booked by the referee.`,
    (name: string) => `${name} goes into the book.`,
    (name: string) => `The referee shows ${name} a yellow card. He'll need to be careful now.`,
    (name: string) => `${name} picks up a booking for that challenge.`,
  ];
  const injuryDescs = [
    (name: string) => `${name} goes down injured!`,
    (name: string) => `${name} is down and receiving treatment!`,
    (name: string) => `Concern for ${name} who pulls up with an injury!`,
    (name: string) => `${name} signals to the bench — he can't continue!`,
    (name: string) => `The physio is rushing on for ${name}. This doesn't look good.`,
  ];
  const ownGoalDescs = [
    (name: string, club: string) => `OWN GOAL! ${name} puts the ball into his own net! Disaster for ${club}!`,
    (name: string, club: string) => `OWN GOAL! A miscued clearance from ${name} goes in! ${club} can't believe it!`,
    (name: string, club: string) => `OWN GOAL! ${name} deflects the ball past his own keeper! ${club} in shock!`,
  ];
  const penaltyGoalDescs = [
    (name: string, club: string) => `PENALTY GOAL! ${name} sends the keeper the wrong way! ${club} score from the spot!`,
    (name: string, _club: string) => `PENALTY GOAL! ${name} smashes it into the top corner! No chance for the keeper!`,
    (name: string, club: string) => `PENALTY GOAL! Cool as you like from ${name}! ${club} take the lead from the spot!`,
  ];
  const penaltyMissDescs = [
    (name: string) => `PENALTY MISS! ${name} sees his spot kick saved!`,
    (name: string) => `PENALTY MISS! ${name} blazes it over the bar from twelve yards!`,
    (name: string) => `PENALTY MISS! ${name} hits the post! What a miss!`,
  ];
  const cornerGoalDescs = [
    (name: string, club: string) => `GOAL! ${name} heads in from the corner for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} rises highest from the corner! ${club} score!`,
    (name: string, _club: string) => `GOAL! A towering header from ${name} after the corner!`,
    (name: string, club: string) => `GOAL! ${name} meets the cross at the back post! ${club} score from the set piece!`,
    (name: string, _club: string) => `GOAL! Bullet header from ${name}! Nobody was going to stop that!`,
  ];

  if (startMin === 1) {
    events.push({ minute: 0, type: 'kickoff', clubId: homeClub.id, description: 'Kick off!' });
  }

  // Calculate stoppage time for this half
  const isFirstHalf = startMin <= 45 && endMin <= 50;
  const nominalEnd = isFirstHalf ? 45 : 90;
  let stoppageTime = 0;

  const MAX_MATCH_MINUTES = 150; // Safety cap to prevent infinite loops
  for (let min = startMin; min <= endMin + stoppageTime && min < MAX_MATCH_MINUTES; min++) {
    // Calculate stoppage at the nominal end of each half
    if (min === nominalEnd && stoppageTime === 0) {
      stoppageTime = calcStoppageTime(events, startMin, nominalEnd);
      if (stoppageTime > 0) {
        events.push({ minute: nominalEnd, type: 'half_time', clubId: '', description: `+${stoppageTime} minutes added time` });
      }
    }

    // AI mid-match tactical reactivity at key minutes (60, 75)
    if (AI_REACTIVITY_MINUTES.includes(min as 60 | 75)) {
      // Home AI reacts if no player tactics provided
      if (!homeTactics && homeClub.aiManagerProfile) {
        const newHomeTactics = getAIReactiveTactics(homeClub.aiManagerProfile, true, homeGoals, awayGoals, min);
        const recomp = computeStrengths(homeClub, awayClub, homePlayers.filter(p => !unavailable.has(p.id)), awayPlayers.filter(p => !unavailable.has(p.id)), newHomeTactics, awayTactics ?? awayClub.aiManagerProfile?.defaultTactics ?? AI_DEFAULT_TACTICS, tacticalFamiliarity, playerClubId);
        homeStr = recomp.homeStr; awayStr = recomp.awayStr;
      }
      // Away AI reacts if no player tactics provided
      if (!awayTactics && awayClub.aiManagerProfile) {
        const newAwayTactics = getAIReactiveTactics(awayClub.aiManagerProfile, false, homeGoals, awayGoals, min);
        const recomp = computeStrengths(homeClub, awayClub, homePlayers.filter(p => !unavailable.has(p.id)), awayPlayers.filter(p => !unavailable.has(p.id)), homeTactics ?? homeClub.aiManagerProfile?.defaultTactics ?? AI_DEFAULT_TACTICS, newAwayTactics, tacticalFamiliarity, playerClubId);
        homeStr = recomp.homeStr; awayStr = recomp.awayStr;
      }
    }

    // In-match fitness degradation
    allMatchPlayers.forEach(p => {
      if (!unavailable.has(p.id) && matchFitness[p.id] !== undefined) {
        matchFitness[p.id] = Math.max(0, matchFitness[p.id] - FITNESS_DEGRADE_PER_MINUTE - (Math.random() * FITNESS_DEGRADE_VARIANCE));
      }
    });

    // Momentum decay toward neutral each minute
    if (momentum > 0) momentum = Math.max(0, momentum - MOMENTUM_DECAY_PER_MINUTE);
    else if (momentum < 0) momentum = Math.min(0, momentum + MOMENTUM_DECAY_PER_MINUTE);

    // Tempo affects event frequency: fast tempo = more events, slow = fewer
    const tempoEventMod = homeTactics?.tempo === 'fast' || awayTactics?.tempo === 'fast' ? 0.04
      : homeTactics?.tempo === 'slow' && awayTactics?.tempo === 'slow' ? -0.03 : 0;
    const baseChance = BASE_EVENT_CHANCE + (min > LATE_GAME_THRESHOLD_MINUTE ? LATE_GAME_EVENT_BONUS : 0) + derbyEventMod + tempoEventMod;
    const eventChance = baseChance + (homeMods.shotMod + awayMods.shotMod) * 0.5;
    if (Math.random() > eventChance) continue;

    // Apply momentum to strength ratio: positive momentum favours home team
    const momentumFactor = momentum * MOMENTUM_STRENGTH_SCALE / 100;
    // Fitness-based freshness: teams with fresher players get a small strength boost
    const homeFitAvg = homePlayers.filter(p => !unavailable.has(p.id)).reduce((sum, p) => sum + (matchFitness[p.id] ?? 80), 0) / Math.max(1, homePlayers.filter(p => !unavailable.has(p.id)).length);
    const awayFitAvg = awayPlayers.filter(p => !unavailable.has(p.id)).reduce((sum, p) => sum + (matchFitness[p.id] ?? 80), 0) / Math.max(1, awayPlayers.filter(p => !unavailable.has(p.id)).length);
    const homeFreshness = (homeFitAvg - awayFitAvg) * SUB_FRESHNESS_BONUS / 100;
    const effectiveHomeStr = homeStr * (1 + momentumFactor + homeFreshness);
    const effectiveAwayStr = awayStr * (1 - momentumFactor - homeFreshness);
    const effectiveTotal = effectiveHomeStr + effectiveAwayStr;

    const isHome = effectiveTotal > 0 ? Math.random() < effectiveHomeStr / effectiveTotal : Math.random() < 0.5;
    const club = isHome ? homeClub : awayClub;
    const squad = isHome ? homePlayers : awayPlayers;
    const oppSquad = isHome ? awayPlayers : homePlayers;
    const oppMods = isHome ? awayMods : homeMods;
    const atkMods = isHome ? homeMods : awayMods;
    const oppDefense = isHome ? awayDefQuality : homeDefQuality;
    const oppGKSave = isHome ? awayGKSave : homeGKSave;
    const roll = Math.random();

    // Tactics shift event type thresholds:
    // - Wide play increases corner chance from saves/misses
    // - Defensive mentality shifts more events toward fouls/blocks
    // - Attacking mentality shifts more events toward shots
    const widthCornerBonus = atkMods.widthMod > 0 ? 0.08 : 0;
    const mentalityShotShift = atkMods.attackMod > 0 ? 0.03 : atkMods.attackMod < -0.1 ? -0.03 : 0;
    const adjustedShotThreshold = SHOT_ATTEMPT_THRESHOLD + mentalityShotShift;

    // === SHOT ATTEMPT ===
    if (roll < adjustedShotThreshold) {
      const eligibleSquad = squad.filter(p => !unavailable.has(p.id));
      if (eligibleSquad.length === 0) continue;
      const scorer = pickAttacker(eligibleSquad);

      // Attribute-driven shot quality
      const shotQuality = (
        scorer.attributes.shooting * SHOT_QUALITY_WEIGHTS.shooting +
        scorer.attributes.mental * SHOT_QUALITY_WEIGHTS.mental +
        scorer.attributes.pace * SHOT_QUALITY_WEIGHTS.pace +
        scorer.attributes.physical * SHOT_QUALITY_WEIGHTS.physical +
        scorer.form * SHOT_QUALITY_WEIGHTS.form
      ) / 100;

      // Fitness factor: uses in-match fitness, penalizes low fitness
      const currentFitness = matchFitness[scorer.id] ?? scorer.fitness;
      const fitnessFactor = FITNESS_FACTOR_BASE + (currentFitness / 100) * FITNESS_FACTOR_SCALE;
      const lowFitPenalty = currentFitness < MATCH_LOW_FITNESS_THRESHOLD ? LOW_FITNESS_SHOT_PENALTY : 0;

      // Morale factor: high morale boosts, low morale penalizes
      const moraleMod = (scorer.morale - MORALE_BASELINE) / 100 * MORALE_PERFORMANCE_WEIGHT;

      // Goal chance: attacker quality vs opponent defense, modified by tactics
      const goalChance = (shotQuality * fitnessFactor * GOAL_CHANCE_ATTACK_MULT) - (oppDefense * GOAL_CHANCE_DEFENSE_MULT) + atkMods.attackMod * GOAL_CHANCE_ATTACK_MOD_SCALE + oppMods.counterVuln * GOAL_CHANCE_COUNTER_VULN_SCALE - lowFitPenalty + moraleMod;

      // Accumulate xG for every shot attempt
      const clampedChance = Math.max(GOAL_CHANCE_MIN, goalChance);
      if (isHome) homeXG += clampedChance; else awayXG += clampedChance;

      if (Math.random() < clampedChance) {
        // Goal scored!
        const preGoalHomeGoals = homeGoals;
        const preGoalAwayGoals = awayGoals;
        if (isHome) homeGoals++; else awayGoals++;
        if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
        const assist = pickAssist(squad, scorer.id);
        if (playerEvents[scorer.id]) playerEvents[scorer.id].goals++;
        if (assist && playerEvents[assist.id]) playerEvents[assist.id].assists++;
        oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });

        // Momentum swings toward scoring team
        momentum = isHome
          ? Math.min(100, momentum + MOMENTUM_GOAL_SWING)
          : Math.max(-100, momentum - MOMENTUM_GOAL_SWING);

        // Pick contextual goal description based on scoreline
        const scorerName = `${scorer.firstName} ${scorer.lastName}`;
        const clubName = club.shortName;
        const nowHome = homeGoals;
        const nowAway = awayGoals;
        const wasLevel = preGoalHomeGoals === preGoalAwayGoals;
        const scoringTeamWasBehind = isHome ? preGoalHomeGoals < preGoalAwayGoals : preGoalAwayGoals < preGoalHomeGoals;
        const isNowLevel = nowHome === nowAway;
        const isLate = min >= LATE_GAME_THRESHOLD_MINUTE;

        let goalDesc: (name: string, club: string) => string;
        if (isLate && (isNowLevel || (wasLevel && !isNowLevel))) {
          goalDesc = pick(lateDramaDescs);
        } else if (isNowLevel && scoringTeamWasBehind) {
          goalDesc = pick(equalizerDescs);
        } else if (wasLevel && !isNowLevel) {
          goalDesc = pick(goAheadDescs);
        } else if (scoringTeamWasBehind && !isNowLevel) {
          goalDesc = pick(comebackDescs);
        } else {
          goalDesc = pick(goalDescs);
        }

        events.push({
          minute: min, type: 'goal', playerId: scorer.id,
          assistPlayerId: assist?.id, clubId: club.id,
          description: goalDesc(scorerName, clubName) + (assist ? ` (assist: ${assist.lastName})` : ''),
        });
      } else if (Math.random() < oppGKSave) {
        // Shot on target but saved — GK quality determines save rate
        if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
        const gk = oppSquad.find(p => p.position === 'GK');
        if (gk && playerEvents[gk.id]) playerEvents[gk.id].saves++;
        // Momentum swings toward the defending (saving) team
        momentum = isHome
          ? Math.max(-100, momentum - MOMENTUM_SAVE_SWING)
          : Math.min(100, momentum + MOMENTUM_SAVE_SWING);
        const saveDesc = pick(saveDescs);
        events.push({ minute: min, type: 'shot_saved', playerId: scorer.id, clubId: club.id, description: gk ? saveDesc(scorer.lastName, gk.lastName) : `${scorer.lastName}'s shot is saved.` });
        // Corner chance from saved shot (wide play increases corner frequency)
        if (Math.random() < CORNER_FROM_SAVE_CHANCE + widthCornerBonus) {
          if (isHome) homeCorners++; else awayCorners++;
          // Corner goal attempt
          if (Math.random() < CORNER_GOAL_CHANCE) {
            const headerCandidates = eligibleSquad.filter(p => p.position !== 'GK');
            if (headerCandidates.length > 0) {
              const headerWeights = headerCandidates.map(p => p.attributes.physical * CORNER_GOAL_PHYSICAL_WEIGHT + p.attributes.mental * CORNER_GOAL_DEFENDING_WEIGHT);
              const tw = headerWeights.reduce((a, b) => a + b, 0);
              let rr = Math.random() * tw;
              let header = headerCandidates[0];
              for (let i = 0; i < headerCandidates.length; i++) { rr -= headerWeights[i]; if (rr <= 0) { header = headerCandidates[i]; break; } }
              if (Math.random() < Math.max(CORNER_HEADER_MIN_CHANCE, (header.attributes.physical / 100) * CORNER_HEADER_PHYSICAL_SCALE)) {
                if (isHome) homeGoals++; else awayGoals++;
                if (isHome) homeSoT++; else awaySoT++;
                if (playerEvents[header.id]) playerEvents[header.id].goals++;
                const cornerAssist = pickAssist(squad, header.id);
                if (cornerAssist && playerEvents[cornerAssist.id]) playerEvents[cornerAssist.id].assists++;
                oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
                const cDesc = pick(cornerGoalDescs);
                events.push({ minute: min, type: 'goal', playerId: header.id, assistPlayerId: cornerAssist?.id, clubId: club.id, description: cDesc(`${header.firstName} ${header.lastName}`, club.shortName) + (cornerAssist ? ` (assist: ${cornerAssist.lastName})` : '') });
              }
            }
          }
        }
      } else {
        // Shot missed
        if (isHome) homeShots++; else awayShots++;
        events.push({ minute: min, type: 'shot_missed', playerId: scorer.id, clubId: club.id, description: pick(missDescs)(scorer.lastName) });
        // Corner chance from missed shot (wide play increases corner frequency)
        if (Math.random() < CORNER_FROM_MISS_CHANCE + widthCornerBonus) {
          if (isHome) homeCorners++; else awayCorners++;
        }
      }
    }
    // === FOUL ===
    else if (roll < FOUL_THRESHOLD + derbyFoulMod) {
      const eligibleFoulers = squad.filter(p => !unavailable.has(p.id));
      if (eligibleFoulers.length === 0) continue;
      const fouler = pickFouler(eligibleFoulers);
      if (!fouler) continue;
      if (isHome) homeFouls++; else awayFouls++;
      const isPlayerTeamFouling = (isHome && homeClub.id === playerClubId) || (!isHome && awayClub.id === playerClubId);
      const disciplinarianMod = (disciplinarianActive && isPlayerTeamFouling) ? (1 - DISCIPLINARIAN_CARD_REDUCTION) : 1;
      const cardChance = (CARD_BASE_CHANCE + atkMods.foulMod + derbyCardMod) * getCardRiskMultiplier(fouler.personality) * disciplinarianMod;
      if (Math.random() < cardChance) {
        const pe = playerEvents[fouler.id];
        if (pe) {
          pe.yellows++;
          if (pe.yellows >= 2) {
            pe.redCard = true;
            sentOff.add(fouler.id);
            unavailable.add(fouler.id);
            events.push({ minute: min, type: 'red_card', playerId: fouler.id, clubId: club.id, description: `Second yellow! ${fouler.lastName} is sent off!` });
            // Rebalance strength after red card
            const recomputed = computeStrengths(homeClub, awayClub, homePlayers.filter(p => !unavailable.has(p.id)), awayPlayers.filter(p => !unavailable.has(p.id)), homeTactics, awayTactics, tacticalFamiliarity, playerClubId);
            homeStr = recomputed.homeStr; awayStr = recomputed.awayStr;
          } else {
            // Momentum swings toward the non-fouling team on yellow cards
            momentum = isHome
              ? Math.max(-100, momentum - MOMENTUM_CARD_SWING)
              : Math.min(100, momentum + MOMENTUM_CARD_SWING);
            events.push({ minute: min, type: 'yellow_card', playerId: fouler.id, clubId: club.id, description: pick(yellowDescs)(fouler.lastName) });
          }
        }
      } else if (Math.random() < STRAIGHT_RED_CHANCE) {
        const pe = playerEvents[fouler.id];
        if (pe && !pe.redCard) {
          pe.redCard = true;
          sentOff.add(fouler.id);
          unavailable.add(fouler.id);
          events.push({ minute: min, type: 'red_card', playerId: fouler.id, clubId: club.id, description: `RED CARD! Straight red for ${fouler.lastName}! Dangerous play!` });
            // Rebalance strength after red card
            const recomputed2 = computeStrengths(homeClub, awayClub, homePlayers.filter(p => !unavailable.has(p.id)), awayPlayers.filter(p => !unavailable.has(p.id)), homeTactics, awayTactics, tacticalFamiliarity, playerClubId);
            homeStr = recomputed2.homeStr; awayStr = recomputed2.awayStr;
        }
      } else {
        events.push({ minute: min, type: 'foul', playerId: fouler.id, clubId: club.id, description: pick(foulDescs)(fouler.lastName) });
      }

      // Foul can cause injury to fouled player (3% chance)
      if (Math.random() < FOUL_INJURY_CHANCE) {
        const oppEligible = oppSquad.filter(p => !unavailable.has(p.id));
        if (oppEligible.length > 0) {
          const fouled = pick(oppEligible);
          const medLevel = isHome ? (awayMedicalLevel ?? 5) : (homeMedicalLevel ?? 5);
          const details = generateInjuryDetails(true, medLevel);
          matchInjuries[fouled.id] = details;
          injured.add(fouled.id);
          unavailable.add(fouled.id);
          const injLabel = INJURY_TYPES[details.type].label;
          const sevLabel = details.severity === 'minor' ? 'Minor' : details.severity === 'moderate' ? 'Moderate' : 'Serious';
          events.push({ minute: min, type: 'injury', playerId: fouled.id, clubId: fouled.clubId, description: `${fouled.lastName} goes down injured after the foul! ${sevLabel} ${injLabel} — ${details.weeksRemaining} week${details.weeksRemaining > 1 ? 's' : ''} out.` });
        }
      }

      // Penalty: foul in dangerous area
      if (Math.random() < PENALTY_FROM_FOUL_CHANCE) {
        const oppEligible = oppSquad.filter(p => !unavailable.has(p.id));
        if (oppEligible.length > 0) {
          const penaltyTaker = pickAttacker(oppEligible);
          const oppClubRef = isHome ? awayClub : homeClub;
          if (Math.random() < PENALTY_CONVERSION_RATE) {
            if (isHome) awayGoals++; else homeGoals++;
            if (isHome) { awayShots++; awaySoT++; } else { homeShots++; homeSoT++; }
            if (playerEvents[penaltyTaker.id]) playerEvents[penaltyTaker.id].goals++;
            squad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
            // Momentum swings toward penalty-scoring team (opposite of fouling team)
            momentum = isHome
              ? Math.max(-100, momentum - MOMENTUM_PENALTY_SWING)
              : Math.min(100, momentum + MOMENTUM_PENALTY_SWING);
            // xG for penalty (standard ~0.76)
            if (isHome) awayXG += PENALTY_CONVERSION_RATE; else homeXG += PENALTY_CONVERSION_RATE;
            events.push({ minute: min, type: 'penalty_scored', playerId: penaltyTaker.id, clubId: oppClubRef.id, description: pick(penaltyGoalDescs)(penaltyTaker.lastName, oppClubRef.shortName) });
          } else {
            if (isHome) awayShots++; else homeShots++;
            events.push({ minute: min, type: 'penalty_missed', playerId: penaltyTaker.id, clubId: oppClubRef.id, description: pick(penaltyMissDescs)(penaltyTaker.lastName) });
          }
        }
      }
    }
    // === OWN GOAL (rare) ===
    else if (Math.random() < OWN_GOAL_CHANCE) {
      const oppEligible = oppSquad.filter(p => !unavailable.has(p.id) && [...DEFENDER_POSITIONS].includes(p.position));
      if (oppEligible.length > 0) {
        const ownGoalPlayer = pick(oppEligible);
        const oppClubRef = isHome ? awayClub : homeClub;
        if (isHome) homeGoals++; else awayGoals++;
        oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
        events.push({ minute: min, type: 'own_goal', playerId: ownGoalPlayer.id, clubId: club.id, description: pick(ownGoalDescs)(ownGoalPlayer.lastName, oppClubRef.shortName) });
      }
    }
    // === INJURY (non-foul) ===
    else if (roll < INJURY_EVENT_THRESHOLD) {
      const eligibleForInjury = squad.filter(p => !unavailable.has(p.id));
      if (eligibleForInjury.length === 0) continue;
      // Injury chance scales with physical fragility, age, and in-match fitness
      const candidate = pick(eligibleForInjury);
      const currentFit = matchFitness[candidate.id] ?? candidate.fitness;
      const lowFitInjuryBonus = currentFit < MATCH_LOW_FITNESS_THRESHOLD ? LOW_FITNESS_INJURY_BONUS : 0;
      // Medical facility level reduces base injury probability
      const medLevel = isHome ? (homeMedicalLevel ?? 5) : (awayMedicalLevel ?? 5);
      const medPrevention = medLevel * MEDICAL_INJURY_PREVENTION_PER_LEVEL;
      const injuryProb = Math.max(0.005, NON_FOUL_INJURY_BASE + ((100 - candidate.attributes.physical) * PHYSICAL_FRAGILITY_FACTOR) + (candidate.age > OLD_PLAYER_INJURY_AGE_THRESHOLD ? OLD_PLAYER_INJURY_BONUS : 0) + lowFitInjuryBonus - medPrevention);
      if (Math.random() < injuryProb) {
        const details = generateInjuryDetails(false, medLevel);
        matchInjuries[candidate.id] = details;
        injured.add(candidate.id);
        unavailable.add(candidate.id);
        const injLabel = INJURY_TYPES[details.type].label;
        const sevLabel = details.severity === 'minor' ? 'Minor' : details.severity === 'moderate' ? 'Moderate' : 'Serious';
        events.push({ minute: min, type: 'injury', playerId: candidate.id, clubId: club.id, description: `${pick(injuryDescs)(candidate.lastName)} ${sevLabel} ${injLabel} — ${details.weeksRemaining} week${details.weeksRemaining > 1 ? 's' : ''} out.` });
      }
    }
  }

  // Add half-time marker at end of first half (only once)
  if (isFirstHalf && !events.some(e => e.type === 'half_time')) {
    events.push({ minute: 45 + stoppageTime, type: 'half_time', clubId: '', description: '— Half Time —' });
  }

  // Stamp momentum snapshot on each event for UI visualization
  let runningMomentum = prevState?.momentum ?? 0;
  for (const ev of events) {
    if (ev.type === 'kickoff') { runningMomentum = 0; }
    ev.momentum = runningMomentum;
    // Approximate momentum shifts for replay (simplified)
    if (ev.type === 'goal' || ev.type === 'penalty_scored') {
      const swing = ev.clubId === homeClub.id ? MOMENTUM_GOAL_SWING : -MOMENTUM_GOAL_SWING;
      runningMomentum = Math.max(-100, Math.min(100, runningMomentum + swing));
    } else if (ev.type === 'shot_saved') {
      const swing = ev.clubId === homeClub.id ? -MOMENTUM_SAVE_SWING : MOMENTUM_SAVE_SWING;
      runningMomentum = Math.max(-100, Math.min(100, runningMomentum + swing));
    }
  }

  return {
    events, homeGoals, awayGoals, homeShots, awayShots, homeSoT, awaySoT,
    homeFouls, awayFouls, homeCorners, awayCorners, sentOff: Array.from(sentOff), injured: Array.from(injured), playerEvents,
    momentum, homeXG, awayXG, matchInjuries,
  };
}

/** Finalize a match from a completed HalfState, producing the final Match and player ratings */
export function finalizeMatch(
  match: Match,
  homeClub: Club,
  awayClub: Club,
  homePlayers: Player[],
  awayPlayers: Player[],
  state: HalfState,
): { result: Match; playerRatings: PlayerMatchRating[] } {
  const total = computeStrengths(homeClub, awayClub, homePlayers, awayPlayers);
  const totalStr = total.homeStr + total.awayStr;
  const homePoss = totalStr > 0 ? Math.round((total.homeStr / totalStr) * 100) : 50;

  state.events.push({ minute: 90, type: 'full_time', clubId: '', description: `— Full Time: ${homeClub.shortName} ${state.homeGoals} - ${state.awayGoals} ${awayClub.shortName} —` });

  const stats: MatchStats = {
    homePossession: homePoss, awayPossession: 100 - homePoss,
    homeShots: state.homeShots, awayShots: state.awayShots,
    homeShotsOnTarget: state.homeSoT, awayShotsOnTarget: state.awaySoT,
    homeFouls: state.homeFouls, awayFouls: state.awayFouls,
    homeCorners: state.homeCorners, awayCorners: state.awayCorners,
    homeXG: Math.round(state.homeXG * 100) / 100,
    awayXG: Math.round(state.awayXG * 100) / 100,
  };

  const allMatchPlayers = [...homePlayers, ...awayPlayers];
  const playerRatings: PlayerMatchRating[] = allMatchPlayers.map(p => {
    const ev = state.playerEvents[p.id];
    const isHomeSide = homePlayers.some(hp => hp.id === p.id);
    const teamWon = isHomeSide ? state.homeGoals > state.awayGoals : state.awayGoals > state.homeGoals;
    const teamLost = isHomeSide ? state.homeGoals < state.awayGoals : state.awayGoals < state.homeGoals;

    // Base rating influenced by team result
    let rating = teamWon ? RATING_BASE_WIN : teamLost ? RATING_BASE_LOSS : RATING_BASE_DRAW;

    if (ev) {
      rating += ev.goals * RATING_GOAL_BONUS;
      rating += ev.assists * RATING_ASSIST_BONUS;
      rating += ev.saves * RATING_SAVE_BONUS;
      rating -= ev.yellows * RATING_YELLOW_PENALTY;
      if (ev.redCard) rating -= RATING_RED_PENALTY;
      // GK clean sheet: only if no goals conceded after they entered
      if (p.position === 'GK') {
        const totalConceded = isHomeSide ? state.awayGoals : state.homeGoals;
        const concededAfterEntry = totalConceded - (ev.goalsAtEntry ?? 0);
        if (concededAfterEntry === 0) rating += RATING_CLEAN_SHEET_BONUS;
      }
    }

    // Attribute-based contribution bonus (defenders get credit for defending, midfielders for passing)
    if (['CB', 'LB', 'RB'].includes(p.position)) {
      rating += (p.attributes.defending / 100) * RATING_DEFENDER_SCALE - RATING_DEFENDER_OFFSET;
    } else if (['CM', 'CDM', 'CAM'].includes(p.position)) {
      rating += (p.attributes.passing / 100) * RATING_MIDFIELDER_SCALE - RATING_MIDFIELDER_OFFSET;
    }

    // Fitness penalty for exhausted players
    if (p.fitness <= RATING_EXHAUSTION_THRESHOLD) rating -= RATING_EXHAUSTION_PENALTY;

    rating += (Math.random() - 0.5) * RATING_VARIANCE;
    rating = Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(rating * 10) / 10));
    return { playerId: p.id, rating, goals: ev?.goals || 0, assists: ev?.assists || 0, yellowCards: ev?.yellows || 0, redCards: ev?.redCard ? 1 : 0 };
  });

  return {
    result: { ...match, played: true, homeGoals: state.homeGoals, awayGoals: state.awayGoals, events: state.events, stats },
    playerRatings,
  };
}

/** Validate a squad has enough players to field a team.
 *  Player's team requires 11; AI teams allow down to 7 (injury-depleted squads). */
function isSquadValid(players: Player[], isPlayerTeam = false): boolean {
  const minPlayers = isPlayerTeam ? 11 : 7;
  return players.length >= minPlayers && players.some(p => p.position === 'GK');
}

/**
 * Simulate a full match in one call (used for AI-vs-AI matches and instant sim).
 * For player matches with half-time break, use simulateHalf() twice with finalizeMatch() instead.
 */
export function simulateMatch(
  match: Match,
  homeClub: Club,
  awayClub: Club,
  homePlayers: Player[],
  awayPlayers: Player[],
  homeTactics?: TacticalInstructions,
  awayTactics?: TacticalInstructions,
  tacticalFamiliarity?: number,
  playerClubId?: string,
  derbyIntensity?: number,
  disciplinarianActive?: boolean,
): { result: Match; playerRatings: PlayerMatchRating[] } {
  // Forfeit if either squad is invalid
  const homeIsPlayer = playerClubId === homeClub.id;
  const awayIsPlayer = playerClubId === awayClub.id;
  const homeValid = isSquadValid(homePlayers, homeIsPlayer);
  const awayValid = isSquadValid(awayPlayers, awayIsPlayer);
  if (!homeValid || !awayValid) {
    const forfeitHome = !homeValid ? 0 : 3;
    const forfeitAway = !awayValid ? 0 : 3;
    return {
      result: { ...match, played: true, homeGoals: forfeitHome, awayGoals: forfeitAway, events: [{ minute: 0, type: 'full_time', clubId: '', description: `— Forfeit: ${!homeValid ? homeClub.shortName : awayClub.shortName} unable to field a valid squad —` }], stats: { homePossession: 50, awayPossession: 50, homeShots: 0, awayShots: 0, homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0, awayFouls: 0, homeCorners: 0, awayCorners: 0, homeXG: 0, awayXG: 0 } },
      playerRatings: [],
    };
  }
  // Use club-specific AI tactics when available, falling back to balanced defaults
  const effectiveHomeTactics = homeTactics ?? homeClub.aiManagerProfile?.defaultTactics ?? AI_DEFAULT_TACTICS;
  const effectiveAwayTactics = awayTactics ?? awayClub.aiManagerProfile?.defaultTactics ?? AI_DEFAULT_TACTICS;

  // Simulate first half (1-45)
  const firstHalf = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45, effectiveHomeTactics, effectiveAwayTactics, tacticalFamiliarity, playerClubId, undefined, derbyIntensity, disciplinarianActive, homeClub.facilities, awayClub.facilities);

  // AI tactical reactivity: adjust tactics for second half based on scoreline
  let secondHalfHomeTactics = effectiveHomeTactics;
  let secondHalfAwayTactics = effectiveAwayTactics;

  if (!homeTactics && homeClub.aiManagerProfile) {
    secondHalfHomeTactics = getAIReactiveTactics(homeClub.aiManagerProfile, true, firstHalf.homeGoals, firstHalf.awayGoals, 45);
  }
  if (!awayTactics && awayClub.aiManagerProfile) {
    secondHalfAwayTactics = getAIReactiveTactics(awayClub.aiManagerProfile, false, firstHalf.homeGoals, firstHalf.awayGoals, 45);
  }

  // Simulate second half (46-90) with potentially adjusted AI tactics
  const fullState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 46, 90, secondHalfHomeTactics, secondHalfAwayTactics, tacticalFamiliarity, playerClubId, firstHalf, derbyIntensity, disciplinarianActive, homeClub.facilities, awayClub.facilities);

  const finalized = finalizeMatch(match, homeClub, awayClub, homePlayers, awayPlayers, fullState);
  return { ...finalized, matchInjuries: fullState.matchInjuries };
}
