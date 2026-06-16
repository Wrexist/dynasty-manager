// MatchChoreographer — the spatial-synthesis layer for the 2.5D pitch view.
//
// The match engine (src/engine/match.ts) emits a flat, non-spatial event list
// and is Math.random-driven. This module is a PURE, DETERMINISTIC transform that
// turns a *finished* Match into a MatchTimeline: a sequence of "beats" carrying
// ball + 22-player positions, a ball-carrier, motion curves and camera hints.
//
// Positional-play model (a whole-team simulation, not just commentary):
//  • the team in possession keeps the ball via a short chain of passes — the ball
//    lives at a carrier's feet and travels teammate→teammate. Full-backs and
//    wingers push to the touchline and run the byline to cross; strikers and the
//    CAM fill the box to finish; the nearest team-mate offers a passing option.
//  • the defending team holds a compact line a safe distance off its own goal
//    (it never stacks on the keeper) and only the NEAREST one or two players
//    press the ball — the rest cover and slide toward the ball's lane.
// It NEVER touches the engine, never calls Math.random (its own id-seeded PRNG
// keeps a match animating identically), and persists nothing.
//
// Coordinates: 0-100, home goal at y=0, away goal at y=100. Home attacks +y.
// "Depth" is per-team distance toward the opponent goal (0 = own goal, 100 = theirs).

import {
  FORMATION_POSITIONS,
  type Match,
  type Club,
  type Player,
  type MatchEvent,
  type MatchTimeline,
  type MatchBeat,
  type ChoreoPlayer,
  type PitchPoint,
  type PitchMotionKind,
  type FormationSlot,
  type Position,
  type TacticalInstructions,
} from '@/types/game';
import { PITCH_CHOREO, DEFAULT_PITCH_TACTICS, MENTALITY_PUSH } from '@/config/pitchChoreography';

// ── Deterministic PRNG (mulberry32) ──
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h ^ 0x9e3779b9) >>> 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const advancement = (team: 'home' | 'away', y: number) => (team === 'home' ? y : 100 - y);
const depthToY = (team: 'home' | 'away', depth: number) => (team === 'home' ? depth : 100 - depth);

const GOAL_EVENTS = new Set<MatchEvent['type']>([
  'goal', 'own_goal', 'penalty_scored', 'header_goal', 'solo_goal',
  'long_range_goal', 'counter_attack_goal', 'free_kick_goal', 'extra_time_goal',
]);
const SHOT_EVENTS = new Set<MatchEvent['type']>([
  'shot_saved', 'shot_missed', 'hit_woodwork', 'goal_line_clearance',
  'goalkeeper_error', 'penalty_missed',
]);
const SETPIECE_EVENTS = new Set<MatchEvent['type']>(['free_kick_goal', 'penalty_scored', 'penalty_missed']);
const DUEL_EVENTS = new Set<MatchEvent['type']>(['foul', 'yellow_card', 'red_card', 'var_check', 'var_disallowed']);
const SIDELINE_EVENTS = new Set<MatchEvent['type']>(['injury', 'substitution']);

const WIDE_POS = new Set<Position>(['LB', 'RB', 'LM', 'RM', 'LW', 'RW']);
const WINGER_POS = new Set<Position>(['LM', 'RM', 'LW', 'RW']);
const FULLBACK_POS = new Set<Position>(['LB', 'RB']);

interface BasePlayer {
  id: string | null;
  pos: Position;
  number: number;
  base: PitchPoint;
}

/** Resolve a team's resting positions in home-oriented coords, shaped by tactics. */
function baseTeam(club: Club, team: 'home' | 'away', tactics: TacticalInstructions): BasePlayer[] {
  const slots: FormationSlot[] = FORMATION_POSITIONS[club.formation] || FORMATION_POSITIONS['4-4-2'];
  const lineup = club.lineup || [];
  const lineShift = tactics.defensiveLine === 'high' ? PITCH_CHOREO.LINE_HIGH
    : tactics.defensiveLine === 'deep' ? -PITCH_CHOREO.LINE_DEEP : 0;
  const widthDir = tactics.width === 'wide' ? 1 : tactics.width === 'narrow' ? -1 : 0;
  return slots.map((slot, i) => {
    let x = slot.x;
    if (widthDir !== 0 && WIDE_POS.has(slot.pos)) {
      x += widthDir * PITCH_CHOREO.WIDTH_PUSH * (slot.x < 50 ? -1 : 1);
    }
    const ownHalfY = clamp(slot.y + (slot.pos === 'GK' ? 0 : lineShift), 2, 96) * PITCH_CHOREO.HALF_SCALE;
    const base: PitchPoint = team === 'home'
      ? { x: clamp(x, 4, 96), y: ownHalfY }
      : { x: clamp(100 - x, 4, 96), y: 100 - ownHalfY };
    return { id: lineup[i] ?? null, pos: slot.pos, number: i + 1, base };
  });
}

