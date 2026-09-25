/**
 * "Skip to full time" — free from half-time, Pro from kickoff, playback-only.
 *
 * Free players had to watch every minute of every match (fastest free speed
 * 2x ≈ 2.5 real minutes a match); the only way out was Pro's Instant Sim in
 * Match Prep. The skip gives free players the second half back without giving
 * away Pro's value, and without changing a single simulated thing: it must
 * produce EXACTLY the result, events, ratings and player stats that letting the
 * match play out untouched would have, committed through the same store calls.
 *
 * How the equivalence is proven. Both runs render the real MatchDay and play
 * the first half on the real clock (fake timers). One then watches the second
 * half; the other skips at half-time. Every store simulation call is reseeded
 * from (seed, action, args) — so the outcome depends only on WHICH calls are
 * made, in what order, from what state, which is precisely the claim. Render-
 * time randomness (commentary flavour) can't leak into the comparison.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useGameStore } from '@/store/gameStore';
import { SECOND_HALF_SEGMENTS } from '@/config/matchEngine';
import { SKIP_TO_FULL_TIME_PHASES } from '@/config/matchSpeed';
import { canSkipToFullTime, playOutSecondHalf } from '@/utils/skipToFullTime';
import type { CupTie, Match, MatchDayPhase } from '@/types/game';

vi.mock('@/main', () => ({ signalReady: () => {}, saveStorageReady: Promise.resolve() }));
vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

import MatchDay from '@/pages/MatchDay';

const CLUB_ID = 'everton';
const SKIP = 'Skip to full time';

// ── Rules ──

describe('canSkipToFullTime', () => {
  const ALL: MatchDayPhase[] = ['pre', 'first_half', 'half_time', 'second_half', 'extra_time_break', 'extra_time', 'penalties', 'post'];

  it('free players: from half-time onward, never the first half', () => {
    const offered = ALL.filter(p => canSkipToFullTime(p, false));
    expect(offered).toEqual(['half_time', 'second_half', 'extra_time_break', 'extra_time']);
  });

  it('Pro keeps it from kickoff — the Pro time saving stays the larger one', () => {
    expect(canSkipToFullTime('first_half', true)).toBe(true);
    for (const p of SKIP_TO_FULL_TIME_PHASES.free) expect(canSkipToFullTime(p, true)).toBe(true);
    // Never before kickoff (that is Instant Sim's job) or once it's over.
    for (const p of ['pre', 'penalties', 'post'] as MatchDayPhase[]) {
      expect(canSkipToFullTime(p, true)).toBe(false);
    }
  });
});

describe('playOutSecondHalf — the clock\'s own call sequence', () => {
  const fakeMatch = (n: number) => ({ id: `m${n}`, events: [] } as unknown as Match);

  it('asks for each remaining segment in order, exactly like the clock', () => {
    const calls: number[] = [];
    const out = playOutSecondHalf(SECOND_HALF_SEGMENTS[0], until => { calls.push(until); return fakeMatch(until); });
    expect(calls).toEqual(SECOND_HALF_SEGMENTS.slice(1));
    expect(out.frontier).toBe(90);
    expect(out.match?.id).toBe('m90');
  });

  it('nothing left to simulate → no calls', () => {
    const extend = vi.fn();
    expect(playOutSecondHalf(90, extend)).toEqual({ match: null, frontier: 90 });
    expect(extend).not.toHaveBeenCalled();
  });

  it('a refusal stops the loop, as the clock stops asking', () => {
    const calls: number[] = [];
    const out = playOutSecondHalf(45, until => { calls.push(until); return until >= 75 ? null : fakeMatch(until); });
    expect(calls).toEqual([60, 75]);
    expect(out).toEqual({ match: fakeMatch(60), frontier: 90 });
  });
});

// ── The screen ──

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

type StoreState = ReturnType<typeof useGameStore.getState>;
type DataSnapshot = Record<string, unknown>;

/** Every non-function slice of the store, deep-copied. */
function snapshotData(): DataSnapshot {
  const out: DataSnapshot = {};
  for (const [k, v] of Object.entries(useGameStore.getState())) {
    if (typeof v !== 'function') out[k] = structuredClone(v);
  }
  return out;
}

let ORIGINAL: Pick<StoreState, 'playFirstHalf' | 'playSecondHalf' | 'playExtraTime' | 'saveGame'>;

