/**
 * Player stats → RevenueCat subscriber attributes.
 *
 * The analytics events in `utils/analytics.ts` have no first-party endpoint.
 * This is their production sink: it folds each event into a small record of
 * device-level totals and flags, and mirrors that record onto the anonymous
 * RevenueCat customer as subscriber attributes. RevenueCat keeps one value per
 * key — not a timeline — so everything here is a running total, a max, a
 * latest value or a flag. That is enough to filter customer lists, target
 * offerings and export by cohort ("payers who never finished season 1",
 * "returned on day 7").
 *
 * Privacy: values are built only from the narrowly typed event data plus
 * counts — no names, no save contents, no nation picks, no free text. The
 * Settings opt-out (consent 'denied') stops new writes and deletes every key.
 */
import type { AnalyticsPayload } from '@/utils/analytics';
import { readPlayerStatsData, writePlayerStatsData } from '@/store/helpers/persistence';
import { setSubscriberAttributes } from '@/utils/purchases';

/** Device-level totals. Every field is optional so an older record parses. */
export interface PlayerStatsRecord {
  appVersion?: string;
  sessions?: number;
  activeDays?: number;
  lastOpenDay?: number;
  returnedD1?: boolean;
  returnedD7?: boolean;
  gamesStarted?: number;
  gameMode?: string;
  division?: string;
  matchesPlayed?: number;
  currentSeason?: number;
  currentWeek?: number;
  seasonsCompleted?: number;
  bestFinish?: number;
  paywallViews?: number;
  paywallSurface?: string;
  trialsStarted?: number;
  purchaseAttempts?: number;
  purchasesCompleted?: number;
  purchasesCancelled?: number;
  purchasesFailed?: number;
  lastProduct?: string;
  marketViews?: number;
  packsFree?: number;
  packsPaid?: number;
  packOddsViews?: number;
  dailyStreakMax?: number;
  worldCupsStarted?: number;
  challengesCompleted?: number;
  remindersOn?: boolean;
  momentsShared?: number;
}

/** Record field → RevenueCat attribute key. The keys are the dashboard
 *  contract: renaming one orphans its history in RevenueCat. */
const ATTRIBUTE_KEYS: Record<keyof PlayerStatsRecord, string> = {
  appVersion: 'app_version',
  sessions: 'sessions',
  activeDays: 'active_days',
  lastOpenDay: 'last_open_day',
  returnedD1: 'returned_d1',
  returnedD7: 'returned_d7',
  gamesStarted: 'games_started',
  gameMode: 'game_mode',
  division: 'division',
  matchesPlayed: 'matches_played',
  currentSeason: 'current_season',
  currentWeek: 'current_week',
  seasonsCompleted: 'seasons_completed',
  bestFinish: 'best_finish',
  paywallViews: 'paywall_views',
  paywallSurface: 'paywall_last_surface',
  trialsStarted: 'trials_started',
  purchaseAttempts: 'purchase_attempts',
  purchasesCompleted: 'purchases_completed',
  purchasesCancelled: 'purchases_cancelled',
  purchasesFailed: 'purchases_failed',
  lastProduct: 'last_product',
  marketViews: 'market_views',
  packsFree: 'packs_opened_free',
  packsPaid: 'packs_opened_paid',
  packOddsViews: 'pack_odds_views',
  dailyStreakMax: 'daily_streak_max',
  worldCupsStarted: 'world_cups_started',
  challengesCompleted: 'challenges_completed',
  remindersOn: 'reminders_on',
  momentsShared: 'moments_shared',
};

/** Delay before pushing, so a burst of events (a pack opening, an advance)
 *  becomes one write. RevenueCat itself syncs attributes on background,
 *  foreground and purchase. */
const FLUSH_DELAY_MS = 3000;

const inc = (n: number | undefined) => (n ?? 0) + 1;

