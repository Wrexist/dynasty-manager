import { SeasonHistory } from '@/types/game';
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
  // Keep top 20 by titles then winRate
  hall.sort((a, b) => b.titles - a.titles || b.winRate - a.winRate);
  writeHallData(JSON.stringify(hall.slice(0, 20)));
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
    titles: seasonHistory.filter(h => h.position === 1).length,
    cupWins: seasonHistory.filter(h => h.cupResult === 'Winner').length,
    bestPosition: seasonHistory.length > 0 ? seasonHistory.reduce((m, h) => h.position < m ? h.position : m, Infinity) : 20,
    winRate: totalMatches > 0 ? Math.round((managerStats.totalWins / totalMatches) * 100) : 0,
    totalWins: managerStats.totalWins,
    totalMatches,
    bestPoints: seasonHistory.length > 0 ? seasonHistory.reduce((m, h) => h.points > m ? h.points : m, 0) : 0,
    prestigeLevel,
    recordedAt: Date.now(),
  };
}
