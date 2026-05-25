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

export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1_000)}K`;
  return `${sign}£${abs}`;
}
