/**
 * Shared plumbing for the Sunday League slice modules.
 *
 * The one rule worth stating: EVERY Sunday-owned random draw goes through
 * `withRng`, which takes the persisted `(seed, rngCursor)`, hands the caller an
 * RNG, and writes the advanced cursor back. Reaching for `Math.random()`
 * anywhere in these modules would silently break reload-stability, which is the
 * whole reason the seeded generator exists.
 */
import type { GameState } from '@/store/storeTypes';
import type { Player, SundaySquadMember, SundayState, Message } from '@/types/game';
import { createSundayRng, cursorOf, type SundayRng } from '@/utils/sunday/rng';
import { SUNDAY_WEEK_LOG_MAX } from '@/config/sundayLeague';
import { addMsg } from '@/utils/helpers';

export type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
export type Get = () => GameState;

/**
 * Run `fn` with a positioned RNG and return its result alongside the new
 * cursor. Callers MUST persist `rngCursor` from the returned value in the same
 * `set` as everything else the draw produced — otherwise the same draws would
 * repeat on the next call.
 */
export function withRng<T>(sunday: SundayState, fn: (rng: SundayRng) => T): { value: T; rngCursor: number } {
  const rng = createSundayRng(sunday.seed, sunday.rngCursor);
  const value = fn(rng);
  return { value, rngCursor: cursorOf(rng) };
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const clampRound = (v: number, lo: number, hi: number): number =>
  Math.round(clamp(v, lo, hi));

/** Player's display name, or a safe fallback for a dangling id. */
export function nameOf(players: Record<string, Player>, id: string | null | undefined): string {
  if (!id) return 'someone';
  const p = players[id];
  return p ? `${p.firstName} ${p.lastName}` : 'someone';
}

/** Append a line to the week log, keeping it short enough to read. */
export function logWeek(sunday: SundayState, ...lines: string[]): string[] {
  return [...sunday.weekLog, ...lines].slice(-SUNDAY_WEEK_LOG_MAX);
}

/** Post an inbox message. Sunday League reuses the shared inbox rather than
 *  inventing a second one — the player already knows where messages live. */
export function sundayMessage(
  messages: Message[],
  season: number,
  week: number,
  title: string,
  body: string,
  type: Message['type'] = 'general',
): Message[] {
  return addMsg(messages, { season, week, type, title, body });
}

/** Find a squad member, or null. */
export function memberOf(sunday: SundayState, playerId: string): SundaySquadMember | null {
  return sunday.squad.find(m => m.playerId === playerId) ?? null;
}

/** Apply a partial update to one squad member, returning a new squad array. */
export function updateMember(
  squad: readonly SundaySquadMember[],
  playerId: string,
  patch: Partial<SundaySquadMember> | ((m: SundaySquadMember) => Partial<SundaySquadMember>),
): SundaySquadMember[] {
  return squad.map(m => {
    if (m.playerId !== playerId) return m;
    const delta = typeof patch === 'function' ? patch(m) : patch;
    return { ...m, ...delta };
  });
}

/** Level of an upgrade, 0 when never bought. */
export function upgradeLevel(sunday: SundayState, id: string): number {
  return sunday.upgrades.find(u => u.id === id)?.level ?? 0;
}