/** What a finished match leaves behind — the things a skip must not change. */
function committed() {
  const st = useGameStore.getState();
  const result = st.currentMatchResult;
  const squadIds = result
    ? [...(st.clubs[result.homeClubId]?.playerIds ?? []), ...(st.clubs[result.awayClubId]?.playerIds ?? [])]
    : [];
  return JSON.parse(JSON.stringify({
    matchPhase: st.matchPhase,
    result,
    fixture: result ? st.fixtures.find(f => f.id === result.id) ?? null : null,
    // Ties the draw creates for the NEXT round get a `crypto.randomUUID()` id —
    // identity, not outcome — so compare their content only.
    cupTies: st.cup.ties.map(t => ({ ...t, id: t.id === 'cup-skip-tie' ? t.id : '<generated>' })),
    ratings: st.matchPlayerRatings,
    leagueTable: st.leagueTable,
    boardConfidence: st.boardConfidence,
    squads: squadIds.map(id => {
      const p = st.players[id];
      return p && {
        id, goals: p.goals, assists: p.assists, appearances: p.appearances,
        yellowCards: p.yellowCards, redCards: p.redCards, fitness: p.fitness,
        morale: p.morale, form: p.form, injured: p.injured, injuryWeeks: p.injuryWeeks,
      };
    }),
  }));
}

/**
 * Reset the store to `base` and reseed every simulation call from its name and
 * arguments. `saveGame` is a spy so the test can see the commit path save.
 */
function stage(base: DataSnapshot, seed: number) {
  useGameStore.setState(structuredClone(base) as Partial<StoreState>);
  const reseeded = <A extends unknown[], R>(name: string, fn: (...a: A) => R) => (...args: A): R => {
    const original = Math.random;
    Math.random = mulberry32(hash(`${seed}:${name}:${args.join(',')}`));
    try { return fn(...args); } finally { Math.random = original; }
  };
  const saveGame = vi.fn();
  const calls: string[] = [];
  useGameStore.setState({
    playFirstHalf: reseeded('first', () => { calls.push('first'); return ORIGINAL.playFirstHalf(); }),
    playSecondHalf: reseeded('second', (until?: number) => { calls.push(`second:${until}`); return ORIGINAL.playSecondHalf(until); }),
    playExtraTime: reseeded('et', () => { calls.push('et'); return ORIGINAL.playExtraTime(); }),
    saveGame,
  } as Partial<StoreState>);
  return { saveGame, calls };
}

const tick = () => act(() => { vi.advanceTimersByTime(3300); });
const button = (name: string | RegExp) => screen.queryByRole('button', { name });

/** Dismiss whatever interrupts the clock WITHOUT changing anything — the
 *  "watched without touching" baseline. */
function dismissInterruptions() {
  const cont = button(/Continue Match/);
  if (cont) fireEvent.click(cont);
  const noSub = screen.queryByText('Continue without substitution');
  if (noSub) fireEvent.click(noSub);
  const ack = button('Acknowledge');
  if (ack) fireEvent.click(ack);
}

function runClockUntil(done: () => boolean) {
  for (let i = 0; i < 400; i++) {
    if (done()) return;
    dismissInterruptions();
    tick();
  }
  throw new Error('match clock never reached the expected screen');
}

const atHalfTime = () => !!button(/Start 2nd Half/);
const isOver = () =>
  !!screen.queryByRole('dialog', { name: 'Post-match summary' }) || !!button(/Take Penalties/);

function kickOffAndWatchFirstHalf() {
  render(<MatchDay />);
  fireEvent.click(button(/Kick Off/)!);
  runClockUntil(atHalfTime);
}

/** Watch to the end, touching nothing: the break buttons are the only taps. */
function watchToEnd() {
  fireEvent.click(button(/Start 2nd Half/)!);
  runClockUntil(() => {
    const et = button(/Play Extra Time/);
    if (et) { fireEvent.click(et); return false; }
    return isOver();
  });
}

function skipFromHere() {
  fireEvent.click(button(SKIP)!);
  fireEvent.click(button(/^Skip$/)!);
  expect(isOver()).toBe(true);
}

