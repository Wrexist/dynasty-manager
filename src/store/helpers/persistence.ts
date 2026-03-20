import type { SlotSummary } from '@/types/game';

/** Migrate legacy single-slot save to slot 1 */
export function migrateLegacySave() {
  const legacy = localStorage.getItem('dynasty-save');
  if (legacy && !localStorage.getItem('dynasty-save-1')) {
    localStorage.setItem('dynasty-save-1', legacy);
  }
  if (legacy) {
    localStorage.removeItem('dynasty-save');
  }
}

/** Get summaries for all 3 save slots */
export function getSlotSummaries(): SlotSummary[] {
  migrateLegacySave();
  return [1, 2, 3].map(slot => {
    const raw = localStorage.getItem(`dynasty-save-${slot}`);
    if (!raw) return { slot, exists: false };
    try {
      const data = JSON.parse(raw);
      const club = data.clubs?.[data.playerClubId];
      // Compute league position from fixtures
      let position = '?';
      if (data.fixtures && data.clubs) {
        const clubIds = Object.keys(data.clubs);
        const points: Record<string, number> = {};
        clubIds.forEach(id => { points[id] = 0; });
        data.fixtures.forEach((m: { played: boolean; homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number }) => {
          if (!m.played) return;
          if (m.homeGoals > m.awayGoals) points[m.homeClubId] = (points[m.homeClubId] || 0) + 3;
          else if (m.homeGoals < m.awayGoals) points[m.awayClubId] = (points[m.awayClubId] || 0) + 3;
          else { points[m.homeClubId] = (points[m.homeClubId] || 0) + 1; points[m.awayClubId] = (points[m.awayClubId] || 0) + 1; }
        });
        const sorted = clubIds.sort((a, b) => (points[b] || 0) - (points[a] || 0));
        const pos = sorted.indexOf(data.playerClubId) + 1;
        position = `${pos}`;
      }
      return { slot, exists: true, clubName: club?.name, season: data.season, week: data.week, position };
    } catch {
      return { slot, exists: false };
    }
  });
}
