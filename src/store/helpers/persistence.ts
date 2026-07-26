import type { SlotSummary, MatchViewMode } from '@/types/game';
import { idbGet, idbPut, idbDel, idbKeys, requestPersistentStorage } from './idbStorage';
import { addGameBreadcrumb } from '@/utils/sentry';

/**
 * Centralised corruption breadcrumb. We don't surface these to the user
 * (every parse-fail call site already has a sensible fallback — return
 * null, mark slot as empty, etc.) but we DO want to see them in Sentry
 * so we can spot a class of corruption hitting many users before they
 * file support tickets. Throws are swallowed defensively — a breadcrumb
 * helper should never be the thing that breaks save loading.
 */
function breadcrumbCorruption(site: string, raw: string | null, err: unknown): void {
  try {
    addGameBreadcrumb('save', `Persistence parse failed: ${site}`, {
      site,
      rawLen: raw?.length ?? 0,
      rawHead: raw ? raw.slice(0, 80) : '',
      message: err instanceof Error ? err.message : String(err),
    });
  } catch { /* breadcrumb must never throw */ }
}

// ── Durable Save Storage ──
//
// Two-layer architecture:
//   1. **Memory cache** — a module-level mirror of every save slot + backup.
//      Serves every synchronous read (`readSaveSlot`, `getSlotSummaries`,
//      `loadGame`), so the rest of the game can stay sync.
//   2. **IndexedDB** — authoritative persistent store. Writes fire async
//      after the memory cache is updated. Hydrated on app start.
//      Unlike `localStorage` (capped at ~5 MB per origin on mobile
//      WKWebView), IDB is bounded only by device free space, so full-size
//      saves with community-pack data persist reliably.
//   3. **localStorage** — best-effort forward-compat mirror. Writes may
//      silently fail on quota; never throws. Existing installs that have
//      saves only in localStorage are migrated into IDB + memory cache on
//      the first call to `hydrateSaveStorage`.

const MAX_SLOTS = 3;

/** Upper bound on total hydration time before the app proceeds without IDB.
 *  Comfortably above a cold IDB read of three slots, low enough that a wedged
 *  database can't hold the title screen hostage. */
const HYDRATE_TIMEOUT_MS = 3000;

const memSlots: (string | null)[] = [null, null, null, null]; // slot 0 unused
const memSlotBackups: (string | null)[] = [null, null, null, null];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

/** Hydrate the in-memory save cache from IndexedDB. Called once at app
 *  start; subsequent calls return the same promise. If IDB is empty for
 *  a slot, we fall back to localStorage — this is the upgrade path for
 *  installs that saved to localStorage on an older app version. After
 *  hydration, `isSaveStorageHydrated()` returns true and
 *  `getSlotSummaries()` / `readSaveSlot()` serve data from memory. */
export function hydrateSaveStorage(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      // Ask the browser to keep IDB data around under storage pressure.
      // Fire-and-forget — the promise resolves whether or not it's granted.
      void requestPersistentStorage();
      const jobs: Promise<void>[] = [];
      for (let slot = 1; slot <= MAX_SLOTS; slot++) {
        jobs.push(hydrateOneSlot(slot));
      }
      // Second layer of the "never hang the title screen" guarantee (the first
      // is the open timeout in idbStorage). Anything that leaves an IDB request
      // pending forever — a locked database after an iOS WebView crash, a
      // wedged transaction — would otherwise mean `hydrated` never flips and
      // TitleScreen renders skeleton slot rows with no Continue and no New Game,
      // permanently. Falling through on a timeout serves whatever the memory
      // cache and localStorage mirror already hold; the slot reads themselves
      // stay resilient, and a late-arriving IDB value still lands in the cache
      // because `hydrateOneSlot` only fills empty entries.
      await Promise.race([
        Promise.all(jobs),
        new Promise<void>((resolve) => setTimeout(resolve, HYDRATE_TIMEOUT_MS)),
      ]);
    } finally {
      hydrated = true;
    }
  })();
  return hydratePromise;
}

