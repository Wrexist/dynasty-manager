/**
 * Cross-save lifetime aggregation — the "Dynasty Legacy" meta layer.
 *
 * Pure: folds the Hall of Managers entries (one per career/save, persisted
 * device-globally) into a single lifetime record. No storage or migration —
 * it reads what the hall already accumulates at season-end / prestige, so it
 * works retroactively for every dynasty a player has ever run.
 */
import type { ManagerLegacy, LegacyTier } from '@/types/game';
import type { HallEntry } from '@/utils/hallOfManagers';

/** Lifetime tier from total trophies — the headline identity badge. */
export function legacyTier(totalTrophies: number): LegacyTier {
  if (totalTrophies >= 30) return 'Immortal';
  if (totalTrophies >= 15) return 'Legendary';
  if (totalTrophies >= 7) return 'Elite';
  if (totalTrophies >= 3) return 'Established';
  if (totalTrophies >= 1) return 'Journeyman';
  return 'Rookie';
}

const sum = (entries: HallEntry[], pick: (e: HallEntry) => number | undefined): number =>
  entries.reduce((n, e) => n + (pick(e) ?? 0), 0);

/** Aggregate every recorded dynasty into one lifetime record. */
export function computeManagerLegacy(entries: HallEntry[]): ManagerLegacy {
  const clubsManaged = Array.from(new Set(entries.map(e => e.clubName).filter(Boolean)));

  const totalTitles = sum(entries, e => e.titles);
  const totalCupWins = sum(entries, e => e.cupWins);
  const totalLeagueCupWins = sum(entries, e => e.leagueCupWins);
  const totalContinentalWins = sum(entries, e => e.continentalWins);
  const totalTrophies = totalTitles + totalCupWins + totalLeagueCupWins + totalContinentalWins;

  const totalWins = sum(entries, e => e.totalWins);
  const totalMatches = sum(entries, e => e.totalMatches);

  // bestPosition is "lower is better"; 0 signals "no career yet" to the UI.
  const bestPosition = entries.length
    ? Math.min(...entries.map(e => (e.bestPosition && e.bestPosition > 0 ? e.bestPosition : 20)))
    : 0;

  return {
    dynasties: entries.length,
    clubsManaged,
    totalSeasons: sum(entries, e => e.seasons),
    totalTitles,
    totalCupWins,
    totalLeagueCupWins,
    totalContinentalWins,
    totalTrophies,
    totalWins,
    totalMatches,
    winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
    bestPosition,
    bestPoints: entries.length ? Math.max(...entries.map(e => e.bestPoints || 0)) : 0,
    highestPrestige: entries.length ? Math.max(...entries.map(e => e.prestigeLevel || 0)) : 0,
    tier: legacyTier(totalTrophies),
  };
}