interface PlaceOpts {
  /** Continuous time (beat seq) driving the smooth idle sway. */
  phaseTime: number;
  lookup?: Record<string, Player>;
  /** Kickoff/restart posture: both teams in resting formation, ball ignored. */
  kickoff?: boolean;
  /** Extra forward push for the attacking team (advances as it keeps the ball). */
  extraPush?: number;
}

/** Where a carrier of `pos` drives the ball from its resting position. */
function carrierSpot(carrier: BasePlayer, possession: 'home' | 'away', tactics: TacticalInstructions, extraPush: number): PitchPoint {
  const baseDepth = advancement(possession, carrier.base.y);
  const ment = (MENTALITY_PUSH[tactics.mentality] - 1) * 12 + extraPush;
  let depth = clamp(baseDepth + PITCH_CHOREO.CARRIER_PUSH + ment, 8, 90);
  let x = carrier.base.x;
  const pos = carrier.pos;
  if (WINGER_POS.has(pos)) {
    x = x < 50 ? lerp(x, 8, 0.6) : lerp(x, 92, 0.6);
    depth = clamp(depth + 6, 32, 92);
  } else if (FULLBACK_POS.has(pos)) {
    x = x < 50 ? lerp(x, 10, 0.4) : lerp(x, 90, 0.4);
    depth = clamp(depth, baseDepth, 88);
  } else if (pos === 'ST') {
    x = lerp(x, 50, 0.35);
    depth = clamp(Math.max(depth, PITCH_CHOREO.BOX_Y - 4), 55, 92);
  } else if (pos === 'CAM') {
    x = lerp(x, 50, 0.25);
    depth = clamp(Math.max(depth, PITCH_CHOREO.ATTACK_THIRD_Y - 4), 48, 90);
  }
  return { x: clamp(x, 5, 95), y: depthToY(possession, depth) };
}

/**
 * Position all 22 players for a beat given the ball location: the possessing
 * team takes up attacking shape around the ball; the defending team holds a
 * line and presses with its nearest one or two players. Smooth deterministic
 * sway keeps everyone alive between beats.
 */