async function hydrateOneSlot(slot: number): Promise<void> {
  const mainKey = STORAGE_KEYS.saveSlot(slot);
  const backupKey = STORAGE_KEYS.saveSlotBackup(slot);
  const [idbMain, idbBackup] = await Promise.all([idbGet(mainKey), idbGet(backupKey)]);
  // Never clobber a save written in-session while this async hydrate was in
  // flight — the memory cache is newer than whatever IDB held at app start,
  // and overwriting it would also rotate the stale data into the backup slot
  // on the next write (burning both recovery layers).
  if (idbMain) {
    if (memSlots[slot] === null) memSlots[slot] = idbMain;
  } else {
    // Fallback: migrate localStorage → IDB so this user's existing save
    // survives the 5 MB quota going forward.
    try {
      const ls = localStorage.getItem(mainKey);
      if (ls) {
        if (memSlots[slot] === null) memSlots[slot] = ls;
        void idbPut(mainKey, ls);
      }
    } catch { /* storage unavailable */ }
  }
  if (idbBackup) {
    if (memSlotBackups[slot] === null) memSlotBackups[slot] = idbBackup;
  } else {
    try {
      const ls = localStorage.getItem(backupKey);
      if (ls) {
        if (memSlotBackups[slot] === null) memSlotBackups[slot] = ls;
        void idbPut(backupKey, ls);
      }
    } catch { /* storage unavailable */ }
  }
}

/** True once `hydrateSaveStorage` has resolved. UI code that lists slots
 *  (e.g. the Title Screen) should gate on this so it doesn't render an
 *  empty picker before IDB has been read. */
export function isSaveStorageHydrated(): boolean {
  return hydrated;
}

/** Test-only: reset the memory cache so each test starts from a blank
 *  slate. Never call from production. */
export function __resetSaveStorageForTests(): void {
  for (let i = 0; i < memSlots.length; i++) {
    memSlots[i] = null;
    memSlotBackups[i] = null;
  }
  hydrated = false;
  hydratePromise = null;
}

/** Best-effort localStorage write. Swallows quota/availability errors —
 *  the IDB mirror is the source of truth. */
function lsSetSafe(key: string, value: string): void {
  try { localStorage.setItem(key, value); }
  catch { /* quota or unavailable — IDB has the data */ }
}

