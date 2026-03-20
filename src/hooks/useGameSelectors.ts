/**
 * Reusable selector hooks for common game state patterns.
 * Eliminates duplicated derived-data logic across pages.
 */

import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import type { Club, Match } from '@/types/game';

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

/** Get the current week's match for the player's club + derived info. */
export function useCurrentMatch(): { match: Match | undefined; isHome: boolean; opponent: Club | undefined } {
  return useGameStore(useShallow(s => {
    const match = s.fixtures.find(
      m => m.week === s.week && !m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId)
    );
    const isHome = match?.homeClubId === s.playerClubId;
    const opponent = match ? s.clubs[isHome ? match.awayClubId : match.homeClubId] : undefined;
    return { match, isHome: !!isHome, opponent };
  }));
}

/** Get count of unread messages. */
export function useUnreadCount(): number {
  return useGameStore(s => s.messages.filter(m => !m.read).length);
}
