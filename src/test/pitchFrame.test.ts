import { describe, it, expect } from 'vitest';
import {
  frameForMinute, lerpFrames, latestGoalAt, createPlayback, advancePlayback, samplePlayback,
  type RenderFrame, type PlaybackOpts, type PlaybackState,
} from '@/engine/match/pitchFrame';
import type { MatchTimeline, MatchBeat, ChoreoPlayer, MatchEvent } from '@/types/game';

const player = (over: Partial<ChoreoPlayer> = {}): ChoreoPlayer => ({
  id: 'p1',
  team: 'home',
  pos: 'ST',
  number: 9,
  point: { x: 0, y: 0 },
  highlighted: false,
  ...over,
});

const beat = (minute: number, seq: number, over: Partial<MatchBeat> = {}): MatchBeat => ({
  seq,
  minute,
  eventType: null,
  possession: 'home',
  ball: { x: minute, y: minute },
  ballMotion: 'pass',
  ballArc: 0,
  camera: { focus: { x: 50, y: 50 }, zoom: 1 },
  players: [],
  highlightIds: [],
  durationMs: 600,
  ...over,
});

const timeline = (beats: MatchBeat[]): MatchTimeline => ({
  matchId: 'm1',
  homeClubId: 'home',
  awayClubId: 'away',
  homeColor: '#f00',
  awayColor: '#00f',
  seed: 1,
  beats,
});

describe('frameForMinute', () => {
  const tl = timeline([beat(0, 0), beat(10, 1), beat(10, 2), beat(45, 3), beat(90, 4)]);

  it('returns the last beat at or before the minute', () => {
    expect(frameForMinute(tl, 0)!.seq).toBe(0);
    expect(frameForMinute(tl, 9)!.seq).toBe(0);
    // Two beats share minute 10 → the later one wins.
    expect(frameForMinute(tl, 10)!.seq).toBe(2);
    expect(frameForMinute(tl, 44)!.seq).toBe(2);
    expect(frameForMinute(tl, 45)!.seq).toBe(3);
  });

  it('clamps beyond the end to the final beat', () => {
    expect(frameForMinute(tl, 200)!.seq).toBe(4);
  });

  it('falls back to the first beat before the timeline starts', () => {
    const late = timeline([beat(5, 0), beat(20, 1)]);
    expect(frameForMinute(late, 0)!.seq).toBe(0);
  });

  it('returns null for an empty timeline', () => {
    expect(frameForMinute(timeline([]), 10)).toBeNull();
  });
});

describe('lerpFrames', () => {
  const from: RenderFrame = {
    ball: { x: 0, y: 0 },
    players: [player({ id: 'p1', point: { x: 0, y: 0 } })],
  };
  const to: RenderFrame = {
    ball: { x: 10, y: 20 },
    players: [player({ id: 'p1', point: { x: 10, y: 40 } })],
  };

  it('returns the source positions at t=0', () => {
    const f = lerpFrames(from, to, 0);
    expect(f.ball).toEqual({ x: 0, y: 0 });
    expect(f.players[0].point).toEqual({ x: 0, y: 0 });
  });

  it('returns the target positions at t=1', () => {
    const f = lerpFrames(from, to, 1);
    expect(f.ball).toEqual({ x: 10, y: 20 });
    expect(f.players[0].point).toEqual({ x: 10, y: 40 });
  });

  it('interpolates the midpoint at t=0.5', () => {
    const f = lerpFrames(from, to, 0.5);
    expect(f.ball).toEqual({ x: 5, y: 10 });
    expect(f.players[0].point).toEqual({ x: 5, y: 20 });
  });

  it('clamps t outside [0,1]', () => {
    expect(lerpFrames(from, to, 2).ball).toEqual({ x: 10, y: 20 });
    expect(lerpFrames(from, to, -1).ball).toEqual({ x: 0, y: 0 });
  });

  it('drops players absent from the target (e.g. a red card)', () => {
    const toWithout: RenderFrame = { ball: { x: 0, y: 0 }, players: [] };
    expect(lerpFrames(from, toWithout, 0.5).players).toHaveLength(0);
  });

  it('snaps in players new to the target', () => {
    const toExtra: RenderFrame = {
      ball: { x: 0, y: 0 },
      players: [player({ id: 'p1' }), player({ id: 'p2', point: { x: 99, y: 99 } })],
    };
    const f = lerpFrames(from, toExtra, 0.5);
    const p2 = f.players.find((p) => p.id === 'p2');
    expect(p2!.point).toEqual({ x: 99, y: 99 });
  });
});