function lsRemoveSafe(key: string): void {
  try { localStorage.removeItem(key); }
  catch { /* unavailable */ }
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
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    // sessionStorage.getItem throwing means storage is unavailable
    // (Safari private mode) — silent fallback is correct. A throw past
    // the getItem call means the data was non-null but JSON.parse choked,
    // which IS corruption — breadcrumb it so we know.
    if (raw !== null) breadcrumbCorruption(`readSessionJson:${key}`, raw, err);
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
  /** sessionStorage: per-tab dismissal of the week-1 onboarding checklist.
   *  Cleared on tab close so reopening the app brings it back while the
   *  career is still in week 1. Not save-scoped — same checklist applies
   *  to every new career, dismiss state is intentionally not persisted. */
  ONBOARDING_CHECKLIST_DISMISSED: 'dynasty-onboarding-checklist-dismissed',
  /** localStorage flag (getFlag/setFlag): the one-off XP reward for finishing
   *  the first-session checklist has been paid. Device-global so a player who
   *  already learned the ropes on a prior career doesn't farm it on each new
   *  save — the reward is a first-timer nudge, not a per-career bonus. */
  ONBOARDING_REWARD_CLAIMED: 'dynasty-onboarding-reward-claimed',
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
  /** localStorage: persistent Hall of Managers data. Must match the key the hall
   *  read/write helpers actually use ('dynasty-hall-of-managers'). */
  HALL_OF_MANAGERS: 'dynasty-hall-of-managers',
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
  /** localStorage: crash-durable record of a paid consumable pack purchase
   *  that has not yet been granted in-game. Written BEFORE the StoreKit
   *  charge, cleared after the pack is opened and the save flushed.
   *  Consumables never appear in RevenueCat entitlements, so if the app
   *  dies between charge and grant this marker is the ONLY evidence that
   *  money changed hands — PacksPage reconciles it on mount. */
  PENDING_PACK_CREDIT: 'dynasty-pending-pack-credit',
  /** localStorage: latest "What's New" release the user has opened. Stored as
   *  a plain version string (e.g. "1.0.1"). Used to gate the "NEW" badge on
   *  the main-menu + Settings tiles so it clears once they tap through. */
  WHATS_NEW_SEEN_VERSION: 'dynasty-whats-new-seen',
  /** localStorage: native App Store review prompt state. JSON-encoded
   *  `{ count, lastShownAt, lastReason }`. Used to throttle our own calls to
   *  `SKStoreReviewController.requestReview` on top of Apple's 3/365-day
   *  hard cap so we only spend prompts on genuine high-emotion moments. */
  APP_REVIEW_STATE: 'dynasty-review-state',
  /** sessionStorage: per-session flag that the "Continue where you left off"
   *  resume card has already been shown this app session (JSON `true`). Tab-
   *  scoped so it re-appears on the next launch but only once per session. Not
   *  save data — a UI nudge derived entirely from existing state. */
  RESUME_CARD_SHOWN: 'dynasty-resume-card-shown',
  /** sessionStorage: remembers the Inbox filter selection (category filters +
   *  unread-only toggle) so it survives navigating away from and back to the
   *  Inbox within a session. JSON-encoded `{ filters: string[]; unreadOnly: boolean }`.
   *  Tab-scoped — a UI preference, not save data. */
  INBOX_FILTER: 'dynasty-inbox-filter',
  /** localStorage: tracks whether the user has seen the subscription
   *  onboarding paywall. Set once the user either starts the free trial or
   *  taps "Maybe later" on the new-game flow. Prevents the paywall from
   *  showing on every subsequent New Game tap. Returning Pro users skip
   *  the check entirely. */
  SUBSCRIBE_ONBOARDING_SEEN: 'dynasty-subscribe-onboarding-seen',
  /** localStorage flag: the first-week welcome tutorial has been shown
   *  (Dashboard). Removed by Settings → Replay Tutorial. */
  WELCOME_SHOWN: 'dynasty-welcome-shown',
  /** localStorage flag prefix: per-screen page hints
   *  (`dynasty-hint-<screen>-shown`, see PageHint.tsx). Cleared as a prefix
   *  by Settings → Replay Tutorial. */
  HINT_PREFIX: 'dynasty-hint-',
  /** localStorage: the user's preferred MatchDay view (`pitch`/`commentary`/
   *  `split`). A pure UI preference kept device-global so it survives app
   *  restarts; not part of any save slot. */
  MATCH_VIEW_MODE: 'dynasty-match-view-mode',
  /** localStorage: device-global daily login streak (JSON DailyStreakRecord).
   *  Tracks real-world consecutive days the player opened the app, independent
   *  of which career/slot is loaded — deliberately NOT save-scoped, so the
   *  streak survives starting a new career. */
  DAILY_STREAK: 'dynasty-daily-streak',
  /** localStorage: device-global set of redeem-code ids already applied on this
   *  device, so a signed code can't be re-applied. JSON array of normalized
   *  code ids. Device-scoped (not save-scoped) so one code = one use per
   *  device regardless of which save is active. */
  REDEEMED_CODES: 'dynasty-redeemed-codes',
  /** localStorage: device-global progress for the active date-boxed live event
   *  (JSON LiveEventProgress). Namespaced by event id inside the record so a
   *  new event starts fresh. Not save-scoped — Festival Points are a
   *  device-level engagement reward, not part of any career. */
  LIVE_EVENT_PROGRESS: 'dynasty-live-event-progress',
  /** localStorage: device-global opt-in for local notification reminders.
   *  '1' = on, '0' = off, missing = never asked. Device-level (not save-scoped)
   *  and paired with the OS permission, which is the ultimate gate. */
  NOTIFICATIONS_ENABLED: 'dynasty-notifications-enabled',
  /** localStorage flag (getFlag/setFlag): the one-time first-win notification
   *  permission prompt has been shown. Device-global so a returning player who
   *  already answered it on a previous career isn't re-prompted on each new
   *  save. Independent of NOTIFICATIONS_ENABLED (which records the answer). */
  NOTIF_FIRST_WIN_PROMPTED: 'dynasty-notif-first-win-prompted',
  /** localStorage: device-global set of completed challenge-scenario ids (JSON
   *  array). Challenge completion is a device-level achievement, not part of
   *  any career save — deliberately NOT save-scoped, so it persists across new
   *  careers and slot deletion. Badges are cosmetic labels, never entitlements. */
  COMPLETED_CHALLENGES: 'dynasty-completed-challenges',
} as const;

