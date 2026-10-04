import { readAnalyticsConsent, __resetAnalyticsConsentForTests, type AnalyticsConsent } from '@/store/helpers/persistence';

// Build-time constant; same mechanism as src/utils/sentry.ts. Falls back to
// 'dev' in vitest where Vite's `define` doesn't run.
declare const __APP_VERSION__: string;

function getAppVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  } catch { return 'dev'; }
}

/** Where a commerce event originated. Without it, shop vs paywall vs packs
 *  purchases are indistinguishable post-hoc and per-surface CVR is
 *  uncomputable. */
export type PurchaseSurface = 'shop' | 'onboarding' | 'packs';

/** Allowed analytics events. Adding a new event? Extend this union and the
 *  matching `EventData` entry — the narrow shape is the whole privacy story.
 *  Anything not listed here can't be sent. */
export type AnalyticsEvent =
  // ── Lifecycle / activation ──
  // Fired once per session from main.tsx. `daysSinceInstall` is a coarse
  // whole-day count derived from the local first-launch timestamp — it is
  // the retention denominator (installs) and D1/D7/D30 buckets, NOT a
  // stable identifier: two devices installed the same day are identical.
  | { name: 'app_open'; data: { daysSinceInstall: number } }
  | { name: 'game_started'; data: { communityPackEnabled: boolean; gameMode: 'sandbox' | 'career' | 'world-cup' | 'sunday'; division: string } }
  | { name: 'season_completed'; data: { season: number; finalPosition: number; division: string } }
  // How far into a career the player got — fired by GameShell when the week or
  // the career match count moves. The retention question is WHERE players stop.
  | { name: 'game_progress'; data: { season: number; week: number; matchesPlayed: number } }
  | { name: 'save_created'; data: { slot: number; bytes: number } }
  | { name: 'save_loaded'; data: { slot: number } }
  | { name: 'save_exported'; data: { slot: number; method: 'share' | 'download' | 'clipboard' } }
  | { name: 'save_imported'; data: { slot: number } }
  | { name: 'community_pack_enabled'; data: Record<string, never> }
  | { name: 'community_pack_disabled'; data: Record<string, never> }
  // ── Commerce funnel ──
  | { name: 'purchase_initiated'; data: { productId: string; surface: PurchaseSurface } }
  | { name: 'purchase_completed'; data: { productId: string; surface: PurchaseSurface } }
  | { name: 'purchase_cancelled'; data: { productId: string; surface: PurchaseSurface } }
  | { name: 'purchase_failed'; data: { productId: string; surface: PurchaseSurface } }
  | { name: 'paywall_viewed'; data: { surface: PurchaseSurface; trialEligible: boolean } }
  | { name: 'paywall_dismissed'; data: { surface: PurchaseSurface; secondsOnScreen: number } }
  | { name: 'trial_started'; data: { productId: string; surface: PurchaseSurface } }
  | { name: 'restore_clicked'; data: Record<string, never> }
  | { name: 'restore_completed'; data: { restoredCount: number } }
  | { name: 'crash'; data: { category: string } }
  // ── Pack opening (free and paid share one funnel) ──
  | { name: 'pack_opened'; data: { tierKey: string; method: 'free' | 'currency' | 'ad' | 'iap'; pityTriggered: boolean; bonusCards?: number } }
  | { name: 'pack_open_another'; data: { tierKey: string; method: 'free' | 'iap' } }
  // ── Market ──
  // `market_viewed` is the denominator for every pack conversion rate; without
  // it a purchase count says nothing about whether the store works.
  | { name: 'market_viewed'; data: { featuredTier: string; weeklyBonusAvailable: boolean; streak: number } }
  // Odds-sheet opens. Worth measuring on its own: a disclosure nobody opens is
  // still required, but a disclosure many players open before buying says the
  // cards are not explaining themselves.
  | { name: 'pack_deal_viewed'; data: { slotId: string; tierKey: string; bonusCards: number } }
  | { name: 'pack_deal_opened'; data: { slotId: string; tierKey: string; bonusCards: number } }
  | { name: 'pack_upsell_shown'; data: { trigger: string } }
  | { name: 'pack_upsell_dismissed'; data: { trigger: string } }
  | { name: 'pack_odds_viewed'; data: { tierKey: string } }
  | { name: 'weekly_bonus_claimed'; data: { tierKey: string; bonusCards: number } }
  // ── World Cup funnel ──
  | { name: 'world_cup_started'; data: { nation: string } }
  | { name: 'world_cup_match_completed'; data: { round: string; result: 'W' | 'D' | 'L'; goalsFor: number; goalsAgainst: number } }
  | { name: 'world_cup_finished'; data: { placement: string } }
  // ── Retention loop ──
  | { name: 'daily_streak_claim'; data: { streak: number; xp: number } }
  | { name: 'festival_checkin'; data: { eventId: string; points: number } }
  | { name: 'festival_tier_claim'; data: { eventId: string; tierId: string; xp: number } }
  | { name: 'legacy_viewed'; data: { tier: string; trophies: number } }
  | { name: 'reminders_enabled'; data: Record<string, never> }
  | { name: 'reminders_disabled'; data: Record<string, never> }
  | { name: 'code_redeemed'; data: { reward: string } }
  | { name: 'challenge_completed'; data: { challengeId: string; xp: number; featured: boolean } }
  | { name: 'resume_card_tap'; data: { screen: string; reason: string } }
  | { name: 'notif_permission_prompt'; data: { action: 'enable' | 'dismiss'; granted: boolean } }
  | { name: 'moment_shared'; data: { type: 'world_cup' | 'shootout' | 'pack_pull' } }
  // Rewarded-ad funnel. `pro` distinguishes the two cohorts because Pro users
  // claim without watching — without it the watch-through rate is meaningless.
  | { name: 'ad_prompt_shown'; data: { placementId: string; pro: boolean } }
  | { name: 'ad_prompt_dismissed'; data: { placementId: string | null; pro: boolean } }
  | { name: 'ad_prompt_failed'; data: { placementId: string; pro: boolean } }
  | { name: 'ad_reward_claimed'; data: { placementId: string; pro: boolean; watched: boolean } };

