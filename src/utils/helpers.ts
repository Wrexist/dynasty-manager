import type { Message } from '@/types/game';

export const pick = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

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
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function addMsg(messages: Message[], msg: Omit<Message, 'id' | 'read'>): Message[] {
  const newMsg: Message = { ...msg, id: crypto.randomUUID(), read: false };
  const updated = [newMsg, ...messages];
  return updated.slice(0, 80);
}

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `£${Math.round(amount / 1_000)}K`;
  return `£${amount}`;
}
