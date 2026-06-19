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
import { readNotificationsEnabled, readDailyStreak } from '@/store/helpers/persistence';
import { getActiveLiveEvent, getEventDaysRemaining } from '@/utils/liveEvents';

/** Stable ids per reminder type so a reschedule replaces rather than stacks. */
export const NOTIFICATION_IDS = {
  streak: 1001,
  festival: 1002,
  inactivity: 1003,
} as const;

export interface EngagementInput {
  /** Active daily-streak length (0 if none). */
  streakCount: number;
  /** Active live event, or null. */
  festival: { name: string; endsInDays: number } | null;
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

  // Generic come-back nudge a few days out (replaced on every reschedule).
  specs.push({
    id: NOTIFICATION_IDS.inactivity,
    title: 'Your squad is waiting',
    body: 'Jump back into your season — matches, transfers and trophies await.',
    at: eveningAfter(now, 3),
  });

  return specs;
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
export async function scheduleEngagementReminders(): Promise<void> {
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
    const specs = buildEngagementNotifications({ streakCount: streak?.current ?? 0, festival });

    await cancelAllEngagementReminders();
    await ln.schedule({
      notifications: specs.map(s => ({ id: s.id, title: s.title, body: s.body, schedule: { at: s.at } })),
    });
  } catch { /* scheduling is best-effort — never block the lifecycle */ }
}