export type AnalyticsEventName = AnalyticsEvent['name'];

/** The full payload shape that leaves the device. Everything here is either
 *  a literal the caller provides (narrowly typed via `AnalyticsEvent`), a
 *  build-time constant, or an ephemeral per-session id. No names, no save
 *  contents, no device fingerprints, no IP (we can't stop the HTTP layer
 *  from seeing the IP, but we don't collect or store it ourselves). */
export interface AnalyticsPayload {
  event: AnalyticsEventName;
  timestamp: number;
  appVersion: string;
  // Regenerated every page load — not persisted across sessions, so it cannot
  // be used to link one session's events to another's.
  sessionId: string;
  data: Record<string, string | number | boolean>;
}

// ── Ephemeral session id ──
// Generated once per module load. We intentionally do NOT persist this across
// sessions; if we did, it would become a stable pseudonymous id (the very
// definition of a device fingerprint).
function mkSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* crypto unavailable — fall through */ }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
const SESSION_ID = mkSessionId();

/** Sink abstraction. The default folds every event into device-level totals
 *  that `utils/playerAttributes.ts` mirrors onto the anonymous RevenueCat
 *  customer as subscriber attributes — there is still no first-party
 *  endpoint and no raw event stream leaves the device. Callers can override
 *  (tests, or a backend later without changing call sites). */
export type AnalyticsSink = (payload: AnalyticsPayload) => void;

let sink: AnalyticsSink = defaultSink;
let cachedConsent: AnalyticsConsent | null = null;

// Loaded on the first event, not at startup: the main chunk has a hard size
// cap. Chained on one promise, so events still fold in the order fired.
let playerStats: Promise<typeof import('@/utils/playerAttributes')> | null = null;

function defaultSink(payload: AnalyticsPayload): void {
  playerStats ??= import('@/utils/playerAttributes');
  void playerStats.then(m => m.recordPlayerStat(payload)).catch(() => { /* stats are best-effort */ });
  // Dev builds log what is being aggregated; tests stay quiet.
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    // eslint-disable-next-line no-console
    console.info('[analytics]', payload.event, payload.data);
  }
}

/** Replace the sink (tests, or custom backends). Pass `null` to restore
 *  the default. Returns the previous sink so tests can restore it. */
export function setAnalyticsSink(next: AnalyticsSink | null): AnalyticsSink {
  const prev = sink;
  sink = next ?? defaultSink;
  return prev;
}

/** Refresh the cached consent read. Call after the user toggles consent in
 *  Settings or answers the first-launch prompt so subsequent track() calls
 *  see the new state without hitting localStorage every time. */
export function refreshAnalyticsConsent(): AnalyticsConsent {
  cachedConsent = readAnalyticsConsent();
  return cachedConsent;
}

export function getCurrentAnalyticsConsent(): AnalyticsConsent {
  if (cachedConsent === null) refreshAnalyticsConsent();
  return cachedConsent as AnalyticsConsent;
}

type DataFor<N extends AnalyticsEventName> = Extract<AnalyticsEvent, { name: N }>['data'];

/** Fire an analytics event. On by default: only "denied" — the Settings
 *  opt-out — short-circuits the pipeline before the event is built. `data` is narrowed
 *  to the shape declared for `name` in `AnalyticsEvent`, so a wrong field
 *  at a call site is a compile error, not a runtime privacy leak. */
export function track<N extends AnalyticsEventName>(name: N, data: DataFor<N>): void {
  if (getCurrentAnalyticsConsent() === 'denied') return;
  const payload: AnalyticsPayload = {
    event: name,
    timestamp: Date.now(),
    appVersion: getAppVersion(),
    sessionId: SESSION_ID,
    data: data as Record<string, string | number | boolean>,
  };
  try {
    sink(payload);
  } catch {
    /* sink must not crash callers */
  }
}

/** Test-only: expose the in-memory session id. */
export function _getSessionIdForTests(): string {
  return SESSION_ID;
}

// ── Lifecycle: app_open ──
// The install denominator. Without it, every conversion rate in the growth
// model is uncomputable — there is no way to divide purchases by installs.
let appOpenFired = false;

/** Fire the once-per-session `app_open` event. `firstLaunchTimestamp` is the
 *  device-level monetization anchor (0 = unknown → treat as first launch).
 *  Safe to call repeatedly; only the first call per session emits. */
export function trackAppOpen(firstLaunchTimestamp: number): void {
  if (appOpenFired) return;
  appOpenFired = true;
  const ts = firstLaunchTimestamp > 0 ? firstLaunchTimestamp : Date.now();
  const daysSinceInstall = Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
  track('app_open', { daysSinceInstall });
}

/** Test-only: reset the cached consent so a test run can flip the flag and
 *  see the change on the next track() call. */
export function _resetAnalyticsCacheForTests(): void {
  cachedConsent = null;
  sink = defaultSink;
  appOpenFired = false;
  __resetAnalyticsConsentForTests();
}
