/**
 * Quick Start pick — which club to offer a brand-new player, and as which
 * nationality. Pure: the page decides what's visible, this decides what to
 * recommend inside that. Config lives in `src/config/quickStart.ts`.
 */

import { CLUBS_DATA } from '@/data/league';
import {
  QUICK_START_CLUB_BY_NATION,
  QUICK_START_DEFAULT_CLUB_ID,
  QUICK_START_FALLBACK_NATION,
} from '@/config/quickStart';
import type { ClubData } from '@/types/game';

export interface QuickStartPick {
  club: ClubData;
  /** The nationality the career starts with — the player's own when known. */
  nation: string;
}

const clubById = (id: string): ClubData | undefined => CLUBS_DATA.find(c => c.id === id);

/**
 * Recommend a club for `nation` (usually the locale default, or whatever the
 * player has highlighted). The nation's own giant when config names one and its
 * league is available; otherwise the default. `isLeagueAvailable` lets the page
 * keep community-pack leagues out when the pack is off — offering a club the
 * player could not have picked by hand would be a different game, not a
 * shortcut. Returns `null` only if the data itself is broken (the default club
 * is missing), so a bad config can hide the card but never crash the page.
 */
export function pickQuickStartClub(
  nation: string | null,
  isLeagueAvailable: (leagueId: string) => boolean = () => true,
): QuickStartPick | null {
  const resolvedNation = nation || QUICK_START_FALLBACK_NATION;
  const preferredId = QUICK_START_CLUB_BY_NATION[resolvedNation];
  const preferred = preferredId ? clubById(preferredId) : undefined;
  if (preferred && isLeagueAvailable(preferred.divisionId)) {
    return { club: preferred, nation: resolvedNation };
  }
  const fallback = clubById(QUICK_START_DEFAULT_CLUB_ID);
  if (!fallback || !isLeagueAvailable(fallback.divisionId)) return null;
  return { club: fallback, nation: resolvedNation };
}
