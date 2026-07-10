/**
 * Local notification reminders — re-engagement nudges via Capacitor Local
 * Notifications. Native-only: every entry point no-ops in the browser (dev) and
 * when the plugin isn't present, mirroring the `haptics.ts` guard pattern.
 *
 * Dynasty Manager is offline + turn-based, so there is no real-world "match
 * day" to notify on. Reminders are therefore wall-clock re-engagement nudges
 * keyed off device-global state: an active daily streak, a live event, and a
 * generic come-back nudge. The pure `buildEngagementNotifications` decides the
 * schedule; the rest is the plugin plumbing.
 *
 * Scheduling lifecycle (wired in main.tsx): cancel-on-resume, reschedule-on-
 * pause. Reminders only exist while the app is backgrounded and always reflect
 * the latest streak/event state captured at background time.
 */
import { readNotificationsEnabled, readDailyStreak, getFlag, setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { getActiveLiveEvent, getEventDaysRemaining } from '@/utils/liveEvents';
import type { GameState } from '@/store/storeTypes';

/** Stable ids per reminder type so a reschedule replaces rather than stacks. */
export const NOTIFICATION_IDS = {
  streak: 1001,
  festival: 1002,
  inactivity: 1003,
} as const;

/** Save-derived hooks that personalise the come-back nudge. All optional —
 *  when nothing is present the reminder falls back to generic copy. */
export interface PersonalContext {
  /** The top cliffhanger line already computed for the current week. */
  topCliffhanger?: string;
  /** Next unplayed fixture, if any. */
  nextOpponent?: string;
  /** Human label for the next fixture's competition (e.g. "Cup final"). */
  nextCompetition?: string;
  /** Count of pending incoming transfer offers. */
  incomingOffers: number;
  /** Count of squad players out of contract at season end. */
  expiringContracts: number;
}

export interface EngagementInput {
  /** Active daily-streak length (0 if none). */
  streakCount: number;
  /** Active live event, or null. */
  festival: { name: string; endsInDays: number } | null;
  /** Save-derived personalisation, or null when no game is loaded. */
  personal?: PersonalContext | null;
}

/** Derive the personalisation context from a loaded save state. Pure; reads a
 *  handful of fields only. `weekCliffhangers` is already computed each week by
 *  the game loop, so we reuse the top line rather than recomputing. Returns
 *  null when there's no active club (nothing personal to say). */
export function derivePersonalContext(state: GameState): PersonalContext | null {
  const club = state.clubs?.[state.playerClubId];
  if (!club) return null;

  const topCliffhanger = state.weekCliffhangers?.[0]?.text;
  const incomingOffers = state.incomingOffers?.length ?? 0;

  const players = state.players || {};
  const expiringContracts = (club.playerIds || [])
    .map(id => players[id])
    .filter(Boolean)
    .filter(p => p.contractEnd <= state.season && p.overall >= 65)
    .length;

  // Next unplayed fixture for the player's club (league or cup).
  let nextOpponent: string | undefined;
  let nextCompetition: string | undefined;
  const upcoming = (state.fixtures || [])
    .filter(m => !m.played && m.week >= state.week && (m.homeClubId === state.playerClubId || m.awayClubId === state.playerClubId))
    .sort((a, b) => a.week - b.week)[0];
  if (upcoming) {
    const oppId = upcoming.homeClubId === state.playerClubId ? upcoming.awayClubId : upcoming.homeClubId;
    nextOpponent = state.clubs?.[oppId]?.shortName || state.clubs?.[oppId]?.name;
    nextCompetition = 'league match';
  }

  return { topCliffhanger, nextOpponent, nextCompetition, incomingOffers, expiringContracts };
}

/** Build the come-back nudge body from personal context, or null when nothing
 *  personal is available (caller falls back to generic copy). Exported for
 *  unit testing the copy selection. */
export function buildPersonalReminderBody(personal: PersonalContext | null | undefined): string | null {
  if (!personal) return null;
  // Priority: a concrete next fixture reads best, then the week's headline
  // cliffhanger, then desk work (offers / expiring contracts).
  if (personal.nextOpponent) {
    return `Your ${personal.nextCompetition || 'next match'} vs ${personal.nextOpponent} is waiting. Jump back in.`;
  }
  if (personal.topCliffhanger) {
    return personal.topCliffhanger;
  }
  if (personal.incomingOffers > 0) {
    return `You have ${personal.incomingOffers} transfer offer${personal.incomingOffers === 1 ? '' : 's'} waiting on your desk.`;
  }
  if (personal.expiringContracts > 0) {
    return `${personal.expiringContracts} of your players are out of contract soon — sort their futures.`;
  }
  return null;
}

export interface NotificationSpec {
  id: number;
  title: string;
  body: string;
  /** Local wall-clock fire time. */
  at: Date;
}

/** `daysAhead` days from `now` at `hour`:00 local. */
function eveningAfter(now: Date, daysAhead: number, hour = 18): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead, hour, 0, 0, 0);
}

/** Pure: the reminders to schedule given current state. Tested independently;
 *  no plugin/storage access. */
