/**
 * Pure helpers extracted from orchestrationSlice.ts.
 *
 * Each function in this file:
 *   - Has no dependency on Zustand `set` / `get`.
 *   - Has no module-level mutable state.
 *
 * If you need to reach back into the slice, keep the helper inside
 * orchestrationSlice.ts. This file is for the cleanly-pure subset.
 */
import type {
  MatchEvent,
  Player,
  Club,
  BoardObjective,
  LeagueId,
  InjuryType,
  InjurySeverity,
  InjuryDetails,
  CupState,
  LeagueCupState,
  ContinentalTournamentState,
  SuperCupMatch,
  Match,
} from '@/types/game';
import { LEAGUES } from '@/data/league';
import {
  BOARD_OBJ_XP_CRITICAL,
  BOARD_OBJ_XP_IMPORTANT,
  BOARD_OBJ_XP_OPTIONAL,
  BOARD_OBJ_XP_OVERACHIEVE_MULT,
  BOARD_OBJ_BUDGET_BOOST,
  RED_CARD_SUSPENSION_MIN,
  RED_CARD_SUSPENSION_RANGE,
  MEDICAL_LEVEL_FACTOR,
  FACILITY_MAX_LEVEL,
  MEDICAL_REINJURY_REDUCTION_PER_LEVEL,
  FORM_WIN_CHANGE,
  FORM_LOSS_CHANGE,
  FORM_DRAW_CHANGE,
  INJURY_TYPES,
  NON_FOUL_INJURY_TYPE_WEIGHTS,
  INJURY_SEVERITY_WEIGHTS,
  CATCH_UP_EXPECTED_GOALS,
  YELLOW_ACCUMULATION_THRESHOLDS,
  YELLOW_ACCUMULATION_BAN_WEEKS,
  RATING_MORALE_BASELINE,
  FORM_PER_RATING_POINT,
  FORM_RATING_ADJ_CAP,
} from '@/config/gameBalance';
import { GOAL_EVENT_TYPES, HOME_ADVANTAGE } from '@/config/matchEngine';
import { resetRealPlayerClaims, claimRealPlayer } from '@/utils/realPlayerPicker';
import { getOpponentQualityBonus } from '@/utils/teamRankings';
import { selectBestLineup, getTeamStrength } from '@/utils/playerGen';
import {
  AI_MIN_MATCH_PLAYERS,
  AI_RATING_BASE_WIN, AI_RATING_BASE_DRAW, AI_RATING_BASE_LOSS,
  AI_RATING_OVERALL_PIVOT, AI_RATING_OVERALL_SCALE,
} from '@/config/aiSimulation';

/**
 * Reset the module-level real-player claim registry and re-claim every
 * persisted FC-backed player. Procedural players carry no `fcId` and
 * must NOT be claimed — claiming a generated "Pieter Jansen" would
 * later block a real FC26 player who happens to share that name and
 * push the picker into procedural fallback unnecessarily.
 */
export function rebuildRealPlayerClaims(players: Record<string, Player>): void {
  resetRealPlayerClaims();
  for (const p of Object.values(players)) {
    if (!p.fcId) continue;
    claimRealPlayer({ fcId: p.fcId, fn: p.firstName, ln: p.lastName });
  }
}

/**
 * Find any tournament match for the player this week (cup, league cup,
 * continental group + knockout, super cups). Pure — lives here so both the
 * UI selectors (useGameSelectors) and store actions (advanceToNextMatch)
 * share ONE definition of "the player has a tournament match this week".
 * advanceToNextMatch previously re-implemented a subset that omitted the
 * three continental tournaments, letting "Skip to Next Match" advance
 * through a continental week and permanently hang the tournament.
 */
