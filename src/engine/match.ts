import { Match, MatchEvent, MatchStats, Player, Club, TacticalInstructions, PlayerMatchRating, canPlayPosition, MatchWeather, WeatherCondition, PitchCondition } from '@/types/game';
import { getAIReactiveTactics, AI_REACTIVITY_MINUTES } from '@/config/aiManager';
import {
  INJURY_TYPES,
  MEDICAL_INJURY_PREVENTION_PER_LEVEL,
  REINJURY_MATCH_CHECK_CHANCE,
  clubMedicalLevel,
} from '@/config/gameBalance';
import type { InjuryDetails } from '@/types/game';
import { pick } from '@/utils/helpers';
import { getCardRiskMultiplier } from '@/utils/personality';
import {
  PRESSING_THRESHOLD, PRESSING_VS_SLOW_BONUS, WIDE_VS_NARROW_BONUS,
  DEEP_VS_HIGH_BONUS, FAST_VS_CAUTIOUS_BONUS,
  DEFENDER_POSITIONS,
  GK_SAVE_BASE, GK_SAVE_RANGE,
  BASE_EVENT_CHANCE, LATE_GAME_EVENT_BONUS, LATE_GAME_THRESHOLD_MINUTE,
  SHOT_ATTEMPT_THRESHOLD, FOUL_BAND_WIDTH, INJURY_BAND_WIDTH, FOUL_BAND_END_CAP, TEMPO_SHOT_THRESHOLD_SCALE,
  LOW_XG_MISS_THRESHOLD, LOW_XG_MISS_SHOW_CHANCE,
  SHOT_QUALITY_WEIGHTS, FITNESS_FACTOR_BASE, FITNESS_FACTOR_SCALE,
  GOAL_CHANCE_ATTACK_MULT, GOAL_CHANCE_DEFENSE_MULT, GOAL_CHANCE_VOLUME_SCALE, GOAL_CHANCE_ATTACK_MOD_SCALE, GOAL_CHANCE_COUNTER_VULN_SCALE, GOAL_CHANCE_MIN,
  CORNER_FROM_SAVE_CHANCE, CORNER_FROM_MISS_CHANCE, SHOT_ON_TARGET_SAVE_SCALE,
  CARD_BASE_CHANCE, STRAIGHT_RED_CHANCE, BOOKED_PLAYER_CARD_MULT,
  MENTALITY_SHOT_SHIFT_SCALE, TEMPO_SHOT_QUALITY_MOD,
  FOUL_INJURY_CHANCE, NON_FOUL_INJURY_BASE, PHYSICAL_FRAGILITY_FACTOR, OLD_PLAYER_INJURY_BONUS, OLD_PLAYER_INJURY_AGE_THRESHOLD,
  RATING_BASE_WIN, RATING_BASE_LOSS, RATING_BASE_DRAW,
  RATING_GOAL_BONUS, RATING_ASSIST_BONUS, RATING_SAVE_BONUS, RATING_YELLOW_PENALTY, RATING_RED_PENALTY, RATING_CLEAN_SHEET_BONUS,
  RATING_DEFENDER_SCALE, RATING_DEFENDER_OFFSET, RATING_MIDFIELDER_SCALE, RATING_MIDFIELDER_OFFSET,
  RATING_EXHAUSTION_THRESHOLD, RATING_EXHAUSTION_PENALTY, RATING_VARIANCE, RATING_MIN, RATING_MAX,
  CORNER_GOAL_CHANCE, CORNER_GOAL_PHYSICAL_WEIGHT, CORNER_GOAL_DEFENDING_WEIGHT,
  FITNESS_DEGRADE_PER_MINUTE, FITNESS_DEGRADE_VARIANCE, LOW_FITNESS_SHOT_PENALTY, MATCH_LOW_FITNESS_THRESHOLD, LOW_FITNESS_INJURY_BONUS,
  PRESSING_FITNESS_DRAIN_PER_POINT, PRESSING_FITNESS_DRAIN_BASELINE, TEMPO_FAST_FITNESS_DRAIN_MOD, TEMPO_SLOW_FITNESS_DRAIN_MOD,
  FATIGUE_COMMENTARY_THRESHOLD, FATIGUE_COMMENTARY_MIN_MINUTE, FATIGUE_COMMENTARY_INTERVAL,
  DERBY_EVENT_MOD_SCALE, DERBY_FOUL_MOD_SCALE, DERBY_CARD_MOD_SCALE,
  CORNER_HEADER_MIN_CHANCE, CORNER_HEADER_PHYSICAL_SCALE, CORNER_HEADER_CB_MULT, CORNER_HEADER_ST_MULT, CORNER_HEADER_MID_MULT,
  OWN_GOAL_CHANCE, PENALTY_FROM_FOUL_CHANCE, PENALTY_CONVERSION_RATE,
  WOODWORK_CHANCE, GOAL_LINE_CLEARANCE_CHANCE,
  DISCIPLINARIAN_CARD_REDUCTION,
  MOMENTUM_GOAL_SWING, MOMENTUM_SAVE_SWING, MOMENTUM_CARD_SWING, MOMENTUM_PENALTY_SWING,
  MOMENTUM_COMMENTARY_SWING, MOMENTUM_SHOT_ATTEMPT_SWING, MOMENTUM_FOUL_SWING, MOMENTUM_RED_CARD_SWING,
  MOMENTUM_DECAY_PER_MINUTE, MOMENTUM_STRENGTH_SCALE,
  SUB_FRESHNESS_BONUS,
  SET_PIECE_TAKER_CORNER_BONUS, PENALTY_TAKER_BONUS,
  COMMENTARY_GAP_MAX, COMMENTARY_CHANCE,
  MIN_PLAYERS_TO_CONTINUE,
  MAX_SUBSTITUTIONS, SUB_ENTRY_FITNESS_BOOST,
  AI_SUB_CHECK_MINUTES, AI_SUB_FITNESS_THRESHOLD, AI_TACTICAL_SUB_CHANCE,
  TACTICAL_INSIGHT_MIN_BONUS, FITNESS_SNAPSHOT_INTERVAL,
  WEATHER_WEIGHTS, PITCH_WEIGHTS, WEATHER_PASSING_MOD, WEATHER_PACE_MOD, WEATHER_FOUL_MOD,
  PITCH_SHOT_MOD, WEATHER_GK_ERROR_MOD,
  FREE_KICK_GOAL_CHANCE, LONG_RANGE_GOAL_CHANCE, COUNTER_ATTACK_GOAL_CHANCE,
  HEADER_GOAL_CHANCE, SOLO_GOAL_CHANCE, GK_ERROR_BASE_CHANCE, GK_ERROR_MAX_CHANCE, GK_ERROR_QUALITY_REDUCTION,
  VAR_CHECK_CHANCE, VAR_DISALLOW_CHANCE,
  FREE_KICK_SET_PIECE_TAKER_CHANCE,
  WEATHER_SUFFIX_CHANCE, DERBY_SUFFIX_CHANCE,
  MORALE_BASELINE, MORALE_PERFORMANCE_WEIGHT,
  DEFENSE_MODIFIER_SCALE, GOAL_SCORING_TYPES,
} from '@/config/matchEngine';
import { generateCommentary } from '@/utils/matchCommentary';
import { getDerbyName } from '@/data/league';
import {
  AI_DEFAULT_TACTICS,
  pickAttacker,
  pickPenaltyTaker,
  pickAssist,
  pickFouler,
  getTacticalMatchupBonus,
  getFormationMatchupBonus,
  getDefenseQuality,
  getGKSaveChance,
  computeStrengths,
  calcStoppageTime,
  generateInjuryDetails,
  isSquadValid,
} from '@/engine/match/helpers';

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
  /** Players substituted OFF in earlier halves — they can never return, so
   *  they must be rebuilt into `unavailable` when a later half/extra time
   *  resumes. Without this, AI tactically-subbed-out players "resurrected"
   *  in extra time (the store lineup still contains them) and the AI played
   *  ET with 11+N active players. Optional for pre-v72 mid-match saves. */
  subbedOut?: string[];
  playerEvents: Record<string, { goals: number; assists: number; yellows: number; redCard: boolean; saves: number; cleanSheet: boolean; goalsAtEntry?: number }>;
  momentum: number;
  homeXG: number;
  awayXG: number;
  /** Injury details generated during the match, keyed by player ID */
  matchInjuries: Record<string, InjuryDetails>;
  /** Substitutions used by each team (for AI sub tracking) */
  homeSubsUsed: number;
  awaySubsUsed: number;
  /** Remaining bench players for AI substitution logic (carried between halves) */
  homeBench: Player[];
  awayBench: Player[];
  /** Players who were subbed into the match (for ratings/finalization) */
  homeSubbedIn: Player[];
  awaySubbedIn: Player[];
  /** Snapshot of in-match fitness for all players (updated periodically) */
  playerFitness: Record<string, number>;
  /** Tactical insights generated during the half */
  tacticalInsights: string[];
  /** Tracks which gap-filler commentary templates have been used this match (avoids repetition).
   *  Plain array (not Set) so JSON.stringify in saveGame survives a mid-match save. */
  usedCommentaryLines: string[];
  /** The match was abandoned under FIFA Law 3 (a side below
   *  MIN_PLAYERS_TO_CONTINUE) and the score has been forfeited.
   *
   *  This MUST live on the carried state, not just in a local. `abandonMatch`
   *  was a local inside simulateHalf, so a first half that ended in a forfeit
   *  was followed by a completely normal second half: the depleted side played
   *  on, both sides kept scoring, and the forfeit was silently undone.
   *  Optional so mid-match saves written before this field default to false. */
  abandoned?: boolean;
}

// Pure helpers (`getFormationFitBonus`, `pickAttacker`, `pickPenaltyTaker`,
// `pickAssist`, `pickFouler`, `getTacticalMatchupBonus`,
// `getFormationMatchupBonus`, `calcStoppageTime`, `getTacticsModifiers`,
// `getDefenseQuality`, `getGKSaveChance`, `computeStrengths`, `weightedPick`,
// `generateInjuryDetails`, `isSquadValid`, `AI_DEFAULT_TACTICS`) live in
// `./match/helpers.ts`. See the import at the top of this file.

/**
 * AI substitution logic: find the best bench replacement for a player.
 * Used for injury replacements and tactical changes by non-player teams.
 */
function tryAISub(
  benchPool: Player[], squad: Player[], unavailable: Set<string>, subsUsed: number,
  reason: 'injury' | 'tactical', outPlayer?: Player,
  matchFitness?: Record<string, number>, isLosing?: boolean, minute?: number,
  goalDiff?: number, teamSentOff?: number,
): { inPlayer: Player; outPlayer: Player } | null {
  if (subsUsed >= MAX_SUBSTITUTIONS) return null;
  const availBench = benchPool.filter(p => !unavailable.has(p.id) && !p.injured);
  if (availBench.length === 0) return null;

  if (reason === 'injury' && outPlayer) {
    // A bench GK may only come on to replace the GK — never as an outfielder.
    const injuryPool = outPlayer.position === 'GK' ? availBench : availBench.filter(p => p.position !== 'GK');
    if (injuryPool.length === 0) return null;
    // Find best positional match for the injured player
    const scored = injuryPool.map(p => {
      let compat = 0.4; // default: wrong position
      if (p.position === outPlayer.position) compat = 1.0;
      else if (canPlayPosition(p, outPlayer.position)) compat = 0.8;
      return { player: p, score: p.overall * compat };
    }).sort((a, b) => b.score - a.score);
    return scored.length > 0 ? { inPlayer: scored[0].player, outPlayer } : null;
  }

  if (reason === 'tactical') {
    // Tactical subs swap outfielders only — keep bench GKs off the candidate
    // pool (the starters loop below already excludes the GK on the pitch).
    const tacticalBench = availBench.filter(p => p.position !== 'GK');
    if (tacticalBench.length === 0) return null;
    // Find the worst-performing available starter to replace
    const availableStarters = squad.filter(p => !unavailable.has(p.id) && p.position !== 'GK');
    if (availableStarters.length === 0) return null;

    let bestOut: Player | null = null;
    let bestIn: Player | null = null;
    let bestScore = 0;

    for (const starter of availableStarters) {
      const starterFit = matchFitness?.[starter.id] ?? starter.fitness;
      // Skip if starter is still relatively fresh
      if (starterFit > AI_SUB_FITNESS_THRESHOLD && !isLosing && !(minute && minute >= 75)) continue;

      for (const bench of tacticalBench) {
        let compat = 0.4;
        if (bench.position === starter.position) compat = 1.0;
        else if (canPlayPosition(bench, starter.position)) compat = 0.8;

        // Score: improvement potential + fitness gain + tactical context
        const fitnessGain = (bench.fitness - starterFit) / 100;
        const qualityDiff = (bench.overall * compat - starter.overall) / 100;
        let contextBonus = 0;
        // After a red card, prioritize defenders to shore up the back line
        if (teamSentOff && teamSentOff > 0 && ['CB', 'CDM', 'CM'].includes(bench.position)) contextBonus += 0.20;
        if (isLosing && minute && minute >= 60) {
          // Prefer bringing on attackers when losing (earlier if heavily behind)
          const urgency = (goalDiff !== undefined && goalDiff <= -2) ? 0.20 : 0.15;
          if (['ST', 'LW', 'RW', 'CAM'].includes(bench.position)) contextBonus += urgency;
        } else if (!isLosing && minute && minute >= 80) {
          // Prefer bringing on defenders when winning
          if (['CB', 'LB', 'RB', 'CDM'].includes(bench.position)) contextBonus += 0.1;
        }
        const score = fitnessGain * 0.6 + qualityDiff * 0.3 + contextBonus;
        if (score > bestScore) {
          bestScore = score;
          bestOut = starter;
          bestIn = bench;
        }
      }
    }
    return bestOut && bestIn ? { inPlayer: bestIn, outPlayer: bestOut } : null;
  }

  return null;
}