/** Read the user's preferred MatchDay view, or null if never set. */
export function readMatchViewMode(): MatchViewMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.MATCH_VIEW_MODE);
    return v === 'pitch' || v === 'commentary' || v === 'split' ? v : null;
  } catch { return null; }
}

/** Persist the user's preferred MatchDay view. Swallows availability errors. */
export function writeMatchViewMode(mode: MatchViewMode): void {
  try { localStorage.setItem(STORAGE_KEYS.MATCH_VIEW_MODE, mode); }
  catch { /* storage unavailable — non-fatal, defaults to commentary */ }
}

// ── Daily Login Streak ──

/** Device-global daily login streak. Persisted in localStorage outside any
 *  save slot. `lastClaimDate` is a local calendar-day key (YYYY-MM-DD);
 *  `current` is the live consecutive-day run; `longest` is the best run ever. */
export interface DailyStreakRecord {
  lastClaimDate: string;
  current: number;
  longest: number;
}

export function readDailyStreak(): DailyStreakRecord | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.DAILY_STREAK);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lastClaimDate !== 'string') return null;
    return {
      lastClaimDate: parsed.lastClaimDate,
      current: typeof parsed.current === 'number' ? parsed.current : 0,
      longest: typeof parsed.longest === 'number' ? parsed.longest : 0,
    };
  } catch (err) {
    if (raw !== null) breadcrumbCorruption('readDailyStreak', raw, err);
    return null;
  }
}

export function writeDailyStreak(record: DailyStreakRecord): void {
  try { localStorage.setItem(STORAGE_KEYS.DAILY_STREAK, JSON.stringify(record)); }
  catch { /* storage unavailable — non-fatal, the streak just won't persist */ }
}

// ── Redeem Codes (device-global) ──

/** Device-global list of redeem-code ids already applied here. */
export function readRedeemedCodes(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.REDEEMED_CODES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch (err) {
    if (raw !== null) breadcrumbCorruption('readRedeemedCodes', raw, err);
    return [];
  }
}

/** Record a redeem-code id as applied. No-op if already present. */
export function addRedeemedCode(codeId: string): void {
  try {
    const existing = readRedeemedCodes();
    if (existing.includes(codeId)) return;
    localStorage.setItem(STORAGE_KEYS.REDEEMED_CODES, JSON.stringify([...existing, codeId]));
  } catch { /* storage unavailable — non-fatal */ }
}

// ── Live Event Progress ──

/** Device-global progress for a date-boxed live event. `eventId` namespaces it
 *  so progress from a previous event is treated as stale (a fresh record is
 *  returned for the current event). `lastCheckInDate` is a local YYYY-MM-DD key. */
export interface LiveEventProgress {
  eventId: string;
  points: number;
  lastCheckInDate: string;
  claimedTierIds: string[];
  /** Local day key of the last match-win award (for the daily cap). */
  matchWinDate?: string;
  /** Number of match-win awards taken on `matchWinDate`. */
  matchWinCount?: number;
}

export function readLiveEventProgress(): LiveEventProgress | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.LIVE_EVENT_PROGRESS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.eventId !== 'string') return null;
    return {
      eventId: parsed.eventId,
      points: typeof parsed.points === 'number' ? parsed.points : 0,
      lastCheckInDate: typeof parsed.lastCheckInDate === 'string' ? parsed.lastCheckInDate : '',
      claimedTierIds: Array.isArray(parsed.claimedTierIds) ? parsed.claimedTierIds.filter((t: unknown) => typeof t === 'string') : [],
      matchWinDate: typeof parsed.matchWinDate === 'string' ? parsed.matchWinDate : undefined,
      matchWinCount: typeof parsed.matchWinCount === 'number' ? parsed.matchWinCount : undefined,
    };
  } catch (err) {
    if (raw !== null) breadcrumbCorruption('readLiveEventProgress', raw, err);
    return null;
  }
}