export function findTournamentMatch(s: { week: number; playerClubId: string; cup: CupState; leagueCup: LeagueCupState | null; championsCup: ContinentalTournamentState | null; shieldCup: ContinentalTournamentState | null; conferenceCup?: ContinentalTournamentState | null; domesticSuperCup: SuperCupMatch | null; continentalSuperCup: SuperCupMatch | null }): { homeClubId: string; awayClubId: string; competition: string } | null {
  const w = s.week;
  const pid = s.playerClubId;
  // ORDER IS LOAD-BEARING and must match `playCurrentMatchImpl`'s detection
  // chain exactly: continental → cup → leagueCup → superCup. It used to run
  // cup → leagueCup → continental here, so on a week holding both a cup tie and
  // a continental fixture the UI announced the cup tie while the engine played
  // the continental one — different opponent, possibly flipped home/away, wrong
  // competition badge, wrong lineup prepared. If you change the priority in one
  // place, change it in the other.

  // Continental group + knockout
  for (const [tourney, name] of [[s.championsCup, 'Champions Cup'], [s.shieldCup, 'Shield Cup'], [s.conferenceCup || null, 'Conference Cup']] as const) {
    if (!tourney) continue;
    for (const group of tourney.groups || []) {
      for (const m of group.matches || []) {
        if (m.played || m.week !== w) continue;
        if (m.homeClubId === pid || m.awayClubId === pid) return { homeClubId: m.homeClubId, awayClubId: m.awayClubId, competition: name as string };
      }
    }
    for (const tie of tourney.knockoutTies || []) {
      if (tie.homeClubId !== pid && tie.awayClubId !== pid) continue;
      if (!tie.leg1Played && tie.week1 === w) return { homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, competition: name as string };
      if (tie.leg1Played && !tie.leg2Played && tie.week2 === w && tie.round !== 'F') return { homeClubId: tie.awayClubId, awayClubId: tie.homeClubId, competition: name as string };
    }
  }
  // Dynasty Cup
  const cupTie = s.cup?.ties?.find(t => t.week === w && !t.played && (t.homeClubId === pid || t.awayClubId === pid));
  if (cupTie) return { homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, competition: 'Dynasty Cup' };
  // League Cup
  const lcTie = s.leagueCup?.ties?.find(t => t.week === w && !t.played && (t.homeClubId === pid || t.awayClubId === pid));
  if (lcTie) return { homeClubId: lcTie.homeClubId, awayClubId: lcTie.awayClubId, competition: 'League Cup' };
  // Super cups
  const dsc = s.domesticSuperCup;
  if (dsc && !dsc.played && w >= dsc.week && (dsc.homeClubId === pid || dsc.awayClubId === pid)) return { homeClubId: dsc.homeClubId, awayClubId: dsc.awayClubId, competition: 'Super Cup' };
  const csc = s.continentalSuperCup;
  if (csc && !csc.played && w >= csc.week && (csc.homeClubId === pid || csc.awayClubId === pid)) return { homeClubId: csc.homeClubId, awayClubId: csc.awayClubId, competition: 'Continental Super Cup' };
  return null;
}

/**
 * Yellow-card accumulation ban.
 *
 * Yellows were incremented and then caused NOTHING — only reds suspended
 * anyone, so `pressingIntensity`, `personality.temperament`, the
 * `disciplinarian` perk and squad depth were all disconnected from discipline.
 *
 * Thresholds are per-season because `seasonEnd.ts` resets `yellowCards` to 0
 * (and clears `suspendedUntilWeek`) at rollover — no extra persisted field is
 * needed. A player picking up two yellows in one match (without a second-yellow
 * red) can cross a threshold from below, so we test for *crossing* rather than
 * equality.
 *
 * Returns the week the player is suspended until, or `null` for no ban.
 * `suspendedUntilWeek > week` is the "is suspended" test used everywhere, so
 * `week + 1 + banWeeks` makes him miss exactly `banWeeks` following weeks.
 */
export function getYellowAccumulationBanWeek(
  previousYellows: number,
  newYellows: number,
  week: number,
): number | null {
  const crossed = YELLOW_ACCUMULATION_THRESHOLDS.some(
    t => previousYellows < t && newYellows >= t,
  );
  if (!crossed) return null;
  return week + 1 + YELLOW_ACCUMULATION_BAN_WEEKS;
}

/**
 * Per-player minutes played, derived from the match event stream.
 *
 * The engine models per-minute fatigue and per-minute participation and then
 * threw both away: every participant took the same flat post-match drain and
 * `minutesPlayed` did not exist anywhere in the codebase. Deriving minutes from
 * the events keeps this a pure function of the persisted `Match`, so it works
 * for the player's match, AI-vs-AI matches, and replays alike.
 *
 * A player's shift ends at the earliest of: being substituted off, being sent
 * off, or going down injured with no replacement. It starts at the minute he
 * came on (0 for starters).
 */