describe('MatchDay — Skip to full time', () => {
  let leagueBase: DataSnapshot;

  beforeAll(() => {
    useGameStore.getState().initGame(CLUB_ID);
    // Step to the first week the player has a league fixture.
    for (let i = 0; i < 12; i++) {
      const cur = useGameStore.getState();
      const hasFixture = cur.fixtures.some(m => m.week === cur.week && !m.played
        && (m.homeClubId === cur.playerClubId || m.awayClubId === cur.playerClubId));
      if (hasFixture) break;
      void useGameStore.getState().advanceWeek();
    }
    const st = useGameStore.getState();
    ORIGINAL = { playFirstHalf: st.playFirstHalf, playSecondHalf: st.playSecondHalf, playExtraTime: st.playExtraTime, saveGame: st.saveGame };
    // Keep the base a plain league week so the comparison is about the skip.
    useGameStore.setState({ settings: { ...st.settings, autoSave: true } });
    leagueBase = snapshotData();
  });

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useGameStore.setState({ ...ORIGINAL });
  });

  it('free players: no skip in the first half, offered from half-time; "Keep watching" holds then resumes the clock', () => {
    const run = stage(leagueBase, 1);
    render(<MatchDay />);
    fireEvent.click(button(/Kick Off/)!);
    tick();
    expect(button(/Pause match/)).toBeTruthy(); // live
    expect(button(SKIP)).toBeNull();
    runClockUntil(atHalfTime);
    expect(button(SKIP)).toBeTruthy();

    // Into the second half: the live row offers it too.
    fireEvent.click(button(/Start 2nd Half/)!);
    tick();
    expect(button(SKIP)).toBeTruthy();
    // The confirmation holds the clock — 30 game minutes of time pass and the
    // next segment (75') is never requested…
    fireEvent.click(button(SKIP)!);
    for (let i = 0; i < 30; i++) tick();
    expect(run.calls).toEqual(['first', 'second:60']);
    // …and backing out simulates nothing and lets the match carry on.
    fireEvent.click(button('Keep watching')!);
    runClockUntil(() => run.calls.includes('second:75'));
    expect(button('Keep watching')).toBeNull();
  });

  it('Pro: offered from kickoff', () => {
    stage(leagueBase, 1);
    useGameStore.setState(s => ({ monetization: { ...s.monetization, entitlements: ['com.dynastymanager.pro'] } }));
    render(<MatchDay />);
    fireEvent.click(button(/Kick Off/)!);
    tick();
    expect(button(/Pause match/)).toBeTruthy();
    expect(button(SKIP)).toBeTruthy();
  });

  it('the skipped match is the watched match — result, events, ratings, player stats', () => {
    const SEED = 7;
    const watched = stage(leagueBase, SEED);
    kickOffAndWatchFirstHalf();
    watchToEnd();
    const watchedResult = committed();
    cleanup();

    const skipped = stage(leagueBase, SEED);
    kickOffAndWatchFirstHalf();
    skipFromHere();
    const skippedResult = committed();

    // It actually finished and committed a real result…
    expect(skippedResult.matchPhase).toBe('full_time');
    expect(skippedResult.fixture?.played).toBe(true);
    expect(skippedResult.result.events.length).toBeGreaterThan(0);
    // …through the same store calls, in the same order, as watching…
    expect(skipped.calls).toEqual(watched.calls);
    expect(skipped.calls).toEqual(['first', ...SECOND_HALF_SEGMENTS.map(b => `second:${b}`)]);
    // …saved through the same path…
    expect(skipped.saveGame).toHaveBeenCalled();
    expect(skipped.saveGame.mock.calls.length).toBe(watched.saveGame.mock.calls.length);
    // …with an identical outcome.
    expect(skippedResult).toEqual(watchedResult);
  }, 120_000);

  it('a drawn cup tie: skip plays extra time too, exactly as tapping through would', () => {
    // Stage a Dynasty Cup tie on the current week (same shape as matchDayCupContext).
    useGameStore.setState(structuredClone(leagueBase) as Partial<StoreState>);
    const s = useGameStore.getState();
    const opponentId = (s.divisionClubs[s.playerDivision] || []).find(id => id !== CLUB_ID)!;
    const tie: CupTie = {
      id: 'cup-skip-tie', round: 'R3' as CupTie['round'], homeClubId: CLUB_ID, awayClubId: opponentId,
      played: false, homeGoals: 0, awayGoals: 0, week: s.week,
    };
    useGameStore.setState({ cup: { ...s.cup, ties: [tie] } });
    const cupBase = snapshotData();

    // Find a seed whose 90 minutes end level (draws are ~30% of matches) and
    // record the tap-through reference at the store level: the calls the
    // watched screen makes — first half, the clock's segments, then the one
    // "Play Extra Time" tap (the extra-time clock itself calls nothing). The
    // league test above proves the screen makes those calls when watched.
    let seed = -1;
    let reference: ReturnType<typeof committed> | null = null;
    let referenceCalls: string[] = [];
    for (let candidate = 1; candidate <= 80 && seed < 0; candidate++) {
      const run = stage(cupBase, candidate);
      useGameStore.getState().playFirstHalf();
      for (const b of SECOND_HALF_SEGMENTS) useGameStore.getState().playSecondHalf(b);
      if (useGameStore.getState().matchPhase !== 'extra_time') continue;
      useGameStore.getState().playExtraTime();
      seed = candidate;
      reference = committed();
      referenceCalls = run.calls;
    }
    expect(seed).toBeGreaterThan(0);

    const skipped = stage(cupBase, seed);
    kickOffAndWatchFirstHalf();
    skipFromHere();
    const skippedResult = committed();

    expect(skipped.calls).toEqual(referenceCalls);
    expect(skipped.calls[skipped.calls.length - 1]).toBe('et');
    expect(['full_time', 'penalties']).toContain(skippedResult.matchPhase);
    expect(skippedResult).toEqual(reference);
  }, 120_000);
});
