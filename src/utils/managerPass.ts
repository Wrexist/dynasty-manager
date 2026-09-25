/**
 * Manager Pass logic — seasons, Pass XP, the free/Pro track and earned-cosmetic
 * ownership.
 *
 * Pure apart from the small storage section (`loadPassRecord` /
 * `savePassRecord` / `isEarnedCosmeticOwned`), so the maths is unit-testable
 * with an injected `now`, the same split as `utils/liveEvents.ts`. The
 * game-state observer that feeds it XP is `utils/managerPassObserver.ts`,
 * loaded with the in-game shell rather than at startup.
 *
 * Sim-neutral by construction: nothing here reads or writes a player, a club,
 * a match or manager XP. Pass XP only moves the pass; the pass only unlocks
 * cosmetics. See the header of `config/managerPass.ts`.
 */
import {
  MANAGER_PASS_TIER_COUNT,
  MANAGER_PASS_XP_PER_TIER,
  MANAGER_PASS_XP,
  MANAGER_PASS_MATCH_XP_DAILY_CAP,
  MANAGER_PASS_LEDGER_MAX,
  MANAGER_PASS_SEASON_MONTHS,
  MANAGER_PASS_TRACK,
} from '@/config/managerPass';
import { COSMETIC_ITEMS } from '@/config/monetization';
import { localDateKey, daysBetween } from '@/utils/dailyStreak';
import { legacyUnlockedRewardIds, readLegacyTier } from '@/utils/managerLegacy';
import {
  readManagerPassData,
  writeManagerPassData,
  readManagerPassMirror,
  writeManagerPassMirror,
} from '@/store/helpers/persistence';
import type {
  CosmeticItem,
  ManagerPassEvent,
  ManagerPassProCarry,
  ManagerPassRecord,
  ManagerPassSeason,
  ManagerPassTierDef,
  ManagerPassTrack,
} from '@/types/game';

// ── Seasons ──

const pad2 = (n: number) => String(n).padStart(2, '0');
const SEASONS_PER_YEAR = 12 / MANAGER_PASS_SEASON_MONTHS;

/** The Pass season containing `now` — a pure function of the local date. */
export function getManagerPassSeason(now: Date = new Date()): ManagerPassSeason {
  const year = now.getFullYear();
  const themeIndex = Math.floor(now.getMonth() / MANAGER_PASS_SEASON_MONTHS);
  const startMonth = themeIndex * MANAGER_PASS_SEASON_MONTHS + 1; // 1-based
  const endMonth = startMonth + MANAGER_PASS_SEASON_MONTHS - 1;
  const lastDay = new Date(year, endMonth, 0).getDate(); // day 0 of next month
  return {
    id: `pass-${year}-${themeIndex + 1}`,
    ordinal: year * SEASONS_PER_YEAR + themeIndex,
    themeIndex,
    start: `${year}-${pad2(startMonth)}-01`,
    end: `${year}-${pad2(endMonth)}-${pad2(lastDay)}`,
  };
}

/** The season with this ordinal — for drawing a stored record's own season,
 *  which is the right one to show even if the device clock disagrees. */
export function passSeasonFromOrdinal(ordinal: number): ManagerPassSeason {
  const year = Math.floor(ordinal / SEASONS_PER_YEAR);
  const themeIndex = ordinal - year * SEASONS_PER_YEAR;
  return getManagerPassSeason(new Date(year, themeIndex * MANAGER_PASS_SEASON_MONTHS, 1, 12));
}

/** Whole days left in `season`, 0 on its last day. */
export function getPassSeasonDaysRemaining(season: ManagerPassSeason, now: Date = new Date()): number {
  return Math.max(0, daysBetween(localDateKey(now), season.end) ?? 0);
}

// ── Record ──

export function freshPassRecord(season: ManagerPassSeason): ManagerPassRecord {
  return {
    v: 1,
    seasonId: season.id,
    seasonOrdinal: season.ordinal,
    xp: 0,
    claimedFree: [],
    claimedPro: [],
    lastCheckInDate: '',
    matchXpDate: '',
    matchXpCount: 0,
    awardedKeys: [],
    ownedRewardIds: [],
    completedSeasonIds: [],
  };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const tiers = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= MANAGER_PASS_TIER_COUNT) : [];
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

/** Every Pro-track reward id — a stored carry may only name these. */
const PRO_TRACK_IDS = new Set(MANAGER_PASS_TRACK.map(t => t.pro));

