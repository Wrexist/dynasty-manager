import type { GameState } from '@/store/storeTypes';
import type { Club, Player } from '@/types/game';
import type { AutoFillContext } from '@/utils/autoFillLineup';
import { autoFillBestTeam } from '@/utils/autoFillLineup';
import { getDerbyIntensity } from '@/data/league';

/**
 * Overrides for in-flight state. Slices building state mid-action (e.g.,
 * packsSlice before set()) can pass their pending maps here so context
 * reflects the to-be-committed world, not the stale store snapshot.
 */
export interface AutoFillContextOverrides {
  clubs?: Record<string, Club>;
  players?: Record<string, Player>;
}

/**
 * Build a match-aware AutoFillContext for a given club. Always includes
 * designated takers and defensive formation so pack-triggered or
 * release-triggered auto-fills don't demote the user's chosen set-piece
 * taker. When a league/cup/league-cup fixture exists this week, adds
 * opponent-aware scoring fields.
 *
 * Shared by clubSlice.autoFillTeam (user-initiated Optimize Lineup) and
 * packsSlice (pack open + quick-release) so results are consistent
 * across entry points.
 */
export function buildAutoFillContext(
  state: GameState,
  clubId: string,
  overrides?: AutoFillContextOverrides,
): AutoFillContext {
  const clubs = overrides?.clubs ?? state.clubs;
  const club = clubs[clubId];
  if (!club) return {};

  const base: AutoFillContext = {
    tactics: state.tactics,
    setPieceTakerId: club.setPieceTakerId,
    penaltyTakerId: club.penaltyTakerId,
    defensiveFormation: club.defensiveFormation,
  };

  const leagueMatch = state.fixtures.find(
    m => m.week === state.week && !m.played &&
      (m.homeClubId === clubId || m.awayClubId === clubId),
  );

  let matchHomeId = leagueMatch?.homeClubId;
  let matchAwayId = leagueMatch?.awayClubId;
  let isCupMatch = false;

  if (!leagueMatch) {
    const cupTie = state.cup?.ties?.find(t =>
      t.week === state.week && !t.played &&
      (t.homeClubId === clubId || t.awayClubId === clubId),
    );
    if (cupTie) {
      matchHomeId = cupTie.homeClubId;
      matchAwayId = cupTie.awayClubId;
      isCupMatch = true;
    } else if (state.leagueCup?.ties) {
      const lcTie = state.leagueCup.ties.find(t =>
        t.week === state.week && !t.played &&
        (t.homeClubId === clubId || t.awayClubId === clubId),
      );
      if (lcTie) {
        matchHomeId = lcTie.homeClubId;
        matchAwayId = lcTie.awayClubId;
        isCupMatch = true;
      }
    }
  }

  if (!matchHomeId || !matchAwayId) return base;

  const isHome = matchHomeId === clubId;
  const oppClubId = isHome ? matchAwayId : matchHomeId;
  const oppClub = clubs[oppClubId];
  const derbyIntensity = getDerbyIntensity(matchHomeId, matchAwayId);

  const hasMatchNextWeek = state.fixtures.some(
    m => m.week === state.week + 1 && !m.played &&
      (m.homeClubId === clubId || m.awayClubId === clubId),
  ) || (state.cup?.ties?.some(t =>
    t.week === state.week + 1 && !t.played &&
    (t.homeClubId === clubId || t.awayClubId === clubId),
  ) ?? false);

  return {
    ...base,
    opponentFormation: oppClub?.formation,
    opponentStyle: oppClub?.aiManagerProfile?.style,
    opponentReputation: oppClub?.reputation,
    isHome,
    derbyIntensity,
    isCupMatch,
    hasMatchNextWeek,
  };
}

/**
 * Re-run the lineup optimizer against `club` using the provided player
 * map, returning a new Club with updated `lineup` / `subs`. When the
 * formation is missing or the optimizer yields no XI (degenerate
 * squad), returns the input club unchanged so callers can commit it
 * verbatim and we never blank out an existing lineup.
 *
 * `context` is optional; defaults to `undefined` which is fine for
 * neutral scoring. Pass the result of `buildAutoFillContext` for
 * taker / match awareness.
 */
export function autoPlaceClubLineup(
  club: Club,
  players: Record<string, Player>,
  week: number,
  season: number,
  context?: AutoFillContext,
): Club {
  if (!club.formation) return club;

  const squad = club.playerIds.map(id => players[id]).filter(Boolean) as Player[];
  if (squad.length === 0) return club;

  const result = autoFillBestTeam(squad, club.formation, week, season, context);
  if (result.lineup.length === 0) return club;

  return {
    ...club,
    lineup: result.lineup.map(p => p.id),
    subs: result.subs.map(p => p.id),
  };
}

/**
 * Returns true when any player in `candidateIds` can reasonably reach
 * the current XI or bench of `club` — used as a fast-path to skip
 * re-optimization when a batch of weak signings clearly can't displace
 * any starter or current bench slot.
 *
 * Heuristic: the max overall among candidates must meet or exceed the
 * min overall in the union of `club.lineup` + `club.subs`. If the
 * squad has no current lineup/subs (fresh save edge case), we always
 * return true to force at least one optimizer run.
 */
export function candidatesCanCrackSquad(
  club: Club,
  players: Record<string, Player>,
  candidateIds: string[],
): boolean {
  const current = [...club.lineup, ...club.subs]
    .map(id => players[id])
    .filter(Boolean) as Player[];
  if (current.length === 0) return true;

  const minCurrent = current.reduce((m, p) => Math.min(m, p.overall), Infinity);
  const maxCandidate = candidateIds
    .map(id => players[id])
    .filter(Boolean)
    .reduce((m, p) => Math.max(m, (p as Player).overall), 0);

  return maxCandidate >= minCurrent;
}
