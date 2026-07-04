/**
 * Interactive (live) World Cup matches — Phase D.
 *
 * In World Cup mode the player's national team IS their "club"
 * (`clubs[playerClubId]`, keyed by nationality), so Squad/Tactics/MatchDay all
 * operate on it natively. What was missing: the player's tournament match ran
 * through the squad-OVR auto-sim in `weekAdvance` instead of the real match
 * engine. These handlers mirror the club live-match flow
 * (`playFirstHalf`/`playSecondHalf`/`playExtraTime`) but source the fixture
 * from the tournament and write the result back into it.
 *
 * Design — why this stays isolated from `weekAdvance`:
 *   The writeback PRE-MARKS the player's fixture/tie as played with the live
 *   score, then delegates the rest (AI-match sims, table rebuild, phase
 *   advance, group-exit handling) to `advanceWeek()`. `processGroupWeek` /
 *   `processKnockoutRound` both skip already-played fixtures, so the existing
 *   pipeline runs unchanged and simply sees "no player match this week". Only
 *   the two knockout terminal cases that live INSIDE weekAdvance's player
 *   branch — elimination fast-forward and a final win — are handled here, since
 *   the no-player path doesn't navigate to the result screen for them.
 *
 * The club match path (`matchActions.ts`) and `weekAdvance.ts` are left
 * completely untouched.
 */
import * as Sentry from '@sentry/react';
import type { Club, Match, MatchEvent, Player, PlayerMatchRating } from '@/types/game';
import type { GameState } from '@/store/storeTypes';
import { HalfState, finalizeMatch, generateMatchWeather, simulateHalf } from '@/engine/match';
import { buildInternationalMatchTeams, getPlayerNextWorldCupMatch, NextWorldCupMatch } from '@/utils/internationalMatch';
import { simulateKnockoutToCompletion } from '@/utils/international';
import { advanceWeekImpl } from '@/store/slices/orchestration/weekAdvance';
import { beginInteractiveShootoutImpl } from '@/store/slices/orchestration/matchActions';
import { CUP_PENALTY_KICKS, INTERNATIONAL_FITNESS_COST } from '@/config/gameBalance';
import { addMsg } from '@/utils/helpers';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

const MIN_SQUAD = 7;

/** Event types that credit a personal goal to the scorer's nation. Own goals
 *  count toward the opponent's score (handled by the engine) but never as a
 *  scorer's international goal. */
const SCORING_EVENTS = new Set<MatchEvent['type']>([
  'goal', 'penalty_scored', 'extra_time_goal', 'free_kick_goal',
  'long_range_goal', 'counter_attack_goal', 'header_goal', 'solo_goal',
]);

interface WorldCupMatchCtx {
  nextMatch: NextWorldCupMatch;
  homeClubId: string;
  awayClubId: string;
  /** True when this is a knockout tie (extra time / penalties apply). */
  knockout: boolean;
}

/** Resolve the player's current WC fixture, materialising the opponent nation
 *  into `clubs`/`players` if it isn't already loaded (so the squad is stable
 *  across halves and save/load — same pattern continental ephemeral clubs use).
 *  Returns null when there's no playable match right now. */
function resolveWorldCupMatch(set: Set, get: Get): WorldCupMatchCtx | null {
  const state = get();
  const nation = state.managerNationality;
  const tournament = state.internationalTournament;
  if (state.gameMode !== 'world-cup' || !nation || !tournament || !state.nationalTeam) return null;

  const nextMatch = getPlayerNextWorldCupMatch(tournament, nation);
  if (!nextMatch) return null;

  const opponent = nextMatch.opponent;
  // Materialise the opponent once; on resume it'll already be present.
  if (!state.clubs[opponent]) {
    const { opponentClub, opponentPlayers } = buildInternationalMatchTeams({
      playerNation: nation,
      opponentNation: opponent,
      nationalTeam: state.nationalTeam,
      existingPlayers: state.players,
      season: state.season,
      communityPackEnabled: state.communityPackEnabled,
    });
    set({
      clubs: { ...state.clubs, [opponent]: opponentClub },
      players: { ...state.players, ...opponentPlayers },
    });
  }

  return {
    nextMatch,
    homeClubId: nextMatch.isHome ? nation : opponent,
    awayClubId: nextMatch.isHome ? opponent : nation,
    knockout: nextMatch.group === null,
  };
}