function parseProCarry(v: unknown): ManagerPassProCarry | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  if (typeof c.seasonId !== 'string' || !Number.isInteger(c.seasonOrdinal)) return null;
  const rewardIds = strings(c.rewardIds).filter(id => PRO_TRACK_IDS.has(id));
  return rewardIds.length > 0 ? { seasonId: c.seasonId, seasonOrdinal: c.seasonOrdinal as number, rewardIds } : null;
}

/**
 * Parse a stored record, or null when there is nothing usable.
 *
 * Tolerant by design: a missing or wrong-typed field falls back to its fresh
 * value instead of discarding the whole record, because the one field that
 * matters most — `ownedRewardIds`, cosmetics already earned — must survive a
 * partially damaged record. A record written by a NEWER build (`v` > 1) is read
 * for the fields this build knows; the unknown ones are dropped on next write.
 */
export function parsePassRecord(raw: string | null): ManagerPassRecord | null {
  if (!raw) return null;
  let o: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    o = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof o.seasonId !== 'string' || !Number.isInteger(o.seasonOrdinal)) return null;
  return {
    v: 1,
    seasonId: o.seasonId,
    seasonOrdinal: o.seasonOrdinal as number,
    xp: Math.min(num(o.xp), MAX_PASS_XP),
    claimedFree: tiers(o.claimedFree),
    claimedPro: tiers(o.claimedPro),
    lastCheckInDate: typeof o.lastCheckInDate === 'string' ? o.lastCheckInDate : '',
    matchXpDate: typeof o.matchXpDate === 'string' ? o.matchXpDate : '',
    matchXpCount: num(o.matchXpCount),
    awardedKeys: strings(o.awardedKeys).slice(-MANAGER_PASS_LEDGER_MAX),
    ownedRewardIds: strings(o.ownedRewardIds),
    completedSeasonIds: strings(o.completedSeasonIds),
    rev: Math.floor(num(o.rev)),
    proCarry: parseProCarry(o.proCarry),
  };
}

// ── Tiers & XP ──

/** XP at which the final tier is reached; XP above it has nowhere to go. */
export const MAX_PASS_XP = MANAGER_PASS_TIER_COUNT * MANAGER_PASS_XP_PER_TIER;

/** Tiers reached for an XP total (0..MANAGER_PASS_TIER_COUNT). */
export function passTierForXp(xp: number): number {
  return Math.max(0, Math.min(MANAGER_PASS_TIER_COUNT, Math.floor(xp / MANAGER_PASS_XP_PER_TIER)));
}

/** Progress toward the next tier, for the XP bar. `next` is null at the top. */
export function passTierProgress(xp: number): { tier: number; next: number | null; into: number; needed: number } {
  const tier = passTierForXp(xp);
  if (tier >= MANAGER_PASS_TIER_COUNT) return { tier, next: null, into: MANAGER_PASS_XP_PER_TIER, needed: MANAGER_PASS_XP_PER_TIER };
  return { tier, next: tier + 1, into: xp - tier * MANAGER_PASS_XP_PER_TIER, needed: MANAGER_PASS_XP_PER_TIER };
}

/** Add Pass XP, capping at the top of the track and stamping the season as
 *  completed the first time the final tier is reached. */
function withXp(record: ManagerPassRecord, amount: number): ManagerPassRecord {
  if (amount <= 0) return record;
  const xp = Math.min(MAX_PASS_XP, record.xp + amount);
  const completed = xp >= MAX_PASS_XP && !record.completedSeasonIds.includes(record.seasonId)
    ? [...record.completedSeasonIds, record.seasonId]
    : record.completedSeasonIds;
  return { ...record, xp, completedSeasonIds: completed };
}

function withKey(record: ManagerPassRecord, key: string): ManagerPassRecord {
  const keys = [...record.awardedKeys, key];
  return { ...record, awardedKeys: keys.length > MANAGER_PASS_LEDGER_MAX ? keys.slice(-MANAGER_PASS_LEDGER_MAX) : keys };
}

/** True when today's check-in has not been taken. */
export function canCheckInPass(record: ManagerPassRecord, now: Date = new Date()): boolean {
  return record.lastCheckInDate !== localDateKey(now);
}

/** Progress after the daily check-in; the same record if already taken today. */
export function applyPassCheckIn(record: ManagerPassRecord, now: Date = new Date()): ManagerPassRecord {
  if (!canCheckInPass(record, now)) return record;
  return { ...withXp(record, MANAGER_PASS_XP.dailyCheckIn), lastCheckInDate: localDateKey(now) };
}

