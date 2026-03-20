import { Match, MatchEvent, MatchStats, Player, Club, TacticalInstructions, PlayerMatchRating, FORMATION_POSITIONS, POSITION_COMPATIBILITY, FormationType } from '@/types/game';
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

/** Compute average defensive quality of a squad's defenders */
function getDefenseQuality(squad: Player[]): number {
  const defenders = squad.filter(p => [...DEFENDER_POSITIONS].includes(p.position));
  if (defenders.length === 0) return DEFENSE_QUALITY_FALLBACK;
  return defenders.reduce((s, p) => s + (p.attributes.defending * DEFENSE_DEFENDING_WEIGHT + p.attributes.physical * DEFENSE_PHYSICAL_WEIGHT + p.attributes.mental * DEFENSE_MENTAL_WEIGHT) / 100, 0) / defenders.length;
}

/** Get the GK's save ability (0.30 to 0.70) */
function getGKSaveChance(squad: Player[]): number {
  const gk = squad.find(p => p.position === 'GK');
  if (!gk) return GK_SAVE_BASE;
  const quality = (gk.attributes.defending * GK_DEFENDING_WEIGHT + gk.attributes.mental * GK_MENTAL_WEIGHT + gk.attributes.physical * GK_PHYSICAL_WEIGHT) / 100;
  return GK_SAVE_BASE + quality * GK_SAVE_RANGE;
}

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
  const homeMatchup = getTacticalMatchupBonus(homeTactics, awayTactics);
  const awayMatchup = getTacticalMatchupBonus(awayTactics, homeTactics);
  // Chemistry bonus (0-8%) based on squad composition
  const homeChemistry = getChemistryBonus(homePlayers);
  const awayChemistry = getChemistryBonus(awayPlayers);
  // Formation-specific attack/defense profiles (e.g. 3-4-3 = +10% attack, -8% defense)
  const homeFormAtk = FORMATION_ATTACK_BONUS[homeClub.formation] || 0;
  const awayFormAtk = FORMATION_ATTACK_BONUS[awayClub.formation] || 0;
  const homeFormDef = FORMATION_DEFENSE_BONUS[homeClub.formation] || 0;
  const awayFormDef = FORMATION_DEFENSE_BONUS[awayClub.formation] || 0;
  // Strength = base * (attack modifiers) reduced by opponent's defensive modifiers
  const homeStr = getTeamStrength(homePlayers) * (HOME_ADVANTAGE + homeMods.attackMod + homeMods.widthMod + homeFamBonus + homeFormBonus + homeMatchup + homeChemistry + homeFormAtk) * (1 - (awayMods.defenseMod + awayFormDef) * 0.3);
  const awayStr = getTeamStrength(awayPlayers) * (1 + awayMods.attackMod + awayMods.widthMod + awayFamBonus + awayFormBonus + awayMatchup + awayChemistry + awayFormAtk) * (1 - (homeMods.defenseMod + homeFormDef) * 0.3);
  return { homeStr, awayStr, homeMods, awayMods };
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
): HalfState {
  // Derby matches: more events, more fouls, more cards
  const derbyEventMod = derbyIntensity ? derbyIntensity * 0.03 : 0;
  const derbyFoulMod = derbyIntensity ? derbyIntensity * 0.06 : 0;
  const derbyCardMod = derbyIntensity ? derbyIntensity * 0.05 : 0;

  let { homeStr, awayStr, homeMods, awayMods } = computeStrengths(
    homeClub, awayClub, homePlayers, awayPlayers, homeTactics, awayTactics, tacticalFamiliarity, playerClubId,
  );
  let total = homeStr + awayStr;

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

  if (startMin === 1) {
    events.push({ minute: 0, type: 'kickoff', clubId: homeClub.id, description: '⚽ Kick off!' });
  }

  for (let min = startMin; min <= endMin; min++) {
    if (min === 45 && startMin <= 45) {
      events.push({ minute: 45, type: 'half_time', clubId: '', description: '— Half Time —' });
    }

    const baseChance = BASE_EVENT_CHANCE + (min > LATE_GAME_THRESHOLD_MINUTE ? LATE_GAME_EVENT_BONUS : 0) + derbyEventMod;
    const eventChance = baseChance + (homeMods.shotMod + awayMods.shotMod) * 0.5;
    if (Math.random() > eventChance) continue;

    const isHome = total > 0 ? Math.random() < homeStr / total : Math.random() < 0.5;
    const club = isHome ? homeClub : awayClub;
    const squad = isHome ? homePlayers : awayPlayers;
    const oppSquad = isHome ? awayPlayers : homePlayers;
    const oppMods = isHome ? awayMods : homeMods;
    const atkMods = isHome ? homeMods : awayMods;
    const oppDefense = isHome ? awayDefQuality : homeDefQuality;
    const oppGKSave = isHome ? awayGKSave : homeGKSave;
    const roll = Math.random();

    // === SHOT ATTEMPT ===
    if (roll < SHOT_ATTEMPT_THRESHOLD) {
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

      // Fitness factor: tired players less effective
      const fitnessFactor = FITNESS_FACTOR_BASE + (scorer.fitness / 100) * FITNESS_FACTOR_SCALE;

      // Goal chance: attacker quality vs opponent defense, modified by tactics
      const goalChance = (shotQuality * fitnessFactor * GOAL_CHANCE_ATTACK_MULT) - (oppDefense * GOAL_CHANCE_DEFENSE_MULT) + atkMods.attackMod * GOAL_CHANCE_ATTACK_MOD_SCALE + oppMods.counterVuln * GOAL_CHANCE_COUNTER_VULN_SCALE;

      if (Math.random() < Math.max(GOAL_CHANCE_MIN, goalChance)) {
        // Goal scored!
        if (isHome) homeGoals++; else awayGoals++;
        if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
        const assist = pickAssist(squad, scorer.id);
        if (playerEvents[scorer.id]) playerEvents[scorer.id].goals++;
        if (assist && playerEvents[assist.id]) playerEvents[assist.id].assists++;
        oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
        events.push({
          minute: min, type: 'goal', playerId: scorer.id,
          assistPlayerId: assist?.id, clubId: club.id,
          description: `⚽ GOAL! ${scorer.firstName} ${scorer.lastName} scores for ${club.shortName}!${assist ? ` (assist: ${assist.lastName})` : ''}`,
        });
      } else if (Math.random() < oppGKSave) {
        // Shot on target but saved — GK quality determines save rate
        if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
        const gk = oppSquad.find(p => p.position === 'GK');
        if (gk && playerEvents[gk.id]) playerEvents[gk.id].saves++;
        events.push({ minute: min, type: 'shot_saved', playerId: scorer.id, clubId: club.id, description: `${scorer.lastName}'s shot is saved${gk ? ` by ${gk.lastName}` : ''}.` });
        // Corner chance from saved shot
        if (Math.random() < CORNER_FROM_SAVE_CHANCE) {
          if (isHome) homeCorners++; else awayCorners++;
        }
      } else {
        // Shot missed
        if (isHome) homeShots++; else awayShots++;
        events.push({ minute: min, type: 'shot_missed', playerId: scorer.id, clubId: club.id, description: `${scorer.lastName} fires wide.` });
        // Corner chance from missed shot
        if (Math.random() < CORNER_FROM_MISS_CHANCE) {
          if (isHome) homeCorners++; else awayCorners++;
        }
      }
    }
    // === FOUL ===
    else if (roll < FOUL_THRESHOLD + derbyFoulMod) {
      const eligibleFoulers = squad.filter(p => !unavailable.has(p.id));
      if (eligibleFoulers.length === 0) continue;
      const fouler = pick(eligibleFoulers);
      if (isHome) homeFouls++; else awayFouls++;
      const cardChance = (CARD_BASE_CHANCE + atkMods.foulMod + derbyCardMod) * getCardRiskMultiplier(fouler.personality);
      if (Math.random() < cardChance) {
        const pe = playerEvents[fouler.id];
        if (pe) {
          pe.yellows++;
          if (pe.yellows >= 2) {
            pe.redCard = true;
            sentOff.add(fouler.id);
            unavailable.add(fouler.id);
            events.push({ minute: min, type: 'red_card', playerId: fouler.id, clubId: club.id, description: `🟥 Second yellow! ${fouler.lastName} is sent off!` });
            // Rebalance strength after red card
            const recomputed = computeStrengths(homeClub, awayClub, homePlayers.filter(p => !unavailable.has(p.id)), awayPlayers.filter(p => !unavailable.has(p.id)), homeTactics, awayTactics, tacticalFamiliarity, playerClubId);
            homeStr = recomputed.homeStr; awayStr = recomputed.awayStr; total = homeStr + awayStr;
          } else {
            events.push({ minute: min, type: 'yellow_card', playerId: fouler.id, clubId: club.id, description: `🟨 Yellow card for ${fouler.lastName}.` });
          }
        }
      } else if (Math.random() < STRAIGHT_RED_CHANCE) {
        const pe = playerEvents[fouler.id];
        if (pe && !pe.redCard) {
          pe.redCard = true;
          sentOff.add(fouler.id);
          unavailable.add(fouler.id);
          events.push({ minute: min, type: 'red_card', playerId: fouler.id, clubId: club.id, description: `🟥 RED CARD! Straight red for ${fouler.lastName}! Dangerous play!` });
            // Rebalance strength after red card
            const recomputed2 = computeStrengths(homeClub, awayClub, homePlayers.filter(p => !unavailable.has(p.id)), awayPlayers.filter(p => !unavailable.has(p.id)), homeTactics, awayTactics, tacticalFamiliarity, playerClubId);
            homeStr = recomputed2.homeStr; awayStr = recomputed2.awayStr; total = homeStr + awayStr;
        }
      } else {
        events.push({ minute: min, type: 'foul', playerId: fouler.id, clubId: club.id, description: `Foul by ${fouler.lastName}.` });
      }

      // Foul can cause injury to fouled player (3% chance)
      if (Math.random() < FOUL_INJURY_CHANCE) {
        const oppEligible = oppSquad.filter(p => !unavailable.has(p.id));
        if (oppEligible.length > 0) {
          const fouled = pick(oppEligible);
          injured.add(fouled.id);
          unavailable.add(fouled.id);
          events.push({ minute: min, type: 'injury', playerId: fouled.id, clubId: fouled.clubId, description: `🏥 ${fouled.lastName} goes down injured after the foul!` });
        }
      }
    }
    // === INJURY (non-foul) ===
    else if (roll < INJURY_EVENT_THRESHOLD) {
      const eligibleForInjury = squad.filter(p => !unavailable.has(p.id));
      if (eligibleForInjury.length === 0) continue;
      // Injury chance scales with physical fragility and age
      const candidate = pick(eligibleForInjury);
      const injuryProb = NON_FOUL_INJURY_BASE + ((100 - candidate.attributes.physical) * PHYSICAL_FRAGILITY_FACTOR) + (candidate.age > OLD_PLAYER_INJURY_AGE_THRESHOLD ? OLD_PLAYER_INJURY_BONUS : 0);
      if (Math.random() < injuryProb) {
        injured.add(candidate.id);
        unavailable.add(candidate.id);
        events.push({ minute: min, type: 'injury', playerId: candidate.id, clubId: club.id, description: `🏥 ${candidate.lastName} goes down injured!` });
      }
    }
  }

  return {
    events, homeGoals, awayGoals, homeShots, awayShots, homeSoT, awaySoT,
    homeFouls, awayFouls, homeCorners, awayCorners, sentOff: Array.from(sentOff), injured: Array.from(injured), playerEvents,
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
    if (p.fitness < RATING_EXHAUSTION_THRESHOLD) rating -= RATING_EXHAUSTION_PENALTY;

    rating += (Math.random() - 0.5) * RATING_VARIANCE;
    rating = Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(rating * 10) / 10));
    return { playerId: p.id, rating, goals: ev?.goals || 0, assists: ev?.assists || 0, yellowCards: ev?.yellows || 0, redCards: ev?.redCard ? 1 : 0 };
  });

  return {
    result: { ...match, played: true, homeGoals: state.homeGoals, awayGoals: state.awayGoals, events: state.events, stats },
    playerRatings,
  };
}