function lineupPlayers(club: Club, players: Record<string, Player>, week: number): Player[] {
  const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
  const ids = new Set<string>();
  const lineup = [...new Set(club.lineup || [])]
    .map(id => players[id]).filter(Boolean).filter(p => !isSuspended(p));
  lineup.forEach(p => ids.add(p.id));
  // Backfill from the bench if the lineup is short (suspensions/injuries).
  for (const sub of (club.subs || []).map(id => players[id]).filter(Boolean)) {
    if (lineup.length >= 11) break;
    if (!ids.has(sub.id) && !isSuspended(sub) && !sub.injured) { lineup.push(sub); ids.add(sub.id); }
  }
  return lineup;
}

function competitionLabel(nextMatch: NextWorldCupMatch): string {
  return nextMatch.group ? `World Cup — Group ${nextMatch.group}` : `World Cup — ${nextMatch.roundLabel}`;
}

/** First half: build teams, run minutes 1-45, land at half-time. */
export function playWorldCupFirstHalfImpl(set: Set, get: Get): HalfState | null {
  const ctx = resolveWorldCupMatch(set, get);
  if (!ctx) return null;
  try {
    const state = get();
    const { clubs, players, playerClubId, tactics, training, season, week } = state;
    const hc = clubs[ctx.homeClubId];
    const ac = clubs[ctx.awayClubId];
    if (!hc || !ac) return null;

    const hp = lineupPlayers(hc, players, week);
    const ap = lineupPlayers(ac, players, week);
    if (hp.length < MIN_SQUAD || ap.length < MIN_SQUAD) return null;

    const isPlayerHome = ctx.homeClubId === playerClubId;
    const hpIds = new Set(hp.map(p => p.id));
    const apIds = new Set(ap.map(p => p.id));
    const hBench = (hc.subs || []).map(id => players[id]).filter(Boolean).filter(p => !hpIds.has(p.id) && !p.injured);
    const aBench = (ac.subs || []).map(id => players[id]).filter(Boolean).filter(p => !apIds.has(p.id) && !p.injured);

    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;
    const weather = generateMatchWeather();
    const halfState = simulateHalf(
      hc, ac, hp, ap, 1, 45, homeTactics, awayTactics, training.tacticalFamiliarity,
      playerClubId, undefined, undefined, false, hc.facilities, ac.facilities, season,
      0, hBench, aBench, undefined, weather, 0,
    );

    set({
      halfTimeState: halfState, currentMatchWeather: weather, matchPhase: 'half_time',
      matchSubsUsed: 0, matchSubbedOffIds: [],
      currentCupTieId: null, currentLeagueCupTieId: null,
      currentContinentalMatchId: null, currentContinentalCompetition: null,
      lastMatchCompetition: competitionLabel(ctx.nextMatch),
    });
    return halfState;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playWorldCupFirstHalf' } });
    abandon(set, get, 'An error occurred during the match. It has been abandoned.');
    return null;
  }
}

/** Second half: run minutes 46-90, finalise. Knockout draws go to extra time;
 *  everything else writes back immediately. */
export function playWorldCupSecondHalfImpl(set: Set, get: Get): Match | null {
  const state = get();
  if (!state.halfTimeState) return null;
  const ctx = resolveWorldCupMatch(set, get);
  if (!ctx) return null;
  try {
    const { clubs, players, playerClubId, tactics, training, halfTimeState, currentMatchWeather, season, week } = get();
    const hc = clubs[ctx.homeClubId];
    const ac = clubs[ctx.awayClubId];
    if (!hc || !ac) return null;
    const hp = lineupPlayers(hc, players, week);
    const ap = lineupPlayers(ac, players, week);
    if (hp.length < MIN_SQUAD || ap.length < MIN_SQUAD) return null;

    const isPlayerHome = ctx.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;
    const match: Match = { id: `wc-${ctx.homeClubId}-${ctx.awayClubId}`, week, homeClubId: ctx.homeClubId, awayClubId: ctx.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] };

    const fullState = simulateHalf(
      hc, ac, hp, ap, 46, 90, homeTactics, awayTactics, training.tacticalFamiliarity,
      playerClubId, halfTimeState!, undefined, false, hc.facilities, ac.facilities, season,
      0, undefined, undefined, undefined, currentMatchWeather ?? undefined, 0,
    );
    const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, fullState, players);
    if (currentMatchWeather) result.weather = currentMatchWeather;

    // Knockout level after 90 → extra time.
    if (ctx.knockout && result.homeGoals === result.awayGoals) {
      set({
        currentMatchResult: result, halfTimeState: fullState, matchPhase: 'extra_time',
        matchSubsUsed: 0, matchPlayerRatings: playerRatings,
      });
      return result;
    }

    applyWorldCupResult(set, get, result, ctx, playerRatings);
    return result;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playWorldCupSecondHalf' } });
    abandon(set, get, 'An error occurred during the second half. The match has been abandoned.');
    return null;
  }
}