export function writeLiveEventProgress(record: LiveEventProgress): void {
  try { localStorage.setItem(STORAGE_KEYS.LIVE_EVENT_PROGRESS, JSON.stringify(record)); }
  catch { /* storage unavailable — non-fatal */ }
}

// ── Completed Challenges (device-global) ──

/** Device-global list of completed challenge-scenario ids. */
export function readCompletedChallenges(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.COMPLETED_CHALLENGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch (err) {
    if (raw !== null) breadcrumbCorruption('readCompletedChallenges', raw, err);
    return [];
  }
}

/** Record a challenge id as completed. No-op if already present. Returns true
 *  when it was newly added (so the caller can pay a first-time reward). */
export function addCompletedChallenge(challengeId: string): boolean {
  try {
    const existing = readCompletedChallenges();
    if (existing.includes(challengeId)) return false;
    localStorage.setItem(STORAGE_KEYS.COMPLETED_CHALLENGES, JSON.stringify([...existing, challengeId]));
    return true;
  } catch { return false; }
}

// ── Notification opt-in ──

/** Device-global notification opt-in. null = never asked (so the Settings
 *  toggle reads OFF until the user explicitly enables it). */
export function readNotificationsEnabled(): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  } catch { return null; }
}

export function writeNotificationsEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled ? '1' : '0'); }
  catch { /* storage unavailable — non-fatal */ }
}

/** Read the latest "What's New" version the user has acknowledged. */
export function readWhatsNewSeenVersion(): string | null {
  try { return localStorage.getItem(STORAGE_KEYS.WHATS_NEW_SEEN_VERSION); }
  catch { return null; }
}

/** Mark a "What's New" version as read (typically the latest, on page open). */
export function writeWhatsNewSeenVersion(version: string): void {
  try { localStorage.setItem(STORAGE_KEYS.WHATS_NEW_SEEN_VERSION, version); }
  catch { /* storage unavailable — non-fatal */ }
}

/** Persistent state for the native App Store review prompt. We layer our own
 *  cap on top of Apple's built-in 3/365 throttle so we only burn requests on
 *  high-emotion moments (season-end with a trophy / promotion / title). */
export interface AppReviewState {
  /** Total number of times we've called `requestReview` over the install's
   *  lifetime. The OS may have shown 0 or all of them — we can't tell. */
  count: number;
  /** Epoch ms of the most recent call. Used to enforce a min-gap. */
  lastShownAt: number;
  /** Free-form tag identifying which moment triggered the most recent call —
   *  useful for analytics / debugging. */
  lastReason?: string;
}

export function readAppReviewState(): AppReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_REVIEW_STATE);
    if (!raw) return { count: 0, lastShownAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      lastShownAt: typeof parsed.lastShownAt === 'number' ? parsed.lastShownAt : 0,
      lastReason: typeof parsed.lastReason === 'string' ? parsed.lastReason : undefined,
    };
  } catch { return { count: 0, lastShownAt: 0 }; }
}

export function writeAppReviewState(state: AppReviewState): void {
  try { localStorage.setItem(STORAGE_KEYS.APP_REVIEW_STATE, JSON.stringify(state)); }
  catch { /* storage unavailable — non-fatal */ }
}

/** Crash-durable marker for a paid-but-not-yet-granted consumable pack.
 *  See STORAGE_KEYS.PENDING_PACK_CREDIT for the lifecycle. */
export interface PendingPackCredit {
  productId: string;
  tierKey: string;
  timestamp: number;
  /** Save slot that initiated the purchase — the credit is only reconciled
   *  into the same save, so a crash + loading a different slot can't grant
   *  the pack to the wrong career. */
  slot: number;
  /** Set once the reconciler has failed to re-grant (e.g. squad full) and
   *  fired its one-time Sentry alert. Throttles the capture to once per marker
   *  so a persistently-blocked claim doesn't re-report on every mount. */
  reported?: boolean;
}

