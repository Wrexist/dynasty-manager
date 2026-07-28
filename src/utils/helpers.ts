import type { Message, Club, VirtualClub } from '@/types/game';
import { MAX_MESSAGES } from '@/config/gameBalance';

export const pick = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pick() called with empty array');
  return arr[Math.floor(Math.random() * arr.length)];
};

// crypto.randomUUID was added to WebKit in iOS 15.4. The app's iOS deployment
// target is 15.0, so calling it directly crashes on 15.0-15.3 devices. Guard
// every call site through this helper.
export function safeRandomUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Fisher-Yates shuffle — uniformly random, unlike .sort(() => Math.random() - 0.5) */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const clamp = (v: number, min = 1, max = 99) => Math.max(min, Math.min(max, Math.round(v)));

export const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function getSuffix(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function addMsg(messages: Message[], msg: Omit<Message, 'id' | 'read'>): Message[] {
  const newMsg: Message = { ...msg, id: safeRandomUUID(), read: false };
  const updated = [newMsg, ...messages];
  return updated.slice(0, MAX_MESSAGES);
}

/** Resolve a club ID to a Club object, falling back to virtualClubs for tournament opponents. */
export function resolveClub(
  clubs: Record<string, Club>,
  virtualClubs: Record<string, VirtualClub> | undefined,
  clubId: string
): Club | null {
  if (clubs[clubId]) return clubs[clubId];
  const vc = virtualClubs?.[clubId];
  if (!vc) return null;
  return { id: clubId, name: vc.name, shortName: vc.shortName, color: vc.color, secondaryColor: vc.secondaryColor, stadiumName: '' } as Club;
}

export interface FormatMoneyOptions {
  /** Prefix a `+` on positive values (for deltas: net weekly, transfer profit). */
  signed?: boolean;
  /** Append a suffix inside the formatted string, e.g. `'/wk'`. */
  suffix?: string;
}

/**
 * THE canonical money formatter. Every £ figure the player ever sees must go
 * through this — no exceptions, no local re-implementations.
 *
 * WHY IT MATTERS: before this was enforced, the Dashboard showed `+£1.2M` and
 * tapping it opened a sheet reading `+£1200K/week net` — the same number at
 * two magnitudes, one tap apart. A £400 line item rendered as `£0K`. One
 * screen floored a £42,900 wage to `£42K` while another rounded it to `£43K`.
 * `ManagerCreation` shipped its own local `formatMoney` shadowing this one.
 * All of those read as bugs to a player, because they are.
 *
 * Rules (fixed — do not add a second magnitude policy):
 *   - >= £1,000,000  → 1 decimal + `M`   (£1.2M)
 *   - >= £1,000      → rounded + `K`     (£43K, never £42K for 42,900)
 *   - below £1,000   → whole pounds      (£400, never £0K)
 *   - negatives always keep the minus sign. Never `Math.abs()` at a call
 *     site to "clean up" a loss — a loss shown as a gain is a real bug.
 */
export function formatMoney(amount: number, options?: FormatMoneyOptions): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : options?.signed && safe > 0 ? '+' : '';
  const suffix = options?.suffix ?? '';

  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}M${suffix}`;
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1_000)}K${suffix}`;
  return `${sign}£${Math.round(abs)}${suffix}`;
}
