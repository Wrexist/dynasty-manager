/**
 * Build match-ready "clubs" for an international fixture so a national-team game
 * can run through the same match engine as a club game (Phase 5 — interactive
 * World Cup matches).
 *
 * The player's nation is assembled from their confirmed `NationalTeamState`
 * (its squad already lives in `players`). The opponent nation is generated on
 * demand from the national-team pool — only the player's nation exists in state
 * otherwise. Pure-ish: synchronous, no store access; returns everything the
 * caller needs to merge into state and call `simulateMatch`.
 */
import type { Club, Player, FormationType, NationalTeamState, InternationalTournamentState } from '@/types/game';
import { generateNationalTeamPool, autoSelectNationalSquad } from '@/utils/international';
import { selectBestLineup } from '@/utils/playerGen';
import { getNationRanking, getNation } from '@/data/nations';

const KNOCKOUT_ROUND_LABEL: Record<string, string> = {
  R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Final', SF: 'Semi-Final', F: 'Final',
};

export interface NextWorldCupMatch {
  opponent: string;
  isHome: boolean;
  roundLabel: string;
  /** Group letter (e.g. 'A') for a group match, else null. */
  group: string | null;
}

/** The player nation's next unplayed World Cup fixture, or null if there is
 *  none right now (between rounds, eliminated, or tournament over). */
export function getPlayerNextWorldCupMatch(
  tournament: InternationalTournamentState | null,
  nation: string,
): NextWorldCupMatch | null {
  if (!tournament || tournament.playerEliminated || tournament.phase === 'complete') return null;

  if (tournament.phase === 'group') {
    for (const group of tournament.groups) {
      const fix = group.fixtures.find(f => !f.played && (f.homeNation === nation || f.awayNation === nation));
      if (fix) {
        const isHome = fix.homeNation === nation;
        return {
          opponent: isHome ? fix.awayNation : fix.homeNation,
          isHome,
          roundLabel: 'Group Stage',
          group: group.name.replace('Group ', ''),
        };
      }
    }
    return null;
  }

  // Knockout — the player's unplayed tie in the current round.
  const tie = tournament.knockoutTies.find(
    t => !t.played && t.round === tournament.currentRound && (t.homeNation === nation || t.awayNation === nation),
  );
  if (!tie) return null;
  const isHome = tie.homeNation === nation;
  return {
    opponent: isHome ? tie.awayNation : tie.homeNation,
    isHome,
    roundLabel: KNOCKOUT_ROUND_LABEL[tie.round] ?? 'Knockout',
    group: null,
  };
}

/** Reputation 1–5 from a FIFA-style ranking (lower rank = stronger). */
function repFromRanking(ranking: number): number {
  if (ranking <= 5) return 5;
  if (ranking <= 12) return 4;
  if (ranking <= 25) return 3;
  if (ranking <= 45) return 2;
  return 1;
}

/** Wrap a set of player IDs into a Club shell keyed by the nation name. Used
 *  for match opponents and (in World Cup mode) for the player's own national
 *  team as their "club". */
export function nationToClub(nation: string, playerIds: string[], lineup: string[], subs: string[], formation: FormationType): Club {
  const nd = getNation(nation);
  const ranking = getNationRanking(nation);
  const reputation = repFromRanking(ranking);
  return {
    id: nation,
    name: nation,
    shortName: nation.slice(0, 3).toUpperCase(),
    color: nd?.color || '#1f2937',
    secondaryColor: nd?.secondaryColor || '#ffffff',
    budget: 0,
    wageBill: 0,
    reputation,
    facilities: Math.min(5, Math.max(1, reputation)),
    youthRating: reputation,
    fanBase: reputation * 20,
    boardPatience: 50,
    playerIds,
    formation,
    lineup,
    subs,
    divisionId: '' as Club['divisionId'],
  };
}

export interface InternationalMatchTeams {
  /** The player's nation as a Club (squad from their NationalTeamState). */
  playerClub: Club;
  /** The opponent nation as a freshly-generated Club. */
  opponentClub: Club;
  /** Only the NEW (opponent) players to merge into state — the player's nation
   *  players already live in `state.players`. */
  opponentPlayers: Record<string, Player>;
}

/**
 * Assemble both nations for `opponentNation` vs the player's nation.
 * `existingPlayers` is the current `state.players` (used so generation doesn't
 * collide with what's already loaded).
 */
export function buildInternationalMatchTeams(opts: {
  playerNation: string;
  opponentNation: string;
  nationalTeam: NationalTeamState;
  existingPlayers: Record<string, Player>;
  season: number;
  communityPackEnabled: boolean;
}): InternationalMatchTeams {
  const { playerNation, opponentNation, nationalTeam, existingPlayers, season, communityPackEnabled } = opts;

  // ── Player nation: reuse the confirmed squad. Backfill lineup defensively
  //    if it's short (the picker guarantees 11, but never trust it blindly).
  const playerLineup = nationalTeam.lineup.length >= 11
    ? nationalTeam.lineup
    : (() => {
        const objs = nationalTeam.squad.map(id => existingPlayers[id]).filter(Boolean);
        return selectBestLineup(objs, nationalTeam.formation).lineup.map(p => p.id);
      })();
  const playerSubs = nationalTeam.subs.length > 0
    ? nationalTeam.subs
    : nationalTeam.squad.filter(id => !playerLineup.includes(id)).slice(0, 7);
  const playerClub = nationToClub(playerNation, nationalTeam.squad, playerLineup, playerSubs, nationalTeam.formation);

  // ── Opponent nation: generate a pool + auto-pick a 23-man squad.
  const opponentPlayers = generateNationalTeamPool(opponentNation, existingPlayers, season, { communityPackEnabled });
  const poolForSelect = { ...existingPlayers, ...opponentPlayers };
  const oppSquad = autoSelectNationalSquad(opponentNation, opponentPlayers, /* currentWeek */ undefined)
    .filter(id => poolForSelect[id]);
  const oppFormation: FormationType = '4-3-3';
  const oppObjs = oppSquad.map(id => poolForSelect[id]).filter(Boolean);
  const oppBest = selectBestLineup(oppObjs, oppFormation);
  const oppLineup = oppBest.lineup.map(p => p.id);
  const oppSubs = oppBest.subs.map(p => p.id).slice(0, 7);
  const opponentClub = nationToClub(opponentNation, oppSquad, oppLineup, oppSubs, oppFormation);

  return { playerClub, opponentClub, opponentPlayers };
}
