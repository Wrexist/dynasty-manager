import type { SlotSummary } from '@/types/game';

// ── Storage Quota Helpers ──

/** Try to free localStorage space by removing backups and non-essential data.
 *  Returns true if any space was freed. */
export function tryFreeStorageSpace(protectedSlot?: number): boolean {
  let freed = false;
  try {
    // 1. Remove backups for all slots (cheapest to lose)
    for (let i = 1; i <= 3; i++) {
      if (i === protectedSlot) continue; // skip the slot we're trying to save
      const backupKey = `dynasty-save-${i}-backup`;
      if (localStorage.getItem(backupKey) !== null) {
        localStorage.removeItem(backupKey);
        freed = true;
      }
    }
    // Also remove backup for the protected slot — better to lose backup than fail the save
    if (protectedSlot) {
      const ownBackup = `dynasty-save-${protectedSlot}-backup`;
      if (localStorage.getItem(ownBackup) !== null) {
        localStorage.removeItem(ownBackup);
        freed = true;
      }
    }
    // 2. Remove session snapshot (small but every bit helps)
    if (localStorage.getItem('dynasty-session-snapshot') !== null) {
      localStorage.removeItem('dynasty-session-snapshot');
      freed = true;
    }
  } catch {
    // storage unavailable
  }
  return freed;
}

/** Check if an error is a storage quota exceeded error */
function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    // Different browsers use different error names/codes
    return err.code === 22 || err.code === 1014 ||
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  return false;
}

// ── Save Data Trimming ──

/** Strip bulky match events and stats from played fixtures that the player
 *  was NOT involved in. Player-club matches keep events for match review.
 *  This can reduce save size by 40-60%. */
export function trimFixturesForSave(
  divisionFixtures: Record<string, unknown[]>,
  playerClubId: string,
): Record<string, unknown[]> {
  const trimmed: Record<string, unknown[]> = {};
  for (const [div, fixtures] of Object.entries(divisionFixtures)) {
    trimmed[div] = fixtures.map((f: unknown) => {
      const match = f as { played?: boolean; homeClubId?: string; awayClubId?: string; events?: unknown[]; stats?: unknown };
      if (!match.played) return match;
      // Keep full data for player's own matches
      const isPlayerMatch = match.homeClubId === playerClubId || match.awayClubId === playerClubId;
      if (isPlayerMatch) return match;
      // Strip events and stats from AI-vs-AI matches — only scores matter
      const { events: _e, stats: _s, ...rest } = match as Record<string, unknown>;
      return rest;
    });
  }
  return trimmed;
}

/** Strip events from standalone fixtures array (legacy format / cup fixtures) */
export function trimFixtureArrayForSave(
  fixtures: unknown[],
  playerClubId: string,
): unknown[] {
  return fixtures.map((f: unknown) => {
    const match = f as { played?: boolean; homeClubId?: string; awayClubId?: string; events?: unknown[]; stats?: unknown };
    if (!match.played) return match;
    const isPlayerMatch = match.homeClubId === playerClubId || match.awayClubId === playerClubId;
    if (isPlayerMatch) return match;
    const { events: _e, stats: _s, ...rest } = match as Record<string, unknown>;
    return rest;
  });
}

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

/** Write a raw save string to a slot, with quota-aware retry.
 *  Strategy: write the main save first, then backup if space allows.
 *  On quota exceeded, free space progressively and retry. */
export function writeSaveSlot(slot: number, json: string): void {
  const key = `dynasty-save-${slot}`;
  const backupKey = `${key}-backup`;

  // Keep the old data in memory for backup (don't read twice)
  let oldData: string | null = null;
  try {
    oldData = localStorage.getItem(key);
  } catch { /* ignore */ }

  // Remove backup first to free space for the main save
  try { localStorage.removeItem(backupKey); } catch { /* ignore */ }

  // Attempt 1: write the main save
  try {
    localStorage.setItem(key, json);
  } catch (err) {
    if (!isQuotaError(err)) throw new Error('SAVE_WRITE_FAILED');

    // Attempt 2: free space and retry
    tryFreeStorageSpace(slot);
    try {
      localStorage.setItem(key, json);
    } catch (err2) {
      if (!isQuotaError(err2)) throw new Error('SAVE_WRITE_FAILED');
      // Attempt 3: remove ALL backups (including our own, already done) and retry
      for (let i = 1; i <= 3; i++) {
        try { localStorage.removeItem(`dynasty-save-${i}-backup`); } catch { /* ignore */ }
      }
      try {
        localStorage.setItem(key, json);
      } catch {
        throw new Error('SAVE_WRITE_FAILED');
      }
    }
  }

  // Main save succeeded — try to create backup from old data (best-effort)
  if (oldData) {
    try {
      localStorage.setItem(backupKey, oldData);
    } catch {
      // Not enough space for backup — that's okay, main save is safe
    }
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