function placeBeatPlayers(
  baseHome: BasePlayer[], baseAway: BasePlayer[],
  possession: 'home' | 'away',
  homeTactics: TacticalInstructions, awayTactics: TacticalInstructions,
  ball: PitchPoint,
  removed: Set<string>, highlight: Set<string>, o: PlaceOpts,
): ChoreoPlayer[] {
  const out: ChoreoPlayer[] = [];

  const emit = (p: BasePlayer, team: 'home' | 'away', x: number, y: number) => {
    const isGK = p.pos === 'GK';
    const seedp = (team === 'home' ? 1 : 101) + p.number * 7;
    const amp = isGK ? PITCH_CHOREO.SWAY_AMP * PITCH_CHOREO.GK_SWAY_FACTOR : PITCH_CHOREO.SWAY_AMP;
    const swayX = amp * Math.sin(seedp * 0.7 + o.phaseTime * PITCH_CHOREO.SWAY_FREQ);
    const swayY = amp * Math.cos(seedp * 1.3 + o.phaseTime * PITCH_CHOREO.SWAY_FREQ);
    out.push({
      id: p.id,
      team,
      pos: p.pos,
      number: p.number,
      name: p.id ? o.lookup?.[p.id]?.lastName : undefined,
      point: { x: clamp(x + swayX, 2, 98), y: clamp(y + swayY, 2, 98) },
      highlighted: p.id != null && highlight.has(p.id),
    });
  };

  const placeResting = (squad: BasePlayer[], team: 'home' | 'away') => {
    for (const p of squad) {
      if (p.id && removed.has(p.id)) continue;
      emit(p, team, p.base.x, p.base.y);
    }
  };

  const placeAttack = (squad: BasePlayer[], team: 'home' | 'away', tactics: TacticalInstructions) => {
    const ment = (MENTALITY_PUSH[tactics.mentality] - 1) * 12 + (o.extraPush ?? 0);
    const ballDepth = advancement(team, ball.y);
    const placed: { p: BasePlayer; x: number; y: number }[] = [];
    for (const p of squad) {
      if (p.id && removed.has(p.id)) continue;
      const baseDepth = advancement(team, p.base.y);
      const lane = p.base.x;
      let x = lane;
      let depth = baseDepth;
      if (p.pos === 'GK') {
        x = 50 + (ball.x - 50) * 0.06;
        depth = 4;
      } else if (FULLBACK_POS.has(p.pos)) {
        x = lane < 50 ? lerp(lane, 9, 0.5) : lerp(lane, 91, 0.5);
        depth = clamp(lerp(baseDepth, ballDepth, 0.55) + ment * 0.5, baseDepth, 88);
      } else if (WINGER_POS.has(p.pos)) {
        x = lane < 50 ? lerp(lane, 7, 0.6) : lerp(lane, 93, 0.6);
        depth = clamp(Math.max(baseDepth, ballDepth + 3) + ment, 32, 92);
      } else if (p.pos === 'ST') {
        x = lerp(lane, 50, 0.45);
        depth = clamp(Math.max(baseDepth, PITCH_CHOREO.BOX_Y) + ment, 58, 93);
      } else if (p.pos === 'CAM') {
        x = lerp(lane, 50, 0.3);
        depth = clamp(Math.max(baseDepth, PITCH_CHOREO.ATTACK_THIRD_Y) + ment, 50, 90);
      } else {
        // CB / CDM / CM: support, stay a touch behind the ball.
        x = lerp(lane, ball.x, 0.18);
        depth = clamp(baseDepth + 10 + ment * 0.6, baseDepth, Math.max(baseDepth, ballDepth - 4));
      }
      placed.push({ p, x, y: depthToY(team, depth) });
    }
    // Nearest non-carrier offers a short passing option.
    let nearest: { p: BasePlayer; x: number; y: number } | null = null;
    let nd = Infinity;
    for (const q of placed) {
      if (q.p.pos === 'GK' || (q.p.id && highlight.has(q.p.id))) continue;
      const d = (q.x - ball.x) ** 2 + (q.y - ball.y) ** 2;
      if (d < nd) { nd = d; nearest = q; }
    }
    if (nearest) {
      nearest.x = lerp(nearest.x, ball.x, PITCH_CHOREO.SUPPORT_PULL);
      nearest.y = lerp(nearest.y, ball.y, PITCH_CHOREO.SUPPORT_PULL);
    }
    for (const q of placed) emit(q.p, team, q.x, q.y);
  };

  const placeDefend = (squad: BasePlayer[], team: 'home' | 'away') => {
    const ballDepthDef = advancement(team, ball.y); // low = ball near their own goal
    const lineDepth = clamp(ballDepthDef - PITCH_CHOREO.LINE_BALL_OFFSET, PITCH_CHOREO.LINE_MIN_DEPTH, PITCH_CHOREO.LINE_MAX_DEPTH);
    const lineShift = lineDepth - PITCH_CHOREO.BACKLINE_BASE;
    const outfield = squad.filter(p => p.pos !== 'GK' && !(p.id && removed.has(p.id)));
    const ranked = outfield
      .map(p => ({ p, d: (p.base.x - ball.x) ** 2 + (p.base.y - ball.y) ** 2 }))
      .sort((a, b) => a.d - b.d);
    const k = ballDepthDef < PITCH_CHOREO.PRESS_NEAR_THRESHOLD ? 2 : 1;
    const pressers = new Set(ranked.slice(0, k).map(r => r.p));
    for (const p of squad) {
      if (p.id && removed.has(p.id)) continue;
      const baseDepth = advancement(team, p.base.y);
      if (p.pos === 'GK') {
        emit(p, team, 50 + (ball.x - 50) * 0.12, depthToY(team, 4));
      } else if (pressers.has(p)) {
        const x = lerp(p.base.x, ball.x, PITCH_CHOREO.PRESS_PULL);
        const depth = lerp(baseDepth + lineShift, ballDepthDef, PITCH_CHOREO.PRESS_PULL);
        emit(p, team, x, depthToY(team, clamp(depth, 5, 95)));
      } else {
        const x = lerp(p.base.x, ball.x, PITCH_CHOREO.COMPACT_X);
        emit(p, team, x, depthToY(team, clamp(baseDepth + lineShift, 5, 92)));
      }
    }
  };

  if (o.kickoff) {
    placeResting(baseHome, 'home');
    placeResting(baseAway, 'away');
    return out;
  }
  if (possession === 'home') {
    placeAttack(baseHome, 'home', homeTactics);
    placeDefend(baseAway, 'away');
  } else {
    placeDefend(baseHome, 'home');
    placeAttack(baseAway, 'away', awayTactics);
  }
  return out;
}