/** Validate a squad has enough players to field a team */
function isSquadValid(players: Player[]): boolean {
  return players.length >= 7 && players.some(p => p.position === 'GK');
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
): { result: Match; playerRatings: PlayerMatchRating[] } {
  // Forfeit if either squad is invalid
  const homeValid = isSquadValid(homePlayers);
  const awayValid = isSquadValid(awayPlayers);
  if (!homeValid || !awayValid) {
    const forfeitHome = !homeValid ? 0 : 3;
    const forfeitAway = !awayValid ? 0 : 3;
    return {
      result: { ...match, played: true, homeGoals: forfeitHome, awayGoals: forfeitAway, events: [{ minute: 0, type: 'full_time', clubId: '', description: `— Forfeit: ${!homeValid ? homeClub.shortName : awayClub.shortName} unable to field a valid squad —` }], stats: { homePossession: 50, awayPossession: 50, homeShots: 0, awayShots: 0, homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0, awayFouls: 0, homeCorners: 0, awayCorners: 0 } },
      playerRatings: [],
    };
  }
  const state = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 90, homeTactics, awayTactics, tacticalFamiliarity, playerClubId, undefined, derbyIntensity);
  return finalizeMatch(match, homeClub, awayClub, homePlayers, awayPlayers, state);
}