/** Generate random weather and pitch conditions for a match */
export function generateMatchWeather(): MatchWeather {
  const weatherRoll = Math.random();
  let cumulative = 0;
  let weather: WeatherCondition = 'clear';
  for (const [w, weight] of Object.entries(WEATHER_WEIGHTS)) {
    cumulative += weight;
    if (weatherRoll < cumulative) { weather = w as WeatherCondition; break; }
  }
  // Rain/snow worsens pitch condition
  const pitchShift = weather === 'rain' ? 0.15 : weather === 'snow' ? 0.25 : 0;
  const pitchRoll = Math.random();
  cumulative = 0;
  let pitch: PitchCondition = 'good';
  const adjustedPitch = { ...PITCH_WEIGHTS, poor: PITCH_WEIGHTS.poor + pitchShift, excellent: Math.max(0.05, PITCH_WEIGHTS.excellent - pitchShift) };
  const pitchTotal = Object.values(adjustedPitch).reduce((a, b) => a + b, 0);
  for (const [p, weight] of Object.entries(adjustedPitch)) {
    cumulative += weight / pitchTotal;
    if (pitchRoll < cumulative) { pitch = p as PitchCondition; break; }
  }
  return { weather, pitch };
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
  currentSeason?: number,
  careerDisciplineMod?: number,
  homeBench?: Player[],
  awayBench?: Player[],
  teamTalkModifiers?: { attackMod: number; defenseMod: number; foulMod: number; fitnessDrainMult?: number },
  matchWeather?: MatchWeather,
  setPieceCoachBonus?: number,
): HalfState {
  // An abandoned match is over. Every later segment — second half, extra time,
  // a resumed mid-match save — must be a no-op, or the forfeited scoreline gets
  // played over and the forfeit is undone.
  if (prevState?.abandoned) {
    return {
      ...prevState,
      events: [...prevState.events],
      sentOff: [...prevState.sentOff],
      injured: [...prevState.injured],
      subbedOut: prevState.subbedOut ? [...prevState.subbedOut] : undefined,
      playerEvents: { ...prevState.playerEvents },
      matchInjuries: { ...prevState.matchInjuries },
      homeBench: [...prevState.homeBench],
      awayBench: [...prevState.awayBench],
      homeSubbedIn: [...prevState.homeSubbedIn],
      awaySubbedIn: [...prevState.awaySubbedIn],
      playerFitness: { ...prevState.playerFitness },
      tacticalInsights: [...prevState.tacticalInsights],
      usedCommentaryLines: [...prevState.usedCommentaryLines],
    };
  }

  // Guard against empty squads — return a forfeit-like state (clone refs to avoid mutation)
  if (homePlayers.length === 0 || awayPlayers.length === 0) {
    const forfeitHome = homePlayers.length === 0;
    // simulateMatch calls simulateHalf twice (1-45, then 46-90 with prevState).
    // Only apply the +3 forfeit goals on the FIRST half — otherwise an
    // empty-squad match scores 3 in each half and finishes 6-0 instead of
    // the intended 3-0. The second-half call just carries prevState forward.
    const forfeitGoals = prevState ? 0 : 3;
    return {
      events: [...(prevState?.events ?? [])],
      homeGoals: (prevState?.homeGoals ?? 0) + (forfeitHome ? 0 : forfeitGoals),
      awayGoals: (prevState?.awayGoals ?? 0) + (forfeitHome ? forfeitGoals : 0),
      homeShots: prevState?.homeShots ?? 0,
      awayShots: prevState?.awayShots ?? 0,
      homeSoT: prevState?.homeSoT ?? 0,
      awaySoT: prevState?.awaySoT ?? 0,
      homeFouls: prevState?.homeFouls ?? 0,
      awayFouls: prevState?.awayFouls ?? 0,
      homeCorners: prevState?.homeCorners ?? 0,
      awayCorners: prevState?.awayCorners ?? 0,
      sentOff: [...(prevState?.sentOff ?? [])],
      injured: [...(prevState?.injured ?? [])],
      matchInjuries: { ...(prevState?.matchInjuries ?? {}) },
      momentum: prevState?.momentum ?? 0,
      homeXG: prevState?.homeXG ?? 0,
      awayXG: prevState?.awayXG ?? 0,
      playerEvents: { ...(prevState?.playerEvents ?? {}) },
      homeSubsUsed: prevState?.homeSubsUsed ?? 0,
      awaySubsUsed: prevState?.awaySubsUsed ?? 0,
      homeBench: prevState?.homeBench ? [...prevState.homeBench] : [...(homeBench || [])],
      awayBench: prevState?.awayBench ? [...prevState.awayBench] : [...(awayBench || [])],
      homeSubbedIn: prevState?.homeSubbedIn ? [...prevState.homeSubbedIn] : [],
      awaySubbedIn: prevState?.awaySubbedIn ? [...prevState.awaySubbedIn] : [],
      playerFitness: { ...(prevState?.playerFitness ?? {}) },
      tacticalInsights: [...(prevState?.tacticalInsights ?? [])],
      usedCommentaryLines: prevState?.usedCommentaryLines ? [...prevState.usedCommentaryLines] : [],
    };
  }

  // Derby matches: more events, more fouls, more cards
  const derbyEventMod = derbyIntensity ? derbyIntensity * DERBY_EVENT_MOD_SCALE : 0;
  const derbyFoulMod = derbyIntensity ? derbyIntensity * DERBY_FOUL_MOD_SCALE : 0;
  const derbyCardMod = derbyIntensity ? derbyIntensity * DERBY_CARD_MOD_SCALE : 0;

  // Weather & pitch modifiers
  const weatherMod = matchWeather ? WEATHER_PASSING_MOD[matchWeather.weather] || 0 : 0;
  const weatherPaceMod = matchWeather ? WEATHER_PACE_MOD[matchWeather.weather] || 0 : 0;
  const weatherFoulMod = matchWeather ? WEATHER_FOUL_MOD[matchWeather.weather] || 0 : 0;
  const pitchShotMod = matchWeather ? PITCH_SHOT_MOD[matchWeather.pitch] || 0 : 0;
  const weatherGKErrorMod = matchWeather ? WEATHER_GK_ERROR_MOD[matchWeather.weather] || 0 : 0;

  const _str = computeStrengths(
    homeClub, awayClub, homePlayers, awayPlayers, homeTactics, awayTactics, tacticalFamiliarity, playerClubId, currentSeason,
  );
  let { homeStr, awayStr } = _str;
  const { homeMods, awayMods } = _str;

  // Apply team talk modifiers (second half only — when playerClubId is known).
  // attackMod boosts the player's own strength; defenseMod damps the OPPONENT's
  // strength (mirroring how MENTALITY_DEFENSE_MOD damps attack in
  // computeStrengths, via the same DEFENSE_MODIFIER_SCALE). Previously both
  // multiplied the player's own scalar, so "Calm" was a pure +6% attack buff
  // with zero defensive effect — and "Demand"'s defense penalty helped you.
  let teamTalkFoulMod = 0;
  if (teamTalkModifiers && playerClubId) {
    const { attackMod, defenseMod, foulMod } = teamTalkModifiers;
    if (playerClubId === homeClub.id) {
      homeStr = homeStr * (1 + attackMod);
      awayStr = awayStr * (1 - defenseMod * DEFENSE_MODIFIER_SCALE);
    } else if (playerClubId === awayClub.id) {
      awayStr = awayStr * (1 + attackMod);
      homeStr = homeStr * (1 - defenseMod * DEFENSE_MODIFIER_SCALE);
    }
    teamTalkFoulMod = foulMod;
  }
  // The injury band sits RELATIVE to the end of the foul band: with an
  // absolute threshold, any derby / weather / team-talk foul modifier pushed
  // the foul band past it and non-foul injuries became impossible in exactly
  // those matches.
  const injuryBandWidth = INJURY_BAND_WIDTH;

  // Generate tactical insights for the player's team
  const tacticalInsights: string[] = prevState?.tacticalInsights ? [...prevState.tacticalInsights] : [];
  // Match-local commentary freshness tracking (carried between halves, fresh per match)
  // Rehydrate from array — an old save may have persisted {} from a previous Set, guard with Array check.
  const usedLines: string[] = Array.isArray(prevState?.usedCommentaryLines)
    ? [...prevState!.usedCommentaryLines]
    : [];
  if (!prevState && playerClubId) {
    const playerIsHome = playerClubId === homeClub.id;
    const myTactics = playerIsHome ? homeTactics : awayTactics;
    const oppTactics = playerIsHome ? awayTactics : homeTactics;
    const oppClub = playerIsHome ? awayClub : homeClub;
    if (myTactics && oppTactics) {
      if (myTactics.pressingIntensity >= PRESSING_THRESHOLD && oppTactics.tempo === 'slow')
        tacticalInsights.push(`High press countering ${oppClub.shortName}'s slow tempo (+${Math.round(PRESSING_VS_SLOW_BONUS * 100)}%)`);
      if (myTactics.width === 'wide' && oppTactics.width === 'narrow')
        tacticalInsights.push(`Wide play exploiting ${oppClub.shortName}'s narrow shape (+${Math.round(WIDE_VS_NARROW_BONUS * 100)}%)`);
      if (myTactics.defensiveLine === 'deep' && oppTactics.defensiveLine === 'high')
        tacticalInsights.push(`Deep line nullifying ${oppClub.shortName}'s high line (+${Math.round(DEEP_VS_HIGH_BONUS * 100)}%)`);
      if (myTactics.tempo === 'fast' && (oppTactics.mentality === 'cautious' || oppTactics.mentality === 'defensive'))
        tacticalInsights.push(`Fast tempo breaking down ${oppClub.shortName}'s caution (+${Math.round(FAST_VS_CAUTIOUS_BONUS * 100)}%)`);
    }
    const myFormation = playerIsHome ? homeClub.formation : awayClub.formation;
    const oppFormation = playerIsHome ? awayClub.formation : homeClub.formation;
    const formBonus = getFormationMatchupBonus(myFormation, oppFormation);
    if (Math.abs(formBonus) >= TACTICAL_INSIGHT_MIN_BONUS) {
      tacticalInsights.push(formBonus > 0
        ? `Formation edge: ${myFormation} vs ${oppFormation} (+${Math.round(formBonus * 100)}%)`
        : `Formation mismatch: ${myFormation} vs ${oppFormation} (${Math.round(formBonus * 100)}%)`);
    }
  }

  // Second-half: generate fresh score-aware tactical insights
  if (prevState && playerClubId) {
    const playerIsHome = playerClubId === homeClub.id;
    const myGoals = playerIsHome ? prevState.homeGoals : prevState.awayGoals;
    const oppGoals = playerIsHome ? prevState.awayGoals : prevState.homeGoals;
    const oppClub = playerIsHome ? awayClub : homeClub;
    const oppTactics = playerIsHome ? awayTactics : homeTactics;

    // Clear first-half insights and generate fresh ones
    tacticalInsights.length = 0;

    if (oppGoals > myGoals) {
      if (oppTactics?.defensiveLine === 'deep')
        tacticalInsights.push(`${oppClub.shortName} sitting deep — consider wide play to stretch them`);
      else
        tacticalInsights.push(`Trailing by ${oppGoals - myGoals} — pushing forward could create chances`);
    } else if (myGoals > oppGoals) {
      tacticalInsights.push(`Leading — ${oppClub.shortName} may push forward, watch for counters`);
    } else {
      tacticalInsights.push(`Level at half-time — tactical balance is key`);
    }

    // Re-evaluate formation matchup
    const myFormation = playerIsHome ? homeClub.formation : awayClub.formation;
    const oppFormation = playerIsHome ? awayClub.formation : homeClub.formation;
    const formBonus = getFormationMatchupBonus(myFormation, oppFormation);
    if (Math.abs(formBonus) >= TACTICAL_INSIGHT_MIN_BONUS) {
      tacticalInsights.push(formBonus > 0
        ? `Formation edge: ${myFormation} vs ${oppFormation} (+${Math.round(formBonus * 100)}%)`
        : `Formation mismatch: ${myFormation} vs ${oppFormation} (${Math.round(formBonus * 100)}%)`);
    }
  }

  // Defensive quality is mutable for the same reason GK save chance is: it must
  // track the players actually on the pitch. It used to be computed ONCE from
  // the starting XI and read for all 90 minutes, so losing your best centre-back
  // to a red card or an injury did not raise your concession rate at all —
  // strength and GK save were refreshed on those events, defence was not.
  // Refreshed by refreshDefenceMetrics() alongside every strength recompute.
  let homeDefQuality = getDefenseQuality(homePlayers);
  let awayDefQuality = getDefenseQuality(awayPlayers);
  // GK save chance is mutable: it must track the ACTIVE keeper, so it gets
  // refreshed (via refreshGKChances below) whenever availability changes —
  // a sent-off/injured GK previously kept "saving" at full quality all match.
  let homeGKSave = getGKSaveChance(homePlayers);
  let awayGKSave = getGKSaveChance(awayPlayers);
  // Pre-compute per-keeper error chance (scaled by GK quality + weather).
  // Recomputed only when the keeper changes, so it stays out of the
  // per-minute loop.
  const computeGKErrorChance = (gkSave: number): number => {
    const norm = Math.max(0, Math.min(1, (gkSave - GK_SAVE_BASE) / GK_SAVE_RANGE));
    const qualityMod = 1 - norm * GK_ERROR_QUALITY_REDUCTION;
    return Math.min(GK_ERROR_BASE_CHANCE * qualityMod + weatherGKErrorMod, GK_ERROR_MAX_CHANCE);
  };
  let homeGKErrorChance = computeGKErrorChance(homeGKSave);
  let awayGKErrorChance = computeGKErrorChance(awayGKSave);

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
  // In-memory Sets for fast membership checks. The persisted HalfState shape
  // uses plain string[] (see fields `sentOff` / `injured` on HalfState) —
  // these locals are suffixed `Set` to keep that distinction obvious on the
  // return site where we call `Array.from(...)` back into the array shape.
  const sentOffSet = new Set<string>(prevState?.sentOff ?? []);
  const injuredSet = new Set<string>(prevState?.injured ?? []);
  const subbedOutSet = new Set<string>(prevState?.subbedOut ?? []);
  const unavailable = new Set<string>([...sentOffSet, ...injuredSet, ...subbedOutSet]);

  // Match injuries: track generated InjuryDetails per player
  const matchInjuries: Record<string, InjuryDetails> = prevState?.matchInjuries ? { ...prevState.matchInjuries } : {};

  // AI substitution tracking: bench pools and sub counts carry between halves
  let homeSubsUsed = prevState?.homeSubsUsed ?? 0;
  let awaySubsUsed = prevState?.awaySubsUsed ?? 0;
  // Build bench pools: from prevState (carries Player objects between halves), or from params on first half
  const homeBenchPool: Player[] = prevState?.homeBench
    ? [...prevState.homeBench]
    : [...(homeBench || [])];
  const awayBenchPool: Player[] = prevState?.awayBench
    ? [...prevState.awayBench]
    : [...(awayBench || [])];
  // Track which players are active on the pitch (starters + subbed in, minus unavailable)
  const homeActive = new Set(homePlayers.map(p => p.id));
  const awayActive = new Set(awayPlayers.map(p => p.id));
  // Track subbed-in players separately to avoid mutating the original starter arrays
  // Carry forward from previous half if continuing
  const homeSubbedIn: Player[] = prevState?.homeSubbedIn ? [...prevState.homeSubbedIn] : [];
  const awaySubbedIn: Player[] = prevState?.awaySubbedIn ? [...prevState.awaySubbedIn] : [];
  // Momentum: positive favours home, negative favours away. Carried between halves.
  let momentum = prevState?.momentum ?? 0;
  // xG accumulators
  let homeXG = prevState?.homeXG ?? 0;
  let awayXG = prevState?.awayXG ?? 0;

  // Carry forward player events and add any new players (subs)
  const playerEvents: Record<string, { goals: number; assists: number; yellows: number; redCard: boolean; saves: number; cleanSheet: boolean; goalsAtEntry?: number }> = prevState ? { ...prevState.playerEvents } : {};
  // allMatchPlayers = starters (not including carried-over subs — those already have playerEvents from prevState)
  const allMatchPlayers = [...homePlayers, ...awayPlayers];
  allMatchPlayers.forEach(p => {
    if (!playerEvents[p.id]) {
      const isHomeSide = homePlayers.some(hp => hp.id === p.id);
      const goalsAgainst = isHomeSide ? awayGoals : homeGoals;
      playerEvents[p.id] = { goals: 0, assists: 0, yellows: 0, redCard: false, saves: 0, cleanSheet: true, goalsAtEntry: p.position === 'GK' ? goalsAgainst : undefined };
    }
  });

  // Track in-match fitness for each player (starters + any carried-over subs)
  const matchFitness: Record<string, number> = prevState?.playerFitness ? { ...prevState.playerFitness } : {};
  allMatchPlayers.forEach(p => { if (matchFitness[p.id] === undefined) matchFitness[p.id] = p.fitness; });
  homeSubbedIn.forEach(p => { if (matchFitness[p.id] === undefined) matchFitness[p.id] = p.fitness; });
  awaySubbedIn.forEach(p => { if (matchFitness[p.id] === undefined) matchFitness[p.id] = p.fitness; });
  // Fitness snapshot to attach to the next event
  let fitnessSnapshot: Record<string, number> | undefined;

  // Helper: get available players for a side (starters + subs - unavailable)
  const homeAvail = () => [...homePlayers, ...homeSubbedIn].filter(p => !unavailable.has(p.id));
  const awayAvail = () => [...awayPlayers, ...awaySubbedIn].filter(p => !unavailable.has(p.id));

  // Refresh GK save/error chances from the available pools — called whenever
  // availability changes (red card, injury, sub) so the chances follow the
  // keeper actually on the pitch (a subbed-on backup GK, or no GK at all —
  // getGKSaveChance degrades to GK_SAVE_BASE when the pool has no keeper).
  // …and the same for defensive quality, which the per-shot goal chance reads.
  const refreshDefenceMetrics = () => {
    homeGKSave = getGKSaveChance(homeAvail());
    awayGKSave = getGKSaveChance(awayAvail());
    homeGKErrorChance = computeGKErrorChance(homeGKSave);
    awayGKErrorChance = computeGKErrorChance(awayGKSave);
    homeDefQuality = getDefenseQuality(homeAvail());
    awayDefQuality = getDefenseQuality(awayAvail());
  };

  // The tactics CURRENTLY in effect. The AI's mid-match reactivity (minutes 60
  // and 75) replaces these, so every later strength recompute has to read them
  // rather than the values this half started with — otherwise a red card, an
  // injury or a substitution silently reverted the opposing manager's tactical
  // change back to his kickoff setup for the rest of the match.
  let currentHomeTactics = homeTactics;
  let currentAwayTactics = awayTactics;

  /**
   * Re-apply the team-talk multipliers to a freshly computed strength pair.
   *
   * The talk is folded into homeStr/awayStr as a MULTIPLIER, so any bare
   * `computeStrengths` assignment discards it. That is exactly what used to
   * happen: ten separate recompute sites (AI reactivity at 60/75, both red-card
   * branches, both injury branches, all four substitution branches) overwrote
   * homeStr/awayStr without re-applying it. AI reactivity fires in effectively
   * every match, so the player's half-time team talk survived about fourteen
   * minutes of the second half and then vanished — on the one mechanic where
   * the player has direct in-match agency.
   *
   * Mirrors the kickoff application above: attackMod lifts your own strength,
   * defenseMod damps the OPPONENT's (via DEFENSE_MODIFIER_SCALE).
   */
  const withTeamTalk = (s: { homeStr: number; awayStr: number }): { homeStr: number; awayStr: number } => {
    if (!teamTalkModifiers || !playerClubId) return s;
    const { attackMod, defenseMod } = teamTalkModifiers;
    if (playerClubId === homeClub.id) {
      return {
        homeStr: s.homeStr * (1 + attackMod),
        awayStr: s.awayStr * (1 - defenseMod * DEFENSE_MODIFIER_SCALE),
      };
    }
    if (playerClubId === awayClub.id) {
      return {
        homeStr: s.homeStr * (1 - defenseMod * DEFENSE_MODIFIER_SCALE),
        awayStr: s.awayStr * (1 + attackMod),
      };
    }
    return s;
  };

  /** Recompute both sides' strength from the players currently available and
   *  the tactics currently in effect, preserving the team talk. EVERY
   *  mid-match strength recompute must go through here. */
  const recomputeStrengths = () => {
    const s = withTeamTalk(computeStrengths(
      homeClub, awayClub, homeAvail(), awayAvail(),
      currentHomeTactics, currentAwayTactics,
      tacticalFamiliarity, playerClubId, currentSeason,
    ));
    homeStr = s.homeStr;
    awayStr = s.awayStr;
  };

  // Carry numerical disadvantage across half/extra-time boundaries. The
  // initial strength computation above used the full passed lineups — the
  // store lineup is never edited on a send-off, so a team reduced to 10 in
  // the first half silently regained full strength here.
  if (prevState && unavailable.size > 0) {
    recomputeStrengths();
    refreshDefenceMetrics();
  }

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
    (name: string, club: string) => `GOAL! ${name} restores parity for ${club}! We're all square!`,
    (name: string, club: string) => `GOAL! ${name} hauls ${club} back into it! That changes everything!`,
  ];
  const goAheadDescs = [
    (name: string, club: string) => `GOAL! ${name} gives ${club} the lead!`,
    (name: string, club: string) => `GOAL! ${name} puts ${club} ahead! The crowd erupts!`,
    (name: string, club: string) => `GOAL! ${name} breaks the deadlock for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} edges ${club} in front! Crucial strike!`,
    (name: string, club: string) => `GOAL! ${name} finds the breakthrough for ${club}! They've been knocking on the door!`,
  ];
  const comebackDescs = [
    (name: string, club: string) => `GOAL! ${name} pulls one back for ${club}! Can they complete the comeback?`,
    (name: string, club: string) => `GOAL! ${name} gives ${club} hope! They're back in this!`,
    (name: string, club: string) => `GOAL! ${name} reduces the deficit for ${club}! What a response!`,
    (name: string, club: string) => `GOAL! ${name} sparks the fightback for ${club}! Don't write them off yet!`,
    (name: string, club: string) => `GOAL! ${name} drags ${club} back into the contest! Game on!`,
  ];
  const lateDramaDescs = [
    (name: string, club: string) => `GOAL! Late drama! ${name} scores for ${club} in the dying minutes!`,
    (name: string, club: string) => `GOAL! Incredible scenes! ${name} finds the net for ${club} right at the death!`,
    (name: string, club: string) => `GOAL! Last-gasp goal from ${name}! ${club} score when it matters most!`,
    (name: string, club: string) => `GOAL! Stoppage time heroics from ${name}! ${club} have snatched it late!`,
    (name: string, club: string) => `GOAL! You couldn't write the script! ${name} scores for ${club} in the final seconds!`,
  ];

  const lateDramaAtmosphere = [
    () => `The tension is unbearable! Every tackle is met with a roar from the crowd!`,
    () => `Players are giving everything in these final minutes. You can feel the desperation!`,
    () => `The fourth official holds up the board — hearts are racing in the stands!`,
    () => `Nerves jangling now! One moment of quality could decide this match!`,
    () => `The clock is ticking down. Neither side wants to make a mistake here!`,
    () => `Frantic scenes! The ball is ping-ponging around the box!`,
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
  const secondYellowDescs = [
    (name: string) => `Second yellow! ${name} is sent off! A foolish challenge.`,
    (name: string) => `That's a second booking for ${name}! Off you go! He leaves his team with 10 men.`,
    (name: string) => `${name} can't believe it — second yellow and he's off! A reckless tackle.`,
  ];
  const straightRedDescs = [
    (name: string) => `RED CARD! ${name} is sent off for violent conduct! A two-footed lunge!`,
    (name: string) => `RED CARD! ${name} denies a clear goal-scoring opportunity! Last man, had to go!`,
    (name: string) => `RED CARD! Straight red for ${name}! Serious foul play — no arguments there.`,
    (name: string) => `RED CARD! ${name} sees red for an elbow off the ball! The ref had no choice.`,
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
  // New event type descriptions
  const freeKickGoalDescs = [
    (name: string, club: string) => `FREE KICK GOAL! ${name} curls it into the top corner for ${club}! What a strike!`,
    (name: string, club: string) => `FREE KICK GOAL! ${name} bends it over the wall and into the net! ${club} score!`,
    (name: string, _club: string) => `FREE KICK GOAL! A stunning set piece from ${name}! The keeper had no chance!`,
    (name: string, club: string) => `FREE KICK GOAL! ${name} whips it into the bottom corner! ${club} celebrating a brilliant dead ball!`,
    (name: string, _club: string) => `FREE KICK GOAL! ${name} steps up and delivers! Inch-perfect placement past the wall!`,
  ];
  const longRangeGoalDescs = [
    (name: string, club: string) => `GOAL! What a hit from ${name}! A thunderbolt from 30 yards for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} tries his luck from distance and it flies in! Spectacular for ${club}!`,
    (name: string, _club: string) => `GOAL! ${name} unleashes a rocket from outside the box! The keeper was rooted!`,
    (name: string, club: string) => `GOAL! An absolute screamer from ${name}! Top bins from 25 yards! ${club} in dreamland!`,
    (name: string, _club: string) => `GOAL! ${name} lets fly from range and the ball swerves into the far corner! Unstoppable!`,
  ];
  const counterAttackGoalDescs = [
    (name: string, club: string) => `GOAL! ${name} finishes a devastating counter attack for ${club}!`,
    (name: string, club: string) => `GOAL! Rapid break from ${club} and ${name} slots it home on the counter!`,
    (name: string, _club: string) => `GOAL! Catch them on the break! ${name} races clear and finishes coolly!`,
    (name: string, club: string) => `GOAL! Textbook counter from ${club}! ${name} completes the move with a calm finish!`,
    (name: string, _club: string) => `GOAL! Lightning on the break! ${name} was too quick for the backtracking defence!`,
  ];
  const headerGoalDescs = [
    (name: string, club: string) => `GOAL! A towering header from ${name}! ${club} score from open play!`,
    (name: string, _club: string) => `GOAL! ${name} rises above the defence and powers a header into the net!`,
    (name: string, club: string) => `GOAL! ${name} heads home for ${club}! Perfect connection!`,
    (name: string, _club: string) => `GOAL! ${name} wins the aerial duel and glances a header into the far corner! Wonderful technique!`,
    (name: string, club: string) => `GOAL! ${name} meets the cross with a thumping header! ${club} on the scoresheet!`,
  ];
  const soloGoalDescs = [
    (name: string, club: string) => `GOAL! Incredible solo run from ${name}! Beats two defenders and finishes brilliantly for ${club}!`,
    (name: string, _club: string) => `GOAL! ${name} dances past the defence with silky footwork and slots it home! Pure skill!`,
    (name: string, club: string) => `GOAL! ${name} picks up the ball, dribbles past three players and scores! What a goal for ${club}!`,
    (name: string, _club: string) => `GOAL! Unstoppable ${name}! A mazy dribble leaves the defence in tatters!`,
    (name: string, club: string) => `GOAL! Individual brilliance from ${name}! ${club} score a wonder goal!`,
  ];
  const gkErrorDescs = [
    (name: string, gk: string, club: string) => `GOAL! Goalkeeper error from ${gk}! ${name} pounces on the mistake for ${club}!`,
    (name: string, gk: string, _club: string) => `GOAL! ${gk} fumbles and ${name} taps into the empty net! What a howler!`,
    (name: string, gk: string, _club: string) => `GOAL! Terrible handling from ${gk}! ${name} capitalises ruthlessly!`,
  ];
  const varCheckDescs = [
    (club: string) => `VAR CHECK — The referee is reviewing the goal for ${club}... GOAL STANDS!`,
    (_club: string) => `VAR CHECK — A long delay while the officials check for offside... Play on! The goal is given!`,
    (_club: string) => `VAR CHECK — Was there a foul in the build-up? The screen shows... no foul. Goal confirmed!`,
  ];
  const varDisallowDescs = [
    (scorer: string) => `VAR CHECK — NO GOAL! ${scorer}'s effort is ruled out for offside. Agonising!`,
    (scorer: string) => `VAR CHECK — DISALLOWED! A handball in the build-up means ${scorer}'s goal won't stand!`,
    (scorer: string) => `VAR CHECK — OVERTURNED! The referee rules a foul in the build-up. ${scorer} can't believe it!`,
  ];
  const woodworkDescs = [
    (name: string) => `${name}'s strike crashes off the crossbar! So close!`,
    (name: string) => `Off the post! ${name} is inches away from scoring!`,
    (name: string) => `${name} rattles the woodwork! The ground shakes with that effort!`,
    (name: string) => `Agonizingly close! ${name} hits the inside of the post and it bounces out!`,
    (name: string) => `What a strike from ${name}! It cannons back off the bar!`,
  ];
  const goalLineClearanceDescs = [
    (shooter: string, defender: string) => `${shooter}'s shot is headed off the line by ${defender}! Incredible last-ditch defending!`,
    (shooter: string, defender: string) => `${defender} clears off the line! ${shooter} can't believe it — it was going in!`,
    (shooter: string, defender: string) => `Heroic clearance from ${defender}! ${shooter} was denied a certain goal!`,
  ];
  const cornerGoalDescs = [
    (name: string, club: string) => `GOAL! ${name} heads in from the corner for ${club}!`,
    (name: string, club: string) => `GOAL! ${name} rises highest from the corner! ${club} score!`,
    (name: string, _club: string) => `GOAL! A towering header from ${name} after the corner!`,
    (name: string, club: string) => `GOAL! ${name} meets the cross at the back post! ${club} score from the set piece!`,
    (name: string, _club: string) => `GOAL! Bullet header from ${name}! Nobody was going to stop that!`,
  ];

  // ── Build-up commentary that precedes goals ──
  // Generic build-up (open play, no special flavor)
  const buildUpGenericDescs = [
    (club: string) => `${club} working it patiently in the final third...`,
    (club: string) => `${club} strung together a lovely move there...`,
    (club: string) => `${club} carve their way into the box...`,
    (club: string) => `Quick one-twos from ${club} on the edge of the area...`,
    (club: string) => `${club} switch the play and catch the defence flat...`,
    (club: string) => `Slick passing from ${club} prises the defence open...`,
    (_club: string) => `A clever flick releases the runner in behind...`,
    (_club: string) => `The ball is worked across the box, defenders scrambling...`,
    (club: string) => `${club} pin them back and keep probing...`,
    (_club: string) => `A neat through ball splits the back line...`,
  ];
  // Counter-attack build-up
  const buildUpCounterDescs = [
    (club: string) => `${club} win it back and break with pace! Three-on-two...`,
    (club: string) => `Turnover! ${club} are away on the counter...`,
    (_club: string) => `Lightning transition — the defence is caught miles upfield...`,
    (club: string) => `${club} spring forward at speed, acres of space ahead...`,
    (_club: string) => `One pass takes out four defenders on the break...`,
  ];
  // Long-range build-up
  const buildUpLongRangeDescs = [
    (_club: string) => `He picks it up 25 yards out, defenders backing off...`,
    (_club: string) => `Space opens up on the edge of the D, he takes a touch...`,
    (_club: string) => `The ball is laid back to the edge of the box, he lines it up...`,
    (_club: string) => `Defenders dropping deep, daring him to shoot from range...`,
  ];
  // Header / cross build-up
  const buildUpHeaderDescs = [
    (club: string) => `${club} get to the byline, the cross is whipped in...`,
    (_club: string) => `Beautiful ball to the back post, defenders ball-watching...`,
    (_club: string) => `The wide man swings it in, attackers swarming the box...`,
    (club: string) => `${club} overload the box, the cross is in the air...`,
  ];
  // Solo / dribble build-up
  const buildUpSoloDescs = [
    (_club: string) => `He picks the ball up in midfield and drives at the defence...`,
    (_club: string) => `Drop of the shoulder, he's past one... past two...`,
    (_club: string) => `A jinking run carries him into the box, defenders backing off...`,
    (_club: string) => `He goes it alone, weaving through challenges...`,
  ];
  // Free-kick build-up
  const buildUpFreeKickDescs = [
    (_club: string) => `Free kick in a dangerous area. The wall lines up...`,
    (_club: string) => `Promising free kick on the edge of the box. Specialist standing over it...`,
    (_club: string) => `Dead ball about 22 yards out — perfect range for a strike...`,
  ];
  // Corner build-up (used for set-piece header goals)
  const buildUpCornerDescs = [
    (club: string) => `Corner for ${club}. Tall men loading the box...`,
    (_club: string) => `The corner is being measured up. Bodies jostling in the area...`,
    (club: string) => `${club} send everyone forward for this corner...`,
  ];
  // GK-error build-up
  const buildUpGKErrorDescs = [
    (_club: string) => `Hopeful ball into the box — and the keeper goes to claim it...`,
    (_club: string) => `A speculative cross causes panic in the six-yard area...`,
    (_club: string) => `The shot is straight at the keeper, but he can't hold on to it...`,
  ];

  /** Pick a build-up commentary line based on the goal flavor. */
  const pickBuildUp = (
    flavor: 'generic' | 'counter' | 'long_range' | 'header' | 'solo' | 'free_kick' | 'corner' | 'gk_error',
    clubShortName: string,
  ): string => {
    let descs: ((club: string) => string)[];
    switch (flavor) {
      case 'counter': descs = buildUpCounterDescs; break;
      case 'long_range': descs = buildUpLongRangeDescs; break;
      case 'header': descs = buildUpHeaderDescs; break;
      case 'solo': descs = buildUpSoloDescs; break;
      case 'free_kick': descs = buildUpFreeKickDescs; break;
      case 'corner': descs = buildUpCornerDescs; break;
      case 'gk_error': descs = buildUpGKErrorDescs; break;
      default: descs = buildUpGenericDescs;
    }
    return pick(descs)(clubShortName);
  };

  // ── Substitution commentary ──
  // Forced (injury) subs MUST contain "injured" — the live commentary row
  // detects forced subs by scanning the description for that word.
  const forcedSubDescs = [
    (inName: string, outName: string, _club: string) => `${inName} comes on for the injured ${outName}.`,
    (inName: string, outName: string, club: string) => `Forced change for ${club} — ${inName} replaces the injured ${outName}.`,
    (inName: string, outName: string, _club: string) => `${outName} can't continue. The injured man is replaced by ${inName}.`,
    (inName: string, outName: string, _club: string) => `Reluctant change — ${inName} on for the injured ${outName}.`,
  ];
  // Tactical / planned subs — varied templates, with optional flavour mentioning the bench, manager, or scoreboard pressure.
  const tacticalSubDescs = [
    (inName: string, outName: string, _club: string) => `${inName} comes on for ${outName}.`,
    (inName: string, outName: string, club: string) => `Change for ${club} — ${outName} off, ${inName} on.`,
    (inName: string, outName: string, _club: string) => `${outName} makes way for ${inName}. Fresh legs from the bench.`,
    (inName: string, outName: string, club: string) => `${club} go to the bench: ${inName} replaces ${outName}.`,
    (inName: string, outName: string, _club: string) => `Tactical switch — ${inName} replaces ${outName}.`,
    (inName: string, outName: string, _club: string) => `${inName} is on, ${outName} trudges off to applause.`,
    (inName: string, outName: string, club: string) => `${club}'s manager rolls the dice — ${inName} for ${outName}.`,
    (inName: string, outName: string, _club: string) => `Off comes ${outName}, on goes ${inName}.`,
    (inName: string, outName: string, club: string) => `${club} ring the changes — ${inName} replaces ${outName}.`,
    (inName: string, outName: string, _club: string) => `${inName} is brought on for ${outName}. The manager wants something different.`,
  ];
  /** Build a substitution description. Forced subs always include "injured" so the UI can flag them. */
  const pickSubDesc = (inName: string, outName: string, clubShortName: string, isForced: boolean): string => {
    const pool = isForced ? forcedSubDescs : tacticalSubDescs;
    return pick(pool)(inName, outName, clubShortName);
  };


  const rainSuffixes = [
    ' The wet conditions playing their part.',
    ' Treacherous underfoot in this rain.',
    ' The ball skidding on the slick surface.',
  ];
  const snowSuffixes = [
    ' The snow making life difficult out there.',
    ' Tough to keep your footing in these conditions.',
    ' Visibility poor in this blizzard.',
  ];
  const windSuffixes = [
    ' The wind a factor in that one.',
    ' A gust of wind taking the ball off course.',
  ];
  const poorPitchSuffixes = [
    ' The ball bobbling on this uneven surface.',
    ' This pitch is cutting up badly.',
    ' The surface not doing anyone any favours.',
  ];
  const waterloggedSuffixes = [
    ' The ball holding up in the standing water.',
    ' Splashing through puddles on this waterlogged pitch.',
    ' The sodden pitch making it almost impossible to play.',
  ];

  // ── Derby Event Suffixes ──
  const derbySuffixes = [
    ' The derby atmosphere turning up the intensity!',
    ' Passions running high in this one!',
    ' The fans are on their feet — this is what it\'s all about!',
  ];
  const derbyIntenseSuffixes = [
    ' Absolute pandemonium! This rivalry never disappoints!',
    ' The noise in this ground is deafening!',
    ' You can cut the tension with a knife!',
  ];

  /** Returns a weather-related suffix or empty string based on current conditions */
  const maybeWeatherSuffix = (): string => {
    if (!matchWeather || matchWeather.weather === 'clear') return '';
    if (Math.random() >= WEATHER_SUFFIX_CHANCE) return '';
    const w = matchWeather.weather;
    if (w === 'rain') return pick(rainSuffixes);
    if (w === 'snow') return pick(snowSuffixes);
    if (w === 'wind') return pick(windSuffixes);
    return '';
  };

  /** Returns a pitch-related suffix or empty string for poor/waterlogged pitches */
  const maybePitchSuffix = (): string => {
    if (!matchWeather) return '';
    if (matchWeather.pitch === 'poor' && Math.random() < WEATHER_SUFFIX_CHANCE) return pick(poorPitchSuffixes);
    if (matchWeather.pitch === 'waterlogged' && Math.random() < WEATHER_SUFFIX_CHANCE) return pick(waterloggedSuffixes);
    return '';
  };

  /** Returns a derby-related suffix or empty string based on rivalry intensity */
  const maybeDerbySuffix = (): string => {
    if (!derbyIntensity || derbyIntensity <= 0) return '';
    if (Math.random() >= DERBY_SUFFIX_CHANCE) return '';
    if (derbyIntensity === 3 && Math.random() < 0.5) return pick(derbyIntenseSuffixes);
    return pick(derbySuffixes);
  };

  /** Append contextual suffixes to an event description (weather OR derby, not both) */
  const withContextSuffix = (desc: string): string => {
    const weatherSuffix = maybeWeatherSuffix() || maybePitchSuffix();
    if (weatherSuffix) return desc + weatherSuffix;
    const derby = maybeDerbySuffix();
    if (derby) return desc + derby;
    return desc;
  };

  // Prepare deferred kickoff commentary (injected inside the minute loop at the correct minutes)
  let deferredWeatherDesc: string | null = null;
  let deferredDerbyDesc: string | null = null;
  let deferredTacticalDesc: string | null = null;
  let deferredTacticalClubId: string | null = null;

  if (startMin === 1) {
    events.push({ minute: 0, type: 'kickoff', clubId: homeClub.id, description: 'Kick off!', tacticalInsight: tacticalInsights.length > 0 ? tacticalInsights[0] : undefined });

    // Weather kickoff — deferred to minute 1
    if (matchWeather && matchWeather.weather !== 'clear') {
      const weatherKickoffDescs: Record<string, string> = {
        rain: 'Heavy rain falling as we get underway. Conditions will test both sides today.',
        snow: 'Snow swirling around the stadium. This could be a classic winter battle.',
        wind: 'A blustery day — the wind will be a factor for both sides.',
      };
      deferredWeatherDesc = weatherKickoffDescs[matchWeather.weather] ?? null;
    }

    // Derby kickoff — deferred to minute 2
    if (derbyIntensity && derbyIntensity > 0) {
      const derbyName = getDerbyName(homeClub.id, awayClub.id);
      deferredDerbyDesc = derbyIntensity >= 3
        ? (derbyName ? `The atmosphere is absolutely electric for the ${derbyName}!` : 'The atmosphere is absolutely electric! This is what football is all about!')
        : derbyIntensity === 2
          ? (derbyName ? `The atmosphere is building nicely for the ${derbyName}.` : 'The atmosphere is building nicely for this rivalry match.')
          : (derbyName ? `A bit of extra spice today — it's the ${derbyName}.` : 'A local rivalry adds a bit of extra spice today.');
    }

    // Tactical counter-play — deferred to minute 5
    const homeMatchup = getTacticalMatchupBonus(homeTactics, awayTactics);
    const awayMatchup = getTacticalMatchupBonus(awayTactics, homeTactics);
    if (homeMatchup > 0 || awayMatchup > 0) {
      const advantage = homeMatchup > awayMatchup ? 'home' : 'away';
      const advClub = advantage === 'home' ? homeClub : awayClub;
      const myT = advantage === 'home' ? homeTactics : awayTactics;
      const oppT = advantage === 'home' ? awayTactics : homeTactics;
      deferredTacticalDesc = `${advClub.shortName} seem to have the tactical edge early on.`;
      deferredTacticalClubId = advClub.id;
      if (myT && oppT) {
        if (myT.pressingIntensity >= PRESSING_THRESHOLD && oppT.tempo === 'slow')
          deferredTacticalDesc = `${advClub.shortName}'s high press is disrupting their opponent's slow build-up play.`;
        else if (myT.width === 'wide' && oppT.width === 'narrow')
          deferredTacticalDesc = `${advClub.shortName}'s wide play is stretching the narrow defensive shape.`;
        else if (myT.defensiveLine === 'deep' && oppT.defensiveLine === 'high')
          deferredTacticalDesc = `${advClub.shortName} are sitting deep and exploiting the space behind the high line.`;
        else if (myT.tempo === 'fast' && (oppT.mentality === 'cautious' || oppT.mentality === 'defensive'))
          deferredTacticalDesc = `${advClub.shortName}'s fast tempo is overwhelming the cautious approach.`;
      }
    }
  }

  // Emit second-half kickoff with tactical insight if available
  if (prevState && tacticalInsights.length > 0) {
    events.push({ minute: startMin, type: 'kickoff', clubId: homeClub.id, description: 'Second half underway!', tacticalInsight: tacticalInsights[0] });
  }

  // Second-half weather reminder — brief reinforcement of conditions
  if (prevState && startMin === 46 && matchWeather && matchWeather.weather !== 'clear') {
    const weatherReminders: Record<string, string> = {
      rain: `The rain hasn't let up. Conditions remain difficult for both sides.`,
      snow: `Still snowing heavily. The pitch is getting worse by the minute.`,
      wind: `The teams have switched ends — the wind now behind ${awayClub.shortName}.`,
    };
    const reminder = weatherReminders[matchWeather.weather];
    if (reminder) {
      events.push({ minute: 46, type: 'commentary', clubId: homeClub.id, description: reminder, momentum: prevState.momentum });
    }
  }

  let lastEventMinute = startMin;
  let lateDramaFired = false;

  // Calculate stoppage time for this half
  const isFirstHalf = startMin <= 45 && endMin <= 50;
  const nominalEnd = isFirstHalf ? 45 : 90;
  let stoppageTime = 0;

  const MAX_MATCH_MINUTES = 150; // Safety cap to prevent infinite loops
  // Seeded from the carried state so a resumed segment of an already-abandoned
  // match cannot restart play (the early return above normally catches this;
  // this keeps the local honest if the guard is ever relaxed).
  let abandonMatch = prevState?.abandoned ?? false;
  // Helper: check if a team has fallen below minimum viable size (FIFA Law 3)
  const checkAbandon = (minute: number): boolean => {
    const homeAvailCount = homeAvail().length;
    const awayAvailCount = awayAvail().length;
    if (homeAvailCount < MIN_PLAYERS_TO_CONTINUE || awayAvailCount < MIN_PLAYERS_TO_CONTINUE) {
      const side = homeAvailCount < MIN_PLAYERS_TO_CONTINUE ? 'home' : 'away';
      events.push({ minute, type: 'commentary', clubId: side === 'home' ? homeClub.id : awayClub.id, description: `Match abandoned — ${side === 'home' ? homeClub.shortName : awayClub.shortName} reduced below ${MIN_PLAYERS_TO_CONTINUE} players.` });
      // FIFA Law 3 forfeit: the team reduced below the minimum loses the
      // match. The opponent is awarded at least a 3-0 win (or keeps the
      // actual scoreline if they were already winning by more). The
      // offending side's own goals are forfeited to 0.
      if (side === 'home') { homeGoals = 0; awayGoals = Math.max(awayGoals, 3); }
      else { awayGoals = 0; homeGoals = Math.max(homeGoals, 3); }
      // The forfeited goals no longer exist — strip the forfeiting side's
      // goal events and zero its players' goal/assist tallies, so scorers
      // don't bank season stats for goals erased from the final score.
      // (Goal-typed events always carry the BENEFITING club's id, including
      // own goals, so a clubId match is the correct filter.)
      const forfeitClubId = side === 'home' ? homeClub.id : awayClub.id;
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (ev.clubId === forfeitClubId && (GOAL_SCORING_TYPES as readonly string[]).includes(ev.type)) {
          events.splice(i, 1);
        }
      }
      const forfeitSidePlayers = side === 'home'
        ? [...homePlayers, ...homeSubbedIn]
        : [...awayPlayers, ...awaySubbedIn];
      for (const p of forfeitSidePlayers) {
        const pe = playerEvents[p.id];
        if (pe) { pe.goals = 0; pe.assists = 0; }
      }
      abandonMatch = true;
      return true;
    }
    return false;
  };
  for (let min = startMin; min <= endMin + stoppageTime && min < MAX_MATCH_MINUTES; min++) {
    const prevEventCount = events.length;
    if (abandonMatch) break;

    // Inject deferred kickoff commentary at the correct simulation minutes
    if (min === 1 && deferredWeatherDesc) {
      events.push({ minute: 1, type: 'commentary', clubId: homeClub.id, description: deferredWeatherDesc, momentum });
      lastEventMinute = 1;
      deferredWeatherDesc = null;
    }
    if (min === 2 && deferredDerbyDesc) {
      events.push({ minute: 2, type: 'commentary', clubId: homeClub.id, description: deferredDerbyDesc, momentum });
      lastEventMinute = 2;
      deferredDerbyDesc = null;
    }
    if (min === 5 && deferredTacticalDesc && deferredTacticalClubId) {
      events.push({ minute: 5, type: 'commentary', clubId: deferredTacticalClubId, description: deferredTacticalDesc });
      lastEventMinute = 5;
      deferredTacticalDesc = null;
    }

    // Calculate stoppage at the nominal end of each half. The announcement is
    // a dedicated 'added_time' event — it was previously typed 'half_time',
    // which suppressed the real Half Time divider (the some() check below)
    // and rendered a "HALF TIME" pill at minute 90 in the second half.
    if (min === nominalEnd && stoppageTime === 0) {
      stoppageTime = calcStoppageTime(events, startMin, nominalEnd);
      if (stoppageTime > 0) {
        events.push({ minute: nominalEnd, type: 'added_time', clubId: '', description: `+${stoppageTime} minutes added time` });
      }
    }

    // AI mid-match tactical reactivity at key minutes (60, 75). Gated on
    // "not the player's club": every call site passes initial tactics for
    // both sides (AI counter-tactics included), so the old `!homeTactics`
    // gate could never fire and reactive AI was dead on every path.
    if (AI_REACTIVITY_MINUTES.includes(min as 60 | 75)) {
      if (homeClub.id !== playerClubId && homeClub.aiManagerProfile) {
        const oldMentality = homeClub.aiManagerProfile.defaultTactics.mentality;
        const newHomeTactics = getAIReactiveTactics(homeClub.aiManagerProfile, true, homeGoals, awayGoals, min);
        if (newHomeTactics.mentality !== oldMentality) {
          events.push({ minute: min, type: 'ai_tactical_change', clubId: homeClub.id, description: `${homeClub.shortName} manager switches to ${newHomeTactics.mentality} mentality.`, momentum });
        }
        // Latch the new tactics so every LATER recompute this match keeps them
        // (a red card at 70' used to revert this change).
        currentHomeTactics = newHomeTactics;
        recomputeStrengths();
      }
      if (awayClub.id !== playerClubId && awayClub.aiManagerProfile) {
        const oldMentality = awayClub.aiManagerProfile.defaultTactics.mentality;
        const newAwayTactics = getAIReactiveTactics(awayClub.aiManagerProfile, false, homeGoals, awayGoals, min);
        if (newAwayTactics.mentality !== oldMentality) {
          events.push({ minute: min, type: 'ai_tactical_change', clubId: awayClub.id, description: `${awayClub.shortName} manager switches to ${newAwayTactics.mentality} mentality.`, momentum });
        }
        currentAwayTactics = newAwayTactics;
        recomputeStrengths();
      }
    }

    // In-match fitness degradation (starters + subbed-in players)
    // Team talk fitness multiplier applies only to the player's club
    // Tactical modifiers (pressing/tempo) apply to each side independently
    const teamTalkDrainMult = teamTalkModifiers?.fitnessDrainMult ?? 1;
    const computeTacticalDrain = (t?: TacticalInstructions) => {
      if (!t) return 1;
      let mult = 1;
      if (t.pressingIntensity > PRESSING_FITNESS_DRAIN_BASELINE) {
        mult += (t.pressingIntensity - PRESSING_FITNESS_DRAIN_BASELINE) * PRESSING_FITNESS_DRAIN_PER_POINT;
      }
      if (t.tempo === 'fast') mult *= TEMPO_FAST_FITNESS_DRAIN_MOD;
      else if (t.tempo === 'slow') mult *= TEMPO_SLOW_FITNESS_DRAIN_MOD;
      return mult;
    };
    const homeTacticalDrain = computeTacticalDrain(homeTactics);
    const awayTacticalDrain = computeTacticalDrain(awayTactics);
    [...allMatchPlayers, ...homeSubbedIn, ...awaySubbedIn].forEach(p => {
      if (!unavailable.has(p.id) && matchFitness[p.id] !== undefined) {
        const isHomeSide = homeActive.has(p.id) || homeSubbedIn.some(s => s.id === p.id);
        const tacticalDrain = isHomeSide ? homeTacticalDrain : awayTacticalDrain;
        const isPlayerTeam = playerClubId && (isHomeSide ? homeClub.id === playerClubId : awayClub.id === playerClubId);
        const talkDrain = isPlayerTeam ? teamTalkDrainMult : 1;
        matchFitness[p.id] = Math.max(0, matchFitness[p.id] - (FITNESS_DEGRADE_PER_MINUTE + Math.random() * FITNESS_DEGRADE_VARIANCE) * talkDrain * tacticalDrain);
      }
    });

    // Snapshot fitness periodically and attach tactical insight to first event of the half
    if (min % FITNESS_SNAPSHOT_INTERVAL === 0) {
      const snapshot: Record<string, number> = {};
      for (const p of [...allMatchPlayers, ...homeSubbedIn, ...awaySubbedIn]) {
        if (!unavailable.has(p.id) && matchFitness[p.id] !== undefined) {
          snapshot[p.id] = Math.round(matchFitness[p.id]);
        }
      }
      // Attach to last event of this minute if any, otherwise to a commentary event
      fitnessSnapshot = snapshot;
    }

    // Fatigue commentary — check periodically in second half when players tire
    if (min >= FATIGUE_COMMENTARY_MIN_MINUTE && min % FATIGUE_COMMENTARY_INTERVAL === 0) {
      // Check each side's average fitness
      const calcAvgFitness = (players: Player[], subbedIn: Player[]) => {
        const all = [...players, ...subbedIn].filter(p => !unavailable.has(p.id) && matchFitness[p.id] !== undefined);
        if (all.length === 0) return 100;
        return all.reduce((sum, p) => sum + (matchFitness[p.id] ?? 100), 0) / all.length;
      };
      const homeAvgFit = calcAvgFitness(homePlayers, homeSubbedIn);
      const awayAvgFit = calcAvgFitness(awayPlayers, awaySubbedIn);
      const fatigueDescs = [
        (club: string) => `Tired legs showing for ${club} — the pace is dropping.`,
        (club: string) => `${club} are visibly tiring as the match wears on.`,
        (club: string) => `The intensity is taking its toll on ${club}'s players.`,
      ];
      if (homeAvgFit < FATIGUE_COMMENTARY_THRESHOLD) {
        events.push({ minute: min, type: 'commentary', clubId: homeClub.id, description: pick(fatigueDescs)(homeClub.shortName), momentum });
      }
      if (awayAvgFit < FATIGUE_COMMENTARY_THRESHOLD) {
        events.push({ minute: min, type: 'commentary', clubId: awayClub.id, description: pick(fatigueDescs)(awayClub.shortName), momentum });
      }
    }

    // Momentum decay toward neutral each minute
    if (momentum > 0) momentum = Math.max(0, momentum - MOMENTUM_DECAY_PER_MINUTE);
    else if (momentum < 0) momentum = Math.min(0, momentum + MOMENTUM_DECAY_PER_MINUTE);

    // Tempo affects event frequency: fast tempo = more events, slow = fewer
    const tempoEventMod = homeTactics?.tempo === 'fast' || awayTactics?.tempo === 'fast' ? 0.04
      : homeTactics?.tempo === 'slow' && awayTactics?.tempo === 'slow' ? -0.03 : 0;
    // NB: the per-side TEMPO_SHOT_MOD is deliberately NOT folded in here. It
    // used to be — `base + (homeMods.shotMod + awayMods.shotMod) * 0.5` — which
    // made it a single SHARED probability, so a fast tempo handed the opponent
    // exactly as many extra shots as it gained (measured: home `fast` 13.0 vs
    // away 12.5 shots, -0.06 pts/g). It is now applied per-side inside the shot
    // threshold, to whichever team owns the event. `tempoEventMod` above keeps
    // the small legitimate symmetric effect (both sides playing fast = a more
    // frantic match).
    const eventChance = BASE_EVENT_CHANCE + (min > LATE_GAME_THRESHOLD_MINUTE ? LATE_GAME_EVENT_BONUS : 0) + derbyEventMod + tempoEventMod;
    if (Math.random() > eventChance) {
      // Late drama atmosphere: inject once when game is tight in the final minutes
      if (!lateDramaFired && min >= LATE_GAME_THRESHOLD_MINUTE && Math.abs(homeGoals - awayGoals) <= 1) {
        lateDramaFired = true;
        events.push({ minute: min, type: 'commentary', clubId: Math.random() < 0.5 ? homeClub.id : awayClub.id, description: pick(lateDramaAtmosphere)(), momentum });
        lastEventMinute = min;
      }
      // Gap-filler: inject commentary if too many silent minutes have passed
      if (min - lastEventMinute >= COMMENTARY_GAP_MAX) {
        const isHome = Math.random() < 0.5;
        const desc = generateCommentary(min, homeClub.shortName, awayClub.shortName, homeGoals, awayGoals, isHome, momentum, matchWeather?.weather, matchWeather?.pitch, derbyIntensity, usedLines);
        // Possession shifts toward the team with the ball
        momentum = isHome
          ? Math.min(100, momentum + MOMENTUM_COMMENTARY_SWING)
          : Math.max(-100, momentum - MOMENTUM_COMMENTARY_SWING);
        events.push({ minute: min, type: 'commentary', clubId: isHome ? homeClub.id : awayClub.id, description: desc, momentum });
        lastEventMinute = min;
      }
      continue;
    }

    // Apply momentum to strength ratio: positive momentum favours home team
    const momentumFactor = momentum * MOMENTUM_STRENGTH_SCALE / 100;
    // Fitness-based freshness: teams with fresher players get a small strength boost
    const homeFitAvg = homeAvail().reduce((sum, p) => sum + (matchFitness[p.id] ?? 80), 0) / Math.max(1, homeAvail().length);
    const awayFitAvg = awayAvail().reduce((sum, p) => sum + (matchFitness[p.id] ?? 80), 0) / Math.max(1, awayAvail().length);
    const homeFreshness = (homeFitAvg - awayFitAvg) * SUB_FRESHNESS_BONUS / 100;
    const effectiveHomeStr = homeStr * (1 + momentumFactor + homeFreshness);
    const effectiveAwayStr = awayStr * (1 - momentumFactor - homeFreshness);
    const effectiveTotal = effectiveHomeStr + effectiveAwayStr;

    const isHome = effectiveTotal > 0 ? Math.random() < effectiveHomeStr / effectiveTotal : Math.random() < 0.5;
    const club = isHome ? homeClub : awayClub;
    // Combine starters + subbed-in players for event selection
    const squad = isHome ? [...homePlayers, ...homeSubbedIn] : [...awayPlayers, ...awaySubbedIn];
    const oppSquad = isHome ? [...awayPlayers, ...awaySubbedIn] : [...homePlayers, ...homeSubbedIn];
    const oppMods = isHome ? awayMods : homeMods;
    const atkMods = isHome ? homeMods : awayMods;
    const oppDefense = isHome ? awayDefQuality : homeDefQuality;
    const oppGKSave = isHome ? awayGKSave : homeGKSave;
    const oppGKErrorChance = isHome ? awayGKErrorChance : homeGKErrorChance;
    const roll = Math.random();

    // Tactics shift event type thresholds:
    // - Wide play increases corner chance from saves/misses
    // - Defensive mentality shifts more events toward fouls/blocks
    // - Attacking mentality shifts more events toward shots
    const widthCornerBonus = atkMods.widthMod > 0 ? 0.08 : 0;
    // Mentality shifts shot VOLUME symmetrically: your aggression buys you more
    // shots, the opponent's compactness takes them away (and their recklessness
    // hands them over). The old flat ±0.03 keyed only on your own mentality,
    // which the opponent never paid for.
    const mentalityShotShift = (atkMods.attackMod - oppMods.defenseMod) * MENTALITY_SHOT_SHIFT_SCALE;
    // Tempo is the EVENT TEAM's own: a fast side turns more of its possessions
    // into shots, a slow side fewer — and the shots it takes are correspondingly
    // rushed (tempoQualityMod, applied to conversion below) so volume is paid
    // for in quality rather than being free.
    const tempoShotShift = (atkMods.shotMod || 0) * TEMPO_SHOT_THRESHOLD_SCALE;
    const eventTeamTempo = isHome ? homeTactics?.tempo : awayTactics?.tempo;
    const tempoQualityMod = eventTeamTempo ? (TEMPO_SHOT_QUALITY_MOD[eventTeamTempo] || 0) : 0;
    const adjustedShotThreshold = SHOT_ATTEMPT_THRESHOLD + mentalityShotShift + tempoShotShift;

    // Where the foul band ends for THIS event minute. Measured as a WIDTH from
    // the (tempo-adjusted) shot threshold so a tempo shift moves the boundary
    // without squeezing the foul band. Derby and weather widen fouls for both
    // sides; the team-talk modifier belongs only to the player's club (the talk
    // was given to that dressing room); pressing intensity (tactics foulMod,
    // reused from the per-half mods — not recomputed per minute) raises the
    // FOULING side's risk, and the fouling side is the one DEFENDING this
    // possession (see the FOUL branch). The injury band offsets from this end
    // so it stays relative (see injuryBandWidth above).
    const defendingTeamIsPlayers = (isHome ? awayClub.id : homeClub.id) === playerClubId;
    const foulBandEnd = Math.min(
      FOUL_BAND_END_CAP,
      adjustedShotThreshold + FOUL_BAND_WIDTH + derbyFoulMod + weatherFoulMod
        + (defendingTeamIsPlayers ? teamTalkFoulMod : 0) + (oppMods.foulMod || 0),
    );

    // === SHOT ATTEMPT ===
    if (roll < adjustedShotThreshold) {
      const eligibleSquad = squad.filter(p => !unavailable.has(p.id));
      if (eligibleSquad.length === 0) continue;
      const scorer = pickAttacker(eligibleSquad);

      // Attribute-driven shot quality (skill moves provide a small creative bonus)
      const skillBonus = (scorer.skillMoves ?? 2) >= 4 ? 0.02 : 0;
      const shotQuality = (
        scorer.attributes.shooting * SHOT_QUALITY_WEIGHTS.shooting +
        scorer.attributes.mental * SHOT_QUALITY_WEIGHTS.mental +
        scorer.attributes.pace * SHOT_QUALITY_WEIGHTS.pace +
        scorer.attributes.physical * SHOT_QUALITY_WEIGHTS.physical +
        scorer.form * SHOT_QUALITY_WEIGHTS.form
      ) / 100 + skillBonus;

      // Fitness factor: uses in-match fitness, penalizes low fitness
      const currentFitness = matchFitness[scorer.id] ?? scorer.fitness;
      const fitnessFactor = FITNESS_FACTOR_BASE + (currentFitness / 100) * FITNESS_FACTOR_SCALE;
      const lowFitPenalty = currentFitness < MATCH_LOW_FITNESS_THRESHOLD ? LOW_FITNESS_SHOT_PENALTY : 0;

      // Morale factor: high morale boosts, low morale penalizes
      const moraleMod = (scorer.morale - MORALE_BASELINE) / 100 * MORALE_PERFORMANCE_WEIGHT;

      // Goal chance: attacker quality vs opponent defense, modified by tactics
      // and weather. The MENTALITY term is symmetric — your own aggression
      // lifts your conversion (+attackMod) and the opponent's caution suppresses
      // it (-oppMods.defenseMod) — so mentality trades goals-for against
      // goals-against. It used to be one-sided AND double-counted in team
      // strength; see the note in computeStrengths.
      const goalChance = (shotQuality * fitnessFactor * GOAL_CHANCE_ATTACK_MULT) - (oppDefense * GOAL_CHANCE_DEFENSE_MULT)
        + (atkMods.attackMod - oppMods.defenseMod) * GOAL_CHANCE_ATTACK_MOD_SCALE
        + oppMods.counterVuln * GOAL_CHANCE_COUNTER_VULN_SCALE
        + tempoQualityMod
        - lowFitPenalty + moraleMod + pitchShotMod + weatherPaceMod + weatherMod;

      // Uniform scale so the added shot volume does not inflate the goal total.
      // Multiplicative and applied to the whole expression on purpose — see
      // GOAL_CHANCE_VOLUME_SCALE for why the additive alternatives distort
      // quality separation and draw rate respectively.
      const clampedChance = Math.max(GOAL_CHANCE_MIN, goalChance * GOAL_CHANCE_VOLUME_SCALE);
      // The keeper is part of RESOLVING the chance, not a relabelling applied
      // afterwards. The goal roll used to be settled first and `oppGKSave` only
      // decided whether the already-decided non-goal read as "saved" or
      // "missed" — so a 64-point swing in GK attributes moved goals conceded by
      // under 20%. Folding the save into the goal roll makes keeper quality a
      // first-class defensive attribute.
      const effectiveGoalChance = clampedChance * (1 - oppGKSave);

      // xG accumulates the EFFECTIVE chance so aggregate xG tracks the goals
      // actually scored (the UI shows xG next to the scoreline). It therefore
      // reads as "expected goals against this keeper".
      if (isHome) homeXG += effectiveGoalChance; else awayXG += effectiveGoalChance;

      if (Math.random() < effectiveGoalChance) {
        // Goal scored!
        const preGoalHomeGoals = homeGoals;
        const preGoalAwayGoals = awayGoals;
        if (isHome) homeGoals++; else awayGoals++;
        if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
        let assist = pickAssist(squad.filter(p => !unavailable.has(p.id)), scorer.id);
        if (playerEvents[scorer.id]) playerEvents[scorer.id].goals++;
        if (assist && playerEvents[assist.id]) playerEvents[assist.id].assists++;
        oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });

        // Momentum swings toward scoring team. Capture the pre-goal value
        // first: the swing is clamped to ±100, so a VAR reversal that blindly
        // subtracted the full swing could over-correct past where momentum
        // actually stood before the goal.
        const preGoalMomentum = momentum;
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

        // Determine goal flavor — new event types add variety
        let goalType: MatchEvent['type'] = 'goal';
        let goalDescription = goalDesc(scorerName, clubName);
        let actualScorerId = scorer.id; // Can be overridden by free kick taker
        const hasHighLine = oppMods.counterVuln > 0.1;
        const flavorRoll = Math.random();
        // Walk cumulative bands over the flavours this scorer is ELIGIBLE for.
        //
        // The chain used to be an else-if ladder whose thresholds were
        // cumulative (`CA`, `CA+LR`, `CA+LR+HEADER`, …) while each branch ALSO
        // carried an independent eligibility gate. When a gate failed its band
        // was not skipped — it was inherited by the next branch. With no high
        // line the long-range branch owned [0, CA+LR) rather than [CA, CA+LR),
        // so it fired at 22% instead of its configured 10%, headers likewise
        // over-fired, and free kicks — last in the ladder — were squeezed out.
        // Free kicks are the only flavour that honours `club.setPieceTakerId`,
        // so the player's chosen dead-ball specialist mattered less than the
        // config implied.
        //
        // Building the eligible list first gives every flavour exactly its
        // configured probability, and anything left over stays a plain goal.
        const flavorBands: { type: MatchEvent['type']; chance: number }[] = [];
        if (hasHighLine) flavorBands.push({ type: 'counter_attack_goal', chance: COUNTER_ATTACK_GOAL_CHANCE });
        if (scorer.attributes.shooting >= 75) flavorBands.push({ type: 'long_range_goal', chance: LONG_RANGE_GOAL_CHANCE });
        if (scorer.attributes.physical >= 70) flavorBands.push({ type: 'header_goal', chance: HEADER_GOAL_CHANCE });
        if ((scorer.skillMoves ?? 2) >= 4 && scorer.attributes.pace >= 70) flavorBands.push({ type: 'solo_goal', chance: SOLO_GOAL_CHANCE });
        // Free kicks have no scorer-level gate here: the shooting bar depends on
        // WHO ends up taking it (a designated specialist gets a lower bar), so
        // it is applied below once the taker is resolved.
        flavorBands.push({ type: 'free_kick_goal', chance: FREE_KICK_GOAL_CHANCE });

        let chosenFlavor: MatchEvent['type'] | null = null;
        let flavorCumulative = 0;
        for (const band of flavorBands) {
          flavorCumulative += band.chance;
          if (flavorRoll < flavorCumulative) { chosenFlavor = band.type; break; }
        }

        if (chosenFlavor === 'counter_attack_goal') {
          goalType = 'counter_attack_goal';
          goalDescription = pick(counterAttackGoalDescs)(scorerName, clubName);
        } else if (chosenFlavor === 'long_range_goal') {
          goalType = 'long_range_goal';
          goalDescription = pick(longRangeGoalDescs)(scorerName, clubName);
        } else if (chosenFlavor === 'header_goal') {
          goalType = 'header_goal';
          goalDescription = pick(headerGoalDescs)(scorerName, clubName);
        } else if (chosenFlavor === 'solo_goal') {
          goalType = 'solo_goal';
          goalDescription = pick(soloGoalDescs)(scorerName, clubName);
        } else if (chosenFlavor === 'free_kick_goal') {
          // Prefer designated set-piece taker for free kicks
          let fkScorer = scorer;
          if (club.setPieceTakerId && club.setPieceTakerId !== scorer.id) {
            const designatedTaker = eligibleSquad.find(p => p.id === club.setPieceTakerId);
            if (designatedTaker && Math.random() < FREE_KICK_SET_PIECE_TAKER_CHANCE) {
              fkScorer = designatedTaker;
            }
          }
          const freeKickThreshold = (club.setPieceTakerId && fkScorer.id === club.setPieceTakerId) ? 60 : 70;
          if (fkScorer.attributes.shooting >= freeKickThreshold) {
            goalType = 'free_kick_goal';
            const fkScorerName = `${fkScorer.firstName} ${fkScorer.lastName}`;
            goalDescription = pick(freeKickGoalDescs)(fkScorerName, clubName);
            // Transfer goal credit to the free kick taker if different from original scorer
            if (fkScorer.id !== scorer.id) {
              if (playerEvents[scorer.id]) playerEvents[scorer.id].goals--;
              if (playerEvents[fkScorer.id]) playerEvents[fkScorer.id].goals++;
              actualScorerId = fkScorer.id;
            }
          }
        }

        // Clear assist if the free-kick override made the assist player the scorer
        if (assist && assist.id === actualScorerId) {
          if (playerEvents[assist.id]) playerEvents[assist.id].assists--;
          assist = undefined;
        }

        // Build-up commentary preceding the goal — adds narrative texture
        const buildUpFlavor: Parameters<typeof pickBuildUp>[0] =
          goalType === 'counter_attack_goal' ? 'counter' :
          goalType === 'long_range_goal' ? 'long_range' :
          goalType === 'header_goal' ? 'header' :
          goalType === 'solo_goal' ? 'solo' :
          goalType === 'free_kick_goal' ? 'free_kick' :
          'generic';
        events.push({
          minute: min, type: 'commentary', clubId: club.id,
          description: pickBuildUp(buildUpFlavor, clubName),
          momentum,
        });

        events.push({
          minute: min, type: goalType, playerId: actualScorerId,
          assistPlayerId: assist?.id, clubId: club.id,
          description: withContextSuffix(goalDescription) + (assist ? ` (assist: ${assist.lastName})` : ''),
          momentum, homeXG, awayXG,
        });

        // VAR check — adds drama after some goals, occasionally disallows
        if (Math.random() < VAR_CHECK_CHANCE) {
          if (Math.random() < VAR_DISALLOW_CHANCE) {
            // VAR overturns the goal — reverse all scoring effects
            if (isHome) homeGoals--; else awayGoals--;
            if (playerEvents[actualScorerId]) playerEvents[actualScorerId].goals--;
            if (assist && playerEvents[assist.id]) playerEvents[assist.id].assists--;
            // Restore opponent GK clean sheet if no other goals conceded
            const goalsAgainstGK = isHome ? homeGoals : awayGoals; // goals by scoring team AFTER reversal
            if (goalsAgainstGK === 0) {
              oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = true; });
            }
            // Reverse momentum swing — restore the exact pre-goal value
            // (subtracting the full swing over-corrects when the clamp ate
            // part of it; nothing else touches momentum between the goal
            // swing above and this VAR check)
            momentum = preGoalMomentum;
            // Replace the goal event with a disallowed event. Pop both the
            // goal event and the build-up commentary that preceded it so the
            // narration doesn't carry an orphan "they break forward..." line.
            events.pop(); // remove the goal event we just pushed
            events.pop(); // remove the build-up commentary we pushed before it
            const disallowedPlayer = actualScorerId !== scorer.id
              ? eligibleSquad.find(p => p.id === actualScorerId) : scorer;
            const disallowedName = disallowedPlayer
              ? `${disallowedPlayer.firstName} ${disallowedPlayer.lastName}` : scorerName;
            events.push({
              minute: min, type: 'var_disallowed', playerId: actualScorerId, clubId: club.id,
              description: pick(varDisallowDescs)(disallowedName),
              momentum, homeXG, awayXG,
            });
          } else {
            events.push({
              minute: min, type: 'var_check', clubId: club.id,
              description: pick(varCheckDescs)(clubName),
              momentum,
            });
          }
        }
      } else if (Math.random() < Math.max(0, oppGKSave - weatherGKErrorMod)) {
        // The defence stopped this one. Entering the branch is DELIBERATELY the
        // unscaled keeper roll: the corner opportunity below hangs off it and
        // carries its own header-goal attempt, so scaling the ENTRY would move
        // the goal model. Only the ACCOUNTING was wrong — the keeper is already
        // folded into the goal roll above, so recording every stopped shot as a
        // save counted him twice and put 46% of shots on target against a real
        // ~34%. See SHOT_ON_TARGET_SAVE_SCALE.
        const recordedOnTarget = Math.random() < SHOT_ON_TARGET_SAVE_SCALE;
        if (isHome) { homeShots++; if (recordedOnTarget) homeSoT++; }
        else { awayShots++; if (recordedOnTarget) awaySoT++; }
        // Credit the ACTIVE keeper: filter unavailable so a sent-off/injured
        // GK stops accruing saves and a subbed-on backup gets the credit.
        const gk = oppSquad.find(p => p.position === 'GK' && !unavailable.has(p.id));
        if (recordedOnTarget && gk && playerEvents[gk.id]) playerEvents[gk.id].saves++;
        // Momentum swings toward the defending team either way — the chance was
        // stopped.
        momentum = isHome
          ? Math.max(-100, momentum - MOMENTUM_SAVE_SWING)
          : Math.min(100, momentum + MOMENTUM_SAVE_SWING);
        if (!recordedOnTarget) {
          events.push({ minute: min, type: 'shot_missed', playerId: scorer.id, clubId: club.id, description: withContextSuffix(`${scorer.lastName}'s effort is deflected away.`), momentum, homeXG, awayXG });
        } else {
        // Goal-line clearance: dramatic defensive intervention
        const eligibleDefenders = oppSquad.filter(p => !unavailable.has(p.id) && DEFENDER_POSITIONS.includes(p.position as typeof DEFENDER_POSITIONS[number]));
        if (Math.random() < GOAL_LINE_CLEARANCE_CHANCE && eligibleDefenders.length > 0) {
          const defender = eligibleDefenders[Math.floor(Math.random() * eligibleDefenders.length)];
          const clearDesc = pick(goalLineClearanceDescs);
          events.push({ minute: min, type: 'goal_line_clearance', playerId: scorer.id, clubId: club.id, description: withContextSuffix(clearDesc(scorer.lastName, defender.lastName)), momentum });
        } else {
          const saveDesc = pick(saveDescs);
          events.push({ minute: min, type: 'shot_saved', playerId: scorer.id, clubId: club.id, description: withContextSuffix(gk ? saveDesc(scorer.lastName, gk.lastName) : `${scorer.lastName}'s shot is saved.`), momentum, homeXG, awayXG });
          }
        }
        // Corner chance from a stopped shot (rate unchanged — see above)
        if (Math.random() < CORNER_FROM_SAVE_CHANCE + widthCornerBonus) {
          if (isHome) homeCorners++; else awayCorners++;
          // Corner goal attempt — designated set-piece taker improves delivery
          const setPieceBonus = (club.setPieceTakerId && eligibleSquad.some(p => p.id === club.setPieceTakerId)) ? SET_PIECE_TAKER_CORNER_BONUS : 0;
          // The Set-Piece Coach perk belongs to the PLAYER's club, not to
          // whoever happens to be at home. Gating it on `isHome` meant every
          // away fixture donated the player's paid perk to the AI opponent.
          const perkSetPieceBonus = (setPieceCoachBonus && club.id === playerClubId) ? setPieceCoachBonus : 0;
          if (Math.random() < CORNER_GOAL_CHANCE + setPieceBonus + perkSetPieceBonus) {
            const headerCandidates = eligibleSquad.filter(p => p.position !== 'GK');
            if (headerCandidates.length > 0) {
              const getHeaderPosMult = (pos: string) => pos === 'CB' ? CORNER_HEADER_CB_MULT : pos === 'ST' ? CORNER_HEADER_ST_MULT : ['CM','CDM','CAM','LW','RW','LM','RM'].includes(pos) ? CORNER_HEADER_MID_MULT : 1.0;
              const headerWeights = headerCandidates.map(p => (p.attributes.physical * CORNER_GOAL_PHYSICAL_WEIGHT + p.attributes.defending * CORNER_GOAL_DEFENDING_WEIGHT) * getHeaderPosMult(p.position));
              const tw = headerWeights.reduce((a, b) => a + b, 0);
              let rr = Math.random() * tw;
              let header = headerCandidates[0];
              for (let i = 0; i < headerCandidates.length; i++) { rr -= headerWeights[i]; if (rr <= 0) { header = headerCandidates[i]; break; } }
              // Header attempt from the corner accrues xG whether or not it goes
              // in. The xG is the header's OWN conversion probability — this
              // used to add CORNER_GOAL_CHANCE (0.12) after the 0.12 gate had
              // already been passed, i.e. it charged the probability of the
              // attempt existing rather than the probability of it scoring, and
              // under-reported corner xG by ~3x.
              const headerGoalChance = Math.max(CORNER_HEADER_MIN_CHANCE, (header.attributes.physical / 100) * CORNER_HEADER_PHYSICAL_SCALE);
              if (isHome) homeXG += headerGoalChance; else awayXG += headerGoalChance;
              if (Math.random() < headerGoalChance) {
                if (isHome) homeGoals++; else awayGoals++;
                if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
                if (playerEvents[header.id]) playerEvents[header.id].goals++;
                const cornerAssist = pickAssist(squad.filter(p => !unavailable.has(p.id)), header.id);
                if (cornerAssist && playerEvents[cornerAssist.id]) playerEvents[cornerAssist.id].assists++;
                oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
                momentum = isHome
                  ? Math.min(100, momentum + MOMENTUM_GOAL_SWING)
                  : Math.max(-100, momentum - MOMENTUM_GOAL_SWING);
                const cDesc = pick(cornerGoalDescs);
                events.push({ minute: min, type: 'commentary', clubId: club.id, description: pickBuildUp('corner', club.shortName), momentum });
                events.push({ minute: min, type: 'goal', playerId: header.id, assistPlayerId: cornerAssist?.id, clubId: club.id, description: withContextSuffix(cDesc(`${header.firstName} ${header.lastName}`, club.shortName)) + (cornerAssist ? ` (assist: ${cornerAssist.lastName})` : ''), momentum, homeXG, awayXG });
              }
            }
          }
        }
      } else if (Math.random() < oppGKErrorChance) {
        // Goalkeeper error — the keeper spills a shot and it goes in.
        // Chance scaled by GK quality + weather, pre-computed once per match.
        //
        // This branch sits inside the SHOT ATTEMPT block, so an attempt was
        // made and it ended up in the net: it counts as a shot AND as a shot on
        // target, exactly like the goal branch above. It used to increment
        // neither, which let a match finish with more goals than shots.
        // (The xG was already booked at the shot-attempt roll, so none is added
        // here — see the own-goal note below.)
        if (isHome) homeGoals++; else awayGoals++;
        if (isHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
        const gkErrorAssist = pickAssist(squad.filter(p => !unavailable.has(p.id)), scorer.id);
        if (playerEvents[scorer.id]) playerEvents[scorer.id].goals++;
        if (gkErrorAssist && playerEvents[gkErrorAssist.id]) playerEvents[gkErrorAssist.id].assists++;
        // The fumbling keeper is the one actually on the pitch
        const oppGK = oppSquad.find(p => p.position === 'GK' && !unavailable.has(p.id));
        oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
        momentum = isHome
          ? Math.min(100, momentum + MOMENTUM_GOAL_SWING)
          : Math.max(-100, momentum - MOMENTUM_GOAL_SWING);
        const gkName = oppGK ? oppGK.lastName : 'the keeper';
        events.push({ minute: min, type: 'commentary', clubId: club.id, description: pickBuildUp('gk_error', club.shortName), momentum });
        events.push({
          minute: min, type: 'goalkeeper_error', playerId: scorer.id, assistPlayerId: gkErrorAssist?.id,
          goalkeeperId: oppGK?.id, clubId: club.id,
          description: withContextSuffix(pick(gkErrorDescs)(scorer.lastName, gkName, club.shortName)) + (gkErrorAssist ? ` (assist: ${gkErrorAssist.lastName})` : ''),
          momentum, homeXG, awayXG,
        });
      } else {
        // Shot missed — chance of dramatic woodwork hit
        if (isHome) homeShots++; else awayShots++;
        // Momentum shifts toward attacking team — they're pressuring
        momentum = isHome
          ? Math.min(100, momentum + MOMENTUM_SHOT_ATTEMPT_SWING)
          : Math.max(-100, momentum - MOMENTUM_SHOT_ATTEMPT_SWING);
        if (Math.random() < WOODWORK_CHANCE) {
          events.push({ minute: min, type: 'hit_woodwork', playerId: scorer.id, clubId: club.id, description: withContextSuffix(pick(woodworkDescs)(scorer.lastName)), momentum, homeXG, awayXG });
        } else {
          // Suppress most low-xG misses from the live commentary feed to keep it focused.
          // Stats (shot count, xG, momentum) above already updated, so the underlying
          // match data is unchanged — only the on-screen prose gets quieter.
          const isMeaningfulChance = effectiveGoalChance >= LOW_XG_MISS_THRESHOLD;
          if (isMeaningfulChance || Math.random() < LOW_XG_MISS_SHOW_CHANCE) {
            events.push({ minute: min, type: 'shot_missed', playerId: scorer.id, clubId: club.id, description: withContextSuffix(pick(missDescs)(scorer.lastName)), momentum, homeXG, awayXG });
          }
        }
        // Corner chance from missed shot (wide play increases corner frequency)
        if (Math.random() < CORNER_FROM_MISS_CHANCE + widthCornerBonus) {
          if (isHome) homeCorners++; else awayCorners++;
        }
      }
    }
    // === FOUL (committed by the side DEFENDING this possession) ===
    else if (roll < foulBandEnd) {
      // The event team is the side in possession, so the foul that stops that
      // possession is conceded by the side defending it. Fouls used to be
      // charged to the event team, and the event team is drawn by strength
      // share, so the BETTER side fouled more — and therefore conceded more
      // penalties. Measured elite-88 v weak-52: penalties awarded home 0.276 /
      // away 0.474, with 64% of the weak side's goals coming from the spot.
      const foulingIsHome = !isHome;
      const foulingClub = foulingIsHome ? homeClub : awayClub;
      const foulingSquad = oppSquad;   // defending side — commits the foul
      const fouledSquad = squad;       // attacking side — wins the free kick
      const eligibleFoulers = foulingSquad.filter(p => !unavailable.has(p.id));
      if (eligibleFoulers.length === 0) continue;
      const fouler = pickFouler(eligibleFoulers);
      if (!fouler) continue;
      if (foulingIsHome) homeFouls++; else awayFouls++;
      const isPlayerTeamFouling = foulingClub.id === playerClubId;
      const disciplinarianMod = (disciplinarianActive && isPlayerTeamFouling) ? (1 - DISCIPLINARIAN_CARD_REDUCTION) : 1;
      const careerMod = (careerDisciplineMod && isPlayerTeamFouling) ? (1 - careerDisciplineMod) : 1;
      // A player already on a yellow knows the next one ends his match — he
      // pulls out of challenges. Without this, a realistic yellow rate produced
      // ~3x real football's red-card rate purely from second bookings.
      const bookedMod = (playerEvents[fouler.id]?.yellows ?? 0) >= 1 ? BOOKED_PLAYER_CARD_MULT : 1;
      const cardChance = (CARD_BASE_CHANCE + derbyCardMod) * getCardRiskMultiplier(fouler.personality) * disciplinarianMod * careerMod * bookedMod;
      if (Math.random() < cardChance) {
        const pe = playerEvents[fouler.id];
        if (pe) {
          pe.yellows++;
          if (pe.yellows >= 2) {
            pe.redCard = true;
            sentOffSet.add(fouler.id);
            unavailable.add(fouler.id);
            // Emit the booking itself as well as the dismissal. Only the
            // `red_card` event used to be pushed, and `Player.yellowCards` is
            // derived from `yellow_card` events — so a second booking was never
            // counted. Season yellow totals under-reported and the new
            // yellow-accumulation bans were reached a match late. A second yellow
            // genuinely IS a yellow followed by a red, which is how a real match
            // log reads.
            events.push({ minute: min, type: 'yellow_card', playerId: fouler.id, clubId: foulingClub.id, description: `${fouler.lastName} is booked for a second time.` });
            // Momentum swings toward the team that was fouled (the event team)
            momentum = isHome
              ? Math.min(100, momentum + MOMENTUM_RED_CARD_SWING)
              : Math.max(-100, momentum - MOMENTUM_RED_CARD_SWING);
            events.push({ minute: min, type: 'red_card', playerId: fouler.id, clubId: foulingClub.id, description: pick(secondYellowDescs)(fouler.lastName), momentum });
            // Warn if team is down to 8 players (one more red = abandonment)
            const teamAvail = foulingIsHome ? homeAvail().length : awayAvail().length;
            if (teamAvail === MIN_PLAYERS_TO_CONTINUE + 1) {
              events.push({ minute: min, type: 'commentary', clubId: foulingClub.id, description: `${foulingClub.shortName} are down to ${teamAvail} players! One more sending off and the match will be abandoned.`, momentum });
            }
            // Rebalance strength after red card (the sent-off player might be the GK)
            recomputeStrengths();
            refreshDefenceMetrics();
            checkAbandon(min);
          } else {
            // Momentum swings toward the non-fouling (event) team on yellows
            momentum = isHome
              ? Math.min(100, momentum + MOMENTUM_CARD_SWING)
              : Math.max(-100, momentum - MOMENTUM_CARD_SWING);
            events.push({ minute: min, type: 'yellow_card', playerId: fouler.id, clubId: foulingClub.id, description: withContextSuffix(pick(yellowDescs)(fouler.lastName)), momentum });
          }
        }
      } else if (Math.random() < STRAIGHT_RED_CHANCE) {
        const pe = playerEvents[fouler.id];
        if (pe && !pe.redCard) {
          pe.redCard = true;
          sentOffSet.add(fouler.id);
          unavailable.add(fouler.id);
          // Momentum swings toward the team that was fouled (the event team)
          momentum = isHome
            ? Math.min(100, momentum + MOMENTUM_RED_CARD_SWING)
            : Math.max(-100, momentum - MOMENTUM_RED_CARD_SWING);
          events.push({ minute: min, type: 'red_card', playerId: fouler.id, clubId: foulingClub.id, description: pick(straightRedDescs)(fouler.lastName), momentum });
            // Warn if team is down to 8 players
            const teamAvail2 = foulingIsHome ? homeAvail().length : awayAvail().length;
            if (teamAvail2 === MIN_PLAYERS_TO_CONTINUE + 1) {
              events.push({ minute: min, type: 'commentary', clubId: foulingClub.id, description: `${foulingClub.shortName} are down to ${teamAvail2} players! One more sending off and the match will be abandoned.`, momentum });
            }
            // Rebalance strength after red card (the sent-off player might be the GK)
            recomputeStrengths();
            refreshDefenceMetrics();
            checkAbandon(min);
        }
      } else {
        // Momentum shifts toward the fouled (event) team
        momentum = isHome
          ? Math.min(100, momentum + MOMENTUM_FOUL_SWING)
          : Math.max(-100, momentum - MOMENTUM_FOUL_SWING);
        events.push({ minute: min, type: 'foul', playerId: fouler.id, clubId: foulingClub.id, description: withContextSuffix(pick(foulDescs)(fouler.lastName)), momentum });
      }

      // A sending-off just above may have taken a side below the minimum and
      // ended the match. `checkAbandon` has already forfeited the score and
      // stripped the goal events, but the loop only breaks at the TOP of the
      // next minute — so the injury and penalty blocks below still ran, and a
      // penalty converted here incremented a scoreline the forfeit had just
      // finalised (0-3 becoming 1-3, with a scorer the forfeit had zeroed).
      // Leave immediately instead.
      if (abandonMatch) break;

      // Foul can cause injury to the FOULED player — i.e. someone on the
      // attacking (event) side, treated by that side's medical staff.
      if (Math.random() < FOUL_INJURY_CHANCE) {
        const oppEligible = fouledSquad.filter(p => !unavailable.has(p.id));
        if (oppEligible.length > 0) {
          const fouled = pick(oppEligible);
          const medLevel = isHome ? (homeMedicalLevel ?? 5) : (awayMedicalLevel ?? 5);
          const details = generateInjuryDetails(true, medLevel);
          matchInjuries[fouled.id] = details;
          injuredSet.add(fouled.id);
          unavailable.add(fouled.id);
          const injLabel = INJURY_TYPES[details.type].label;
          const sevLabel = details.severity === 'minor' ? 'Minor' : details.severity === 'moderate' ? 'Moderate' : 'Serious';
          const injDesc = `${fouled.lastName} goes down injured after the foul! ${sevLabel} ${injLabel} — ${details.weeksRemaining} week${details.weeksRemaining > 1 ? 's' : ''} out.`;
          events.push({ minute: min, type: 'injury', playerId: fouled.id, clubId: fouled.clubId, description: injDesc + (maybeWeatherSuffix() || maybePitchSuffix()) });
          // Rebalance strength after injury (numerical disadvantage; GK may be the casualty)
          recomputeStrengths();
          refreshDefenceMetrics();
          // AI substitution for injured player (non-player team only)
          const injuredIsHome = fouled.clubId === homeClub.id;
          const injuredIsPlayerTeam = fouled.clubId === playerClubId;
          if (!injuredIsPlayerTeam) {
            const subResult = tryAISub(injuredIsHome ? homeBenchPool : awayBenchPool, injuredIsHome ? [...homePlayers, ...homeSubbedIn] : [...awayPlayers, ...awaySubbedIn], unavailable, injuredIsHome ? homeSubsUsed : awaySubsUsed, 'injury', fouled, undefined, undefined, min);
            if (subResult) {
              const { inPlayer, outPlayer } = subResult;
              if (injuredIsHome) { homeSubsUsed++; homeActive.add(inPlayer.id); homeSubbedIn.push(inPlayer); } else { awaySubsUsed++; awayActive.add(inPlayer.id); awaySubbedIn.push(inPlayer); }
              // Remove from bench pool
              const benchPool = injuredIsHome ? homeBenchPool : awayBenchPool;
              const benchIdx = benchPool.findIndex(p => p.id === inPlayer.id);
              if (benchIdx >= 0) benchPool.splice(benchIdx, 1);
              // Init playerEvents and matchFitness for sub
              if (!playerEvents[inPlayer.id]) playerEvents[inPlayer.id] = { goals: 0, assists: 0, yellows: 0, redCard: false, saves: 0, cleanSheet: true, goalsAtEntry: injuredIsHome ? awayGoals : homeGoals };
              matchFitness[inPlayer.id] = Math.min(100, inPlayer.fitness + SUB_ENTRY_FITNESS_BOOST);
              {
                const subClub = injuredIsHome ? homeClub : awayClub;
                events.push({ minute: min, type: 'substitution', playerId: inPlayer.id, assistPlayerId: outPlayer.id, clubId: subClub.id, description: pickSubDesc(inPlayer.lastName, outPlayer.lastName, subClub.shortName, true) });
              }
              // Rebalance after sub improves team (a backup GK may have come on)
              recomputeStrengths();
              refreshDefenceMetrics();
            }
          }
        }
      }

      // Penalty: the foul was in the box — awarded AGAINST the fouling side,
      // which is the side defending this possession. The taker therefore comes
      // from the ATTACKING (event) squad.
      if (Math.random() < PENALTY_FROM_FOUL_CHANCE) {
        const attackingIsHome = isHome;
        const attackingClub = attackingIsHome ? homeClub : awayClub;
        const atkEligibleAll = fouledSquad.filter(p => !unavailable.has(p.id));
        const atkEligible = atkEligibleAll.filter(p => p.position !== 'GK').length > 0
          ? atkEligibleAll.filter(p => p.position !== 'GK')
          : atkEligibleAll;
        if (atkEligible.length > 0) {
          // Prefer designated penalty taker if on the pitch
          const designatedTaker = attackingClub.penaltyTakerId ? atkEligible.find(p => p.id === attackingClub.penaltyTakerId) : null;
          const penaltyTaker = designatedTaker || pickPenaltyTaker(atkEligible);
          const penaltyBonus = designatedTaker ? PENALTY_TAKER_BONUS : 0;
          // xG for penalty attempt (standard ~0.76) — added regardless of outcome
          if (attackingIsHome) homeXG += PENALTY_CONVERSION_RATE; else awayXG += PENALTY_CONVERSION_RATE;
          if (Math.random() < PENALTY_CONVERSION_RATE + penaltyBonus) {
            if (attackingIsHome) homeGoals++; else awayGoals++;
            if (attackingIsHome) { homeShots++; homeSoT++; } else { awayShots++; awaySoT++; }
            if (playerEvents[penaltyTaker.id]) playerEvents[penaltyTaker.id].goals++;
            // The conceding keeper is on the FOULING side.
            foulingSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
            // Momentum swings toward the penalty-scoring (attacking) team
            momentum = attackingIsHome
              ? Math.min(100, momentum + MOMENTUM_PENALTY_SWING)
              : Math.max(-100, momentum - MOMENTUM_PENALTY_SWING);
            events.push({ minute: min, type: 'penalty_scored', playerId: penaltyTaker.id, clubId: attackingClub.id, description: withContextSuffix(pick(penaltyGoalDescs)(penaltyTaker.lastName, attackingClub.shortName)), momentum, homeXG, awayXG });
          } else {
            if (attackingIsHome) homeShots++; else awayShots++;
            events.push({ minute: min, type: 'penalty_missed', playerId: penaltyTaker.id, clubId: attackingClub.id, description: withContextSuffix(pick(penaltyMissDescs)(penaltyTaker.lastName)), momentum, homeXG, awayXG });
          }
        }
      }
    }
    // === OWN GOAL (rare) ===
    // NOTE on ordering: this is an independent draw evaluated for every roll
    // past `foulBandEnd`, so it intercepts OWN_GOAL_CHANCE (0.45%) of the rolls
    // the injury band below would otherwise classify. That is deliberate to
    // leave alone rather than deliberate by design: the measured aggregates sit
    // inside real-football envelopes as they stand (0.493 injuries and 0.018
    // own goals per match over 1500 matches), so re-ordering the branches would
    // shift two calibrated rates to satisfy a comment. Revisit only alongside a
    // recalibration, not on its own.
    //
    // No xG is accrued here, deliberately: an own goal is not a shot by the
    // benefiting team and standard xG models exclude them entirely. (The
    // `goalkeeper_error` branch above likewise adds none of its own — the shot
    // that the keeper fumbled already booked its xG at the shot-attempt roll.)
    else if (Math.random() < OWN_GOAL_CHANCE) {
      const oppEligible = oppSquad.filter(p => !unavailable.has(p.id) && (DEFENDER_POSITIONS as readonly string[]).includes(p.position));
      if (oppEligible.length > 0) {
        const ownGoalPlayer = pick(oppEligible);
        const oppClubRef = isHome ? awayClub : homeClub;
        if (isHome) homeGoals++; else awayGoals++;
        oppSquad.forEach(p => { if (p.position === 'GK' && playerEvents[p.id]) playerEvents[p.id].cleanSheet = false; });
        momentum = isHome
          ? Math.min(100, momentum + MOMENTUM_GOAL_SWING)
          : Math.max(-100, momentum - MOMENTUM_GOAL_SWING);
        events.push({ minute: min, type: 'own_goal', playerId: ownGoalPlayer.id, clubId: club.id, description: withContextSuffix(pick(ownGoalDescs)(ownGoalPlayer.lastName, oppClubRef.shortName)), momentum });
      }
    }
    // === INJURY (non-foul) ===
    else if (roll < foulBandEnd + injuryBandWidth) {
      const eligibleForInjury = squad.filter(p => !unavailable.has(p.id));
      if (eligibleForInjury.length === 0) continue;
      // Injury chance scales with physical fragility, age, and in-match fitness
      const candidate = pick(eligibleForInjury);
      const currentFit = matchFitness[candidate.id] ?? candidate.fitness;
      const lowFitInjuryBonus = currentFit < MATCH_LOW_FITNESS_THRESHOLD ? LOW_FITNESS_INJURY_BONUS : 0;
      // Medical facility level reduces base injury probability
      const medLevel = isHome ? (homeMedicalLevel ?? 5) : (awayMedicalLevel ?? 5);
      const medPrevention = medLevel * MEDICAL_INJURY_PREVENTION_PER_LEVEL;
      // Re-injury risk: players returning from injury with active reinjuryWeeksRemaining have elevated chance
      const reinjuryBonus = (candidate.injuryDetails?.reinjuryWeeksRemaining ?? 0) > 0 ? REINJURY_MATCH_CHECK_CHANCE : 0;
      const injuryProb = Math.max(0.005, NON_FOUL_INJURY_BASE + ((100 - candidate.attributes.physical) * PHYSICAL_FRAGILITY_FACTOR) + (candidate.age > OLD_PLAYER_INJURY_AGE_THRESHOLD ? OLD_PLAYER_INJURY_BONUS : 0) + lowFitInjuryBonus + reinjuryBonus - medPrevention);
      if (Math.random() < injuryProb) {
        const details = generateInjuryDetails(false, medLevel);
        matchInjuries[candidate.id] = details;
        injuredSet.add(candidate.id);
        unavailable.add(candidate.id);
        const injLabel = INJURY_TYPES[details.type].label;
        const sevLabel = details.severity === 'minor' ? 'Minor' : details.severity === 'moderate' ? 'Moderate' : 'Serious';
        const nonFoulInjDesc = `${pick(injuryDescs)(candidate.lastName)} ${sevLabel} ${injLabel} — ${details.weeksRemaining} week${details.weeksRemaining > 1 ? 's' : ''} out.`;
        events.push({ minute: min, type: 'injury', playerId: candidate.id, clubId: club.id, description: nonFoulInjDesc + (maybeWeatherSuffix() || maybePitchSuffix()) });
        // Rebalance strength after injury (numerical disadvantage; GK may be the casualty)
        recomputeStrengths();
        refreshDefenceMetrics();
        // AI substitution for injured player (non-player team only)
        const candIsHome = club.id === homeClub.id;
        const candIsPlayerTeam = club.id === playerClubId;
        if (!candIsPlayerTeam) {
          const subResult2 = tryAISub(candIsHome ? homeBenchPool : awayBenchPool, candIsHome ? [...homePlayers, ...homeSubbedIn] : [...awayPlayers, ...awaySubbedIn], unavailable, candIsHome ? homeSubsUsed : awaySubsUsed, 'injury', candidate, undefined, undefined, min);
          if (subResult2) {
            const { inPlayer, outPlayer } = subResult2;
            if (candIsHome) { homeSubsUsed++; homeActive.add(inPlayer.id); homeSubbedIn.push(inPlayer); } else { awaySubsUsed++; awayActive.add(inPlayer.id); awaySubbedIn.push(inPlayer); }
            const benchPool2 = candIsHome ? homeBenchPool : awayBenchPool;
            const benchIdx2 = benchPool2.findIndex(p => p.id === inPlayer.id);
            if (benchIdx2 >= 0) benchPool2.splice(benchIdx2, 1);
            if (!playerEvents[inPlayer.id]) playerEvents[inPlayer.id] = { goals: 0, assists: 0, yellows: 0, redCard: false, saves: 0, cleanSheet: true, goalsAtEntry: candIsHome ? awayGoals : homeGoals };
            matchFitness[inPlayer.id] = Math.min(100, inPlayer.fitness + SUB_ENTRY_FITNESS_BOOST);
            events.push({ minute: min, type: 'substitution', playerId: inPlayer.id, assistPlayerId: outPlayer.id, clubId: club.id, description: pickSubDesc(inPlayer.lastName, outPlayer.lastName, club.shortName, true) });
            recomputeStrengths();
            refreshDefenceMetrics();
          }
        }
      }
    }
    // === COMMENTARY FALLBACK (event roll passed but no shot/foul/injury triggered) ===
    else if (Math.random() < COMMENTARY_CHANCE) {
      const desc = generateCommentary(min, homeClub.shortName, awayClub.shortName, homeGoals, awayGoals, isHome, momentum, matchWeather?.weather, matchWeather?.pitch, derbyIntensity, usedLines);
      // Possession shifts toward the team with the ball
      momentum = isHome
        ? Math.min(100, momentum + MOMENTUM_COMMENTARY_SWING)
        : Math.max(-100, momentum - MOMENTUM_COMMENTARY_SWING);
      events.push({ minute: min, type: 'commentary', clubId: club.id, description: desc, momentum });
    }
    // === AI TACTICAL SUBSTITUTIONS at key minutes ===
    if (AI_SUB_CHECK_MINUTES.includes(min)) {
      // Home team AI tactical sub (skip if player's team)
      if (homeClub.id !== playerClubId && homeSubsUsed < MAX_SUBSTITUTIONS && homeBenchPool.length > 0 && Math.random() < AI_TACTICAL_SUB_CHANCE) {
        const homeLosing = homeGoals < awayGoals;
        const homeGoalDiff = homeGoals - awayGoals;
        const homeSentOff = [...homePlayers, ...homeSubbedIn].filter(p => sentOffSet.has(p.id)).length;
        const aiSub = tryAISub(homeBenchPool, [...homePlayers, ...homeSubbedIn], unavailable, homeSubsUsed, 'tactical', undefined, matchFitness, homeLosing, min, homeGoalDiff, homeSentOff);
        if (aiSub) {
          homeSubsUsed++; homeActive.add(aiSub.inPlayer.id);
          homeSubbedIn.push(aiSub.inPlayer);
          unavailable.add(aiSub.outPlayer.id); // Subbed-out player can't return to the pitch
          subbedOutSet.add(aiSub.outPlayer.id); // …including in later halves / extra time
          const bIdx = homeBenchPool.findIndex(p => p.id === aiSub.inPlayer.id);
          if (bIdx >= 0) homeBenchPool.splice(bIdx, 1);
          if (!playerEvents[aiSub.inPlayer.id]) playerEvents[aiSub.inPlayer.id] = { goals: 0, assists: 0, yellows: 0, redCard: false, saves: 0, cleanSheet: true, goalsAtEntry: awayGoals };
          matchFitness[aiSub.inPlayer.id] = Math.min(100, aiSub.inPlayer.fitness + SUB_ENTRY_FITNESS_BOOST);
          events.push({ minute: min, type: 'substitution', playerId: aiSub.inPlayer.id, assistPlayerId: aiSub.outPlayer.id, clubId: homeClub.id, description: pickSubDesc(aiSub.inPlayer.lastName, aiSub.outPlayer.lastName, homeClub.shortName, false) });
          recomputeStrengths();
          refreshDefenceMetrics();
        }
      }
      // Away team AI tactical sub (skip if player's team)
      if (awayClub.id !== playerClubId && awaySubsUsed < MAX_SUBSTITUTIONS && awayBenchPool.length > 0 && Math.random() < AI_TACTICAL_SUB_CHANCE) {
        const awayLosing = awayGoals < homeGoals;
        const awayGoalDiff = awayGoals - homeGoals;
        const awaySentOff = [...awayPlayers, ...awaySubbedIn].filter(p => sentOffSet.has(p.id)).length;
        const aiSub = tryAISub(awayBenchPool, [...awayPlayers, ...awaySubbedIn], unavailable, awaySubsUsed, 'tactical', undefined, matchFitness, awayLosing, min, awayGoalDiff, awaySentOff);
        if (aiSub) {
          awaySubsUsed++; awayActive.add(aiSub.inPlayer.id);
          awaySubbedIn.push(aiSub.inPlayer);
          unavailable.add(aiSub.outPlayer.id); // Subbed-out player can't return to the pitch
          subbedOutSet.add(aiSub.outPlayer.id); // …including in later halves / extra time
          const bIdx = awayBenchPool.findIndex(p => p.id === aiSub.inPlayer.id);
          if (bIdx >= 0) awayBenchPool.splice(bIdx, 1);
          if (!playerEvents[aiSub.inPlayer.id]) playerEvents[aiSub.inPlayer.id] = { goals: 0, assists: 0, yellows: 0, redCard: false, saves: 0, cleanSheet: true, goalsAtEntry: homeGoals };
          matchFitness[aiSub.inPlayer.id] = Math.min(100, aiSub.inPlayer.fitness + SUB_ENTRY_FITNESS_BOOST);
          events.push({ minute: min, type: 'substitution', playerId: aiSub.inPlayer.id, assistPlayerId: aiSub.outPlayer.id, clubId: awayClub.id, description: pickSubDesc(aiSub.inPlayer.lastName, aiSub.outPlayer.lastName, awayClub.shortName, false) });
          recomputeStrengths();
          refreshDefenceMetrics();
        }
      }
    }

    // Update last event tracker
    if (events.length > 0 && events[events.length - 1].minute === min) {
      lastEventMinute = min;
    }
    // Attach pending fitness snapshot to the first event generated after the snapshot was taken
    if (fitnessSnapshot && events.length > prevEventCount) {
      events[events.length - 1].playerFitness = fitnessSnapshot;
      fitnessSnapshot = undefined;
    }
  }

  // Flush any remaining fitness snapshot to the last event
  if (fitnessSnapshot && events.length > 0) {
    events[events.length - 1].playerFitness = fitnessSnapshot;
    fitnessSnapshot = undefined;
  }

  // Add half-time marker at end of first half (only once). The 'added_time'
  // announcement no longer trips this check (it used to be typed half_time,
  // which suppressed the divider whenever stoppage time was announced).
  if (isFirstHalf && !events.some(e => e.type === 'half_time')) {
    events.push({ minute: 45 + stoppageTime, type: 'half_time', clubId: '', description: '— Half Time —' });
  }

  // Stoppage-time events were recorded at literal minutes past the half's
  // nominal end (46-52 for H1), colliding with real second-half minutes and
  // double-counting inside H2's calcStoppageTime window [46, 90]. Clamp the
  // stored minute to the nominal end and carry the human-readable label
  // ("45+2") on the optional displayMinute field. Array order is preserved,
  // so minutes stay non-decreasing for the MatchDay ticker cursor. Extra-time
  // halves never set stoppageTime (min === nominalEnd is outside their
  // 91-120 range), so ET minutes are untouched.
  if (stoppageTime > 0) {
    for (const ev of events) {
      if (ev.minute > nominalEnd && ev.minute <= nominalEnd + stoppageTime) {
        ev.displayMinute = `${nominalEnd}+${ev.minute - nominalEnd}`;
        ev.minute = nominalEnd;
      }
    }
  }

  // Stamp momentum snapshot on each event for UI visualization
  // Events that already have momentum set inline use their real value;
  // others inherit the last known momentum state
  let runningMomentum = prevState?.momentum ?? 0;
  for (const ev of events) {
    if (ev.type === 'kickoff') { runningMomentum = 0; ev.momentum = 0; }
    else if (ev.momentum !== undefined) { runningMomentum = ev.momentum; }
    else { ev.momentum = runningMomentum; }
  }

  return {
    events, homeGoals, awayGoals, homeShots, awayShots, homeSoT, awaySoT,
    homeFouls, awayFouls, homeCorners, awayCorners, sentOff: Array.from(sentOffSet), injured: Array.from(injuredSet), subbedOut: Array.from(subbedOutSet), playerEvents,
    momentum, homeXG, awayXG, matchInjuries,
    homeSubsUsed, awaySubsUsed,
    homeBench: homeBenchPool, awayBench: awayBenchPool,
    homeSubbedIn, awaySubbedIn,
    playerFitness: { ...matchFitness },
    tacticalInsights,
    usedCommentaryLines: usedLines,
    abandoned: abandonMatch,
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
  /** Optional lookup to resolve participants no longer in the passed lineup
   *  arrays — e.g. starters subbed out at half-time, whom the second-half
   *  lineups omit but who still deserve a rating + match-history record.
   *  Interactive callers (matchActions) pass the store's players record;
   *  simulateMatch doesn't need it (its lineups cover all participants). */
  playersById?: Record<string, Player>,
): { result: Match; playerRatings: PlayerMatchRating[] } {
  const total = computeStrengths(homeClub, awayClub, homePlayers, awayPlayers);
  const totalStr = total.homeStr + total.awayStr;
  // Blend strength-based possession with actual match events for realism
  const strengthShare = totalStr > 0 ? total.homeStr / totalStr : 0.5;
  const totalShots = state.homeShots + state.awayShots;
  const shotShare = totalShots > 0 ? state.homeShots / totalShots : 0.5;
  const goalDiff = state.homeGoals - state.awayGoals;
  const resultBias = goalDiff > 0 ? 0.04 : goalDiff < 0 ? -0.04 : 0;
  const rawPoss = strengthShare * 0.40 + shotShare * 0.40 + 0.10 + resultBias + (Math.random() - 0.5) * 0.08;
  const homePoss = Math.round(Math.max(25, Math.min(75, rawPoss * 100)));

  // Full-time marker sits at the last simulated minute (extra time pushes it
  // to 120; a clamped regular match ends at 90) instead of a hardcoded 90.
  const lastSimulatedMinute = state.events.reduce((m, e) => Math.max(m, e.minute), 90);
  state.events.push({ minute: lastSimulatedMinute, type: 'full_time', clubId: '', description: `— Full Time: ${homeClub.shortName} ${state.homeGoals} - ${state.awayGoals} ${awayClub.shortName} —` });

  const stats: MatchStats = {
    homePossession: homePoss, awayPossession: 100 - homePoss,
    homeShots: state.homeShots, awayShots: state.awayShots,
    homeShotsOnTarget: state.homeSoT, awayShotsOnTarget: state.awaySoT,
    homeFouls: state.homeFouls, awayFouls: state.awayFouls,
    homeCorners: state.homeCorners, awayCorners: state.awayCorners,
    homeXG: Math.round(state.homeXG * 100) / 100,
    awayXG: Math.round(state.awayXG * 100) / 100,
  };

  // Include subbed-in players for ratings (starters + subs from HalfState)
  const allHomePlayers = [...homePlayers, ...(state.homeSubbedIn || [])];
  const allAwayPlayers = [...awayPlayers, ...(state.awaySubbedIn || [])];
  // Anyone with a playerEvents entry actually participated. Half-time-subbed-
  // out starters are absent from the (second-half) lineup arrays AND from the
  // engine's subbedIn lists — resolve their Player objects via playersById
  // and attribute the side by clubId. Without the lookup (or for ids that
  // don't resolve to either club) behavior is unchanged: they're skipped.
  if (playersById) {
    const knownIds = new Set([...allHomePlayers, ...allAwayPlayers].map(p => p.id));
    for (const pid of Object.keys(state.playerEvents)) {
      if (knownIds.has(pid)) continue;
      const p = playersById[pid];
      if (!p) continue;
      if (p.clubId === homeClub.id) allHomePlayers.push(p);
      else if (p.clubId === awayClub.id) allAwayPlayers.push(p);
    }
  }
  const allMatchPlayers = [...allHomePlayers, ...allAwayPlayers];
  const playerRatings: PlayerMatchRating[] = allMatchPlayers.map(p => {
    const ev = state.playerEvents[p.id];
    const isHomeSide = allHomePlayers.some(hp => hp.id === p.id);
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
      // GK clean sheet: team must have kept a real clean sheet (0 goals conceded)
      // AND the GK must not have conceded after entry
      if (p.position === 'GK') {
        const totalConceded = isHomeSide ? state.awayGoals : state.homeGoals;
        const concededAfterEntry = totalConceded - (ev.goalsAtEntry ?? 0);
        if (totalConceded === 0 && concededAfterEntry === 0) rating += RATING_CLEAN_SHEET_BONUS;
      }
    }

    // Attribute-based contribution bonus (defenders get credit for defending, midfielders for passing)
    if (['CB', 'LB', 'RB'].includes(p.position)) {
      rating += (p.attributes.defending / 100) * RATING_DEFENDER_SCALE - RATING_DEFENDER_OFFSET;
    } else if (['CM', 'CDM', 'CAM'].includes(p.position)) {
      rating += (p.attributes.passing / 100) * RATING_MIDFIELDER_SCALE - RATING_MIDFIELDER_OFFSET;
    }

    // Fitness penalty for exhausted players — use the in-match fitness the
    // engine tracked (pre-match p.fitness as fallback for AI quick paths)
    const endFitness = state.playerFitness?.[p.id] ?? p.fitness;
    if (endFitness <= RATING_EXHAUSTION_THRESHOLD) rating -= RATING_EXHAUSTION_PENALTY;

    rating += (Math.random() - 0.5) * RATING_VARIANCE;
    rating = Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(rating * 10) / 10));
    return { playerId: p.id, rating, goals: ev?.goals || 0, assists: ev?.assists || 0, yellowCards: ev?.yellows || 0, redCards: ev?.redCard ? 1 : 0 };
  });

  return {
    result: { ...match, played: true, homeGoals: state.homeGoals, awayGoals: state.awayGoals, events: state.events, stats },
    playerRatings,
  };
}