/** Build a forward-progressing chain of carriers for a possession, weighted
 *  toward better passers, ending at `endId` (the event's player) if supplied. */
function pickChain(
  squad: BasePlayer[], possession: 'home' | 'away', endId: string | null | undefined,
  count: number, rng: () => number, lookup?: Record<string, Player>,
): BasePlayer[] {
  if (!squad.length) return [];
  const sorted = [...squad].sort((a, b) => advancement(possession, a.base.y) - advancement(possession, b.base.y));
  const chain: BasePlayer[] = [];
  for (let k = 0; k < count; k++) {
    const lo = Math.floor((k / count) * sorted.length);
    const hi = Math.min(sorted.length - 1, Math.floor(((k + 1) / count) * sorted.length));
    const band = sorted.slice(lo, hi + 1);
    if (!band.length) continue;
    let pick = band[Math.floor(rng() * band.length)];
    if (lookup) {
      let best = -1;
      for (const c of band) {
        const w = (lookup[c.id as string]?.attributes.passing ?? 60) * (0.6 + rng() * 0.8);
        if (w > best) { best = w; pick = c; }
      }
    }
    if (!chain.includes(pick)) chain.push(pick);
  }
  if (endId) {
    const end = squad.find(p => p.id === endId);
    if (end && chain[chain.length - 1] !== end) chain.push(end);
  }
  return chain.length ? chain : [sorted[sorted.length - 1]];
}

interface BuildOpts {
  tactics?: { home: TacticalInstructions; away: TacticalInstructions };
  players?: Record<string, Player>;
}

/**
 * Build a deterministic 2.5D motion timeline from a finished match.
 * Pure: same (id, events, tactics) → same timeline, every time.
 */