export function computeMinutesPlayed(
  events: Pick<MatchEvent, 'minute' | 'type' | 'playerId' | 'assistPlayerId'>[],
  participantIds: string[],
): Record<string, number> {
  let fullTime = 90;
  const cameOn: Record<string, number> = {};
  const wentOff: Record<string, number> = {};
  const noteOff = (id: string, minute: number) => {
    if (wentOff[id] === undefined || minute < wentOff[id]) wentOff[id] = minute;
  };
  for (const ev of events) {
    if (ev.minute > fullTime) fullTime = ev.minute;
    if (ev.type === 'substitution') {
      // `playerId` comes on, `assistPlayerId` goes off (see makeMatchSub).
      if (ev.playerId && cameOn[ev.playerId] === undefined) cameOn[ev.playerId] = ev.minute;
      if (ev.assistPlayerId) noteOff(ev.assistPlayerId, ev.minute);
    } else if (ev.type === 'red_card' && ev.playerId) {
      noteOff(ev.playerId, ev.minute);
    } else if (ev.type === 'injury' && ev.playerId) {
      // If he was substituted the substitution event above gives the same or a
      // later minute; `noteOff` keeps the earlier one either way.
      noteOff(ev.playerId, ev.minute);
    }
  }
  const out: Record<string, number> = {};
  for (const id of participantIds) {
    const start = cameOn[id] ?? 0;
    const end = wentOff[id] ?? fullTime;
    // Floor at 1: a stoppage-time substitute has his minute clamped to the
    // half's nominal end (see MatchEvent.displayMinute), which would otherwise
    // credit a player who demonstrably took the pitch with zero minutes.
    out[id] = Math.max(1, Math.round(end - start));
  }
  return out;
}

/**
 * Last known in-match fitness per player, recovered from the periodic snapshots
 * the engine stamps onto events (`FITNESS_SNAPSHOT_INTERVAL`). Snapshots skip
 * players who have become unavailable, so merging forwards and keeping the last
 * seen value gives a subbed-off / sent-off / injured player the fitness he had
 * when he left the pitch rather than a full-90 figure.
 *
 * Reading it off the `Match` (rather than plumbing `HalfState` through every
 * call site) keeps this usable from the shared post-match path.
 */
export function extractFinalMatchFitness(
  events: Pick<MatchEvent, 'playerFitness'>[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of events) {
    if (!ev.playerFitness) continue;
    for (const [pid, fit] of Object.entries(ev.playerFitness)) {
      if (typeof fit === 'number' && Number.isFinite(fit)) out[pid] = fit;
    }
  }
  return out;
}

/** Weighted random pick from a record of weights */
export function weightedPickFromRecord<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w as number), 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight as number;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Generate injury details for AI match processing */
export function generateAIInjuryDetails(medicalLevel: number = 5): InjuryDetails {
  const type = weightedPickFromRecord(NON_FOUL_INJURY_TYPE_WEIGHTS) as InjuryType;
  const severity = weightedPickFromRecord(INJURY_SEVERITY_WEIGHTS) as InjurySeverity;
  const config = INJURY_TYPES[type];
  const [minWeeks, maxWeeks] = config.weeks[severity];
  const weeksRaw = Math.max(1, minWeeks + Math.floor(Math.random() * (maxWeeks - minWeeks + 1)));
  const medicalReduction = Math.max(0, Math.floor(medicalLevel / 5));
  const weeks = Math.max(1, weeksRaw - medicalReduction);
  return {
    type, severity, weeksRemaining: weeks, totalWeeks: weeks,
    reinjuryRisk: Math.max(0, config.reinjuryRisk[severity] - medicalLevel * MEDICAL_REINJURY_REDUCTION_PER_LEVEL),
    reinjuryWeeksRemaining: config.reinjuryDuration[severity],
    fitnessOnReturn: config.fitnessOnReturn[severity],
  };
}