export function readPendingPackCredit(): PendingPackCredit | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.PENDING_PACK_CREDIT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.productId !== 'string' || typeof parsed?.tierKey !== 'string') return null;
    return {
      productId: parsed.productId,
      tierKey: parsed.tierKey,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : 0,
      slot: typeof parsed.slot === 'number' ? parsed.slot : 0,
      ...(parsed.reported === true ? { reported: true } : {}),
    };
  } catch (err) {
    if (raw !== null) breadcrumbCorruption('readPendingPackCredit', raw, err);
    return null;
  }
}

export function writePendingPackCredit(credit: PendingPackCredit): void {
  try { localStorage.setItem(STORAGE_KEYS.PENDING_PACK_CREDIT, JSON.stringify(credit)); }
  catch { /* storage unavailable — the purchase still proceeds, just without crash durability */ }
}

export function clearPendingPackCredit(): void {
  try { localStorage.removeItem(STORAGE_KEYS.PENDING_PACK_CREDIT); }
  catch { /* storage unavailable */ }
}

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
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSnapshot;
  } catch (err) {
    if (raw !== null) breadcrumbCorruption('loadSessionSnapshot', raw, err);
    return null;
  }
}

export function clearSessionSnapshot(): void {
  try { localStorage.removeItem(SNAPSHOT_KEY); }
  catch { /* storage unavailable */ }
}

/** Migrate legacy single-slot save to slot 1. Writes through every layer
 *  (memory cache, IDB, localStorage) so the upgrade sticks across sessions
 *  even when localStorage is tight. */
export function migrateLegacySave() {
  try {
    const legacy = localStorage.getItem('dynasty-save');
    if (!legacy) return;
    if (!readSaveSlot(1)) {
      memSlots[1] = legacy;
      void idbPut(STORAGE_KEYS.saveSlot(1), legacy);
      lsSetSafe(STORAGE_KEYS.saveSlot(1), legacy);
    }
    lsRemoveSafe('dynasty-save');
  } catch {
    // storage unavailable
  }
}

// ── Save Slot Helpers (used by orchestrationSlice) ──

/** Read a raw save string from a slot. Returns the in-memory cache first
 *  (authoritative during a session), falling back to `localStorage` for
 *  fresh installs that haven't run `hydrateSaveStorage` yet. Never throws. */
export function readSaveSlot(slot: number): string | null {
  const cached = memSlots[slot];
  if (cached) return cached;
  try {
    const ls = localStorage.getItem(STORAGE_KEYS.saveSlot(slot));
    if (ls) memSlots[slot] = ls;
    return ls;
  } catch { return null; }
}

/** Write a raw save string to a slot with automatic backup rotation.
 *
 *  Ordering:
 *    1. Rotate the previous main into the in-memory backup slot.
 *    2. Install the new payload in the in-memory main slot (authoritative
 *       for every read this session).
 *    3. Fire async IDB writes for main + backup (durable across sessions,
 *       unbounded quota on mobile WKWebView).
 *    4. Best-effort mirror to `localStorage` — swallows quota errors so a
 *       save never fails the user-visible flow. The 5 MB cap on mobile
 *       WKWebView is the reason we moved to IDB in the first place.
 *
 *  Writes are never silently lost: step 2 guarantees the current session
 *  sees the save immediately, and step 3 guarantees the next session does
 *  too (IDB transactions are ACID). localStorage is purely a compatibility
 *  mirror for older code paths and tests. */
export interface SaveWriteResult {
  /** localStorage mirror status — known synchronously. False on quota
   *  exceeded; the memory cache is always updated and IDB is in flight. */
  lsOk: boolean;
  /** IDB write outcome. Resolves true on success, false on quota / IDB
   *  unavailable / transaction abort. Never rejects — `idbPut` swallows. */
  idbPromise: Promise<boolean>;
}

