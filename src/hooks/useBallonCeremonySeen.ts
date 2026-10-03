import { useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ceremonyCareerKey, hasSeenCeremony, markCeremonySeen } from '@/utils/ballonDorCeremony';

/** Whether this career's Ballon d'Or night for `season` has been watched, and
 *  a setter that records it. Screens use it to keep the winner sealed —
 *  season summary teaser, page header — until the cards have been turned. */
export function useBallonCeremonySeen(season: number | null): [boolean, () => void] {
  const careerId = useGameStore(s => s.careerId);
  const activeSlot = useGameStore(s => s.activeSlot);
  const key = ceremonyCareerKey(careerId, activeSlot);
  const [bump, setBump] = useState(0);
  void bump;
  const seen = season == null ? true : hasSeenCeremony(key, season);
  const markSeen = useCallback(() => {
    if (season == null) return;
    markCeremonySeen(key, season);
    setBump(n => n + 1);
  }, [key, season]);
  return [seen, markSeen];
}