describe('latestGoalAt', () => {
  const mk = (minute: number, type: MatchEvent['type'], extra: Partial<MatchEvent> = {}): MatchEvent =>
    ({ minute, type, clubId: 'home', description: `${type}@${minute}`, ...extra });
  const events: MatchEvent[] = [
    mk(0, 'kickoff'),
    mk(12, 'goal', { playerId: 'a' }),
    mk(20, 'shot_missed'),
    mk(34, 'penalty_missed'),
    mk(55, 'header_goal', { playerId: 'b' }),
  ];

  it('returns the most recent goal at or before the minute', () => {
    expect(latestGoalAt(events, 11)).toBeNull();
    expect(latestGoalAt(events, 12)!.playerId).toBe('a');
    expect(latestGoalAt(events, 54)!.playerId).toBe('a');
    expect(latestGoalAt(events, 90)!.playerId).toBe('b');
  });

  it('ignores misses and non-goal events', () => {
    expect(latestGoalAt([mk(10, 'shot_missed'), mk(20, 'penalty_missed')], 90)).toBeNull();
  });

  it('counts own goals as goals', () => {
    expect(latestGoalAt([mk(30, 'own_goal')], 90)!.type).toBe('own_goal');
  });
});

describe('beat sequencer', () => {
  const opts: PlaybackOpts = { beatMs: 500, catchupLagMinutes: 2, catchupScale: 3 };
  const beats = [beat(0, 0), beat(0, 1), beat(1, 2), beat(2, 3), beat(40, 4)];

  it('advances to the next beat once a transition completes', () => {
    const s = createPlayback();
    // maxMinute 2: index 0 (minute 0) is within catch-up lag, so play at 1x.
    const r = advancePlayback(beats, s, 500, 2, opts); // one full beat
    expect(r.justAdvanced).toBe(true);
    expect(r.state.index).toBe(1);
    expect(r.state.t).toBeCloseTo(0, 5);
  });

  it('holds at the live edge — never plays beats past the revealed minute', () => {
    // maxMinute = 0 → only the two minute-0 beats are playable.
    let s = createPlayback();
    for (let i = 0; i < 10; i++) s = advancePlayback(beats, s, 500, 0, opts).state;
    expect(beats[s.index].minute).toBe(0);
    expect(s.index).toBe(1); // reached the last minute-0 beat and held
    expect(s.t).toBe(1);
  });

  it('speeds up (catch-up) when lagging far behind the revealed minute', () => {
    // index 0 (minute 0) vs maxMinute 40 → lag triggers catchupScale.
    const normal = advancePlayback(beats, createPlayback(), 100, 0, opts).state.t;
    const caught = advancePlayback(beats, createPlayback(), 100, 40, opts).state.t;
    expect(caught).toBeGreaterThan(normal);
  });

  it('samples an interpolated frame between the current and next beat', () => {
    const s: PlaybackState = { index: 0, t: 0.5 };
    const sample = samplePlayback(beats, s, 90)!;
    expect(sample.beat.seq).toBe(0);
    expect(sample.next!.seq).toBe(1);
    expect(sample.t).toBe(0.5);
  });

  it('holds (no next) at the live edge when the following beat is unrevealed', () => {
    const s: PlaybackState = { index: 1, t: 1 };
    const sample = samplePlayback(beats, s, 0)!; // minute-1 beat not revealed
    expect(sample.next).toBeNull();
    expect(sample.frame.ball).toEqual(beats[1].ball);
  });
});