export interface WriteSaveSlotOptions {
  /** Guard for the backup-rotation step. When supplied, the outgoing main
   *  save is only rotated into the backup slot if this predicate returns
   *  true for it. A malformed outgoing main is overwritten in place and the
   *  existing (last-known-good) backup is left UNTOUCHED — this is what
   *  stops two consecutive bad saves from burning the recovery copy.
   *  Injected (rather than importing `validateSaveShape` here) because this
   *  module is low-level and eagerly bundled — pulling in the migration
   *  module would drag its heavy data imports into the eager-bundle budget
   *  and risk an import cycle. Omit for raw writes (tests, legacy callers),
   *  which keeps the always-rotate behaviour. */
  validateOutgoing?: (raw: string) => boolean;
}

export function writeSaveSlot(slot: number, json: string, opts?: WriteSaveSlotOptions): SaveWriteResult {
  const mainKey = STORAGE_KEYS.saveSlot(slot);
  const backupKey = STORAGE_KEYS.saveSlotBackup(slot);
  const tmpKey = STORAGE_KEYS.saveSlotTmp(slot);

  // Step 1-2: update memory cache (sync, authoritative for this session).
  // `readSaveSlot` falls back to localStorage when the cache is empty, so a
  // pre-hydration write still rotates the previous save into the backup
  // slot instead of losing it.
  const oldMain = readSaveSlot(slot);
  // Only rotate a VALID outgoing main into the backup. If the outgoing main
  // is malformed (partial write / on-disk corruption) we overwrite it in
  // place and preserve whatever the backup already holds — otherwise a bad
  // save landing on top of another bad save would destroy the last valid
  // backup. Without an injected validator we keep the historical
  // always-rotate behaviour.
  const rotate = !!oldMain && (opts?.validateOutgoing ? opts.validateOutgoing(oldMain) : true);
  if (rotate) memSlotBackups[slot] = oldMain as string;
  memSlots[slot] = json;

  // Sweep any legacy tmp key from the old atomic-staging write path so it
  // doesn't get salvaged later as a phantom older save.
  try { localStorage.removeItem(tmpKey); } catch { /* ignore */ }

  // Step 3: fire IDB writes. We capture the main-write Promise (and ignore
  // the backup-write outcome — the main write is what determines whether
  // the slot survives a reload). The caller can use this to detect the
  // "both disk paths failed" case and surface a Save Failed warning.
  const idbPromise = idbPut(mainKey, json);
  if (rotate) void idbPut(backupKey, oldMain as string);
  else if (!oldMain && hydrated) void idbDel(backupKey);
  // else: either the outgoing main failed validation (leave the existing backup
  // intact), or we haven't hydrated yet. The `hydrated` guard matters: before
  // hydration `readSaveSlot` can legitimately return null while IDB still holds
  // both a main and a backup, so an early write — reachable via
  // `migrateLegacySave()` or a deep link straight to #/select-club — would read
  // `oldMain === null` and DELETE the last-known-good IDB backup while
  // overwriting the main. Never destroy a recovery layer we haven't looked at.

  // Step 4: best-effort localStorage mirror. On quota exceeded we drop
  // whatever was there so the two stores don't diverge — IDB is truth.
  let lsOk = true;
  try {
    localStorage.setItem(mainKey, json);
    if (rotate) lsSetSafe(backupKey, oldMain as string);
    else if (!oldMain) lsRemoveSafe(backupKey);
    // else: preserve the existing backup mirror for the invalid-main case.
  } catch {
    // Quota exceeded — drop the main mirror. The caller now sees `lsOk: false`
    // and can await `idbPromise` to decide whether to warn the user. We only
    // clear the backup mirror when we just rotated into it; an untouched
    // last-known-good backup must survive a main-write quota failure.
    lsOk = false;
    lsRemoveSafe(mainKey);
    if (rotate) lsRemoveSafe(backupKey);
  }

  return { lsOk, idbPromise };
}

/** Read the staging-area payload for a slot. Retained for backward compat —
 *  the new write path no longer stages through a tmp key, but old
 *  installs may still have one lying around. */
export function readSaveSlotTmp(slot: number): string | null {
  try { return localStorage.getItem(STORAGE_KEYS.saveSlotTmp(slot)); }
  catch { return null; }
}

/** Drop the tmp key for a slot. Kept for backward compat. */
export function clearSaveSlotTmp(slot: number): void {
  try { localStorage.removeItem(STORAGE_KEYS.saveSlotTmp(slot)); }
  catch { /* storage unavailable */ }
}