/** Extra time: minutes 91-120. Still level → penalties. */
export function playWorldCupExtraTimeImpl(set: Set, get: Get): Match | null {
  const state = get();
  const { clubs, players, playerClubId, tactics, training, currentMatchResult, halfTimeState, currentMatchWeather, season, week } = state;
  if (!currentMatchResult || !halfTimeState) return null;
  const ctx = resolveWorldCupMatch(set, get);
  if (!ctx) return null;
  try {
    const hc = clubs[ctx.homeClubId];
    const ac = clubs[ctx.awayClubId];
    if (!hc || !ac) return null;
    const hp = lineupPlayers(hc, players, week);
    const ap = lineupPlayers(ac, players, week);
    if (hp.length < MIN_SQUAD || ap.length < MIN_SQUAD) return null;

    const isPlayerHome = ctx.homeClubId === playerClubId;
    const homeTactics = isPlayerHome ? tactics : undefined;
    const awayTactics = isPlayerHome ? undefined : tactics;
    const match: Match = { id: currentMatchResult.id, week, homeClubId: ctx.homeClubId, awayClubId: ctx.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] };

    const etState = simulateHalf(
      hc, ac, hp, ap, 91, 120, homeTactics, awayTactics, training.tacticalFamiliarity,
      playerClubId, halfTimeState, undefined, false, hc.facilities, ac.facilities, season,
      0, undefined, undefined, undefined, currentMatchWeather ?? undefined, 0,
    );
    const { result, playerRatings } = finalizeMatch(match, hc, ac, hp, ap, etState, players);
    if (currentMatchWeather) result.weather = currentMatchWeather;

    if (result.homeGoals === result.awayGoals) {
      // Still level — go to a kick-by-kick penalty shootout (same flow club cup
      // ties use). `playWorldCupPenalties` pre-computes the kicks; the shared
      // PenaltyShootout UI reveals them; `finalizeWorldCupPenalties` writes back.
      set({
        currentMatchResult: result, halfTimeState: etState, matchPhase: 'penalties',
        matchPlayerRatings: playerRatings, matchSubsUsed: 0,
      });
      return result;
    }

    applyWorldCupResult(set, get, result, ctx, playerRatings);
    return result;
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playWorldCupExtraTime' } });
    abandon(set, get, 'An error occurred during extra time. The match has been abandoned.');
    return null;
  }
}

/** Open the interactive (tap-to-aim) shootout for the player's national
 *  team vs the opponent — same shared setup the club cup flow uses. */
export function playWorldCupPenaltiesImpl(set: Set, get: Get): Match | null {
  const state = get();
  const { clubs, currentMatchResult } = state;
  if (!currentMatchResult) return null;
  const hc = clubs[currentMatchResult.homeClubId];
  const ac = clubs[currentMatchResult.awayClubId];
  if (!hc || !ac) return null;
  try {
    // Interactive (tap-to-aim) shootout — same shared setup as club cups.
    return beginInteractiveShootoutImpl(set, get);
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'playWorldCupPenalties' } });
    abandon(set, get, 'An error occurred during the penalty shootout. The match has been abandoned.');
    return null;
  }
}

/** Reconstruct the shootout from the pre-computed kicks and write the result
 *  back into the tournament. Routed to from `skipPenaltyShootout` /
 *  `revealNextPenaltyKick` when in World Cup mode. */
