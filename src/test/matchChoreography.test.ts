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

  describe('continuous open-play flow', () => {
    const adv = (poss: 'home' | 'away', y: number) => (poss === 'home' ? y : 100 - y);

    it('flows the ball forward without snapping back to the defenders each minute', () => {
      const timeline = buildMatchTimeline(makeMatch([]), home, away);
      // Across consecutive open-play beats of the SAME possession, the ball never
      // lurches a long way back toward its own goal (the old per-minute "reset").
      let prev: (typeof timeline.beats)[number] | null = null;
      let maxBackward = 0;
      for (const b of timeline.beats) {
        if (b.eventType !== null) { prev = null; continue; }
        if (prev && prev.possession === b.possession) {
          const back = adv(prev.possession, prev.ball.y) - adv(b.possession, b.ball.y);
          if (back > maxBackward) maxBackward = back;
        }
        prev = b;
      }
      // A modest recycle pass is fine; half-pitch resets are not.
      expect(maxBackward).toBeLessThan(20);
    });

    it('strings possession into multi-phase spells (inertia), not minute-by-minute flips', () => {
      const timeline = buildMatchTimeline(makeMatch([]), home, away);
      let longest = 0;
      let cur = 0;
      let prev: 'home' | 'away' | null = null;
      for (const b of timeline.beats) {
        if (b.eventType !== null) { prev = null; cur = 0; continue; }
        if (b.possession === prev) cur++;
        else { cur = 1; prev = b.possession; }
        if (cur > longest) longest = cur;
      }
      // At least one spell strings several beats together (a sustained move).
      expect(longest).toBeGreaterThan(6);
    });
  });

  it('restarts from the centre with the conceding team after a goal', () => {
    const timeline = buildMatchTimeline(makeMatch([ev(30, 'goal', 'home', { playerId: 'home-p9' })]), home, away);
    const goalIdx = timeline.beats.findIndex((b) => b.eventType === 'goal');
    const restart = timeline.beats[goalIdx + 1];
    expect(restart.possession).toBe('away'); // conceding side kicks off
    expect(restart.ball).toEqual({ x: 50, y: 50 });
  });

  it('treats a keeper-error goal as a goal (centre restart, not a missed shot)', () => {
    const timeline = buildMatchTimeline(makeMatch([ev(30, 'goalkeeper_error', 'home', { playerId: 'home-p9' })]), home, away);
    const idx = timeline.beats.findIndex((b) => b.eventType === 'goalkeeper_error');
    const restart = timeline.beats[idx + 1];
    expect(restart.possession).toBe('away');
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

  it('derives chip speed from pace, scaled down by fatigue', () => {
    const lookup = {
      'home-p9': { lastName: 'Sprinter', attributes: { pace: 90 }, fitness: 100 },
      'home-p8': { lastName: 'Spent', attributes: { pace: 90 }, fitness: 40 },
      'home-p7': { lastName: 'Plodder', attributes: { pace: 40 }, fitness: 100 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const timeline = buildMatchTimeline(makeMatch([]), home, away, { players: lookup });
    const speedOf = (id: string) => timeline.beats.flatMap((b) => b.players).find((p) => p.id === id)?.speed;
    const fresh = speedOf('home-p9')!;
    const tired = speedOf('home-p8')!;
    const slow = speedOf('home-p7')!;
    expect(fresh).toBeGreaterThan(tired);   // fatigue slows the same pace
    expect(fresh).toBeGreaterThan(slow);    // pace beats a fresh plodder
    expect(fresh).toBeLessThanOrEqual(1);
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

describe('buildMatchTimeline — the pitch shows the goal the commentary describes', () => {
  /** Carriers of the beats leading up to the first beat tagged `type`. */
  const carriersBefore = (timeline: ReturnType<typeof buildMatchTimeline>, type: MatchEvent['type']) => {
    const i = timeline.beats.findIndex(b => b.eventType === type);
    expect(i).toBeGreaterThan(0);
    return timeline.beats.slice(0, i).filter(b => b.minute === timeline.beats[i].minute).map(b => b.ballCarrierId);
  };

  it('the recorded assister plays the final pass to the scorer', () => {
    for (const seed of ['m1', 'm2', 'm3', 'm4', 'm5']) {
      const t = buildMatchTimeline(makeMatch([ev(34, 'goal', 'home', { playerId: 'home-p9', assistPlayerId: 'home-p4' })], { id: seed }), home, away);
      const carriers = carriersBefore(t, 'goal');
      expect(carriers.slice(-2)).toEqual(['home-p4', 'home-p9']);
      // Neither touches it earlier in the move.
      expect(carriers.slice(0, -2)).not.toContain('home-p9');
      expect(carriers.slice(0, -2)).not.toContain('home-p4');
    }
  });

  it('a counter-attack goal goes through the assister', () => {
    const t = buildMatchTimeline(makeMatch([ev(50, 'counter_attack_goal', 'away', { playerId: 'away-p10', assistPlayerId: 'away-p7' })]), home, away);
    expect(carriersBefore(t, 'counter_attack_goal').slice(-2)).toEqual(['away-p7', 'away-p10']);
  });

  it('the penalty is taken by whoever the engine says took it, not the designated taker', () => {
    // The designated taker was subbed off; the engine gave it to home-p7.
    const club = makeClub('home', { penaltyTakerId: 'home-p9' });
    const t = buildMatchTimeline(makeMatch([ev(70, 'penalty_scored', 'home', { playerId: 'home-p7' })]), club, away);
    expect(carriersBefore(t, 'penalty_scored').at(-1)).toBe('home-p7');
  });

  it('falls back to the designated taker when the event names nobody', () => {
    const club = makeClub('home', { penaltyTakerId: 'home-p9' });
    const t = buildMatchTimeline(makeMatch([ev(70, 'penalty_scored', 'home')]), club, away);
    expect(carriersBefore(t, 'penalty_scored').at(-1)).toBe('home-p9');
  });
});

describe('buildMatchTimeline — the XIs that kicked off', () => {
  it('stands the given XI in the formation slots instead of club.lineup', () => {
    const xi = Array.from({ length: 11 }, (_, i) => `fielded-${i}`);
    const t = buildMatchTimeline(makeMatch([]), home, away, { lineups: { home: xi } });
    const homeIds = t.beats[0].players.filter(p => p.team === 'home').map(p => p.id).sort();
    expect(homeIds).toEqual([...xi].sort());
    // The side with no override still reads club.lineup.
    expect(t.beats[0].players.filter(p => p.team === 'away').map(p => p.id).sort()).toEqual([...away.lineup].sort());
  });
});

describe('offside and shape (open play)', () => {
  const adv = (team: 'home' | 'away', y: number) => (team === 'home' ? y : 100 - y);
  const events: MatchEvent[] = [];
  for (let m = 3; m < 88; m += 7) {
    events.push(ev(m, m % 2 ? 'shot_saved' : 'shot_missed', m % 3 ? 'home' : 'away', { playerId: `${m % 3 ? 'home' : 'away'}-p10` }));
  }
  const tl = buildMatchTimeline(makeMatch(events), home, away);
  const open = tl.beats.filter(b => b.eventType == null && b.players.length === 22);

  it('has open-play beats to check', () => {
    expect(open.length).toBeGreaterThan(50);
  });

  it('never leaves an off-ball attacker beyond the last outfield defender', () => {
    for (const b of open) {
      const att = b.possession;
      const def = att === 'home' ? 'away' : 'home';
      const line = Math.max(...b.players.filter(p => p.team === def && p.pos !== 'GK').map(p => adv(att, p.point.y)));
      const cap = Math.max(line, adv(att, b.ball.y), 50);
      for (const p of b.players) {
        if (p.team !== att || p.pos === 'GK' || (p.id && b.highlightIds.includes(p.id))) continue;
        expect(adv(att, p.point.y), `${p.id} at minute ${b.minute}`).toBeLessThanOrEqual(cap + 0.5);
      }
    }
  });

  it('keeps the striker out of the box while his side builds from the back', () => {
    for (const b of open) {
      if (adv(b.possession, b.ball.y) > 40) continue;
      for (const p of b.players) {
        if (p.team === b.possession && p.pos === 'ST') expect(adv(b.possession, p.point.y)).toBeLessThan(80);
      }
    }
  });
});

describe('offside event', () => {
  const adv = (team: 'home' | 'away', y: number) => (team === 'home' ? y : 100 - y);
  const tl = buildMatchTimeline(makeMatch([ev(30, 'offside', 'home', { playerId: 'home-p10' })]), home, away);
  const i = tl.beats.findIndex(b => b.eventType === 'offside');

  it('plays the ball to a runner who is beyond the last defender', () => {
    expect(i).toBeGreaterThan(0);
    const b = tl.beats[i];
    expect(b.possession).toBe('home');
    expect(b.ballMotion).toBe('longball');
    expect(b.highlightIds).toContain('home-p10');
    const runner = b.players.find(p => p.id === 'home-p10')!;
    const line = Math.max(...b.players.filter(p => p.team === 'away' && p.pos !== 'GK').map(p => adv('home', p.point.y)));
    expect(adv('home', runner.point.y)).toBeGreaterThan(line);
    expect(b.caption).toBe('offside@30');
  });

  it('gives the free kick to the defenders from where he was caught', () => {
    const fk = tl.beats[i + 1];
    expect(fk.possession).toBe('away');
    expect(fk.ball).toEqual(tl.beats[i].ball);
  });
});

describe('restarts and turnovers', () => {
  it('a missed shot is followed by the defending keeper taking a goal kick', () => {
    const tl = buildMatchTimeline(makeMatch([ev(20, 'shot_missed', 'home', { playerId: 'home-p10' })]), home, away);
    const i = tl.beats.findIndex(b => b.eventType === 'shot_missed');
    const gk = tl.beats[i + 1];
    expect(gk.possession).toBe('away');
    expect(gk.ballMotion).toBe('restart');
    expect(100 - gk.ball.y).toBeLessThan(10); // away keeper's six-yard box (away defends y=100)
    const keeper = gk.players.find(p => p.team === 'away' && p.pos === 'GK')!;
    expect(gk.ballCarrierId).toBe(keeper.id);
    expect(keeper.point).toEqual(gk.ball);
  });

  it('wins the ball where the move broke down, not back in its own half', () => {
    const tl = buildMatchTimeline(makeMatch([]), home, away);
    let checked = 0;
    for (let i = 1; i < tl.beats.length; i++) {
      const prev = tl.beats[i - 1], b = tl.beats[i];
      if (b.eventType !== null || prev.eventType !== null || b.possession === prev.possession || b.ballMotion !== 'idle') continue;
      expect(b.ball.x).toBeCloseTo(Math.min(94, Math.max(6, prev.ball.x)));
      expect(b.ball.y).toBeCloseTo(Math.min(94, Math.max(6, prev.ball.y)));
      const winner = b.players.find(p => p.id === b.ballCarrierId)!;
      expect(winner.team).toBe(b.possession);
      expect(winner.highlighted).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});
