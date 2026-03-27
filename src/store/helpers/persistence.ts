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
  try {
    const legacy = localStorage.getItem('dynasty-save');
    if (legacy && !localStorage.getItem('dynasty-save-1')) {
      localStorage.setItem('dynasty-save-1', legacy);
    }
    if (legacy) {
      localStorage.removeItem('dynasty-save');
    }
  } catch {
    // storage unavailable
  }
}

// ── Save Slot Helpers (used by orchestrationSlice) ──

const MAX_SLOTS = 3;

/** Read a raw save string from a slot */
export function readSaveSlot(slot: number): string | null {
  try { return localStorage.getItem(`dynasty-save-${slot}`); }
  catch { return null; }
}

/** Write a raw save string to a slot, creating a backup first */
export function writeSaveSlot(slot: number, json: string): void {
  try {
    const existing = localStorage.getItem(`dynasty-save-${slot}`);
    if (existing) {
      localStorage.setItem(`dynasty-save-${slot}-backup`, existing);
    }
    localStorage.setItem(`dynasty-save-${slot}`, json);
  } catch {
    throw new Error('SAVE_WRITE_FAILED');
  }
}

/** Read the backup save for a slot */
export function readSaveSlotBackup(slot: number): string | null {
  try { return localStorage.getItem(`dynasty-save-${slot}-backup`); }
  catch { return null; }
}

/** Promote backup to primary for a slot */
export function promoteSaveBackup(slot: number, raw: string): void {
  try { localStorage.setItem(`dynasty-save-${slot}`, raw); }
  catch { /* storage unavailable */ }
}

/** Remove a save slot */
export function removeSaveSlot(slot: number): void {
  try { localStorage.removeItem(`dynasty-save-${slot}`); }
  catch { /* storage unavailable */ }
}

// ── Hall of Managers persistence ──

const HALL_KEY = 'dynasty-hall-of-managers';

/** Read the Hall of Managers JSON string */
export function readHallData(): string | null {
  try { return localStorage.getItem(HALL_KEY); }
  catch { return null; }
}

/** Write the Hall of Managers JSON string */
export function writeHallData(json: string): void {
  try { localStorage.setItem(HALL_KEY, json); }
  catch { /* storage full */ }
}

// ── Delete All Data (Apple account deletion requirement) ──

/** Wipe all Dynasty Manager data from localStorage */
export function deleteAllDynastyData(): void {
  try {
    for (let i = 1; i <= MAX_SLOTS; i++) {
      localStorage.removeItem(`dynasty-save-${i}`);
      localStorage.removeItem(`dynasty-save-${i}-backup`);
    }
    localStorage.removeItem(HALL_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem('dynasty-save'); // legacy key
    // Clear all flags (hints, welcome, etc.)
    Object.keys(localStorage)
      .filter(k => k.startsWith('dynasty-'))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

/** Get summaries for all 3 save slots */
export function getSlotSummaries(): SlotSummary[] {
  migrateLegacySave();
  return [1, 2, 3].map(slot => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(`dynasty-save-${slot}`);
    } catch {
      return { slot, exists: false };
    }
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
      return { slot, exists: true, clubName: club?.name, season: data.season, week: data.week, position, gameMode: data.gameMode || 'sandbox' };
    } catch {
      return { slot, exists: false };
    }
  });
}
