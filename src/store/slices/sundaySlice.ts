/**
 * Sunday League slice — state, and a thin async facade over the mode.
 *
 * WHY THE FACADE. A slice is composed into `gameStore` at module load, so
 * anything it imports statically is in the eager boot bundle. Importing the
 * mode's config, content and simulation here cost a MEASURED 44 kB gzipped on
 * first paint — for a mode most players will never open — and left the eager
 * budget with 0.2 kB of headroom. So this file imports types only, and the
 * implementation (`./sunday/actions`) is dynamic-imported on first use and
 * cached for the session.
 *
 * The cost of that is the one thing to know when calling these: every Sunday
 * action returns a Promise. The first call pays one chunk fetch; the rest
 * resolve on a microtask.
 *
 * DOUBLE-SUBMIT. Because there is now an await before any state is written, a
 * fast double tap could enter the same action twice before either has run.
 * Each implementation is guarded on state that its own write invalidates (the
 * recruit is gone from the board, the event is no longer pending, the upgrade
 * level has moved), and JavaScript's single thread means the implementation
 * itself runs atomically — so the second call re-reads the post-write state and
 * declines. UI that can be double-tapped disables itself as well.
 */
import type {
  SundayClubIdentity, SundayClubPersonalityId, SundayMatchReport, SundayState,
  SundayTacticId, SundayUpgradeId,
} from '@/types/game';
import type { GameState } from '../storeTypes';

type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;
type Get = () => GameState;

type Actions = typeof import('./sunday/actions');

let cached: Actions | null = null;
let pending: Promise<Actions> | null = null;

/** Load (once) and cache the implementation module. */
function actions(): Promise<Actions> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = import('./sunday/actions').then(m => { cached = m; return m; });
  }
  return pending;
}

/**
 * Warm the implementation chunk.
 *
 * Called when a Sunday save is loaded so the first tap on the hub does not pay
 * the fetch. Failure is deliberately silent — the action's own import will
 * retry, and a prefetch that throws must never break a load.
 */
export function preloadSundayActions(): void {
  void actions().catch(() => undefined);
}

/** Dev-only invariant check on a whole freshly-arrived state. No-op outside
 *  development, and never throws — see `assertSundayStateInDev`. */
export function assertSundayStateInDev(state: GameState): void {
  if (!import.meta.env.DEV) return;
  if (state.gameMode !== 'sunday' || !state.sunday) return;
  void actions().then(m => m.assertSundayStateInDev(state)).catch(() => undefined);
}

export const createSundaySlice = (set: Set, get: Get) => ({
  sunday: null as SundayState | null,

  startSundayLeague: async (options: { personality: SundayClubPersonalityId; identity?: Partial<SundayClubIdentity>; seed?: number }) => {
    (await actions()).startSundayLeague(set, get, options);
  },

  setSundayTactic: async (tactic: SundayTacticId) => {
    (await actions()).setSundayTactic(set, get, tactic);
  },

  setSundayCaptain: async (playerId: string) => {
    (await actions()).setSundayCaptain(set, get, playerId);
  },

  setSundayTeamsheet: async (xi: string[], bench: string[]) =>
    (await actions()).setSundayTeamsheet(set, get, xi, bench),

  autoPickSundayTeamsheet: async () => (await actions()).autoPickSundayTeamsheet(set, get),

  playSundayMatch: async (): Promise<SundayMatchReport | null> =>
    (await actions()).playSundayMatch(set, get),

  playSundayFirstHalf: async () => (await actions()).playSundayFirstHalfAction(set, get),

  finishSundayMatch: async (tactic?: SundayTacticId): Promise<SundayMatchReport | null> =>
    (await actions()).finishSundayMatchAction(set, get, tactic),

  arriveSundayMatch: async () => (await actions()).ensureArrival(set, get),

  hireSundayRingers: async (count: number) => (await actions()).hireSundayRingers(set, get, count),

  resolveSundayEvent: async (choiceId: string) => (await actions()).resolveSundayEvent(set, get, choiceId),

  signSundayRecruit: async (recruitId: string) => (await actions()).signSundayRecruit(set, get, recruitId),

  releaseSundayPlayer: async (playerId: string) => (await actions()).releaseSundayPlayer(set, get, playerId),

  buySundayUpgrade: async (upgradeId: SundayUpgradeId) => (await actions()).buySundayUpgrade(set, get, upgradeId),

  acceptSundaySponsor: async (offerId: string) => (await actions()).acceptSundaySponsor(set, get, offerId),

  declineSundaySponsor: async (offerId: string) => {
    (await actions()).declineSundaySponsor(set, get, offerId);
  },

  runSundayFundraiser: async () => (await actions()).runSundayFundraiser(set, get),

  chaseSundaySubs: async () => (await actions()).chaseSundaySubs(set, get),

  ringRoundSunday: async (playerId: string) => (await actions()).ringRoundSunday(set, get, playerId),

  endSundaySeason: async () => {
    (await actions()).endSundaySeason(set, get);
  },
});
