/**
 * Manager Pass logic — seasons, Pass XP, the free/Pro track, earned-cosmetic
 * ownership, and the game-state observer that feeds it XP.
 *
 * Pure apart from the small storage section (`loadPassRecord` /
 * `savePassRecord` / `isEarnedCosmeticOwned`), so the maths is unit-testable
 * with an injected `now`, the same split as `utils/liveEvents.ts`.
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
import { hallEntryId } from '@/utils/hallOfManagers';
import { legacyUnlockedRewardIds, readLegacyTier } from '@/utils/managerLegacy';
import { readManagerPassData, writeManagerPassData } from '@/store/helpers/persistence';
import type {
  CosmeticItem,
  ManagerPassEvent,
  ManagerPassRecord,
  ManagerPassSeason,
  ManagerPassTierDef,
  ManagerPassTrack,
  SeasonHistory,
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
  return claimablePassRewards(record, isPro).reduce((r, c) => applyPassClaim(r, c.tier, c.track, isPro), record);
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
 */
export function rollPassSeason(record: ManagerPassRecord, season: ManagerPassSeason, isPro: boolean): ManagerPassRecord {
  if (record.seasonId === season.id || record.seasonOrdinal > season.ordinal) return record;
  const settled = applyClaimAll(record, isPro);
  return {
    ...freshPassRecord(season),
    awardedKeys: settled.awardedKeys,
    ownedRewardIds: settled.ownedRewardIds,
    completedSeasonIds: settled.completedSeasonIds,
  };
}

// ── Storage (the only side-effecting section) ──

let memoRaw: string | null | undefined;
let memoRecord: ManagerPassRecord | null = null;

/** The stored record, parsed once per distinct stored string. Null when none. */
function storedPassRecord(): ManagerPassRecord | null {
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

export function savePassRecord(record: ManagerPassRecord): void {
  const json = JSON.stringify(record);
  writeManagerPassData(json);
  memoRaw = json;
  memoRecord = record;
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

// ── Game-state observer ──
//
// Pass XP comes from signals the game already keeps, read as MONOTONIC
// COUNTERS of the current career: matches played (managerStats), monthly
// objectives completed (sessionStats.objectivesCompleted — cumulative per
// career despite its name) and seasons completed (seasonHistory). A step of
// the counter within the same career is an event; its key is the counter's new
// value ("the 57th match of career C"), so replaying that match after
// reloading an older save produces the same key and pays nothing. Anything
// that is not a small forward step — a load, a new game, a prestige reset — is
// a re-baseline, never an award. No hook in the match engine, the week loop or
// season end is needed.

/** The slice of game state the observer reads. */
export interface PassObservedState {
  gameStarted: boolean;
  careerKey: string;
  wins: number;
  draws: number;
  losses: number;
  objectivesCompleted: number;
  seasonsPlayed: number;
  lastSeason: SeasonHistory | null;
}

export interface PassObservableGameState {
  gameStarted: boolean;
  careerId?: string | null;
  activeSlot: number;
  managerStats: { totalWins: number; totalDraws: number; totalLosses: number };
  sessionStats?: { objectivesCompleted?: number } | null;
  seasonHistory: SeasonHistory[];
}

export function observePassState(s: PassObservableGameState): PassObservedState {
  const history = Array.isArray(s.seasonHistory) ? s.seasonHistory : [];
  return {
    gameStarted: !!s.gameStarted,
    careerKey: hallEntryId({ careerId: s.careerId, activeSlot: s.activeSlot }),
    wins: s.managerStats?.totalWins ?? 0,
    draws: s.managerStats?.totalDraws ?? 0,
    losses: s.managerStats?.totalLosses ?? 0,
    objectivesCompleted: s.sessionStats?.objectivesCompleted ?? 0,
    seasonsPlayed: history.length,
    lastSeason: history.length ? history[history.length - 1] : null,
  };
}

/** Trophies a completed season delivered — same rules as the Hall of Managers. */
export function seasonTrophyCount(h: SeasonHistory): number {
  const won = (r?: string) => (r === 'Winner' ? 1 : 0);
  return (h.position === 1 ? 1 : 0) + won(h.cupResult) + won(h.leagueCupResult)
    + won(h.championsCupResult) + won(h.shieldCupResult) + won(h.conferenceCupResult);
}

/** Most objectives one month can complete — a larger jump is a load, not play. */
const MAX_OBJECTIVE_STEP = 5;

/** Events between two observed states. Empty unless both are the same running
 *  career and a counter stepped forward by a plausible single-action amount. */
export function diffPassEvents(prev: PassObservedState, next: PassObservedState): ManagerPassEvent[] {
  if (!prev.gameStarted || !next.gameStarted || prev.careerKey !== next.careerKey) return [];
  const events: ManagerPassEvent[] = [];
  const c = next.careerKey;

  const dW = next.wins - prev.wins;
  const dD = next.draws - prev.draws;
  const dL = next.losses - prev.losses;
  if (dW + dD + dL === 1 && dW >= 0 && dD >= 0 && dL >= 0) {
    const played = next.wins + next.draws + next.losses;
    events.push({ source: 'match', key: `m:${c}:${played}`, outcome: dW ? 'win' : dD ? 'draw' : 'loss' });
  }

  const dO = next.objectivesCompleted - prev.objectivesCompleted;
  if (dO >= 1 && dO <= MAX_OBJECTIVE_STEP) {
    for (let n = prev.objectivesCompleted + 1; n <= next.objectivesCompleted; n++) {
      events.push({ source: 'objective', key: `o:${c}:${n}` });
    }
  }

  if (next.seasonsPlayed === prev.seasonsPlayed + 1 && next.lastSeason) {
    events.push({ source: 'season', key: `s:${c}:${next.lastSeason.season}`, trophies: seasonTrophyCount(next.lastSeason) });
  }
  return events;
}

interface ObservableStore<S extends PassObservableGameState> {
  getState: () => S;
  subscribe: (listener: (state: S) => void) => () => void;
}

/**
 * Watch the store and hand Pass events to `record`. Returns the unsubscribe.
 * Mounted by GameShell for as long as a game is on screen. The baseline is the
 * state at attach time, so attaching never pays for anything already played.
 */
export function attachManagerPassObserver<S extends PassObservableGameState>(
  store: ObservableStore<S>,
  record: (events: ManagerPassEvent[]) => void,
): () => void {
  let prev = observePassState(store.getState());
  return store.subscribe(state => {
    const next = observePassState(state);
    const events = diffPassEvents(prev, next);
    // Advance the baseline BEFORE recording: `record` sets store state, which
    // re-enters this listener synchronously and must see nothing new.
    prev = next;
    if (events.length) record(events);
  });
}