/** Apply AI match events to players: goals, assists, injuries, cards, suspensions. */
export function applyAIMatchEvents(
  // Widened from a hand-rolled subset to the real event shape: `minute` is
  // needed to derive minutes played, and every caller already passes
  // `result.events` (a full MatchEvent[]).
  events: MatchEvent[],
  newPlayers: Record<string, Player>,
  clubs: Record<string, Club>,
  week: number,
  homeLineup?: Player[],
  awayLineup?: Player[],
  homeGoals?: number,
  awayGoals?: number,
  rankings?: Record<string, number>,
  homeClubId?: string,
  awayClubId?: string,
) {
  // Track per-player goal/assist counts from events for synthetic rating
  const playerGoalCounts: Record<string, number> = {};
  const playerAssistCounts: Record<string, number> = {};
  for (const ev of events) {
    const isGoalEv = (GOAL_EVENT_TYPES as readonly string[]).includes(ev.type);
    if (isGoalEv && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], goals: newPlayers[ev.playerId].goals + 1 };
      playerGoalCounts[ev.playerId] = (playerGoalCounts[ev.playerId] || 0) + 1;
    }
    if (isGoalEv && ev.type !== 'penalty_scored' && ev.assistPlayerId && newPlayers[ev.assistPlayerId]) {
      newPlayers[ev.assistPlayerId] = { ...newPlayers[ev.assistPlayerId], assists: newPlayers[ev.assistPlayerId].assists + 1 };
      playerAssistCounts[ev.assistPlayerId] = (playerAssistCounts[ev.assistPlayerId] || 0) + 1;
    }
    if (ev.type === 'injury' && ev.playerId && newPlayers[ev.playerId]) {
      const clubFacilities = clubs[newPlayers[ev.playerId].clubId]?.facilities ?? 5;
      const aiMedicalLevel = Math.min(FACILITY_MAX_LEVEL, Math.round(clubFacilities * MEDICAL_LEVEL_FACTOR));
      const injDetails = generateAIInjuryDetails(aiMedicalLevel);
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], injured: true, injuryWeeks: injDetails.weeksRemaining, injuryDetails: injDetails };
    }
    if (ev.type === 'yellow_card' && ev.playerId && newPlayers[ev.playerId]) {
      const prevYellows = newPlayers[ev.playerId].yellowCards;
      const nextYellows = prevYellows + 1;
      const banUntil = getYellowAccumulationBanWeek(prevYellows, nextYellows, week);
      newPlayers[ev.playerId] = {
        ...newPlayers[ev.playerId],
        yellowCards: nextYellows,
        // Never shorten an existing (longer) suspension.
        ...(banUntil != null
          ? { suspendedUntilWeek: Math.max(newPlayers[ev.playerId].suspendedUntilWeek ?? 0, banUntil) }
          : {}),
      };
    }
    if (ev.type === 'red_card' && ev.playerId && newPlayers[ev.playerId]) {
      newPlayers[ev.playerId] = { ...newPlayers[ev.playerId], redCards: newPlayers[ev.playerId].redCards + 1, suspendedUntilWeek: week + 1 + RED_CARD_SUSPENSION_MIN + Math.floor(Math.random() * RED_CARD_SUSPENSION_RANGE) };
    }
  }

  // Track appearances and synthetic match ratings for AI lineups
  if (homeLineup && awayLineup && homeGoals !== undefined && awayGoals !== undefined) {
    // Minutes played: derived from the same event stream the player's club uses,
    // so `Player.minutesPlayed` means the same thing league-wide (and the
    // minutes-based playing-time term in development.ts is comparable across
    // the player's squad and the other 755 clubs).
    const minutes = computeMinutesPlayed(events, [...homeLineup, ...awayLineup].map(p => p.id));
    const sides: { lineup: Player[]; won: boolean; lost: boolean; clubId: string; oppClubId: string }[] = [
      { lineup: homeLineup, won: homeGoals > awayGoals, lost: homeGoals < awayGoals, clubId: homeClubId || '', oppClubId: awayClubId || '' },
      { lineup: awayLineup, won: awayGoals > homeGoals, lost: awayGoals < homeGoals, clubId: awayClubId || '', oppClubId: homeClubId || '' },
    ];
    for (const side of sides) {
      // Opponent quality bonus: performing well against strong teams earns higher ratings
      const oppBonus = rankings && side.clubId && side.oppClubId
        ? getOpponentQualityBonus(rankings[side.clubId] || 800, rankings[side.oppClubId] || 800)
        : 0;
      for (const p of side.lineup) {
        if (!newPlayers[p.id]) continue;
        // Synthetic match rating: base from result + quality + contribution + opponent quality
        let rating = side.won ? AI_RATING_BASE_WIN : side.lost ? AI_RATING_BASE_LOSS : AI_RATING_BASE_DRAW;
        // Quality is RELATIVE to a pivot. `(overall / 100) * 1.5` added ~1.1 to
        // every player regardless of quality, which is most of why the synthetic
        // mean sat 1.14 above the engine's.
        rating += ((p.overall - AI_RATING_OVERALL_PIVOT) / 100) * AI_RATING_OVERALL_SCALE;
        rating += (playerGoalCounts[p.id] || 0) * 0.5;
        rating += (playerAssistCounts[p.id] || 0) * 0.3;
        rating += oppBonus;
        rating += (Math.random() - 0.5) * 0.6;
        rating = Math.max(3, Math.min(10, Math.round(rating * 10) / 10));

        const prev = newPlayers[p.id];
        // Team result stays dominant; the rating only softens or sharpens it.
        const formChange = (side.won ? FORM_WIN_CHANGE : side.lost ? FORM_LOSS_CHANGE : FORM_DRAW_CHANGE)
          + Math.max(-FORM_RATING_ADJ_CAP, Math.min(FORM_RATING_ADJ_CAP,
            (rating - RATING_MORALE_BASELINE) * FORM_PER_RATING_POINT));
        newPlayers[p.id] = {
          ...prev,
          appearances: prev.appearances + 1,
          minutesPlayed: (prev.minutesPlayed || 0) + (minutes[p.id] ?? 0),
          form: Math.min(100, Math.max(10, prev.form + Math.round(formChange))),
          seasonRatingTotal: (prev.seasonRatingTotal || 0) + rating,
          seasonRatedMatches: (prev.seasonRatedMatches || 0) + 1,
        };
      }
    }
  }
}

