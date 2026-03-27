/**
 * Reusable selector hooks for common game state patterns.
 * Eliminates duplicated derived-data logic across pages.
 */

import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import type { Club, Match, CupState, LeagueCupState, ContinentalTournamentState, SuperCupMatch } from '@/types/game';

/** Get the player's club object. */
export function usePlayerClub(): Club {
  return useGameStore(s => s.clubs[s.playerClubId]);
}

/** Get league position for a club (defaults to player's club). Returns 1-based index. */
export function useLeaguePosition(clubId?: string): number {
  return useGameStore(s => {
    const id = clubId ?? s.playerClubId;
    const entry = s.leagueTable.find(e => e.clubId === id);
    return entry ? s.leagueTable.indexOf(entry) + 1 : s.leagueTable.length;
  });
}

/** Find any tournament match for the player this week (cup, league cup, continental, super cup). */
function findTournamentMatch(s: { week: number; playerClubId: string; cup: CupState; leagueCup: LeagueCupState | null; championsCup: ContinentalTournamentState | null; shieldCup: ContinentalTournamentState | null; domesticSuperCup: SuperCupMatch | null; continentalSuperCup: SuperCupMatch | null }): { homeClubId: string; awayClubId: string; competition: string } | null {
  const w = s.week;
  const pid = s.playerClubId;
  // Dynasty Cup
  const cupTie = s.cup?.ties?.find(t => t.week === w && !t.played && (t.homeClubId === pid || t.awayClubId === pid));
  if (cupTie) return { homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, competition: 'Dynasty Cup' };
  // League Cup
  const lcTie = s.leagueCup?.ties?.find(t => t.week === w && !t.played && (t.homeClubId === pid || t.awayClubId === pid));
  if (lcTie) return { homeClubId: lcTie.homeClubId, awayClubId: lcTie.awayClubId, competition: 'League Cup' };
  // Continental group + knockout
  for (const [tourney, name] of [[s.championsCup, 'Champions Cup'], [s.shieldCup, 'Shield Cup']] as const) {
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
  // Super cups
  const dsc = s.domesticSuperCup;
  if (dsc && !dsc.played && dsc.week === w && (dsc.homeClubId === pid || dsc.awayClubId === pid)) return { homeClubId: dsc.homeClubId, awayClubId: dsc.awayClubId, competition: 'Super Cup' };
  const csc = s.continentalSuperCup;
  if (csc && !csc.played && csc.week === w && (csc.homeClubId === pid || csc.awayClubId === pid)) return { homeClubId: csc.homeClubId, awayClubId: csc.awayClubId, competition: 'Continental Super Cup' };
  return null;
}

/** Get the current week's match for the player's club + derived info. */
export function useCurrentMatch(): { match: Match | undefined; isHome: boolean; opponent: Club | undefined; competition?: string } {
  return useGameStore(useShallow(s => {
    const leagueMatch = s.fixtures.find(
      m => m.week === s.week && !m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId)
    );
    if (leagueMatch) {
      const isHome = leagueMatch.homeClubId === s.playerClubId;
      const opponent = s.clubs[isHome ? leagueMatch.awayClubId : leagueMatch.homeClubId];
      return { match: leagueMatch, isHome, opponent };
    }
    // Check tournament matches
    const tourneyMatch = findTournamentMatch(s);
    if (tourneyMatch) {
      const syntheticMatch = { id: 'tournament', week: s.week, homeClubId: tourneyMatch.homeClubId, awayClubId: tourneyMatch.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match;
      const isHome = tourneyMatch.homeClubId === s.playerClubId;
      const oppId = isHome ? tourneyMatch.awayClubId : tourneyMatch.homeClubId;
      const opponent = s.clubs[oppId] || (s.virtualClubs?.[oppId] ? { id: oppId, name: s.virtualClubs[oppId].name, shortName: s.virtualClubs[oppId].shortName, color: s.virtualClubs[oppId].color } as Club : undefined);
      return { match: syntheticMatch, isHome, opponent, competition: tourneyMatch.competition };
    }
    return { match: undefined, isHome: false, opponent: undefined };
  }));
}

/** Get count of unread messages. */
export function useUnreadCount(): number {
  return useGameStore(s => s.messages.filter(m => !m.read).length);
}