/** Pass XP a match is worth. */
export function matchPassXp(outcome: 'win' | 'draw' | 'loss'): number {
  const bonus = outcome === 'win' ? MANAGER_PASS_XP.matchWinBonus : outcome === 'draw' ? MANAGER_PASS_XP.matchDrawBonus : 0;
  return MANAGER_PASS_XP.matchPlayed + bonus;
}

/** Pass XP a completed season is worth, given the trophies won in it. */
export function seasonPassXp(trophies: number): number {
  return MANAGER_PASS_XP.seasonCompleted + Math.max(0, trophies) * MANAGER_PASS_XP.trophyWon;
}

/**
 * Progress after one observed event. Idempotent per `event.key`: a key already
 * in the ledger pays nothing, which is what stops a reloaded save from paying
 * for the same match twice. Matches past the day's cap are recorded (the match
 * is spent) but pay nothing.
 */
export function applyPassEvent(record: ManagerPassRecord, event: ManagerPassEvent, now: Date = new Date()): ManagerPassRecord {
  if (record.awardedKeys.includes(event.key)) return record;
  if (event.source === 'match') {
    const today = localDateKey(now);
    const count = record.matchXpDate === today ? record.matchXpCount : 0;
    const spent = { ...withKey(record, event.key), matchXpDate: today, matchXpCount: count };
    if (count >= MANAGER_PASS_MATCH_XP_DAILY_CAP) return spent;
    return withXp({ ...spent, matchXpCount: count + 1 }, matchPassXp(event.outcome));
  }
  if (event.source === 'objective') return withXp(withKey(record, event.key), MANAGER_PASS_XP.objectiveCompleted);
  return withXp(withKey(record, event.key), seasonPassXp(event.trophies));
}

export function applyPassEvents(record: ManagerPassRecord, events: ManagerPassEvent[], now: Date = new Date()): ManagerPassRecord {
  return events.reduce((r, e) => applyPassEvent(r, e, now), record);
}

// ── Track & claims ──

export function getPassTierDef(tier: number): ManagerPassTierDef | undefined {
  return MANAGER_PASS_TRACK.find(t => t.tier === tier);
}

/** The cosmetic id a tier pays on a track, if any. */
export function passRewardId(tier: number, track: ManagerPassTrack): string | undefined {
  const def = getPassTierDef(tier);
  return track === 'free' ? def?.free : def?.pro;
}

export type PassClaimStatus = 'none' | 'locked' | 'pro_locked' | 'claimable' | 'claimed';

/**
 * Where one reward cell stands:
 *  - `none`       — this tier has no reward on this track
 *  - `locked`     — tier not reached yet
 *  - `pro_locked` — reached, but the Pro track needs Pro (the upsell cell)
 *  - `claimable`  — reached and collectable now
 *  - `claimed`    — collected this season
 */
export function passClaimStatus(record: ManagerPassRecord, tier: number, track: ManagerPassTrack, isPro: boolean): PassClaimStatus {
  if (!passRewardId(tier, track)) return 'none';
  const claimed = track === 'free' ? record.claimedFree : record.claimedPro;
  if (claimed.includes(tier)) return 'claimed';
  if (passTierForXp(record.xp) < tier) return 'locked';
  if (track === 'pro' && !isPro) return 'pro_locked';
  return 'claimable';
}

/** Progress after collecting one reward; the same record unless claimable. */
export function applyPassClaim(record: ManagerPassRecord, tier: number, track: ManagerPassTrack, isPro: boolean): ManagerPassRecord {
  if (passClaimStatus(record, tier, track, isPro) !== 'claimable') return record;
  const rewardId = passRewardId(tier, track)!;
  const owned = record.ownedRewardIds.includes(rewardId) ? record.ownedRewardIds : [...record.ownedRewardIds, rewardId];
  return track === 'free'
    ? { ...record, claimedFree: [...record.claimedFree, tier], ownedRewardIds: owned }
    : { ...record, claimedPro: [...record.claimedPro, tier], ownedRewardIds: owned };
}

/** Every reward collectable right now, in track order. */
export function claimablePassRewards(record: ManagerPassRecord, isPro: boolean): { tier: number; track: ManagerPassTrack }[] {
  const out: { tier: number; track: ManagerPassTrack }[] = [];
  for (const def of MANAGER_PASS_TRACK) {
    for (const track of ['free', 'pro'] as const) {
      if (passClaimStatus(record, def.tier, track, isPro) === 'claimable') out.push({ tier: def.tier, track });
    }
  }
  return out;
}

