/**
 * competitionStatus — single source of truth for "which competitions is the
 * player active in this season, and what's their current round/status".
 *
 * Shared by the Dashboard summary card (renders each entry as a row) and the
 * Competitions hub (decides which tabs to show + their default). Mirrors the
 * per-competition status strings the old stacked CompetitionStatusCards
 * computed inline on the Dashboard, so behaviour is preserved after the
 * consolidation.
 */
import type {
  CupState,
  LeagueCupState,
  ContinentalTournamentState,
  SuperCupMatch,
  CompetitionStatusEntry,
  GameScreen,
} from '@/types/game';
import { getRoundName } from '@/data/cup';

interface ClubLike {
  shortName: string;
}

export interface CompetitionStatusContext {
  cup: CupState;
  leagueCup: LeagueCupState | null;
  championsCup: ContinentalTournamentState | null;
  shieldCup: ContinentalTournamentState | null;
  conferenceCup: ContinentalTournamentState | null;
  domesticSuperCup: SuperCupMatch | null;
  continentalSuperCup: SuperCupMatch | null;
  playerClubId: string;
  clubs: Record<string, ClubLike>;
  virtualClubs: Record<string, ClubLike>;
}

function shortNameOf(
  id: string | null | undefined,
  clubs: Record<string, ClubLike>,
  virtualClubs: Record<string, ClubLike>,
): string {
  if (!id) return '?';
  return clubs[id]?.shortName || virtualClubs[id]?.shortName || '?';
}

/** Status string + outcome for a continental tournament (Champions/Shield/Conference). */
function continentalStatus(
  t: ContinentalTournamentState,
  playerClubId: string,
  clubs: Record<string, ClubLike>,
  virtualClubs: Record<string, ClubLike>,
): { status: string; outcome: CompetitionStatusEntry['outcome'] } {
  if (t.winnerId) {
    return {
      status: `Winner: ${shortNameOf(t.winnerId, clubs, virtualClubs)}`,
      outcome: t.winnerId === playerClubId ? 'won' : 'active',
    };
  }
  if (t.playerEliminated) return { status: 'Eliminated', outcome: 'eliminated' };
  if (t.currentPhase === 'group') return { status: 'Group Stage', outcome: 'active' };
  return { status: t.currentRound || 'Knockout', outcome: 'active' };
}

/**
 * Returns the player's active competitions for the current season, in the order
 * they should surface (Cup → League Cup → Continental → Super Cup). Presence
 * conditions match the old Dashboard cards / MoreDrawer hide logic; League is
 * intentionally excluded here (always available, handled separately by callers).
 */
export function getActiveCompetitions(ctx: CompetitionStatusContext): CompetitionStatusEntry[] {
  const {
    cup, leagueCup, championsCup, shieldCup, conferenceCup,
    domesticSuperCup, continentalSuperCup, playerClubId, clubs, virtualClubs,
  } = ctx;
  const entries: CompetitionStatusEntry[] = [];

  // Domestic Cup
  if (cup?.currentRound) {
    entries.push({
      key: 'cup',
      screen: 'cup',
      title: 'Domestic Cup',
      status: cup.winner
        ? `Winner: ${shortNameOf(cup.winner, clubs, virtualClubs)}`
        : cup.eliminated ? 'Eliminated'
        : getRoundName(cup.currentRound),
      outcome: cup.winner === playerClubId ? 'won' : cup.eliminated ? 'eliminated' : 'active',
    });
  }

  // League Cup
  if (leagueCup?.currentRound) {
    entries.push({
      key: 'league-cup',
      screen: 'league-cup',
      title: 'League Cup',
      status: leagueCup.winner
        ? `Winner: ${shortNameOf(leagueCup.winner, clubs, virtualClubs)}`
        : leagueCup.eliminated ? 'Eliminated'
        : getRoundName(leagueCup.currentRound),
      outcome: leagueCup.winner === playerClubId ? 'won' : leagueCup.eliminated ? 'eliminated' : 'active',
    });
  }

  // Continental — select by PARTICIPATION, not by tier order.
  //
  // The old code picked the highest tier merely *present*, on the premise that
  // "the player is only ever in one". State does not satisfy that premise:
  // season rollover generates all three tournaments every year whenever there
  // are enough qualifiers (always), and stamps the two the player is not in
  // with `playerEliminated: true`. So from season 2 onward a Shield Cup
  // qualifier — and a club that qualified for nothing — saw a permanent
  // "Champions Cup — Eliminated" row, while their real competition, whose
  // fixtures they were playing on MatchDay, had no reachable UI at all.
  //
  // `playerGroupId` is the participation marker the draw already writes.
  const inTournament = (t: ContinentalTournamentState | null | undefined) => !!t?.playerGroupId;
  const continental: { t: ContinentalTournamentState; screen: GameScreen; title: string } | null =
    inTournament(championsCup) ? { t: championsCup!, screen: 'champions-cup', title: 'Champions Cup' }
    : inTournament(shieldCup) ? { t: shieldCup!, screen: 'shield-cup', title: 'Shield Cup' }
    : inTournament(conferenceCup) ? { t: conferenceCup!, screen: 'conference-cup', title: 'Conference Cup' }
    : null;
  if (continental) {
    const { status, outcome } = continentalStatus(continental.t, playerClubId, clubs, virtualClubs);
    entries.push({ key: 'continental', screen: continental.screen, title: continental.title, status, outcome });
  }

  // Super Cup (domestic and/or continental — surface the domestic one first).
  if (domesticSuperCup || continentalSuperCup) {
    const primary = domesticSuperCup || continentalSuperCup;
    const won = domesticSuperCup?.winnerId === playerClubId || continentalSuperCup?.winnerId === playerClubId;
    entries.push({
      key: 'super-cup',
      screen: 'super-cup',
      title: 'Super Cup',
      status: primary?.winnerId
        ? `Winner: ${shortNameOf(primary.winnerId, clubs, virtualClubs)}`
        : primary?.played === false ? `Week ${primary.week}`
        : 'View matches',
      outcome: won ? 'won' : 'active',
    });
  }

  return entries;
}
