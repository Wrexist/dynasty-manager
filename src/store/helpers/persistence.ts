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

/** Read a JSON value from sessionStorage. Session storage is tab-scoped and
 *  cleared on tab close — used for ephemeral draft state (e.g. mid-onboarding
 *  progress) that should survive a refresh but not be persisted to save slots.
 *  Returns null on any failure (unavailable / parse error / SSR). */
export function readSessionJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write a JSON value to sessionStorage. Swallows quota/availability errors. */
export function writeSessionJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, JSON.stringify(value)); }
  catch { /* storage unavailable / quota exceeded — non-fatal */ }
}

/** Remove a key from sessionStorage. Swallows availability errors. */
export function removeSessionKey(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); }
  catch { /* noop */ }
}

/** All browser-storage keys used by the game, in one place so callers never
 *  pass raw string literals. Adding a new key? Register it here and reference
 *  it from the caller via `STORAGE_KEYS.MY_THING`. */
export const STORAGE_KEYS = {
  /** sessionStorage: mid-onboarding draft (club selection). Tab-scoped. */
  ONBOARDING_DRAFT: 'dynasty-onboarding-draft',
  /** sessionStorage: in-flight community pack opt-in for new-game onboarding.
   *  Set by the community pack popup before the user reaches club selection;
   *  null until the popup is answered. Tab-scoped, cleared once the career
   *  starts (initGame writes the answer onto the save slot itself). */
  COMMUNITY_PACK_DRAFT: 'dynasty-community-pack-draft',
  /** localStorage: per-slot community pack opt-in remembered across new-game
   *  attempts on the same slot. Set the first time the popup is answered for
   *  a slot; cleared when the slot is deleted. */
  communityPackSlotPref: (slot: number) => `dynasty-cp-slot-${slot}`,
  /** localStorage: in-session snapshot for crash recovery. */
  SESSION_SNAPSHOT: 'dynasty-session-snapshot',
  /** localStorage: persistent Hall of Managers data. */
  HALL_OF_MANAGERS: 'dynasty-hall',
  /** localStorage: save slot (1..3). */
  saveSlot: (slot: number) => `dynasty-save-${slot}`,
  /** localStorage: backup shadow of a save slot. */
  saveSlotBackup: (slot: number) => `dynasty-save-${slot}-backup`,
  /** localStorage: staging area for atomic writes. If this key is present
   *  at load time it means the previous write crashed between "stage" and
   *  "promote"; the recovery path inspects it. */
  saveSlotTmp: (slot: number) => `dynasty-save-${slot}-tmp`,
  /** localStorage: device-level analytics consent. Lives outside the per-slot
   *  save so the user only answers once. Values: 'granted' | 'denied'. Missing
   *  key = never asked → show the consent screen. */
  ANALYTICS_CONSENT: 'dynasty-analytics-consent',
} as const;

/** Analytics consent state. `'unknown'` surfaces the first-launch prompt. */
export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';

export function readAnalyticsConsent(): AnalyticsConsent {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANALYTICS_CONSENT);
    if (raw === 'granted' || raw === 'denied') return raw;
    return 'unknown';
  } catch { return 'unknown'; }
}

export function writeAnalyticsConsent(value: 'granted' | 'denied'): void {
  try { localStorage.setItem(STORAGE_KEYS.ANALYTICS_CONSENT, value); }
  catch { /* storage unavailable — consent stays 'unknown', analytics stays off. */ }
}

/** Read the per-slot community pack opt-in. Returns null if the user has
 *  never answered the popup for this slot (popup should show on next
 *  "New Game" click). */
export function readCommunityPackSlotPref(slot: number): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.communityPackSlotPref(slot));
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch { return null; }
}

/** Persist the per-slot community pack opt-in so subsequent "New Game"
 *  clicks on the same slot skip the popup. */
export function writeCommunityPackSlotPref(slot: number, enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEYS.communityPackSlotPref(slot), enabled ? '1' : '0'); }
  catch { /* storage unavailable / quota — non-fatal */ }
}

