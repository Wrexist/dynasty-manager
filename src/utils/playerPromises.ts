import type { Player, PlayerPromise, PlayerPromiseType } from '@/types/game';
import { safeRandomUUID } from '@/utils/helpers';
import {
  PROMISE_STARTS_THRESHOLD,
  PROMISE_AMBITION_TOP_FINISH,
  PROMISE_KEPT_MORALE_BOOST,
  PROMISE_KEPT_LOYALTY_BUMP,
  PROMISE_BROKEN_MORALE_HIT,
} from '@/config/gameBalance';

/** Short, player-facing labels for each promise type. */
export const PROMISE_LABEL: Record<PlayerPromiseType, string> = {
  playing_time: 'regular starts',
  ambition: 'to challenge for a trophy',
  strengthen_squad: 'a marquee signing',
};

/** Chip labels shown in the contract-renewal UI. */
export const PROMISE_CHIP_LABEL: Record<PlayerPromiseType, string> = {
  playing_time: 'Promise regular starts',
  ambition: 'Promise to challenge for a trophy',
  strengthen_squad: 'Promise a marquee signing',
};

/** Create a fresh active promise. The deadline is the end of the season it was
 *  made — it is evaluated at that season's `endSeasonImpl`. */
export function makePlayerPromise(
  playerId: string,
  type: PlayerPromiseType,
  season: number,
  week: number,
): PlayerPromise {
  return {
    id: safeRandomUUID(),
    playerId,
    type,
    madeSeason: season,
    madeWeek: week,
    deadlineSeason: season,
    status: 'active',
  };
}

export interface PromiseEvalContext {
  season: number;
  /** Player's final league position this season (1 = champions). */
  leaguePosition: number;
  /** True if the player's club won ANY trophy this season. */
  wonTrophy: boolean;
  /** True if a signing at or above (squad avg + margin) arrived this season. */
  qualifyingSigning: boolean;
}

export interface PromiseOutcome {
  playerId: string;
  kept: boolean;
  moraleDelta: number;
  loyaltyDelta: number;
  wantsToLeave: boolean;
}

export interface PromiseMessage {
  title: string;
  body: string;
}

export interface PromiseEvalResult {
  outcomes: PromiseOutcome[];
  messages: PromiseMessage[];
  /** Updated promise list: due promises resolved, stale resolved ones pruned. */
  nextPromises: PlayerPromise[];
}

/** Whether a due promise was kept, given the season's outcome. */
export function isPromiseKept(
  type: PlayerPromiseType,
  player: Player,
  ctx: PromiseEvalContext,
): boolean {
  switch (type) {
    case 'playing_time':
      return (player.appearances || 0) >= PROMISE_STARTS_THRESHOLD;
    case 'ambition':
      return ctx.wonTrophy || ctx.leaguePosition <= PROMISE_AMBITION_TOP_FINISH;
    case 'strengthen_squad':
      return ctx.qualifyingSigning;
    default:
      return false;
  }
}

/**
 * Evaluate all promises at season end.
 *  - Active promises whose deadline is this season are resolved (kept/broken).
 *  - Kept: morale + loyalty reward. Broken: big morale hit + transfer request.
 *  - Resolved promises are retained for ONE season as history, then pruned.
 *  - A promise whose player no longer exists is dropped silently.
 *
 * Pure — returns the outcomes/messages/next-list for the caller to apply.
 */
export function evaluatePromises(
  promises: PlayerPromise[],
  players: Record<string, Player>,
  ctx: PromiseEvalContext,
): PromiseEvalResult {
  const outcomes: PromiseOutcome[] = [];
  const messages: PromiseMessage[] = [];
  const nextPromises: PlayerPromise[] = [];

  for (const promise of promises) {
    if (promise.status === 'active') {
      const player = players[promise.playerId];
      if (!player) continue; // player gone — drop the promise
      if (promise.deadlineSeason > ctx.season) {
        nextPromises.push(promise); // not due yet
        continue;
      }
      const kept = isPromiseKept(promise.type, player, ctx);
      const name = `${player.firstName} ${player.lastName}`;
      const label = PROMISE_LABEL[promise.type];
      if (kept) {
        outcomes.push({
          playerId: promise.playerId,
          kept: true,
          moraleDelta: PROMISE_KEPT_MORALE_BOOST,
          loyaltyDelta: PROMISE_KEPT_LOYALTY_BUMP,
          wantsToLeave: false,
        });
        messages.push({
          title: `Promise Kept — ${name}`,
          body: `You promised ${name} ${label}, and you delivered. He is delighted and his loyalty to the club has grown.`,
        });
      } else {
        outcomes.push({
          playerId: promise.playerId,
          kept: false,
          moraleDelta: -PROMISE_BROKEN_MORALE_HIT,
          loyaltyDelta: 0,
          wantsToLeave: true,
        });
        messages.push({
          title: `Promise Broken — ${name}`,
          body: `You promised ${name} ${label}, but failed to deliver. He feels betrayed and has handed in a transfer request.`,
        });
      }
      nextPromises.push({ ...promise, status: kept ? 'kept' : 'broken' });
    } else {
      // Already resolved — keep for one season of history, then prune.
      if (promise.deadlineSeason >= ctx.season) nextPromises.push(promise);
    }
  }

  return { outcomes, messages, nextPromises };
}
