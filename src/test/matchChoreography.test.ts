import { describe, it, expect } from 'vitest';
import { buildMatchTimeline } from '@/engine/match/choreography';
import type { Match, Club, MatchEvent, TacticalInstructions } from '@/types/game';

const tactics = (over: Partial<TacticalInstructions> = {}): TacticalInstructions =>
  ({ mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'normal', pressingIntensity: 50, ...over });

function makeClub(id: string, over: Partial<Club> = {}): Club {
  return {
    id,
    name: id,
    shortName: id,
    color: id === 'home' ? '#e11d2a' : '#1d4ed8',
    secondaryColor: '#ffffff',
    budget: 0,
    wageBill: 0,
    reputation: 50,
    facilities: 50,
    youthRating: 50,
    fanBase: 1000,
    boardPatience: 50,
    playerIds: [],
    formation: '4-3-3',
    lineup: Array.from({ length: 11 }, (_, i) => `${id}-p${i + 1}`),
    subs: [],
    divisionId: 'epl' as Club['divisionId'],
    ...over,
  };
}

function makeMatch(events: MatchEvent[], over: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    week: 1,
    homeClubId: 'home',
    awayClubId: 'away',
    played: true,
    homeGoals: 0,
    awayGoals: 0,
    events,
    ...over,
  };
}

const ev = (
  minute: number,
  type: MatchEvent['type'],
  clubId: string,
  extra: Partial<MatchEvent> = {},
): MatchEvent => ({ minute, type, clubId, description: `${type}@${minute}`, ...extra });

const ALL_EVENT_TYPES: MatchEvent['type'][] = [
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'shot_saved',
  'shot_missed', 'hit_woodwork', 'goal_line_clearance', 'foul', 'yellow_card',
  'red_card', 'injury', 'substitution', 'half_time', 'added_time', 'full_time',
  'kickoff', 'extra_time_goal', 'penalty_shootout', 'commentary',
  'ai_tactical_change', 'free_kick_goal', 'long_range_goal', 'counter_attack_goal',
  'header_goal', 'solo_goal', 'goalkeeper_error', 'var_check', 'var_disallowed',
];

const home = makeClub('home');
const away = makeClub('away');

function expectValidBeats(timeline: ReturnType<typeof buildMatchTimeline>) {
  for (const beat of timeline.beats) {
    expect(Number.isFinite(beat.ball.x)).toBe(true);
    expect(Number.isFinite(beat.ball.y)).toBe(true);
    expect(beat.ball.x).toBeGreaterThanOrEqual(0);
    expect(beat.ball.x).toBeLessThanOrEqual(100);
    expect(beat.ball.y).toBeGreaterThanOrEqual(0);
    expect(beat.ball.y).toBeLessThanOrEqual(100);
    expect(Number.isFinite(beat.camera.zoom)).toBe(true);
    for (const p of beat.players) {
      expect(Number.isFinite(p.point.x)).toBe(true);
      expect(Number.isFinite(p.point.y)).toBe(true);
      expect(p.point.x).toBeGreaterThanOrEqual(2);
      expect(p.point.x).toBeLessThanOrEqual(98);
      expect(p.point.y).toBeGreaterThanOrEqual(2);
      expect(p.point.y).toBeLessThanOrEqual(98);
    }
  }
}