// `isSquadValid` is exported from `./match/helpers.ts`.

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
  currentSeason?: number,
  careerDisciplineMod?: number,
  homeBench?: Player[],
  awayBench?: Player[],
  matchWeather?: MatchWeather,
  setPieceCoachBonus?: number,
  /** Medical Centre level (0-10) for each side. The player's club must pass
   *  `facilities.medicalLevel` — the level they actually paid to upgrade.
   *  Omitted for AI-vs-AI, where `clubMedicalLevel` derives it from the club's
   *  static rating. Passing `club.facilities` raw is wrong: that is a fixed
   *  quality rating on a different scale which never reflects an upgrade. */
  homeMedicalLevel?: number,
  awayMedicalLevel?: number,
): { result: Match; playerRatings: PlayerMatchRating[]; matchInjuries: Record<string, InjuryDetails> } {
  // Generate weather if not provided
  const weather = matchWeather || generateMatchWeather();
  // Resolve each side's Medical Centre level. Callers that know the player's
  // upgraded level pass it; otherwise derive it from the club's static rating.
  const homeMed = homeMedicalLevel ?? clubMedicalLevel(homeClub.facilities);
  const awayMed = awayMedicalLevel ?? clubMedicalLevel(awayClub.facilities);
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
      matchInjuries: {},
    };
  }
  // Use club-specific AI tactics when available, falling back to balanced defaults
  const effectiveHomeTactics = homeTactics ?? homeClub.aiManagerProfile?.defaultTactics ?? AI_DEFAULT_TACTICS;
  const effectiveAwayTactics = awayTactics ?? awayClub.aiManagerProfile?.defaultTactics ?? AI_DEFAULT_TACTICS;

  // Simulate first half (1-45)
  const firstHalf = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 1, 45, effectiveHomeTactics, effectiveAwayTactics, tacticalFamiliarity, playerClubId, undefined, derbyIntensity, disciplinarianActive, homeMed, awayMed, currentSeason, careerDisciplineMod, homeBench, awayBench, undefined, weather, setPieceCoachBonus);

  // AI tactical reactivity: adjust tactics for second half based on scoreline
  let secondHalfHomeTactics = effectiveHomeTactics;
  let secondHalfAwayTactics = effectiveAwayTactics;

  // Gated on "not the player's club" — see the in-half reactivity note in
  // simulateHalf: callers always pass tactics, so `!homeTactics` never fired.
  if (homeClub.id !== playerClubId && homeClub.aiManagerProfile) {
    secondHalfHomeTactics = getAIReactiveTactics(homeClub.aiManagerProfile, true, firstHalf.homeGoals, firstHalf.awayGoals, 45);
  }
  if (awayClub.id !== playerClubId && awayClub.aiManagerProfile) {
    secondHalfAwayTactics = getAIReactiveTactics(awayClub.aiManagerProfile, false, firstHalf.homeGoals, firstHalf.awayGoals, 45);
  }

  // Simulate second half (46-90) with potentially adjusted AI tactics
  const fullState = simulateHalf(homeClub, awayClub, homePlayers, awayPlayers, 46, 90, secondHalfHomeTactics, secondHalfAwayTactics, tacticalFamiliarity, playerClubId, firstHalf, derbyIntensity, disciplinarianActive, homeMed, awayMed, currentSeason, careerDisciplineMod, homeBench, awayBench, undefined, weather, setPieceCoachBonus);

  const finalized = finalizeMatch(match, homeClub, awayClub, homePlayers, awayPlayers, fullState);
  // Attach weather to the match result
  finalized.result.weather = weather;
  return { ...finalized, matchInjuries: fullState.matchInjuries };
}