/** Pure: the record after one event. Unknown events leave it unchanged. */
export function foldEvent(prev: PlayerStatsRecord, p: AnalyticsPayload): PlayerStatsRecord {
  const r: PlayerStatsRecord = { ...prev, appVersion: p.appVersion };
  const d = p.data;
  switch (p.event) {
    case 'app_open': {
      const day = Number(d.daysSinceInstall) || 0;
      r.sessions = inc(r.sessions);
      if (r.lastOpenDay === undefined || day > r.lastOpenDay) r.activeDays = inc(r.activeDays);
      r.lastOpenDay = Math.max(r.lastOpenDay ?? 0, day);
      if (day === 1) r.returnedD1 = true;
      if (day >= 7) r.returnedD7 = true;
      break;
    }
    case 'game_started':
      r.gamesStarted = inc(r.gamesStarted);
      r.gameMode = String(d.gameMode);
      r.division = String(d.division);
      break;
    case 'game_progress':
      r.currentSeason = Number(d.season);
      r.currentWeek = Number(d.week);
      r.matchesPlayed = Math.max(r.matchesPlayed ?? 0, Number(d.matchesPlayed) || 0);
      break;
    case 'season_completed': {
      r.seasonsCompleted = inc(r.seasonsCompleted);
      const pos = Number(d.finalPosition);
      if (pos > 0) r.bestFinish = Math.min(r.bestFinish ?? pos, pos);
      break;
    }
    case 'paywall_viewed':
      r.paywallViews = inc(r.paywallViews);
      r.paywallSurface = String(d.surface);
      break;
    case 'trial_started': r.trialsStarted = inc(r.trialsStarted); break;
    case 'purchase_initiated':
      r.purchaseAttempts = inc(r.purchaseAttempts);
      r.lastProduct = String(d.productId);
      break;
    case 'purchase_completed': r.purchasesCompleted = inc(r.purchasesCompleted); break;
    case 'purchase_cancelled': r.purchasesCancelled = inc(r.purchasesCancelled); break;
    case 'purchase_failed': r.purchasesFailed = inc(r.purchasesFailed); break;
    case 'market_viewed': r.marketViews = inc(r.marketViews); break;
    case 'pack_opened':
      if (d.method === 'iap') r.packsPaid = inc(r.packsPaid);
      else r.packsFree = inc(r.packsFree);
      break;
    case 'pack_odds_viewed': r.packOddsViews = inc(r.packOddsViews); break;
    case 'daily_streak_claim':
      r.dailyStreakMax = Math.max(r.dailyStreakMax ?? 0, Number(d.streak) || 0);
      break;
    case 'world_cup_started': r.worldCupsStarted = inc(r.worldCupsStarted); break;
    case 'challenge_completed': r.challengesCompleted = inc(r.challengesCompleted); break;
    case 'reminders_enabled': r.remindersOn = true; break;
    case 'reminders_disabled': r.remindersOn = false; break;
    case 'moment_shared': r.momentsShared = inc(r.momentsShared); break;
    default: return prev;
  }
  return r;
}

/** Pure: the record as RevenueCat attributes. Unset fields are omitted. */
export function toAttributes(r: PlayerStatsRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, key] of Object.entries(ATTRIBUTE_KEYS)) {
    const v = r[field as keyof PlayerStatsRecord];
    if (v !== undefined && v !== null) out[key] = String(v);
  }
  return out;
}

/** Every attribute key set to null — RevenueCat deletes a key set to null. */
export function clearedAttributes(): Record<string, null> {
  const out: Record<string, null> = {};
  for (const key of Object.values(ATTRIBUTE_KEYS)) out[key] = null;
  return out;
}

// ── Runtime: persisted record + debounced push ──

let record: PlayerStatsRecord | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function load(): PlayerStatsRecord {
  if (record) return record;
  try {
    const raw = readPlayerStatsData();
    const parsed = raw ? JSON.parse(raw) : null;
    record = parsed && typeof parsed === 'object' ? parsed as PlayerStatsRecord : {};
  } catch {
    record = {};
  }
  return record;
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void setSubscriberAttributes(toAttributes(load()));
  }, FLUSH_DELAY_MS);
}

/** Analytics sink: fold the event, persist, push soon. Never throws. */
export function recordPlayerStat(payload: AnalyticsPayload): void {
  try {
    const prev = load();
    const next = foldEvent(prev, payload);
    if (next === prev) return;
    record = next;
    writePlayerStatsData(JSON.stringify(next));
    scheduleFlush();
  } catch { /* stats must never break gameplay */ }
}

/** The Settings opt-out: cancel a pending push and delete every key from
 *  RevenueCat. The local totals stay on the device. */
export function clearPlayerStatAttributes(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  void setSubscriberAttributes(clearedAttributes());
}

/** Test-only. */
export function __resetPlayerStatsForTests(): void {
  record = null;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
}
