import { Match } from '@/types/game';

/** Get the last N results for a club from played fixtures */
export function getRecentForm(clubId: string, fixtures: Match[], count: number = 5): ('W' | 'D' | 'L')[] {
  const played = fixtures
    .filter(m => m.played && (m.homeClubId === clubId || m.awayClubId === clubId))
    .sort((a, b) => a.week - b.week); // chronological

  const recent = played.slice(-count);
  return recent.map(m => {
    const isHome = m.homeClubId === clubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    if (gf > ga) return 'W';
    if (gf < ga) return 'L';
    return 'D';
  });
}
