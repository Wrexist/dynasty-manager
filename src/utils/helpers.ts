import type { Message } from '@/types/game';

export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const clamp = (v: number, min = 1, max = 99) => Math.max(min, Math.min(max, Math.round(v)));

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