/** Sweep stale tmp keys from a previous app version that still used the
 *  tmp-staging write path. If tmp is valid JSON and the slot is empty
 *  (no memory cache entry, no localStorage primary), salvage it; otherwise
 *  drop it. Idempotent. */
export function recoverStaleSaveTmp(): void {
  try {
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
      const tmpKey = STORAGE_KEYS.saveSlotTmp(slot);
      const tmp = localStorage.getItem(tmpKey);
      if (tmp === null) continue;
      const hasPrimary = memSlots[slot] !== null || localStorage.getItem(STORAGE_KEYS.saveSlot(slot)) !== null;
      if (!hasPrimary) {
        try {
          JSON.parse(tmp);
          memSlots[slot] = tmp;
          void idbPut(STORAGE_KEYS.saveSlot(slot), tmp);
          lsSetSafe(STORAGE_KEYS.saveSlot(slot), tmp);
        } catch { /* tmp corrupted — drop it */ }
      }
      localStorage.removeItem(tmpKey);
    }
  } catch { /* storage unavailable */ }
}

/** Read the backup save for a slot. Memory cache → localStorage fallback. */
export function readSaveSlotBackup(slot: number): string | null {
  const cached = memSlotBackups[slot];
  if (cached) return cached;
  try {
    const ls = localStorage.getItem(STORAGE_KEYS.saveSlotBackup(slot));
    if (ls) memSlotBackups[slot] = ls;
    return ls;
  } catch { return null; }
}

/** Promote the backup shadow to primary for a slot. Updates memory cache,
 *  IDB, and localStorage so subsequent reads/writes treat the recovered
 *  data as the new source of truth. */
export function promoteSaveBackup(slot: number, raw: string): void {
  memSlots[slot] = raw;
  memSlotBackups[slot] = null;
  void idbPut(STORAGE_KEYS.saveSlot(slot), raw);
  void idbDel(STORAGE_KEYS.saveSlotBackup(slot));
  lsRemoveSafe(STORAGE_KEYS.saveSlotBackup(slot));
  lsSetSafe(STORAGE_KEYS.saveSlot(slot), raw);
}

/** Remove a save slot from every layer (memory, IDB, localStorage). */
export function removeSaveSlot(slot: number): void {
  memSlots[slot] = null;
  memSlotBackups[slot] = null;
  void idbDel(STORAGE_KEYS.saveSlot(slot));
  void idbDel(STORAGE_KEYS.saveSlotBackup(slot));
  lsRemoveSafe(STORAGE_KEYS.saveSlot(slot));
  lsRemoveSafe(STORAGE_KEYS.saveSlotBackup(slot));
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

/** Wipe all Dynasty Manager data from every storage layer (memory cache,
 *  IndexedDB, localStorage). Required for the Apple account-deletion flow. */
export function deleteAllDynastyData(): void {
  // Memory cache — zero out sync source of truth.
  for (let i = 0; i < memSlots.length; i++) {
    memSlots[i] = null;
    memSlotBackups[i] = null;
  }
  // IndexedDB — drop every key namespaced for Dynasty.
  void (async () => {
    try {
      const keys = await idbKeys();
      await Promise.all(keys.map(k => idbDel(k)));
    } catch { /* ignore */ }
  })();
  // localStorage — drop every key the app may have written.
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

/** Get summaries for all 3 save slots. Reads from the memory cache (so
 *  IDB-only saves show up on the Title Screen) with a localStorage
 *  fallback for users whose slots haven't been hydrated yet. */
export function getSlotSummaries(): SlotSummary[] {
  migrateLegacySave();
  return [1, 2, 3].map(slot => {
    const raw = readSaveSlot(slot);
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
    } catch (err) {
      // Slot data exists but failed to parse — corruption. Without the
      // breadcrumb the user just sees their populated slot rendered as
      // an empty "New Game" row on TitleScreen, with no signal to us
      // that a save was lost.
      breadcrumbCorruption(`getSlotSummaries:slot${slot}`, raw, err);
      return { slot, exists: false };
    }
  });
}
