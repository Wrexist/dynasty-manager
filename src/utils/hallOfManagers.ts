import { SeasonHistory } from '@/types/game';
import { isManagersLeagueTitle } from '@/utils/prestige';
import { readHallData, writeHallData } from '@/store/helpers/persistence';
import { addGameBreadcrumb } from '@/utils/sentry';

export interface HallEntry {
  id: string;
  clubName: string;
  seasons: number;
  titles: number;
  cupWins: number;
  bestPosition: number;
  winRate: number;
  totalWins: number;
  totalMatches: number;
  bestPoints: number;
  prestigeLevel: number;
  recordedAt: number; // timestamp
  /** League Cup wins. Optional — older persisted entries predate this field
   *  (treat missing as 0 when aggregating). */
  leagueCupWins?: number;
  /** Continental trophies (Champions/Shield/Conference Cup wins). Optional —
   *  older persisted entries predate this field. */
  continentalWins?: number;
}

/** Careers kept on disk. Every reader that TOTALS the hall (Dynasty Legacy,
 *  the status chip) sums all stored rows, so this is the history the lifetime
 *  numbers are built from — it used to be 20, which let the 21st career push
 *  an old one out and made lifetime totals go down. */
export const HALL_MAX_STORED = 100;
/** Rows the Hall of Managers leaderboard shows. */
export const HALL_DISPLAY_MAX = 20;

/** Hall key for the career in a save: its stable `careerId` (v93+), or the
 *  legacy per-slot key for a career that started before careerIds existed, so
 *  that continuing career keeps updating the row it already has. */
export function hallEntryId(state: { careerId?: string | null; activeSlot: number }): string {
  return state.careerId || `slot-${state.activeSlot}`;
}

/** Load hall of managers from localStorage */
export function loadHall(): HallEntry[] {
  let raw: string | null = null;
  try {
    raw = readHallData();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    // Corrupt hall data silently loses every past dynasty's record —
    // a deeply unpleasant surprise. Breadcrumb so we can see how often
    // this happens in the wild.
    if (raw !== null) {
      try {
        addGameBreadcrumb('save', 'Hall of managers parse failed', {
          rawLen: raw.length,
          message: err instanceof Error ? err.message : String(err),
        });
      } catch { /* breadcrumb must never throw */ }
    }
    return [];
  }
}

/** Save a career record to the hall (call at season end or prestige) */
export function saveToHall(entry: HallEntry): void {
  const hall = loadHall();
  // Update existing entry for same id, or add new
  const idx = hall.findIndex(h => h.id === entry.id);
  if (idx >= 0) {
    hall[idx] = entry;
  } else {
    hall.push(entry);
  }
  // Rank by titles then winRate; keep the best HALL_MAX_STORED
  hall.sort((a, b) => b.titles - a.titles || b.winRate - a.winRate);
  writeHallData(JSON.stringify(hall.slice(0, HALL_MAX_STORED)));
}

/** Build a hall entry from current game state */
export function buildHallEntry(
  saveId: string,
  clubName: string,
  seasonHistory: SeasonHistory[],
  managerStats: { totalWins: number; totalDraws: number; totalLosses: number },
  prestigeLevel: number,
): HallEntry {
  const totalMatches = managerStats.totalWins + managerStats.totalDraws + managerStats.totalLosses;
  return {
    id: saveId,
    clubName,
    seasons: seasonHistory.length,
    titles: seasonHistory.filter(isManagersLeagueTitle).length,
    cupWins: seasonHistory.filter(h => h.cupResult === 'Winner').length,
    leagueCupWins: seasonHistory.filter(h => h.leagueCupResult === 'Winner').length,
    continentalWins: seasonHistory.reduce((n, h) =>
      n + (h.championsCupResult === 'Winner' ? 1 : 0)
        + (h.shieldCupResult === 'Winner' ? 1 : 0)
        + (h.conferenceCupResult === 'Winner' ? 1 : 0), 0),
    bestPosition: seasonHistory.length > 0 ? seasonHistory.reduce((m, h) => h.position < m ? h.position : m, Infinity) : 20,
    winRate: totalMatches > 0 ? Math.round((managerStats.totalWins / totalMatches) * 100) : 0,
    totalWins: managerStats.totalWins,
    totalMatches,
    bestPoints: seasonHistory.length > 0 ? seasonHistory.reduce((m, h) => h.points > m ? h.points : m, 0) : 0,
    prestigeLevel,
    recordedAt: Date.now(),
  };
}
