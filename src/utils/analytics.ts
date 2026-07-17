import { readAnalyticsConsent, type AnalyticsConsent } from '@/store/helpers/persistence';

// Build-time constant; same mechanism as src/utils/sentry.ts. Falls back to
// 'dev' in vitest where Vite's `define` doesn't run.
declare const __APP_VERSION__: string;

function getAppVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  } catch { return 'dev'; }
}

/** Allowed analytics events. Adding a new event? Extend this union and the
 *  matching `EventData` entry — the narrow shape is the whole privacy story.
 *  Anything not listed here can't be sent. */
export type AnalyticsEvent =
  | { name: 'game_started'; data: { communityPackEnabled: boolean; gameMode: 'sandbox' | 'career' | 'world-cup'; division: string } }
  | { name: 'season_completed'; data: { season: number; finalPosition: number; division: string } }
  | { name: 'save_created'; data: { slot: number; bytes: number } }
  | { name: 'save_loaded'; data: { slot: number } }
  | { name: 'save_exported'; data: { slot: number; method: 'share' | 'download' | 'clipboard' } }
  | { name: 'save_imported'; data: { slot: number } }
  | { name: 'community_pack_enabled'; data: Record<string, never> }
  | { name: 'community_pack_disabled'; data: Record<string, never> }
  | { name: 'purchase_initiated'; data: { productId: string } }
  | { name: 'purchase_completed'; data: { productId: string } }
  | { name: 'purchase_cancelled'; data: { productId: string } }
  | { name: 'purchase_failed'; data: { productId: string } }
  | { name: 'restore_clicked'; data: Record<string, never> }
  | { name: 'restore_completed'; data: { restoredCount: number } }
  | { name: 'crash'; data: { category: string } }
  // ── Retention loop ──
  | { name: 'daily_streak_claim'; data: { streak: number; xp: number } }
  | { name: 'festival_checkin'; data: { eventId: string; points: number } }
  | { name: 'festival_tier_claim'; data: { eventId: string; tierId: string; xp: number } }
  | { name: 'season_pass_claim'; data: { tier: number; xp: number } }
  | { name: 'legacy_viewed'; data: { tier: string; trophies: number } }
  | { name: 'reminders_enabled'; data: Record<string, never> }
  | { name: 'reminders_disabled'; data: Record<string, never> }
  | { name: 'code_redeemed'; data: { reward: string } }
  | { name: 'challenge_completed'; data: { challengeId: string; xp: number; featured: boolean } }
  | { name: 'resume_card_tap'; data: { screen: string; reason: string } }
  | { name: 'notif_permission_prompt'; data: { action: 'enable' | 'dismiss'; granted: boolean } }
  | { name: 'moment_shared'; data: { type: 'world_cup' | 'shootout' } };

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

/** Sink abstraction. Default is a no-op; callers can override (useful for
 *  tests, or for wiring up a backend later without changing call sites). */
export type AnalyticsSink = (payload: AnalyticsPayload) => void;

let sink: AnalyticsSink = defaultSink;
let cachedConsent: AnalyticsConsent | null = null;

function defaultSink(payload: AnalyticsPayload): void {
  // In dev, log so developers can see what would have been sent. In prod
  // with no endpoint configured, stay silent — events leave the device only
  // if an explicit endpoint is set AND the user granted consent.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[analytics]', payload.event, payload.data);
  }
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  if (!endpoint || typeof fetch === 'undefined') return;
  // Best-effort; never throw, never await.
  try {
    const body = JSON.stringify(payload);
    // Use sendBeacon when available (survives page unload) then fall back.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(endpoint, body);
      if (ok) return;
    }
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow — analytics is best-effort, never retried */
    });
  } catch {
    /* sink errors must never surface to the app */
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

/** Fire an analytics event. No-op unless the user has explicitly granted
 *  consent — default state is "unknown" (first launch) and "denied" both
 *  short-circuit the pipeline before the event is built. `data` is narrowed
 *  to the shape declared for `name` in `AnalyticsEvent`, so a wrong field
 *  at a call site is a compile error, not a runtime privacy leak. */
export function track<N extends AnalyticsEventName>(name: N, data: DataFor<N>): void {
  if (getCurrentAnalyticsConsent() !== 'granted') return;
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

/** Test-only: reset the cached consent so a test run can flip the flag and
 *  see the change on the next track() call. */
export function _resetAnalyticsCacheForTests(): void {
  cachedConsent = null;
  sink = defaultSink;
}