export function buildMatchTimeline(match: Match, homeClub: Club, awayClub: Club, opts: BuildOpts = {}): MatchTimeline {
  const events = match.events || [];
  const seed = hashString(match.id || '');
  const rng = makeRng(seed);
  const homeTactics = opts.tactics?.home ?? homeClub.aiManagerProfile?.defaultTactics ?? DEFAULT_PITCH_TACTICS;
  const awayTactics = opts.tactics?.away ?? awayClub.aiManagerProfile?.defaultTactics ?? DEFAULT_PITCH_TACTICS;
  const lookup = opts.players;
  const baseHome = baseTeam(homeClub, 'home', homeTactics);
  const baseAway = baseTeam(awayClub, 'away', awayTactics);
  const removed = new Set<string>();
  const beats: MatchBeat[] = [];
  let seq = 0;
  let momentum = 0;
  let prevPossession: 'home' | 'away' | null = null;

  const byMinute = new Map<number, MatchEvent[]>();
  let lastMinute = 0;
  for (const e of events) {
    lastMinute = Math.max(lastMinute, e.minute);
    const bucket = byMinute.get(e.minute);
    if (bucket) bucket.push(e);
    else byMinute.set(e.minute, [e]);
  }
  const maxMin = Math.max(90, lastMinute);

  const pushBeat = (
    minute: number, eventType: MatchEvent['type'] | null, possession: 'home' | 'away',
    ball: PitchPoint, ballCarrierId: string | null, motion: PitchMotionKind, zoom: number,
    players: ChoreoPlayer[], highlight: Set<string>, caption: string | undefined,
  ) => {
    beats.push({
      seq: seq++, minute, eventType, possession, ballCarrierId,
      ball, ballMotion: motion, ballArc: PITCH_CHOREO.ARC[motion] ?? 0,
      camera: { focus: ball, zoom }, players, highlightIds: Array.from(highlight),
      caption, durationMs: GOAL_EVENTS.has(eventType as MatchEvent['type']) ? PITCH_CHOREO.GOAL_BEAT_MS : PITCH_CHOREO.BEAT_MS,
    });
  };

  const zoomFor = (possession: 'home' | 'away', p: PitchPoint) => {
    const adv = advancement(possession, p.y);
    return adv > PITCH_CHOREO.BOX_Y - 6 ? PITCH_CHOREO.ZOOM_GOAL
      : adv > PITCH_CHOREO.ATTACK_THIRD_Y - 6 ? PITCH_CHOREO.ZOOM_ATTACK : PITCH_CHOREO.ZOOM_WIDE;
  };

  const highlightFor = (id: string | null) => {
    const h = new Set<string>();
    if (id) h.add(id);
    return h;
  };

  // Emit a pass chain: ball travels carrier→carrier among the possessing team.
  const emitPossession = (minute: number, possession: 'home' | 'away', endId: string | null, captionLast?: string) => {
    const tactics = possession === 'home' ? homeTactics : awayTactics;
    const baseSquad = (possession === 'home' ? baseHome : baseAway)
      .filter(p => p.pos !== 'GK' && p.id && !removed.has(p.id));
    const passes = PITCH_CHOREO.PASSES_BY_TEMPO[tactics.tempo] ?? 2;
    const chain = pickChain(baseSquad, possession, endId, passes, rng, lookup);
    chain.forEach((carrier, idx) => {
      const extraPush = Math.min(idx * PITCH_CHOREO.POSSESSION_ADVANCE, PITCH_CHOREO.POSSESSION_ADVANCE_MAX);
      const ball = carrierSpot(carrier, possession, tactics, extraPush);
      const hl = highlightFor(carrier.id);
      const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, ball, removed, hl, { phaseTime: seq, lookup, extraPush });
      const self = players.find(p => p.id === carrier.id);
      if (self) self.point = { ...ball }; // carrier sits exactly on the ball
      const motion: PitchMotionKind = idx === 0 ? 'dribble' : 'pass';
      pushBeat(minute, null, possession, { ...ball }, carrier.id, motion, zoomFor(possession, ball),
        players, hl, idx === chain.length - 1 ? captionLast : undefined);
    });
    return chain[chain.length - 1]?.id ?? null;
  };

  // A turnover: a central player of the team that just won the ball steps onto
  // it in their own middle third, before they build. Sells the change of hands.
  const emitTurnover = (minute: number, possession: 'home' | 'away') => {
    const squad = (possession === 'home' ? baseHome : baseAway)
      .filter(p => p.pos !== 'GK' && p.id && !removed.has(p.id));
    if (!squad.length) return;
    let winner = squad[0];
    let bestScore = Infinity;
    for (const p of squad) {
      const score = Math.abs(advancement(possession, p.base.y) - 32) + Math.abs(p.base.x - 50) * 0.5;
      if (score < bestScore) { bestScore = score; winner = p; }
    }
    const depth = clamp(advancement(possession, winner.base.y), 16, 42);
    const ball = { x: clamp(lerp(winner.base.x, 50, 0.3), 8, 92), y: depthToY(possession, depth) };
    const hl = highlightFor(winner.id);
    const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, ball, removed, hl, { phaseTime: seq, lookup });
    const self = players.find(p => p.id === winner.id);
    if (self) self.point = { ...ball };
    pushBeat(minute, null, possession, { ...ball }, winner.id, 'idle', PITCH_CHOREO.ZOOM_WIDE, players, hl, undefined);
  };

  // Always open on the team's actual formation shape (resting, both halves).
  pushBeat(0, null, 'home', { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE,
    placeBeatPlayers(baseHome, baseAway, 'home', homeTactics, awayTactics, { x: 50, y: 50 }, removed, new Set(), { phaseTime: 0, lookup, kickoff: true }),
    new Set(), undefined);

  for (let minute = 0; minute <= maxMin; minute++) {
    const evs = byMinute.get(minute);
    if (evs && evs.length) {
      for (const ev of evs) {
        if (typeof ev.momentum === 'number') momentum = ev.momentum;
        const isHome = ev.clubId === homeClub.id;
        const possession: 'home' | 'away' = isHome ? 'home' : 'away';
        const club = isHome ? homeClub : awayClub;

        if (GOAL_EVENTS.has(ev.type) || SHOT_EVENTS.has(ev.type)) {
          const shooterId = SETPIECE_EVENTS.has(ev.type)
            ? (ev.type === 'penalty_scored' || ev.type === 'penalty_missed' ? club.penaltyTakerId : club.setPieceTakerId) || ev.playerId || null
            : ev.playerId || null;
          emitPossession(minute, possession, shooterId ?? null);
          // Strike: ball at the goal mouth, both teams swarm the box.
          const acc = lookup && shooterId ? (lookup[shooterId]?.attributes.shooting ?? 65) : 65;
          const spread = (1 - acc / 100) * 24;
          const gx = clamp(50 + (rng() * 2 - 1) * spread, 8, 92);
          const goalY = possession === 'home' ? PITCH_CHOREO.BOX_Y + 6 : 100 - (PITCH_CHOREO.BOX_Y + 6);
          const goalPoint = { x: gx, y: clamp(goalY, 2, 98) };
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          if (ev.assistPlayerId) hl.add(ev.assistPlayerId);
          if (ev.goalkeeperId) hl.add(ev.goalkeeperId);
          const shotPlayers = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, goalPoint, removed, hl, { phaseTime: seq, lookup, extraPush: PITCH_CHOREO.POSSESSION_ADVANCE_MAX });
          pushBeat(minute, ev.type, possession, goalPoint, null, 'shot', PITCH_CHOREO.ZOOM_GOAL, shotPlayers, hl, ev.description);
          if (GOAL_EVENTS.has(ev.type)) {
            // Centre restart by the conceding team after a goal.
            const conceding: 'home' | 'away' = possession === 'home' ? 'away' : 'home';
            const restartPlayers = placeBeatPlayers(baseHome, baseAway, conceding, homeTactics, awayTactics, { x: 50, y: 50 }, removed, new Set(), { phaseTime: seq, lookup, kickoff: true });
            pushBeat(minute, null, conceding, { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE, restartPlayers, new Set(), undefined);
            prevPossession = conceding;
          } else {
            // After a shot the other team restarts (keeper / goal kick).
            prevPossession = isHome ? 'away' : 'home';
          }
        } else if (DUEL_EVENTS.has(ev.type)) {
          // A foul/card free kick goes to the OTHER (non-offending) team.
          const offence = ev.type === 'foul' || ev.type === 'yellow_card' || ev.type === 'red_card';
          const beatPossession: 'home' | 'away' = offence ? (isHome ? 'away' : 'home') : possession;
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          const ball = { x: clamp(50 + (rng() * 2 - 1) * 18, 10, 90), y: 50 };
          const players = placeBeatPlayers(baseHome, baseAway, beatPossession, homeTactics, awayTactics, ball, removed, hl, { phaseTime: seq, lookup });
          const self = ev.playerId ? players.find(p => p.id === ev.playerId) : null;
          const ballAt = self ? { ...self.point } : ball;
          pushBeat(minute, ev.type, beatPossession, ballAt, ev.playerId ?? null, 'idle', PITCH_CHOREO.ZOOM_WIDE, players, hl, ev.description);
          prevPossession = beatPossession;
        } else if (SIDELINE_EVENTS.has(ev.type)) {
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          const ball = { x: rng() < 0.5 ? 6 : 94, y: PITCH_CHOREO.MIDFIELD_Y };
          const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, ball, removed, hl, { phaseTime: seq, lookup });
          pushBeat(minute, ev.type, possession, ball, null, 'idle', PITCH_CHOREO.ZOOM_WIDE, players, hl, ev.description);
          if (ev.type === 'substitution' && ev.playerId && ev.assistPlayerId) {
            const squad = isHome ? baseHome : baseAway;
            const slot = squad.find(p => p.id === ev.assistPlayerId);
            if (slot) slot.id = ev.playerId; // incoming takes the outgoing slot
          }
        } else {
          // Ambient: kickoff/half-time reset to the formation shape.
          const isReset = ev.type === 'kickoff' || ev.type === 'half_time';
          const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, { x: 50, y: 50 }, removed, new Set(), { phaseTime: seq, lookup, kickoff: isReset });
          pushBeat(minute, ev.type, possession, { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE, players, new Set(), ev.description);
          prevPossession = possession;
        }

        if (ev.type === 'red_card' && ev.playerId) removed.add(ev.playerId);
      }
    } else {
      // Possession ebbs and flows, biased by momentum (50/50 at neutral), with a
      // turnover beat whenever the ball changes hands — so an even game looks even.
      const pHome = clamp(0.5 + momentum / 200, 0.1, 0.9);
      const possession: 'home' | 'away' = rng() < pHome ? 'home' : 'away';
      if (prevPossession && possession !== prevPossession) emitTurnover(minute, possession);
      emitPossession(minute, possession, null);
      prevPossession = possession;
    }
  }

  return {
    matchId: match.id,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    homeColor: homeClub.color,
    awayColor: awayClub.color,
    seed,
    beats,
  };
}