export function applyClaimAll(record: ManagerPassRecord, isPro: boolean): ManagerPassRecord {
  const claimed = claimablePassRewards(record, isPro).reduce((r, c) => applyPassClaim(r, c.tier, c.track, isPro), record);
  return applyCarriedProClaim(claimed, isPro);
}

// ── Last season's Pro rewards (carry-over) ──

/**
 * Pro rewards carried over from the previous season that are collectable now:
 * Pro is confirmed, the carry comes from the season IMMEDIATELY before the
 * record's own (bounded — an older carry is dead), and the reward is not
 * already owned. Pass `isPro = true` to ask what is waiting behind Pro.
 */
export function carriedProRewards(record: ManagerPassRecord, isPro: boolean): string[] {
  const carry = record.proCarry;
  if (!isPro || !carry || carry.seasonOrdinal !== record.seasonOrdinal - 1) return [];
  return carry.rewardIds.filter(id => !record.ownedRewardIds.includes(id));
}

/** Progress after collecting every carried Pro reward; the same record when
 *  there is nothing collectable. The carry is spent once collected. */
export function applyCarriedProClaim(record: ManagerPassRecord, isPro: boolean): ManagerPassRecord {
  const ids = carriedProRewards(record, isPro);
  if (ids.length === 0) return record;
  return { ...record, ownedRewardIds: [...record.ownedRewardIds, ...ids], proCarry: null };
}

/** Pro-track rewards reached this season but neither collected nor owned. */
function uncollectedProRewards(record: ManagerPassRecord): string[] {
  const reached = passTierForXp(record.xp);
  return MANAGER_PASS_TRACK
    .filter(def => def.tier <= reached && !record.claimedPro.includes(def.tier) && !record.ownedRewardIds.includes(def.pro))
    .map(def => def.pro);
}

/** Rewards collectable right now on either track, plus last season's Pro
 *  carry — the number a "to collect" badge shows. */
export function passClaimableCount(record: ManagerPassRecord, isPro: boolean): number {
  return claimablePassRewards(record, isPro).length + carriedProRewards(record, isPro).length;
}

/**
 * Move a record into `season`.
 *
 * Same season, or a record from a LATER season than `season` (the clock went
 * backwards): unchanged — progress is never reset toward the past. Otherwise
 * the old season closes: every reward already reached but not collected is
 * collected for the player (free always; Pro while they are Pro), because a
 * reward earned and lost to a forgotten tap is the one outcome worse than not
 * offering it. XP, claims and today's counters reset; the ledger, the owned
 * collection and the completed-season list carry over.
 *
 * `isPro` is only what the device believes at this instant. A subscriber whose
 * renewal has not synced yet reads as not-Pro, so the Pro rewards they reached
 * are not dropped: they become `proCarry`, collectable once Pro is confirmed
 * during the next season (`carriedProRewards`). Only the season immediately
 * before is carried; an older carry is replaced.
 */
export function rollPassSeason(record: ManagerPassRecord, season: ManagerPassSeason, isPro: boolean): ManagerPassRecord {
  if (record.seasonId === season.id || record.seasonOrdinal > season.ordinal) return record;
  const settled = applyClaimAll(record, isPro);
  const missedPro = !isPro && season.ordinal === record.seasonOrdinal + 1 ? uncollectedProRewards(settled) : [];
  return {
    ...freshPassRecord(season),
    rev: record.rev,
    awardedKeys: settled.awardedKeys,
    ownedRewardIds: settled.ownedRewardIds,
    completedSeasonIds: settled.completedSeasonIds,
    proCarry: missedPro.length > 0
      ? { seasonId: record.seasonId, seasonOrdinal: record.seasonOrdinal, rewardIds: missedPro }
      : null,
  };
}

// ── Storage (the only side-effecting section) ──

let memoRaw: string | null | undefined;
let memoRecord: ManagerPassRecord | null = null;
/** Set when storage refused the last write (WKWebView's ~5MB localStorage is
 *  shared with the save mirror). Memory then holds the newer record for the
 *  rest of the session — otherwise the next read would re-parse the older
 *  stored string and a reward collected a moment ago would vanish. */
let unpersisted = false;

/** The stored record, parsed once per distinct stored string. Null when none. */
function storedPassRecord(): ManagerPassRecord | null {
  if (unpersisted) return memoRecord;
  const raw = readManagerPassData();
  if (raw !== memoRaw) {
    memoRaw = raw;
    memoRecord = parsePassRecord(raw);
  }
  return memoRecord;
}

