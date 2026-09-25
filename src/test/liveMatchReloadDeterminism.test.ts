/**
 * R14 — a reload mid-match cannot re-roll it.
 *
 * Closing or reloading during a match discarded it (`loadGame` resets the live
 * match state), and the replay from kickoff was a fresh simulation, so a bad
 * first half could be re-rolled as often as the player liked. Every live match
 * step now draws from a seed derived from what the save already holds (career,
 * season, match id, stage — `liveMatchSeed`), so the replay after a reload
 * plays out identically for the same decisions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { liveMatchSeed } from '@/store/slices/orchestration/matchActions';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import type { MatchEvent } from '@/types/game';

const SLOT = 1;
const CLUB = 'arsenal';

function fingerprint(events: MatchEvent[]): string[] {
  return events.map(e => `${e.minute}:${e.type}:${e.clubId}:${e.playerId ?? ''}`);
}

/** Kick off, return the first half as a comparable fingerprint. */
function playFirstHalf() {
  const half = useGameStore.getState().playFirstHalf();
  expect(half, 'the first half kicked off').toBeTruthy();
  return { score: `${half!.homeGoals}-${half!.awayGoals}`, events: fingerprint(half!.events) };
}

/** Stand-in for an app kill: throw away the live match and load the save. */
function reload() {
  expect(useGameStore.getState().loadGame(SLOT)).toBe(true);
  const s = useGameStore.getState();
  expect(s.matchPhase).toBe('none');
  expect(s.halfTimeState).toBeNull();
}

beforeEach(() => {
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  useGameStore.getState().initGame(CLUB);
  // Autosave off: the only save is the pre-match one a reload returns to (a
  // full-time autosave would otherwise overwrite it with the played match).
  useGameStore.setState({ activeSlot: SLOT, settings: { ...useGameStore.getState().settings, autoSave: false } });
  useGameStore.getState().saveGame(SLOT);
});

describe('R14: a live match replays identically after a reload', () => {
  it('first half: same events and score after a reload', { timeout: 60_000 }, () => {
    const first = playFirstHalf();
    reload();
    const replay = playFirstHalf();
    expect(replay.score).toBe(first.score);
    expect(replay.events).toEqual(first.events);
    expect(first.events.length).toBeGreaterThan(0);
  });

  it('whole match: same final score and events after a reload', { timeout: 60_000 }, () => {
    playFirstHalf();
    const a = useGameStore.getState().playSecondHalf(90)!;
    expect(a).toBeTruthy();
    reload();
    playFirstHalf();
    const b = useGameStore.getState().playSecondHalf(90)!;
    expect(`${b.homeGoals}-${b.awayGoals}`).toBe(`${a.homeGoals}-${a.awayGoals}`);
    expect(fingerprint(b.events)).toEqual(fingerprint(a.events));
  });

  it('second half in segments: the same pause replays the same way', { timeout: 60_000 }, () => {
    playFirstHalf();
    useGameStore.getState().playSecondHalf(60);
    const a = useGameStore.getState().playSecondHalf(90)!;
    reload();
    playFirstHalf();
    useGameStore.getState().playSecondHalf(60);
    const b = useGameStore.getState().playSecondHalf(90)!;
    expect(fingerprint(b.events)).toEqual(fingerprint(a.events));
  });

  it('leaves Math.random unseeded outside the match', () => {
    const before = Math.random;
    playFirstHalf();
    expect(Math.random).toBe(before);
  });
});

describe('liveMatchSeed', () => {
  const base = { careerId: 'c-1', activeSlot: 1, playerClubId: CLUB, season: 1, invincibleUsedThisSeason: false };

  it('is stable for the same match and stage', () => {
    expect(liveMatchSeed(base, 'm1', 'first-half')).toBe(liveMatchSeed({ ...base }, 'm1', 'first-half'));
  });

  it('differs by match, stage, season and career', () => {
    const seed = liveMatchSeed(base, 'm1', 'first-half');
    expect(liveMatchSeed(base, 'm2', 'first-half')).not.toBe(seed);
    expect(liveMatchSeed(base, 'm1', 'second-half:46')).not.toBe(seed);
    expect(liveMatchSeed({ ...base, season: 2 }, 'm1', 'first-half')).not.toBe(seed);
    expect(liveMatchSeed({ ...base, careerId: 'c-2' }, 'm1', 'first-half')).not.toBe(seed);
  });

  it('a used Invincible rewind gives the replay a new seed', () => {
    expect(liveMatchSeed({ ...base, invincibleUsedThisSeason: true }, 'm1', 'first-half'))
      .not.toBe(liveMatchSeed(base, 'm1', 'first-half'));
  });
});
