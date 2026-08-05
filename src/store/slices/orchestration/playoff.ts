/**
 * The player's promotion playoff, played BEFORE season rollover.
 *
 * The alternative — pausing `endSeasonImpl` mid-way and resuming it after the
 * match — was rejected deliberately. That function is a single synchronous pass
 * that mutates clubs, players, divisions, finances, awards and fixtures
 * together; making it resumable would require every one of those mutations to be
 * idempotent across a save/load boundary, and its tests cover the whole pass
 * rather than its parts.
 *
 * So the playoff runs first, as ordinary matches, and hands a finished result
 * into rollover. Rollover stays one pass and its tests stay valid.
 *
 * The ties deliberately do NOT live in `state.fixtures`: the final league table
 * is rebuilt from that array at rollover, so a playoff tie there would corrupt
 * the standings the playoff was seeded from.
 */
import type { GameState } from '../../storeTypes';
import type { LeagueId, Match, PlayoffState, PlayoffTieResult } from '@/types/game';
import { buildLeagueTable, LEAGUES, getDerbyIntensity } from '@/data/league';
import { determineProRelZones, resumePlayoff } from '@/utils/promotionRelegation';
import { pickAiMatchSquad } from '@/store/slices/orchestration/helpers';
import { simulateMatch } from '@/engine/match';
import { safeRandomUUID } from '@/utils/helpers';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

/** Build the Match object for a pending tie. Not a league fixture — see header. */
function makePlayoffMatch(state: GameState, homeClubId: string, awayClubId: string): Match {
  return {
    id: `playoff-${state.season}-${safeRandomUUID()}`,
    week: state.week,
    season: state.season,
    homeClubId,
    awayClubId,
    homeGoals: 0,
    awayGoals: 0,
    played: false,
    events: [],
  } as Match;
}

/**
 * Simulate one AI-vs-AI playoff tie and return the winner.
 *
 * A level tie sends the better-placed side through — `homeClubId` is always the
 * better-placed one (see `stepPlayoff`'s seeding). That rule is applied here and
 * in `seasonEnd`'s resolver, and must stay identical in both.
 */
function simulateAiTie(state: GameState, homeClubId: string, awayClubId: string): string {
  const hc = state.clubs[homeClubId];
  const ac = state.clubs[awayClubId];
  if (!hc || !ac) return homeClubId;
  const hp = pickAiMatchSquad(hc, state.players, state.week).xi;
  const ap = pickAiMatchSquad(ac, state.players, state.week).xi;
  if (hp.length === 0) return awayClubId;
  if (ap.length === 0) return homeClubId;
  const { result } = simulateMatch(
    makePlayoffMatch(state, homeClubId, awayClubId), hc, ac, hp, ap,
    undefined, undefined, undefined, state.playerClubId,
    getDerbyIntensity(homeClubId, awayClubId), undefined, state.season,
  );
  if (result.homeGoals === result.awayGoals) return homeClubId;
  return result.homeGoals > result.awayGoals ? homeClubId : awayClubId;
}

/** The player's playoff candidates for this season, or null if not in one. */
export function getPlayerPlayoffCandidates(state: GameState): { leagueId: LeagueId; candidates: string[] } | null {
  const leagueId = state.playerDivision;
  const league = LEAGUES.find(l => l.id === leagueId);
  if (!league || league.playoffSpots <= 0) return null;
  const clubIds = state.divisionClubs[leagueId] || [];
  if (clubIds.length === 0) return null;
  const table = buildLeagueTable(state.fixtures, clubIds);
  const zones = determineProRelZones(table, league);
  if (!zones.playoffCandidates.includes(state.playerClubId)) return null;
  return { leagueId, candidates: zones.playoffCandidates };
}

/**
 * Advance the bracket from whatever is already resolved.
 *
 * Returns the next tie the player must play, or the finished bracket. AI ties
 * encountered on the way are simulated and recorded, so a single call moves the
 * bracket as far as it can go without the player.
 */
function advanceBracket(
  state: GameState,
  candidates: string[],
  resolved: PlayoffTieResult[],
): { pending: { homeClubId: string; awayClubId: string; teamsInRound: number } | null; resolved: PlayoffTieResult[] } {
  const working = [...resolved];
  const outcome = resumePlayoff(candidates, working, state.playerClubId, (home, away) => {
    const winner = simulateAiTie(state, home, away);
    // Record AI ties too, so a replay after a save/load cannot re-decide them
    // with a different roll.
    working.push({
      homeClubId: home,
      awayClubId: away,
      homeGoals: winner === home ? 1 : 0,
      awayGoals: winner === home ? 0 : 1,
      playerAdvanced: false,
    });
    return winner;
  });
  return {
    pending: outcome.kind === 'pending'
      ? { homeClubId: outcome.tie.homeClubId, awayClubId: outcome.tie.awayClubId, teamsInRound: outcome.tie.teamsInRound }
      : null,
    resolved: working,
  };
}

/**
 * Enter the playoff phase if the player's club qualified. Returns true when the
 * caller should NOT roll the season yet.
 *
 * Career mode: an unemployed manager has no club in a table and cannot qualify,
 * so no explicit guard is needed beyond the candidate check.
 */
export function maybeEnterPlayoff(set: Set, get: Get): boolean {
  const state = get();
  if (state.seasonPhase === 'playoff') return true; // already in it
  const qualified = getPlayerPlayoffCandidates(state);
  if (!qualified) return false;

  const { pending, resolved } = advanceBracket(state, qualified.candidates, []);
  if (!pending) return false; // nothing for the player to play — roll as normal

  const playoffState: PlayoffState = {
    leagueId: qualified.leagueId,
    candidates: qualified.candidates,
    resolved,
    pendingMatch: makePlayoffMatch(state, pending.homeClubId, pending.awayClubId),
    teamsInRound: pending.teamsInRound,
  };
  set({ seasonPhase: 'playoff', playoffState });
  return true;
}

/**
 * Record the result of the player's tie and move the bracket on.
 *
 * When no further player tie remains the phase ends and the caller should roll
 * the season; `playoffState` is kept (not cleared) so rollover can read
 * `resolved` and never re-decide a match the player just played.
 */
export function recordPlayerPlayoffResult(set: Set, get: Get, result: Match): { seasonShouldRoll: boolean } {
  const state = get();
  const ps = state.playoffState;
  if (!ps) return { seasonShouldRoll: true };

  const playerIsHome = result.homeClubId === state.playerClubId;
  const level = result.homeGoals === result.awayGoals;
  // A level tie sends the better-placed side through, and the better-placed side
  // is always the home team here. Same rule as `seasonEnd`'s resolver.
  const playerAdvanced = level
    ? playerIsHome
    : (playerIsHome ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals);

  const recorded: PlayoffTieResult[] = [
    ...ps.resolved,
    {
      homeClubId: result.homeClubId,
      awayClubId: result.awayClubId,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      playerAdvanced,
    },
  ];

  const { pending, resolved } = advanceBracket(get(), ps.candidates, recorded);
  if (pending) {
    set({
      playoffState: {
        ...ps,
        resolved,
        pendingMatch: makePlayoffMatch(get(), pending.homeClubId, pending.awayClubId),
        teamsInRound: pending.teamsInRound,
      },
    });
    return { seasonShouldRoll: false };
  }

  set({ seasonPhase: 'regular', playoffState: { ...ps, resolved, pendingMatch: null } });
  return { seasonShouldRoll: true };
}
