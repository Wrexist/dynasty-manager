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

  it('swaps a substituted-on player onto the pitch after the substitution', () => {
    const timeline = buildMatchTimeline(
      makeMatch([ev(60, 'substitution', 'home', { playerId: 'home-sub1', assistPlayerId: 'home-p7' })]),
      home,
      away,
    );
    const after = timeline.beats.find((b) => b.minute === 75)!;
    const ids = after.players.map((p) => p.id);
    expect(ids).not.toContain('home-p7'); // came off
    expect(ids).toContain('home-sub1'); // came on
    expect(after.players.filter((p) => p.team === 'home')).toHaveLength(11); // still 11
  });

  it('biases filler possession toward the team with momentum', () => {
    const timeline = buildMatchTimeline(makeMatch([ev(5, 'foul', 'away', { momentum: -60 })]), home, away);
    const fillers = timeline.beats.filter((b) => b.eventType === null && b.minute > 10);
    const homeP = fillers.filter((b) => b.possession === 'home').length;
    const awayP = fillers.filter((b) => b.possession === 'away').length;
    expect(awayP).toBeGreaterThan(homeP);
  });

  it('alternates possession (ebb and flow), not one team for the whole match', () => {
    const timeline = buildMatchTimeline(makeMatch([]), home, away); // neutral momentum
    const perMinute = new Map<number, 'home' | 'away'>();
    for (const b of timeline.beats) {
      if (b.eventType === null && !perMinute.has(b.minute)) perMinute.set(b.minute, b.possession);
    }
    const seq = [...perMinute.values()];
    let changes = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) changes++;
    expect(changes).toBeGreaterThan(8); // the ball changes hands many times
    const homeShare = seq.filter((p) => p === 'home').length / seq.length;
    expect(homeShare).toBeGreaterThan(0.25);
    expect(homeShare).toBeLessThan(0.75);
  });

  it('restarts from the centre with the conceding team after a goal', () => {
    const timeline = buildMatchTimeline(makeMatch([ev(30, 'goal', 'home', { playerId: 'home-p9' })]), home, away);
    const goalIdx = timeline.beats.findIndex((b) => b.eventType === 'goal');
    const restart = timeline.beats[goalIdx + 1];
    expect(restart.possession).toBe('away'); // conceding side kicks off
    expect(restart.ball).toEqual({ x: 50, y: 50 });
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

  it('opens on the resting formation shape with the ball at centre', () => {
    const timeline = buildMatchTimeline(makeMatch([ev(0, 'kickoff', 'home')]), home, away);
    const first = timeline.beats[0];
    expect(first.ball).toEqual({ x: 50, y: 50 });
    expect(first.ballCarrierId).toBeNull();
    expect(first.players.filter((p) => p.team === 'home')).toHaveLength(11);
    expect(first.players.filter((p) => p.team === 'away')).toHaveLength(11);
    // Resting: home in its own half (y < 50), away in theirs (y > 50).
    const homeMeanY = first.players.filter((p) => p.team === 'home').reduce((a, p) => a + p.point.y, 0) / 11;
    const awayMeanY = first.players.filter((p) => p.team === 'away').reduce((a, p) => a + p.point.y, 0) / 11;
    expect(homeMeanY).toBeLessThan(50);
    expect(awayMeanY).toBeGreaterThan(50);
  });

  it('labels chips with player surnames when a lookup is supplied', () => {
    const players = {
      'home-p9': { lastName: 'Striker', attributes: { passing: 70, shooting: 88 } },
      'away-p1': { lastName: 'Keeper', attributes: { passing: 50, shooting: 30 } },
    } as unknown as Record<string, import('@/types/game').Player>;
    const timeline = buildMatchTimeline(makeMatch([]), home, away, { players });
    const named = timeline.beats[0].players.find((p) => p.id === 'home-p9');
    expect(named!.name).toBe('Striker');
  });

  it('carries player name and overall onto chips when a lookup is provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lookup = { 'home-p9': { lastName: 'Striker', overall: 88, attributes: { passing: 70, shooting: 90 } } } as any;
    const timeline = buildMatchTimeline(makeMatch([]), home, away, { players: lookup });
    const chip = timeline.beats.flatMap((b) => b.players).find((p) => p.id === 'home-p9');
    expect(chip?.name).toBe('Striker');
    expect(chip?.overall).toBe(88);
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
    // First in-possession beat (home on the ball) — block shift + width applied.
    const b = tl.beats.find((bt) => bt.ballCarrierId && bt.possession === 'home')!;
    const ps = b.players.filter((p) => p.team === 'home');
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

  describe('set pieces & live tactics', () => {
    it('stages a corner after a defended shot', () => {
      const tl = buildMatchTimeline(makeMatch([ev(30, 'shot_saved', 'home', { playerId: 'home-p9' })]), home, away);
      const idx = tl.beats.findIndex((b) => b.eventType === 'shot_saved');
      const corner = tl.beats.slice(idx + 1, idx + 3).find((b) => b.ball.x <= 8 || b.ball.x >= 92);
      expect(corner).toBeDefined();
      expect(Math.max(corner!.ball.y, 100 - corner!.ball.y)).toBeGreaterThan(90); // up by the byline
    });

    it('lays out a penalty — taker on the spot, keeper on the line, box clear', () => {
      const tl = buildMatchTimeline(
        makeMatch([ev(40, 'penalty_scored', 'home', { playerId: 'home-p9', goalkeeperId: 'away-p1' })]),
        home,
        away,
      );
      const setup = tl.beats.find((b) => b.eventType === null && b.ballCarrierId === 'home-p9' && Math.abs(b.ball.x - 50) < 2 && b.ball.y > 80);
      expect(setup).toBeDefined();
      expect(setup!.players.find((p) => p.id === 'home-p9')!.point.y).toBeGreaterThan(78);
      expect(setup!.players.find((p) => p.id === 'away-p1')!.point.y).toBeGreaterThan(94);
      expect(setup!.players.filter((p) => p.point.y > 86).length).toBeLessThanOrEqual(2); // not a box scramble
    });

    it('plays a counter-attack as a fast vertical break', () => {
      const tl = buildMatchTimeline(makeMatch([ev(50, 'counter_attack_goal', 'home', { playerId: 'home-p9' })]), home, away);
      expect(tl.beats.filter((b) => b.minute === 50 && b.ballMotion === 'longball').length).toBeGreaterThanOrEqual(2);
    });

    it('reshapes a team when its AI mentality changes mid-match', () => {
      const tl = buildMatchTimeline(
        makeMatch([ev(20, 'ai_tactical_change', 'home', { description: 'Home switch to attacking mentality' })]),
        home,
        away,
        { tactics: { home: tactics({ mentality: 'defensive' }), away: tactics() } },
      );
      const meanY = (b: { players: { team: string; point: { y: number } }[] }) => {
        const ps = b.players.filter((p) => p.team === 'home');
        return ps.reduce((a, p) => a + p.point.y, 0) / ps.length;
      };
      const before = tl.beats.filter((b) => b.minute < 20 && b.possession === 'home' && b.ballCarrierId);
      const after = tl.beats.filter((b) => b.minute > 20 && b.possession === 'home' && b.ballCarrierId);
      const avg = (arr: typeof before) => arr.reduce((a, b) => a + meanY(b), 0) / arr.length;
      expect(before.length).toBeGreaterThan(0);
      expect(after.length).toBeGreaterThan(0);
      expect(avg(after)).toBeGreaterThan(avg(before));
    });
  });

  describe('defensive shape', () => {
    // First in-possession beat: home attacks, away defends.
    const tl = buildMatchTimeline(makeMatch([]), home, away);
    const beat = tl.beats.find((b) => b.ballCarrierId && b.possession === 'home')!;
    const awayPlayers = beat.players.filter((p) => p.team === 'away');
    const dist = (p: { point: { x: number; y: number } }) => Math.hypot(p.point.x - beat.ball.x, p.point.y - beat.ball.y);

    it('holds a line and never collapses onto the keeper', () => {
      // At most the GK should be jammed on the goal line (y > 94 for away).
      expect(awayPlayers.filter((p) => p.point.y > 94).length).toBeLessThanOrEqual(2);
    });

    it('does not send the whole defence at the ball', () => {
      // Plenty of defenders hold their shape well away from the ball…
      expect(awayPlayers.filter((p) => dist(p) > 25).length).toBeGreaterThanOrEqual(4);
      // …but at least one player presses it.
      expect(awayPlayers.filter((p) => dist(p) < 18).length).toBeGreaterThanOrEqual(1);
      // …and not the entire team.
      expect(awayPlayers.filter((p) => dist(p) < 18).length).toBeLessThanOrEqual(4);
    });
  });
});