export function finalizeWorldCupPenaltiesImpl(set: Set, get: Get): void {
  const state = get();
  const { clubs, currentMatchResult, penaltyShootoutKicks, matchPlayerRatings } = state;
  if (!currentMatchResult || penaltyShootoutKicks.length === 0) return;
  const hc = clubs[currentMatchResult.homeClubId];
  const ac = clubs[currentMatchResult.awayClubId];
  if (!hc || !ac) return;
  try {
    const penEvents: MatchEvent[] = penaltyShootoutKicks.map(kick => {
      const isSuddenDeath = kick.round > CUP_PENALTY_KICKS;
      const minute = isSuddenDeath ? 130 : 121 + (kick.round - 1);
      const clubId = kick.isHome ? hc.id : ac.id;
      const teamName = kick.isHome ? hc.shortName : ac.shortName;
      const score = `(${kick.homeTotal}-${kick.awayTotal})`;
      return {
        minute, type: 'penalty_shootout' as const, clubId,
        description: kick.scored ? `${teamName} SCORE! ${score}` : `${teamName} miss! ${score}`,
      };
    });
    const lastKick = penaltyShootoutKicks[penaltyShootoutKicks.length - 1];
    const penHome = lastKick.homeTotal;
    const penAway = lastKick.awayTotal;
    const winnerId = penHome > penAway ? hc.id : ac.id;
    const finalResult: Match = {
      ...currentMatchResult,
      events: [...currentMatchResult.events, ...penEvents],
      penaltyShootout: { home: penHome, away: penAway },
    };

    // Re-resolve the match context (the fixture is still unplayed at this point).
    const ctx = resolveWorldCupMatch(set, get);
    set({ penaltyShootoutKicks: [], penaltyShootoutRevealIndex: 0, penaltyShootoutCtx: null });
    if (!ctx) return;
    applyWorldCupResult(set, get, finalResult, ctx, matchPlayerRatings || [], winnerId);
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'finalizeWorldCupPenalties' } });
    abandon(set, get, 'An error occurred finalizing the penalty shootout. The match has been abandoned.');
  }
}

/** Write the live result into the tournament, record caps/goals/results from
 *  the REAL match events, then advance the tournament. */