/** The stored record, or a fresh one for `season` when none is stored. NOT
 *  rolled — callers roll with the player's current Pro status. */
export function loadPassRecord(season: ManagerPassSeason): ManagerPassRecord {
  return storedPassRecord() ?? freshPassRecord(season);
}

/**
 * Persist the record: localStorage (read synchronously all session) and a
 * write-through IndexedDB copy (what survives WKWebView evicting
 * localStorage). Stamps `rev` so start-up can tell which copy is newer, and
 * returns the stamped record — the one to publish.
 */
export function savePassRecord(record: ManagerPassRecord): ManagerPassRecord {
  const stamped: ManagerPassRecord = { ...record, rev: (record.rev ?? 0) + 1 };
  const json = JSON.stringify(stamped);
  unpersisted = !writeManagerPassData(json);
  memoRaw = json;
  memoRecord = stamped;
  void writeManagerPassMirror(json);
  return stamped;
}

const union = (a: string[], b: string[]): string[] => {
  const extra = b.filter(x => !a.includes(x));
  return extra.length > 0 ? [...a, ...extra] : a;
};

/**
 * The newer of the localStorage and IndexedDB copies (higher `rev`; a tie
 * keeps `local`). Collected cosmetics and completed seasons only ever grow, so
 * those are the union of both copies: an older copy can lose progress, never
 * a reward. Returns `local` itself when it is already the answer.
 */
export function mergePassRecords(local: ManagerPassRecord | null, mirror: ManagerPassRecord | null): ManagerPassRecord | null {
  if (!local) return mirror;
  if (!mirror) return local;
  const newer = (mirror.rev ?? 0) > (local.rev ?? 0) ? mirror : local;
  const older = newer === local ? mirror : local;
  const owned = union(newer.ownedRewardIds, older.ownedRewardIds);
  const completed = union(newer.completedSeasonIds, older.completedSeasonIds);
  if (owned === newer.ownedRewardIds && completed === newer.completedSeasonIds) return newer;
  return { ...newer, ownedRewardIds: owned, completedSeasonIds: completed };
}

let hydration: Promise<boolean> | null = null;

/**
 * Reconcile the two stored copies, once per session (the slice starts it at
 * store creation). When the IndexedDB copy is newer — localStorage was
 * evicted, or refused writes the mirror took — it is restored into
 * localStorage and this resolves `true` so the caller republishes. When the
 * localStorage copy is newer (every install that predates the mirror) it is
 * copied into IndexedDB. An IndexedDB that does not answer changes nothing.
 */
export function hydratePassStorage(): Promise<boolean> {
  if (!hydration) {
    hydration = (async () => {
      const mirror = await readManagerPassMirror();
      if (!mirror.ok) return false;
      const local = storedPassRecord();
      const remote = parsePassRecord(mirror.value);
      const merged = mergePassRecords(local, remote);
      if (!merged) return false;
      if (merged === local) {
        if (!remote || (remote.rev ?? 0) !== (local.rev ?? 0)) void writeManagerPassMirror(JSON.stringify(local));
        return false;
      }
      savePassRecord(merged);
      return true;
    })().catch(() => false);
  }
  return hydration;
}

/** Test-only: forget the in-memory state so a test can start a "new session". */
export function __resetPassStorageForTests(): void {
  memoRaw = undefined;
  memoRecord = null;
  unpersisted = false;
  hydration = null;
}

/**
 * Does the player own this earned cosmetic? The ownership check behind
 * `hasCosmetic` for items with `earnedBy` — they are never in `entitlements`.
 * A pass reward is owned once collected, in any season, on this device; a
 * Legacy reward while the Legacy tier that unlocks it is held.
 */
export function isEarnedCosmeticOwned(item: Pick<CosmeticItem, 'id' | 'earnedBy'>): boolean {
  if (item.earnedBy === 'manager_pass') return storedPassRecord()?.ownedRewardIds.includes(item.id) ?? false;
  // A Legacy item is owned while the lifetime tier that unlocks it is held.
  if (item.earnedBy === 'legacy') return legacyUnlockedRewardIds(readLegacyTier()).includes(item.id);
  return false;
}

/** Every earned cosmetic the player owns, in catalog order. */
export function ownedEarnedCosmetics(): CosmeticItem[] {
  return COSMETIC_ITEMS.filter(c => c.earnedBy && isEarnedCosmeticOwned(c));
}
