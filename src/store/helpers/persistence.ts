import type { SlotSummary } from '@/types/game';

/** Read a flag from localStorage */
export function getFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; }
  catch { return false; }
}

/** Set a flag in localStorage */
export function setFlag(key: string): void {
  try { localStorage.setItem(key, '1'); }
  catch { /* storage full or unavailable */ }
}

/** Remove a flag from localStorage */
export function removeFlag(key: string): void {
  try { localStorage.removeItem(key); }
  catch { /* storage unavailable */ }
}

/** Remove all localStorage keys matching a prefix */
export function clearFlagsByPrefix(prefix: string): void {
  try { Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k)); }
  catch { /* storage unavailable */ }
}

// ── Session Snapshot (for "Welcome back" recap) ──

export interface SessionSnapshot {
  week: number;
  season: number;
  leaguePosition: number;
  boardConfidence: number;
  budget: number;
  injuredCount: number;
  timestamp: number;
}

const SNAPSHOT_KEY = 'dynasty-session-snapshot';

export function saveSessionSnapshot(snap: SessionSnapshot): void {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)); }
  catch { /* storage full */ }
}

export function loadSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSnapshot;
  } catch { return null; }
}

export function clearSessionSnapshot(): void {
  try { localStorage.removeItem(SNAPSHOT_KEY); }
  catch { /* storage unavailable */ }
}

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
      // Compute league position from division-specific fixtures (or all fixtures for old saves)
      let position = '?';
      const divFixtures = data.divisionFixtures?.[data.playerDivision] || data.fixtures;
      const divClubs = data.divisionClubs?.[data.playerDivision] || (data.clubs ? Object.keys(data.clubs) : []);
      if (divFixtures && divClubs.length > 0) {
        const points: Record<string, number> = {};
        divClubs.forEach((id: string) => { points[id] = 0; });
        divFixtures.forEach((m: { played: boolean; homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number }) => {
          if (!m.played) return;
          if (m.homeGoals > m.awayGoals) points[m.homeClubId] = (points[m.homeClubId] || 0) + 3;
          else if (m.homeGoals < m.awayGoals) points[m.awayClubId] = (points[m.awayClubId] || 0) + 3;
          else { points[m.homeClubId] = (points[m.homeClubId] || 0) + 1; points[m.awayClubId] = (points[m.awayClubId] || 0) + 1; }
        });
        const sorted = [...divClubs].sort((a: string, b: string) => (points[b] || 0) - (points[a] || 0));
        const pos = sorted.indexOf(data.playerClubId) + 1;
        position = `${pos}`;
      }
      return { slot, exists: true, clubName: club?.name, season: data.season, week: data.week, position };
    } catch {
      return { slot, exists: false };
    }
  });
}