function applyWorldCupResult(
  set: Set, get: Get, result: Match, ctx: WorldCupMatchCtx,
  playerRatings: PlayerMatchRating[], penaltyWinnerId?: string,
) {
  const state = get();
  const nation = state.managerNationality!;
  const tournament = state.internationalTournament!;
  const nt = { ...state.nationalTeam! };
  const isHome = ctx.nextMatch.isHome;
  const myGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const winnerId = ctx.knockout
    ? (penaltyWinnerId ?? (result.homeGoals > result.awayGoals ? ctx.homeClubId : ctx.awayClubId))
    : undefined;

  // ── Caps + fitness for the whole squad; real scorers from match events.
  const newPlayers = { ...state.players };
  const updatedCaps = { ...nt.caps };
  const updatedGoals = { ...nt.internationalGoals };
  for (const pid of nt.squad) {
    const p = newPlayers[pid];
    if (!p) continue;
    const recovered = Math.min(100, p.fitness + 3);
    newPlayers[pid] = {
      ...p,
      fitness: Math.max(40, recovered - INTERNATIONAL_FITNESS_COST),
      internationalCaps: (p.internationalCaps || 0) + 1,
    };
    updatedCaps[pid] = (updatedCaps[pid] || 0) + 1;
  }
  for (const ev of result.events) {
    if (!SCORING_EVENTS.has(ev.type) || ev.clubId !== nation || !ev.playerId) continue;
    const scorer = newPlayers[ev.playerId];
    if (!scorer) continue;
    newPlayers[ev.playerId] = { ...scorer, internationalGoals: (scorer.internationalGoals || 0) + 1 };
    updatedGoals[ev.playerId] = (updatedGoals[ev.playerId] || 0) + 1;
  }
  nt.caps = updatedCaps;
  nt.internationalGoals = updatedGoals;
  nt.results = [...nt.results, {
    season: state.season,
    opponent: ctx.nextMatch.opponent,
    goalsFor: myGoals,
    goalsAgainst: oppGoals,
    tournament: tournament.name,
    round: ctx.knockout ? (tournament.currentRound ?? 'Knockout') : 'Group Stage',
    ...(ctx.knockout && { won: winnerId === nation }),
  }];

  const matchDisplay = {
    currentMatchResult: result, matchPhase: 'full_time' as const, halfTimeState: null,
    matchSubsUsed: 0, matchPlayerRatings: playerRatings,
    lastMatchCompetition: competitionLabel(ctx.nextMatch),
  };

  if (!ctx.knockout) {
    // GROUP — write the fixture, then let advanceWeek sim the rest of the week
    // (it skips this now-played fixture) and handle group-exit fast-forward.
    // Each group pair meets exactly once, so the (home, away) nation pair
    // uniquely identifies the fixture — no need to gate on week (the schedule
    // and currentWeek can diverge by a tick when playing ahead of the sim).
    const groups = tournament.groups.map(g => ({
      ...g,
      fixtures: g.fixtures.map(f =>
        (f.homeNation === ctx.homeClubId && f.awayNation === ctx.awayClubId && !f.played)
          ? { ...f, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals }
          : f),
    }));
    set({ internationalTournament: { ...tournament, groups }, nationalTeam: nt, players: newPlayers });
    // Call the impl directly, NOT the `advanceWeek` action wrapper: that wrapper
    // has an async re-entrancy guard meant for user double-taps, and bypassing
    // it keeps this internal orchestration synchronous (WC's international step
    // is sync). Sims this week's AI matches + advances the phase.
    void advanceWeekImpl(set, get);
    set(matchDisplay);
    return;
  }

  // KNOCKOUT — write the tie.
  const tie = tournament.knockoutTies.find(
    t => !t.played && t.round === tournament.currentRound && (t.homeNation === ctx.homeClubId || t.awayNation === ctx.awayClubId),
  );
  if (!tie) { set({ nationalTeam: nt, players: newPlayers, ...matchDisplay }); return; }
  // The tie's stored home/away may be the reverse of how we ran the match;
  // map our home/away goals onto the tie's own orientation.
  const tieHomeIsOurHome = tie.homeNation === ctx.homeClubId;
  const updatedTie = {
    ...tie, played: true,
    homeGoals: tieHomeIsOurHome ? result.homeGoals : result.awayGoals,
    awayGoals: tieHomeIsOurHome ? result.awayGoals : result.homeGoals,
    winnerId,
    ...(result.penaltyShootout && {
      penaltyShootout: tieHomeIsOurHome ? result.penaltyShootout : { home: result.penaltyShootout.away, away: result.penaltyShootout.home },
    }),
  };
  const finalTies = tournament.knockoutTies.map(t => t.id === tie.id ? updatedTie : t);
  const playerEliminated = winnerId !== nation;
  const isFinal = tournament.currentRound === 'F';

  // Terminal cases weekAdvance's no-player path doesn't navigate for: a final
  // result, or elimination (fast-forward the rest of the bracket to a champion).
  if (isFinal) {
    set({
      internationalTournament: { ...tournament, knockoutTies: finalTies, phase: 'complete', winner: winnerId ?? null, playerEliminated, currentWeek: tournament.currentWeek + 1 },
      nationalTeam: nt, players: newPlayers, currentScreen: 'world-cup-result', ...matchDisplay,
    });
    return;
  }
  if (playerEliminated) {
    const { knockoutTies: finishedTies, winner } = simulateKnockoutToCompletion(finalTies, tournament.currentRound!, nation);
    set({
      internationalTournament: { ...tournament, knockoutTies: finishedTies, phase: 'complete', currentRound: 'F', winner, playerEliminated: true, currentWeek: tournament.currentWeek + 1 },
      nationalTeam: nt, players: newPlayers, currentScreen: 'world-cup-result', ...matchDisplay,
    });
    return;
  }

  // Advanced to the next round — delegate AI sims + bracket generation.
  set({ internationalTournament: { ...tournament, knockoutTies: finalTies }, nationalTeam: nt, players: newPlayers });
  void advanceWeekImpl(set, get); // see note above — impl directly, not the guarded wrapper
  set(matchDisplay);
}

function abandon(set: Set, get: Get, body: string) {
  try {
    get().cleanupAbandonedMatch();
    set({
      currentScreen: 'dashboard',
      messages: addMsg(get().messages, {
        week: get().week, season: get().season, type: 'general',
        title: 'Match Error', body,
      }),
    });
  } catch (cleanupErr) {
    Sentry.captureException(cleanupErr, { tags: { context: 'worldCupMatchCleanup' } });
  }
}