/** Clear the per-slot opt-in so the popup shows again on the next "New Game". */
export function clearCommunityPackSlotPref(slot: number): void {
  try { localStorage.removeItem(STORAGE_KEYS.communityPackSlotPref(slot)); }
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

/** Write a raw save string to a slot with verified staging + automatic backup.
 *
 *  Sequence:
 *    1. Stage the new payload in `dynasty-save-${slot}-tmp`.
 *    2. Verify tmp is byte-identical AND round-trips through JSON.parse —
 *       catches silent localStorage truncation / BOM / partial-write issues.
 *    3. Remove the staged tmp immediately to free its quota footprint.
 *    4. Rotate the previous main into `-backup` (best effort).
 *    5. Set main to the in-memory payload (still held in `json`).
 *    6. On quota error at step 5, drop backup and retry once.
 *
 *  If step 1 fails outright (quota after `tryFreeStorageSpace`), we skip
 *  staging and fall through to the legacy direct-write path — the save is
 *  still atomic at the localStorage key level, we just lose the pre-commit
 *  verification.
 *
 *  The tmp key exists only briefly as a "did this payload really round-trip
 *  through storage intact?" probe; it is never the authoritative source.
 *  `recoverStaleSaveTmp()` sweeps leftover tmp keys on the load path in case
 *  a crash interrupted the sequence between step 1 and step 3. */
export function writeSaveSlot(slot: number, json: string): void {
  const mainKey = STORAGE_KEYS.saveSlot(slot);
  const backupKey = STORAGE_KEYS.saveSlotBackup(slot);
  const tmpKey = STORAGE_KEYS.saveSlotTmp(slot);

  // Clean any stale tmp from a previous crashed write.
  try { localStorage.removeItem(tmpKey); } catch { /* ignore */ }

  // Snapshot the current main BEFORE any destructive op.
  let oldMain: string | null = null;
  try { oldMain = localStorage.getItem(mainKey); } catch { /* ignore */ }

  // Step 1-2: stage and verify. On any failure, fall through to the
  // non-atomic direct-write fallback.
  let staged = false;
  try {
    localStorage.setItem(tmpKey, json);
    const readback = localStorage.getItem(tmpKey);
    if (readback === json) {
      JSON.parse(readback);
      staged = true;
    }
  } catch {
    /* fall through */
  }
  // Step 3: free the tmp's quota regardless of whether verify passed.
  try { localStorage.removeItem(tmpKey); } catch { /* ignore */ }

  if (!staged) {
    // Direct-write fallback (legacy quota-retry behaviour).
    try { localStorage.removeItem(backupKey); } catch { /* ignore */ }
    try {
      localStorage.setItem(mainKey, json);
    } catch (err) {
      if (!isQuotaError(err)) throw new Error('SAVE_WRITE_FAILED');
      tryFreeStorageSpace(slot);
      try { localStorage.setItem(mainKey, json); }
      catch { throw new Error('SAVE_WRITE_FAILED'); }
    }
    if (oldMain !== null) {
      try { localStorage.setItem(backupKey, oldMain); }
      catch { /* quota — acceptable */ }
    }
    return;
  }

  // Atomic path: staged + verified. Rotate then promote.
  try { localStorage.removeItem(backupKey); } catch { /* ignore */ }
  if (oldMain !== null) {
    try { localStorage.setItem(backupKey, oldMain); }
    catch { /* quota — main write is the priority */ }
  }
  try {
    localStorage.setItem(mainKey, json);
  } catch {
    // Drop backup and retry — main has priority.
    try { localStorage.removeItem(backupKey); } catch { /* ignore */ }
    try { localStorage.setItem(mainKey, json); }
    catch { throw new Error('SAVE_WRITE_FAILED'); }
  }
}

/** Read the staging-area payload for a slot. Callers use this during the
 *  load path to salvage a save that was being written when the previous
 *  process crashed. Returns null if no staging payload is present. */
export function readSaveSlotTmp(slot: number): string | null {
  try { return localStorage.getItem(STORAGE_KEYS.saveSlotTmp(slot)); }
  catch { return null; }
}

/** Drop the tmp key for a slot. Used after recovery or to drop a stale tmp
 *  that couldn't be salvaged. */
export function clearSaveSlotTmp(slot: number): void {
  try { localStorage.removeItem(STORAGE_KEYS.saveSlotTmp(slot)); }
  catch { /* storage unavailable */ }
}

/** Module-init recovery: if a tmp key exists for a slot whose main save is
 *  missing (e.g. process crashed between steps 1–4 of writeSaveSlot), and
 *  the tmp parses as valid JSON, promote it to main. Otherwise drop stale
 *  tmp keys so they can't cause confusion on the next write. Idempotent. */
export function recoverStaleSaveTmp(): void {
  try {
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
      const tmpKey = STORAGE_KEYS.saveSlotTmp(slot);
      const mainKey = STORAGE_KEYS.saveSlot(slot);
      const tmp = localStorage.getItem(tmpKey);
      if (tmp === null) continue;
      const main = localStorage.getItem(mainKey);
      if (main === null) {
        try { JSON.parse(tmp); localStorage.setItem(mainKey, tmp); }
        catch { /* tmp corrupted — drop it */ }
      }
      localStorage.removeItem(tmpKey);
    }
  } catch { /* storage unavailable */ }
}

/** Read the backup save for a slot */
export function readSaveSlotBackup(slot: number): string | null {
  try { return localStorage.getItem(`dynasty-save-${slot}-backup`); }
  catch { return null; }
}

/** Promote the backup shadow to primary for a slot. Drops the backup key
 *  before writing main so we don't trip the localStorage quota storing two
 *  copies of the same payload in Safari / embedded WebView / Node test env
 *  (jsdom has a 5 MB cap that a ~2 MB save can double past). The next
 *  regular save cycle will rotate the new main into a fresh backup. */
export function promoteSaveBackup(slot: number, raw: string): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.saveSlotBackup(slot));
    localStorage.setItem(STORAGE_KEYS.saveSlot(slot), raw);
  } catch { /* storage unavailable */ }
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
      localStorage.removeItem(`dynasty-save-${i}-tmp`);
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