export function buildEngagementNotifications(input: EngagementInput, now: Date = new Date()): NotificationSpec[] {
  const specs: NotificationSpec[] = [];

  // Streak — tomorrow evening, only while a run is going (loss-aversion nudge).
  if (input.streakCount > 0) {
    specs.push({
      id: NOTIFICATION_IDS.streak,
      title: `🔥 ${input.streakCount}-day streak`,
      body: "Open Dynasty Manager to claim today's reward and keep your streak alive.",
      at: eveningAfter(now, 1),
    });
  }

  // Festival — tomorrow evening while the event still has a claimable day.
  if (input.festival && input.festival.endsInDays >= 1) {
    const lastDay = input.festival.endsInDays <= 1;
    specs.push({
      id: NOTIFICATION_IDS.festival,
      title: input.festival.name,
      body: lastDay
        ? 'Final day — claim your festival rewards before the event ends.'
        : 'Your daily festival check-in is ready. Climb the rewards track!',
      at: eveningAfter(now, 1),
    });
  }

  // Come-back nudge a few days out (replaced on every reschedule). Personalised
  // from the active save when possible, generic otherwise.
  const personalBody = buildPersonalReminderBody(input.personal);
  specs.push({
    id: NOTIFICATION_IDS.inactivity,
    title: personalBody ? 'Your season is calling' : 'Your squad is waiting',
    body: personalBody ?? 'Jump back into your season — matches, transfers and trophies await.',
    at: eveningAfter(now, 3),
  });

  return specs;
}

// ── First-win notification prompt (G5) ──
//
// A value-framed, one-time ask surfaced at the FIRST WIN peak instead of never.
// The match flow (a pure helper) signals eligibility here; a UI overlay
// subscribes and routes itself through the presentation queue. Kept as a tiny
// external store so `matchProcessing` can flag it without importing the app
// store (which would create an import cycle) or React.

let firstWinPromptPending = false;
const firstWinListeners = new Set<() => void>();
function emitFirstWin(): void {
  firstWinListeners.forEach(l => { try { l(); } catch { /* listener errors are non-fatal */ } });
}

/** Sync eligibility: the user has never answered the notification opt-in AND we
 *  haven't already shown this one-time prompt on this device. */
export function isFirstWinPromptEligible(): boolean {
  return readNotificationsEnabled() === null && !getFlag(STORAGE_KEYS.NOTIF_FIRST_WIN_PROMPTED);
}

/** Side-effect fired at the first-win moment. Flags the prompt pending when
 *  eligible; no-op otherwise. Never throws — must never break a match. */
export function signalFirstWinForNotifications(): void {
  try {
    if (firstWinPromptPending) return;
    if (!isFirstWinPromptEligible()) return;
    firstWinPromptPending = true;
    emitFirstWin();
  } catch { /* never break a match */ }
}

export function isFirstWinPromptPending(): boolean {
  return firstWinPromptPending;
}

export function subscribeFirstWinPrompt(cb: () => void): () => void {
  firstWinListeners.add(cb);
  return () => { firstWinListeners.delete(cb); };
}

/** Clear the pending prompt and mark it shown so it never re-appears, whatever
 *  the user chose. Idempotent. */
export function resolveFirstWinPrompt(): void {
  firstWinPromptPending = false;
  setFlag(STORAGE_KEYS.NOTIF_FIRST_WIN_PROMPTED);
  emitFirstWin();
}

/** Test-only: reset the module-level first-win prompt state. */
export function __resetFirstWinPromptForTests(): void {
  firstWinPromptPending = false;
  firstWinListeners.clear();
}

// ── Native plumbing (no-ops off-device) ──

type LocalNotificationsModule = typeof import('@capacitor/local-notifications');
type LocalNotifications = LocalNotificationsModule['LocalNotifications'];

let plugin: LocalNotifications | false | null = null;

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function load(): Promise<LocalNotifications | false> {
  if (plugin !== null) return plugin;
  try {
    const mod = await import('@capacitor/local-notifications');
    plugin = mod.LocalNotifications;
  } catch {
    plugin = false;
  }
  return plugin;
}

export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** Current OS permission state, or 'unsupported' off-device. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!(await isNative())) return 'unsupported';
  const ln = await load();
  if (!ln) return 'unsupported';
  try {
    const res = await ln.checkPermissions();
    return (res.display as NotificationPermission) ?? 'prompt';
  } catch {
    return 'unsupported';
  }
}

/** Request permission. Returns true only when granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!(await isNative())) return false;
  const ln = await load();
  if (!ln) return false;
  try {
    const res = await ln.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

/** Cancel all engagement reminders we manage. Best-effort. */
export async function cancelAllEngagementReminders(): Promise<void> {
  if (!(await isNative())) return;
  const ln = await load();
  if (!ln) return;
  try {
    await ln.cancel({ notifications: Object.values(NOTIFICATION_IDS).map(id => ({ id })) });
  } catch { /* best-effort */ }
}

/** (Re)schedule reminders from current device-global state. No-op unless the
 *  user has opted in and granted OS permission. Cancels prior reminders first
 *  so the set always reflects the latest streak/event state. */
export async function scheduleEngagementReminders(personal?: PersonalContext | null): Promise<void> {
  if (readNotificationsEnabled() !== true) return;
  if (!(await isNative())) return;
  const ln = await load();
  if (!ln) return;
  try {
    const perm = await ln.checkPermissions();
    if (perm.display !== 'granted') return;

    const streak = readDailyStreak();
    const event = getActiveLiveEvent();
    const festival = event ? { name: event.name, endsInDays: getEventDaysRemaining(event) ?? 0 } : null;
    const specs = buildEngagementNotifications({ streakCount: streak?.current ?? 0, festival, personal });

    await cancelAllEngagementReminders();
    await ln.schedule({
      notifications: specs.map(s => ({ id: s.id, title: s.title, body: s.body, schedule: { at: s.at } })),
    });
  } catch { /* scheduling is best-effort — never block the lifecycle */ }
}