describe('buildMatchTimeline', () => {
  it('is deterministic — same match produces an identical timeline', () => {
    const events = [
      ev(0, 'kickoff', 'home'),
      ev(12, 'shot_saved', 'home', { playerId: 'home-p10', momentum: 20 }),
      ev(34, 'goal', 'home', { playerId: 'home-p9', assistPlayerId: 'home-p8', momentum: 45 }),
      ev(58, 'yellow_card', 'away', { playerId: 'away-p4', momentum: -10 }),
      ev(77, 'goal', 'away', { playerId: 'away-p11', momentum: -30 }),
      ev(90, 'full_time', 'home'),
    ];
    const a = buildMatchTimeline(makeMatch(events), home, away);
    const b = buildMatchTimeline(makeMatch(events), home, away);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(a.seed).toBe(b.seed);
  });

  it('always covers at least a full 90-minute match with breathing filler beats', () => {
    const timeline = buildMatchTimeline(makeMatch([ev(0, 'kickoff', 'home')]), home, away);
    const minutes = new Set(timeline.beats.map((b) => b.minute));
    expect(minutes.has(0)).toBe(true);
    expect(minutes.has(45)).toBe(true);
    expect(minutes.has(90)).toBe(true);
    // Minutes without events still produce a possession beat (never frozen).
    const fillers = timeline.beats.filter((b) => b.eventType === null);
    expect(fillers.length).toBeGreaterThan(80);
    expectValidBeats(timeline);
  });

  it('extends past 90 to cover extra-time events', () => {
    const timeline = buildMatchTimeline(
      makeMatch([
        ev(105, 'extra_time_goal', 'home', { playerId: 'home-p9' }),
        ev(120, 'full_time', 'home'),
      ]),
      home,
      away,
    );
    const maxMinute = Math.max(...timeline.beats.map((b) => b.minute));
    expect(maxMinute).toBeGreaterThan(90);
    expect(maxMinute).toBe(120);
    expect(timeline.beats.some((b) => b.minute === 105 && b.eventType === 'extra_time_goal')).toBe(true);
    expectValidBeats(timeline);
  });

  it('produces a valid, in-bounds beat for every event type', () => {
    for (const type of ALL_EVENT_TYPES) {
      const timeline = buildMatchTimeline(
        makeMatch([ev(10, type, 'home', { playerId: 'home-p10', goalkeeperId: 'away-p1' })]),
        home,
        away,
      );
      const beat = timeline.beats.find((b) => b.eventType === type);
      expect(beat, `missing beat for ${type}`).toBeDefined();
      expectValidBeats(timeline);
    }
  });

  it('removes a sent-off player from beats after the red card', () => {
    const timeline = buildMatchTimeline(
      makeMatch([ev(20, 'red_card', 'home', { playerId: 'home-p5' })]),
      home,
      away,
    );
    const before = timeline.beats.find((b) => b.minute === 20 && b.eventType === 'red_card');
    const after = timeline.beats.find((b) => b.minute === 60);
    // Shown on the dismissal beat, gone afterwards.
    expect(before!.players.some((p) => p.id === 'home-p5')).toBe(true);
    expect(after!.players.some((p) => p.id === 'home-p5')).toBe(false);
    // Home plays the rest of the match a man down.
    expect(after!.players.filter((p) => p.team === 'home').length).toBe(10);
  });

  it('drives filler possession from momentum sign', () => {
    const timeline = buildMatchTimeline(
      makeMatch([ev(10, 'foul', 'away', { momentum: -40 })]),
      home,
      away,
    );
    const filler = timeline.beats.find((b) => b.minute === 30 && b.eventType === null);
    expect(filler!.possession).toBe('away');
  });

  it('handles a goalless, event-light match without NaN', () => {
    const timeline = buildMatchTimeline(makeMatch([]), home, away);
    expect(timeline.beats.length).toBeGreaterThan(0);
    expectValidBeats(timeline);
  });

  it('passes through team colours and ids', () => {
    const timeline = buildMatchTimeline(makeMatch([]), home, away);
    expect(timeline.homeColor).toBe('#e11d2a');
    expect(timeline.awayColor).toBe('#1d4ed8');
    expect(timeline.homeClubId).toBe('home');
    expect(timeline.awayClubId).toBe('away');
  });

  it('keeps the ball at the ball-carrier’s feet during possession', () => {
    const timeline = buildMatchTimeline(makeMatch([]), home, away);
    const beat = timeline.beats.find((b) => b.ballCarrierId);
    expect(beat).toBeDefined();
    const carrier = beat!.players.find((p) => p.id === beat!.ballCarrierId);
    expect(carrier).toBeDefined();
    expect(beat!.ball.x).toBeCloseTo(carrier!.point.x, 5);
    expect(beat!.ball.y).toBeCloseTo(carrier!.point.y, 5);
  });

  const homeMetric = (t: TacticalInstructions, fn: (xs: number[], ys: number[]) => number) => {
    const tl = buildMatchTimeline(makeMatch([]), home, away, { tactics: { home: t, away: tactics() } });
    const ps = tl.beats[0].players.filter((p) => p.team === 'home');
    return fn(ps.map((p) => p.point.x), ps.map((p) => p.point.y));
  };

  it('spreads wide players wider under a wide width than a narrow one', () => {
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(homeMetric(tactics({ width: 'wide' }), (xs) => spread(xs)))
      .toBeGreaterThan(homeMetric(tactics({ width: 'narrow' }), (xs) => spread(xs)));
  });

  it('pushes the possessing team further forward under an attacking mentality', () => {
    const meanY = (_xs: number[], ys: number[]) => ys.reduce((a, b) => a + b, 0) / ys.length;
    // Home attacks +y, so a higher mean y = more advanced.
    expect(homeMetric(tactics({ mentality: 'attacking' }), meanY))
      .toBeGreaterThan(homeMetric(tactics({ mentality: 'defensive' }), meanY));
  });
});
