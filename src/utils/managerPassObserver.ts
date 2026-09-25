/**
 * Manager Pass game-state observer — turns play into Pass XP events.
 *
 * Its own module so it loads with the (lazy) in-game shell that mounts it,
 * not with the store at startup: the main chunk has a hard size cap.
 */
import { hallEntryId } from '@/utils/hallOfManagers';
import type { ManagerPassEvent, SeasonHistory } from '@/types/game';

// ── Game-state observer ──
//
// Pass XP comes from signals the game already keeps, read as MONOTONIC
// COUNTERS of the current career: matches played (managerStats), monthly
// objectives completed (sessionStats.objectivesCompleted — cumulative per
// career despite its name) and seasons completed (seasonHistory). A step of
// the counter within the same career is an event; its key is the counter's new
// value ("the 57th match of career C"), so replaying that match after
// reloading an older save produces the same key and pays nothing. Anything
// that is not a small forward step — a load, a new game, a prestige reset — is
// a re-baseline, never an award. No hook in the match engine, the week loop or
// season end is needed.

/** The slice of game state the observer reads. */
export interface PassObservedState {
  gameStarted: boolean;
  careerKey: string;
  wins: number;
  draws: number;
  losses: number;
  objectivesCompleted: number;
  seasonsPlayed: number;
  lastSeason: SeasonHistory | null;
}

export interface PassObservableGameState {
  gameStarted: boolean;
  careerId?: string | null;
  activeSlot: number;
  managerStats: { totalWins: number; totalDraws: number; totalLosses: number };
  sessionStats?: { objectivesCompleted?: number } | null;
  seasonHistory: SeasonHistory[];
}

export function observePassState(s: PassObservableGameState): PassObservedState {
  const history = Array.isArray(s.seasonHistory) ? s.seasonHistory : [];
  return {
    gameStarted: !!s.gameStarted,
    careerKey: hallEntryId({ careerId: s.careerId, activeSlot: s.activeSlot }),
    wins: s.managerStats?.totalWins ?? 0,
    draws: s.managerStats?.totalDraws ?? 0,
    losses: s.managerStats?.totalLosses ?? 0,
    objectivesCompleted: s.sessionStats?.objectivesCompleted ?? 0,
    seasonsPlayed: history.length,
    lastSeason: history.length ? history[history.length - 1] : null,
  };
}

/** Trophies a completed season delivered — same rules as the Hall of Managers. */
export function seasonTrophyCount(h: SeasonHistory): number {
  const won = (r?: string) => (r === 'Winner' ? 1 : 0);
  return (h.position === 1 ? 1 : 0) + won(h.cupResult) + won(h.leagueCupResult)
    + won(h.championsCupResult) + won(h.shieldCupResult) + won(h.conferenceCupResult);
}

/** Most objectives one month can complete — a larger jump is a load, not play. */
const MAX_OBJECTIVE_STEP = 5;

/** Events between two observed states. Empty unless both are the same running
 *  career and a counter stepped forward by a plausible single-action amount. */
export function diffPassEvents(prev: PassObservedState, next: PassObservedState): ManagerPassEvent[] {
  if (!prev.gameStarted || !next.gameStarted || prev.careerKey !== next.careerKey) return [];
  const events: ManagerPassEvent[] = [];
  const c = next.careerKey;

  const dW = next.wins - prev.wins;
  const dD = next.draws - prev.draws;
  const dL = next.losses - prev.losses;
  if (dW + dD + dL === 1 && dW >= 0 && dD >= 0 && dL >= 0) {
    const played = next.wins + next.draws + next.losses;
    events.push({ source: 'match', key: `m:${c}:${played}`, outcome: dW ? 'win' : dD ? 'draw' : 'loss' });
  }

  const dO = next.objectivesCompleted - prev.objectivesCompleted;
  if (dO >= 1 && dO <= MAX_OBJECTIVE_STEP) {
    for (let n = prev.objectivesCompleted + 1; n <= next.objectivesCompleted; n++) {
      events.push({ source: 'objective', key: `o:${c}:${n}` });
    }
  }

  if (next.seasonsPlayed === prev.seasonsPlayed + 1 && next.lastSeason) {
    events.push({ source: 'season', key: `s:${c}:${next.lastSeason.season}`, trophies: seasonTrophyCount(next.lastSeason) });
  }
  return events;
}

interface ObservableStore<S extends PassObservableGameState> {
  getState: () => S;
  subscribe: (listener: (state: S) => void) => () => void;
}

/**
 * Watch the store and hand Pass events to `record`. Returns the unsubscribe.
 * Mounted by GameShell for as long as a game is on screen. The baseline is the
 * state at attach time, so attaching never pays for anything already played.
 */
export function attachManagerPassObserver<S extends PassObservableGameState>(
  store: ObservableStore<S>,
  record: (events: ManagerPassEvent[]) => void,
): () => void {
  let prev = observePassState(store.getState());
  return store.subscribe(state => {
    const next = observePassState(state);
    const events = diffPassEvents(prev, next);
    // Advance the baseline BEFORE recording: `record` sets store state, which
    // re-enters this listener synchronously and must see nothing new.
    prev = next;
    if (events.length) record(events);
  });
}