/** Build the season-start board objectives for a given club. */
export function generateObjectives(club: Club, leagueId?: LeagueId): BoardObjective[] {
  const objectives: BoardObjective[] = [];
  const lid = leagueId || club.divisionId;
  const league = LEAGUES.find(l => l.id === lid);
  const teamCount = league?.teamCount || 20;
  const replacedSlots = league?.replacedSlots || 0;
  const safePos = teamCount - replacedSlots;
  const half = Math.floor(teamCount / 2);

  // League objectives based on reputation
  if (club.reputation >= 5) {
    objectives.push({ id: '1', description: 'Win the League', priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: 1, targetOverachieve: 1,
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL });
    objectives.push({ id: '2', description: 'Finish in Top 3', priority: 'important', completed: false,
      checkType: 'league_position', targetMin: 3, targetOverachieve: 1,
      xpReward: BOARD_OBJ_XP_IMPORTANT, xpRewardOverachieve: BOARD_OBJ_XP_IMPORTANT * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '1', description: 'Finish in Top 6', priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: 6, targetOverachieve: 3,
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
    objectives.push({ id: '2', description: `Reach Top Half`, priority: 'important', completed: false,
      checkType: 'league_position', targetMin: half, targetOverachieve: 6,
      xpReward: BOARD_OBJ_XP_IMPORTANT, xpRewardOverachieve: BOARD_OBJ_XP_IMPORTANT * BOARD_OBJ_XP_OVERACHIEVE_MULT });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '1', description: 'Reach Top Half', priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: half, targetOverachieve: Math.max(1, half - 3),
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
  } else {
    const target = replacedSlots > 0 ? safePos : half;
    const desc = replacedSlots > 0 ? `Avoid Replacement (Top ${safePos})` : 'Finish in Top Half';
    objectives.push({ id: '1', description: desc, priority: 'critical', completed: false,
      checkType: 'league_position', targetMin: target, targetOverachieve: Math.max(1, target - 4),
      xpReward: BOARD_OBJ_XP_CRITICAL, xpRewardOverachieve: BOARD_OBJ_XP_CRITICAL * BOARD_OBJ_XP_OVERACHIEVE_MULT,
      budgetBoost: BOARD_OBJ_BUDGET_BOOST });
  }

  // Cup objectives based on reputation
  if (club.reputation >= 5) {
    objectives.push({ id: '4', description: 'Win the Cup', priority: 'important', completed: false,
      checkType: 'cup_round', targetMin: 1, xpReward: BOARD_OBJ_XP_IMPORTANT });
  } else if (club.reputation >= 4) {
    objectives.push({ id: '4', description: 'Reach Cup Semi-Final', priority: 'important', completed: false,
      checkType: 'cup_round', targetMin: 2, targetOverachieve: 1,
      xpReward: BOARD_OBJ_XP_IMPORTANT, xpRewardOverachieve: BOARD_OBJ_XP_IMPORTANT * BOARD_OBJ_XP_OVERACHIEVE_MULT });
  } else if (club.reputation >= 3) {
    objectives.push({ id: '4', description: 'Reach Cup Quarter-Final', priority: 'optional', completed: false,
      checkType: 'cup_round', targetMin: 3, targetOverachieve: 2,
      xpReward: BOARD_OBJ_XP_OPTIONAL, xpRewardOverachieve: BOARD_OBJ_XP_OPTIONAL * BOARD_OBJ_XP_OVERACHIEVE_MULT });
  }

  objectives.push({ id: '3', description: 'Stay within budget', priority: 'optional', completed: false,
    checkType: 'budget', targetMin: 0,
    xpReward: BOARD_OBJ_XP_OPTIONAL });

  return objectives;
}

/**
 * Build an AI club's XI and bench for a simulated match.
 *
 * WHY THIS EXISTS: every AI-sim site used to do
 * `club.playerIds.map(...).filter(p => !p.injured).slice(0, LINEUP_SIZE)` —
 * i.e. the first 11 players in raw `playerIds` insertion order. `isSquadValid`
 * (engine/match.ts) requires a goalkeeper among the starters and forfeits 3-0
 * otherwise, and MEASURED AT INIT, 23 of 92 English clubs (25%) had no GK in
 * that slice. So P(at least one side invalid) was ~44% on day one, and it got
 * worse as transfers shuffled roster order: a full simulated season produced
 * 1,119 forfeits out of 1,712 fixtures — 65%.
 *
 * Everything downstream was therefore fiction: league tables, promotion and
 * relegation, position prize money, top scorers, goals/cards per match, and any
 * balance measurement taken against a live save rather than an isolated engine
 * harness.
 *
 * `selectBestLineup` picks position-aware against the club's actual formation
 * and already excludes injured, on-loan and suspended players, so it fills the
 * GK slot whenever the squad contains any goalkeeper at all.
 *
 * `honourSavedLineup` is for the one club that has a human opinion: when the
 * player's own league fixture gets auto-simmed because a higher-priority match
 * took the week, their saved XI is what should take the field, not the
 * optimizer's. Slot order is preserved (chemistry links and formation rendering
 * align by index), and only unavailable or missing entries are replaced.
 */
export function pickAiMatchSquad(
  club: Club,
  players: Record<string, Player>,
  week: number,
  honourSavedLineup = false,
): { xi: Player[]; bench: Player[] } {
  const squad = club.playerIds.map(id => players[id]).filter(Boolean);
  const { lineup, subs } = selectBestLineup(squad, club.formation, week);
  let xi = lineup;
  let bench = subs;

  if (honourSavedLineup && club.lineup?.length) {
    const isAvailable = (p: Player) =>
      !!p && !p.injured && !p.onLoan && !(p.suspendedUntilWeek && p.suspendedUntilWeek > week);
    const used = new Set<string>();
    const take = (id: string | undefined) => {
      const p = id ? players[id] : undefined;
      if (!p || used.has(p.id) || !isAvailable(p)) return undefined;
      used.add(p.id);
      return p;
    };
    // Walk the saved XI slot by slot; cover each hole with the optimizer's pick
    // for that slot, then anything else it rated highly.
    const cover = [...lineup, ...subs];
    let coverIdx = 0;
    const nextCover = () => {
      while (coverIdx < cover.length) {
        const p = cover[coverIdx++];
        if (p && !used.has(p.id)) { used.add(p.id); return p; }
      }
      return undefined;
    };
    const savedXi: Player[] = [];
    for (const id of club.lineup) {
      const p = take(id) ?? nextCover();
      if (p) savedXi.push(p);
    }
    while (savedXi.length < lineup.length) {
      const p = nextCover();
      if (!p) break;
      savedXi.push(p);
    }
    if (savedXi.length > 0) {
      xi = savedXi;
      const savedBench = (club.subs ?? []).map(id => take(id)).filter(Boolean) as Player[];
      bench = savedBench;
      while (bench.length < 7) {
        const p = nextCover();
        if (!p) break;
        bench = [...bench, p];
      }
    }
  }

  // Emergency XI. `isSquadValid` forfeits below 7 players, and an injury crisis
  // can genuinely take a thin squad under that — measured mid-season, the worst
  // club had 6 available. A fabricated 3-0 walkover corrupts the table, the prize
  // money and every balance measurement far more than an under-strength side
  // losing on merit does, and clubs in that position sign emergency cover rather
  // than forfeit. Backfill from the unavailable pool, least-injured first, so the
  // fixture is actually played.
  if (xi.length < AI_MIN_MATCH_PLAYERS) {
    const picked = new Set(xi.map(p => p.id));
    const reserves = squad
      .filter(p => !picked.has(p.id) && !p.onLoan)
      .sort((a, b) => (a.injuryDetails?.weeksRemaining ?? 1) - (b.injuryDetails?.weeksRemaining ?? 1) || b.overall - a.overall);
    for (const p of reserves) {
      if (xi.length >= AI_MIN_MATCH_PLAYERS) break;
      xi = [...xi, p];
      picked.add(p.id);
    }
  }
  const inXi = new Set(xi.map(p => p.id));
  return { xi, bench: bench.filter(p => !inXi.has(p.id)).slice(0, 7) };
}

/**
 * Drop the event log and stats from an AI-vs-AI match result before it goes into
 * state.
 *
 * Only the SCORE matters for tables, records and history; the events are consumed
 * immediately by `applyAIMatchEvents` (goals, assists, cards, injuries) and never
 * read again. The player's own matches keep everything — Match Review renders them.
 *
 * WHY: measured at the end of one season with the living world loaded, AI fixtures
 * carried 175,656 events across 3,082 matches — 83.9 MB of `divisionFixtures` held
 * in memory, against 1.73 MB once the save path trimmed it. The save was always
 * fine (`trimFixturesForSave` strips the same fields); the heap was not, and it got
 * much worse when AI fixtures stopped being one-event forfeits and started being
 * real simulated matches. On a phone that is the difference between comfortable and
 * a memory-pressure kill.
 */
export function stripAiMatchDetail(result: Match, playerClubId: string): Match {
  if (result.homeClubId === playerClubId || result.awayClubId === playerClubId) return result;
  if (!result.events?.length && !result.stats) return result;
  const { events: _events, stats: _stats, ...rest } = result as Match & Record<string, unknown>;
  return { ...rest, events: [] } as Match;
}

/**
 * Cheap scoreline-only resolver for AI-vs-AI catch-up fixtures.
 *
 * The season-end catch-up exists to COMPLETE TABLES — it fast-forwards fixtures
 * that were never played so a division doesn't finish its season short (a Premier
 * League save used to leave 8 rounds unplayed in each lower English tier). Tables
 * need scores and nothing else, and `stripAiMatchDetail` discards AI event logs on
 * the way into state anyway — so running the full event engine here was doing a
 * large amount of work purely to throw the result away.
 *
 * That waste became a real latency hazard: with the living world loaded, a save
 * where other divisions lag can present thousands of outstanding fixtures at
 * season end, and `endSeason` blocks the UI. Measured 6.2s against a 5s budget
 * before this, on a pyramid where only the player's own division had been played.
 *
 * Poisson around a strength-derived expectation, with the same home advantage the
 * engine uses, so promotion and relegation stay plausible.
 */
export function resolveCatchUpFixture(
  match: Match,
  homePlayers: Player[],
  awayPlayers: Player[],
): Match {
  const hs = getTeamStrength(homePlayers) * HOME_ADVANTAGE;
  const as = getTeamStrength(awayPlayers);
  const total = hs + as;
  const share = total > 0 ? hs / total : 0.5;
  // Centre on a realistic combined goal total, split by strength share.
  const combined = CATCH_UP_EXPECTED_GOALS;
  return {
    ...match,
    played: true,
    homeGoals: poissonSample(combined * share),
    awayGoals: poissonSample(combined * (1 - share)),
    events: [],
  };
}

/** Small-lambda Poisson sampler. Bounded so a pathological lambda can't spin. */
function poissonSample(lambda: number): number {
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
    if (k > 12) break;
  } while (p > L);
  return k - 1;
}
