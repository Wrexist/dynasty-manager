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
  // A keeper error is a scoring event in the engine (GOAL_EVENT_TYPES) — it must
  // get the goal staging + centre restart, not the missed-shot branch.
  'goalkeeper_error',
]);
const SHOT_EVENTS = new Set<MatchEvent['type']>([
  'shot_saved', 'shot_missed', 'hit_woodwork', 'goal_line_clearance', 'penalty_missed',
]);
const SETPIECE_EVENTS = new Set<MatchEvent['type']>(['free_kick_goal', 'penalty_scored', 'penalty_missed']);
const DUEL_EVENTS = new Set<MatchEvent['type']>(['foul', 'yellow_card', 'red_card', 'var_check', 'var_disallowed']);
const SIDELINE_EVENTS = new Set<MatchEvent['type']>(['injury', 'substitution']);

const WIDE_POS = new Set<Position>(['LB', 'RB', 'LM', 'RM', 'LW', 'RW']);
const WINGER_POS = new Set<Position>(['LM', 'RM', 'LW', 'RW']);
const FULLBACK_POS = new Set<Position>(['LB', 'RB']);

/** Extract a new mentality from an AI tactical-change description, if present. */
function mentalityFromText(text: string): TacticalInstructions['mentality'] | null {
  const t = (text || '').toLowerCase();
  if (t.includes('all-out') || t.includes('all out')) return 'all-out-attack';
  if (t.includes('attacking')) return 'attacking';
  if (t.includes('defensive')) return 'defensive';
  if (t.includes('cautious')) return 'cautious';
  if (t.includes('balanced')) return 'balanced';
  return null;
}

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
      overall: p.id ? o.lookup?.[p.id]?.overall : undefined,
      // Per-player burst = pace, scaled down by fatigue so a tired squad visibly
      // lumbers (fitness 100 → full pace; fitness 0 → ~22% slower).
      speed: p.id && o.lookup?.[p.id]
        ? clamp(((o.lookup[p.id].attributes?.pace ?? 50) / 100) * (0.78 + 0.22 * ((o.lookup[p.id].fitness ?? 100) / 100)), 0, 1)
        : undefined,
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
    // Offside line: the defending team's last man, derived from the ball's
    // advancement (defenders drop with the ball). No attacker may stand beyond
    // it — this is what stops strikers camping on the goal-line during a
    // midfield phase. Attacking mentalities gamble the line higher.
    const offside = clamp(
      ballDepth + PITCH_CHOREO.OFFSIDE_LEAD + (MENTALITY_PUSH[tactics.mentality] - 1) * PITCH_CHOREO.OFFSIDE_MENT,
      PITCH_CHOREO.OFFSIDE_MIN,
      PITCH_CHOREO.OFFSIDE_MAX,
    );
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
      // Off-ball runs for the front line (never the carrier): a slow, deterministic
      // diagonal run into space — lateral sweep + a forward surge toward goal — so
      // attackers peel off and check back instead of standing on a fixed mark.
      const isCarrier = p.id != null && highlight.has(p.id);
      if (!isCarrier && (WINGER_POS.has(p.pos) || p.pos === 'ST' || p.pos === 'CAM')) {
        const phase = o.phaseTime * PITCH_CHOREO.RUN_CYCLE_FREQ + p.number * 1.3;
        x = clamp(x + Math.sin(phase) * PITCH_CHOREO.RUN_LATERAL_AMP, 5, 95);
        depth = clamp(depth + Math.max(0, Math.cos(phase)) * PITCH_CHOREO.RUN_FORWARD_AMP, 5, 95);
      }
      // Hold the line: cap every outfielder at the offside line (deep players sit
      // well below it and are untouched). Applied after off-ball runs so a run
      // can't surge a forward beyond the last defender.
      if (p.pos !== 'GK') depth = Math.min(depth, offside);
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
        // The keeper dives across toward a close ball (a shot), otherwise just
        // shuffles along the line with play.
        const follow = ballDepthDef < 22 ? 0.55 : 0.12;
        emit(p, team, 50 + (ball.x - 50) * follow, depthToY(team, 4));
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

/** Build a chain of carriers for a possession, weighted toward better passers,
 *  ending at `endId` (the event's player) if supplied.
 *
 *  Two modes:
 *   • Default (no `flow`) — the chain spans the whole squad deep→forward, i.e. a
 *     full-pitch build-up. Used by event build-ups (a goal/shot move).
 *   • `flow` set — all carriers are drawn from a tight band centred on the
 *     possession's current *flow line* (`centerFrac`, 0 = deepest, 1 = most
 *     advanced). The ball short-passes around that line (lateral, same depth);
 *     forward progress is made BETWEEN minutes by advancing the line. This is
 *     what makes open play flow continuously instead of resetting to the back
 *     line every minute. */
function pickChain(
  squad: BasePlayer[], possession: 'home' | 'away', endId: string | null | undefined,
  count: number, rng: () => number, lookup?: Record<string, Player>,
  flow?: { centerFrac: number; halfWidth: number },
): BasePlayer[] {
  if (!squad.length) return [];
  const sorted = [...squad].sort((a, b) => advancement(possession, a.base.y) - advancement(possession, b.base.y));
  const chain: BasePlayer[] = [];
  for (let k = 0; k < count; k++) {
    let f0: number, f1: number;
    if (flow) {
      f0 = clamp(flow.centerFrac - flow.halfWidth, 0, 1);
      f1 = clamp(flow.centerFrac + flow.halfWidth, 0, 1);
    } else {
      f0 = k / count;
      f1 = (k + 1) / count;
    }
    const lo = Math.floor(f0 * sorted.length);
    const hi = Math.min(sorted.length - 1, Math.floor(f1 * sorted.length));
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
  const homeTactics0 = opts.tactics?.home ?? homeClub.aiManagerProfile?.defaultTactics ?? DEFAULT_PITCH_TACTICS;
  const awayTactics0 = opts.tactics?.away ?? awayClub.aiManagerProfile?.defaultTactics ?? DEFAULT_PITCH_TACTICS;
  // Mutable so mid-match AI tactical changes reshape the block.
  let homeTactics = homeTactics0;
  let awayTactics = awayTactics0;
  const lookup = opts.players;
  const baseHome = baseTeam(homeClub, 'home', homeTactics);
  const baseAway = baseTeam(awayClub, 'away', awayTactics);
  const removed = new Set<string>();
  const beats: MatchBeat[] = [];
  let seq = 0;
  let momentum = 0;
  let prevPossession: 'home' | 'away' | null = null;
  // Continuous-possession flow: how far up the pitch (band fraction) the team in
  // possession currently is, persisted across minutes so retained possession
  // flows upfield instead of snapping back to the defenders every minute.
  let flowFrac: number = PITCH_CHOREO.FLOW_START;
  let flowTeam: 'home' | 'away' | null = null;

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
  // `flow` windows the chain up the pitch for a continuing possession (so the
  // move flows forward instead of restarting deep); omitted on event build-ups,
  // which still build from the back for a full-pitch attacking move.
  const emitPossession = (
    minute: number, possession: 'home' | 'away', endId: string | null,
    captionLast?: string, flow?: { centerFrac: number; halfWidth: number },
  ) => {
    const tactics = possession === 'home' ? homeTactics : awayTactics;
    const baseSquad = (possession === 'home' ? baseHome : baseAway)
      .filter(p => p.pos !== 'GK' && p.id && !removed.has(p.id));
    const passes = PITCH_CHOREO.PASSES_BY_TEMPO[tactics.tempo] ?? 2;
    const chain = pickChain(baseSquad, possession, endId, passes, rng, lookup, flow);
    chain.forEach((carrier, idx) => {
      const extraPush = Math.min(idx * PITCH_CHOREO.POSSESSION_ADVANCE, PITCH_CHOREO.POSSESSION_ADVANCE_MAX);
      const ball = carrierSpot(carrier, possession, tactics, extraPush);
      // In flow mode, anchor the ball's depth to the flow line so a pass to a
      // deeper team-mate doesn't lurch it half the pitch back (lateral position
      // is untouched — wingers still drive the touchline).
      if (flow) {
        const lineDepth = clamp(flow.centerFrac * PITCH_CHOREO.FLOW_DEPTH_SCALE, 8, 90);
        const bd = advancement(possession, ball.y);
        ball.y = depthToY(possession, lerp(bd, lineDepth, PITCH_CHOREO.FLOW_DEPTH_PULL));
      }
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

  // Lock the ball to a specific player after the model has positioned everyone.
  const stageWithBallAt = (
    minute: number, possession: 'home' | 'away', ball: PitchPoint, onBallId: string | null,
    motion: PitchMotionKind, zoom: number, highlight: Set<string>,
  ) => {
    const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, ball, removed, highlight, { phaseTime: seq, lookup, extraPush: PITCH_CHOREO.POSSESSION_ADVANCE_MAX });
    if (onBallId) {
      const onBall = players.find(p => p.id === onBallId);
      if (onBall) onBall.point = { ...ball };
    }
    pushBeat(minute, null, possession, { ...ball }, onBallId, motion, zoom, players, highlight, undefined);
  };

  // Fast vertical break: win it deep, then ball into space for the finisher.
  const emitCounter = (minute: number, possession: 'home' | 'away', finisherId: string | null) => {
    const squad = (possession === 'home' ? baseHome : baseAway).filter(p => p.pos !== 'GK' && p.id && !removed.has(p.id));
    if (!squad.length) return;
    const deep = squad.reduce((b, p) => (advancement(possession, p.base.y) < advancement(possession, b.base.y) ? p : b), squad[0]);
    const startBall = { x: clamp(deep.base.x, 8, 92), y: depthToY(possession, clamp(advancement(possession, deep.base.y), 12, 40)) };
    stageWithBallAt(minute, possession, startBall, deep.id, 'longball', PITCH_CHOREO.ZOOM_WIDE, highlightFor(deep.id));
    const target = squad.find(p => p.id === finisherId)
      ?? squad.reduce((b, p) => (advancement(possession, p.base.y) > advancement(possession, b.base.y) ? p : b), squad[0]);
    const spot = carrierSpot(target, possession, possession === 'home' ? homeTactics : awayTactics, PITCH_CHOREO.POSSESSION_ADVANCE_MAX);
    stageWithBallAt(minute, possession, spot, target.id, 'longball', zoomFor(possession, spot), highlightFor(target.id));
  };

  // Corner: ball at the flag, attackers crowd the box, defenders pack the goal.
  const emitCorner = (minute: number, possession: 'home' | 'away', takerId: string | null) => {
    const cornerBall = { x: seq % 2 === 0 ? 6 : 94, y: depthToY(possession, 96) };
    stageWithBallAt(minute, possession, cornerBall, takerId, 'cross', PITCH_CHOREO.ZOOM_GOAL, highlightFor(takerId));
  };

  // Free kick: taker stands over the ball at the edge of the final third.
  const emitFreeKickSetup = (minute: number, possession: 'home' | 'away', takerId: string | null) => {
    const fkBall = { x: clamp(50 + (rng() * 2 - 1) * 20, 20, 80), y: depthToY(possession, 70) };
    stageWithBallAt(minute, possession, fkBall, takerId, 'idle', PITCH_CHOREO.ZOOM_ATTACK, highlightFor(takerId));
  };

  // Penalty arrangement: ball on the spot, taker behind it, defending keeper on
  // the line, everyone else held outside the box at the arc. Reused for the
  // setup beat (ball on spot) and the strike beat (ball at goal).
  const buildPenaltyPlayers = (possession: 'home' | 'away', takerId: string | null, keeperId: string | null): ChoreoPlayer[] => {
    const defending: 'home' | 'away' = possession === 'home' ? 'away' : 'home';
    const players: ChoreoPlayer[] = [];
    const arrange = (squad: BasePlayer[], team: 'home' | 'away') => {
      for (const p of squad) {
        if (p.id && removed.has(p.id)) continue;
        let x = clamp(20 + ((p.number * 11) % 60), 18, 82);
        let depth: number;
        if (p.pos === 'GK') {
          x = 50;
          depth = team === defending ? 3 : 22;
        } else if (p.id != null && p.id === takerId) {
          x = 50;
          depth = 84;
        } else {
          depth = team === possession ? 74 : 18; // arc, on each side of the box
        }
        players.push({
          id: p.id, team, pos: p.pos, number: p.number,
          name: p.id ? lookup?.[p.id]?.lastName : undefined,
          overall: p.id ? lookup?.[p.id]?.overall : undefined,
          point: { x: clamp(x, 2, 98), y: clamp(depthToY(team, depth), 2, 98) },
          highlighted: p.id != null && (p.id === takerId || p.id === keeperId),
        });
      }
    };
    arrange(baseHome, 'home');
    arrange(baseAway, 'away');
    return players;
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
          const isGoal = GOAL_EVENTS.has(ev.type);
          const isPenalty = ev.type === 'penalty_scored' || ev.type === 'penalty_missed';
          const isFreeKick = ev.type === 'free_kick_goal';
          const isCounter = ev.type === 'counter_attack_goal';
          const shooterId = SETPIECE_EVENTS.has(ev.type)
            ? (isPenalty ? club.penaltyTakerId : club.setPieceTakerId) || ev.playerId || null
            : ev.playerId || null;

          // Build-up / set-piece setup.
          if (isPenalty) {
            const penPlayers = buildPenaltyPlayers(possession, shooterId ?? null, ev.goalkeeperId ?? null);
            const penHl = new Set<string>([shooterId, ev.goalkeeperId].filter(Boolean) as string[]);
            pushBeat(minute, null, possession, { x: 50, y: depthToY(possession, 89) }, shooterId ?? null, 'idle', PITCH_CHOREO.ZOOM_GOAL, penPlayers, penHl, undefined);
          } else if (isCounter) {
            emitCounter(minute, possession, shooterId ?? null);
          } else {
            emitPossession(minute, possession, shooterId ?? null);
            if (isFreeKick) emitFreeKickSetup(minute, possession, shooterId ?? null);
          }

          // Strike: ball to the goal mouth.
          const acc = lookup && shooterId ? (lookup[shooterId]?.attributes.shooting ?? 65) : 65;
          const spread = (1 - acc / 100) * 24;
          const gx = clamp(50 + (rng() * 2 - 1) * spread, 8, 92);
          const goalY = possession === 'home' ? PITCH_CHOREO.BOX_Y + 6 : 100 - (PITCH_CHOREO.BOX_Y + 6);
          const goalPoint = { x: gx, y: clamp(goalY, 2, 98) };
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          if (ev.assistPlayerId) hl.add(ev.assistPlayerId);
          if (ev.goalkeeperId) hl.add(ev.goalkeeperId);
          const strikeMotion: PitchMotionKind = isFreeKick ? 'cross' : 'shot';
          const shotPlayers = isPenalty
            ? buildPenaltyPlayers(possession, shooterId ?? null, ev.goalkeeperId ?? null)
            : placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, goalPoint, removed, hl, { phaseTime: seq, lookup, extraPush: PITCH_CHOREO.POSSESSION_ADVANCE_MAX });
          pushBeat(minute, ev.type, possession, goalPoint, null, strikeMotion, PITCH_CHOREO.ZOOM_GOAL, shotPlayers, hl, ev.description);

          if (isGoal) {
            // Centre restart by the conceding team after a goal.
            const conceding: 'home' | 'away' = possession === 'home' ? 'away' : 'home';
            const restartPlayers = placeBeatPlayers(baseHome, baseAway, conceding, homeTactics, awayTactics, { x: 50, y: 50 }, removed, new Set(), { phaseTime: seq, lookup, kickoff: true });
            pushBeat(minute, null, conceding, { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE, restartPlayers, new Set(), undefined);
            prevPossession = conceding;
          } else if (ev.type === 'shot_saved' || ev.type === 'hit_woodwork' || ev.type === 'goal_line_clearance') {
            // Defended attempt → corner; the attacking team keeps it.
            emitCorner(minute, possession, club.setPieceTakerId ?? null);
            prevPossession = possession;
          } else {
            // Missed shot → the other team restarts.
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
          // Live tactics: an AI mentality switch reshapes that team's block.
          if (ev.type === 'ai_tactical_change') {
            const m = mentalityFromText(ev.description);
            if (m) {
              if (isHome) homeTactics = { ...homeTactics, mentality: m };
              else awayTactics = { ...awayTactics, mentality: m };
            }
          }
          // Ambient: kickoff/half-time reset to the formation shape.
          const isReset = ev.type === 'kickoff' || ev.type === 'half_time';
          const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, { x: 50, y: 50 }, removed, new Set(), { phaseTime: seq, lookup, kickoff: isReset });
          pushBeat(minute, ev.type, possession, { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE, players, new Set(), ev.description);
          prevPossession = possession;
        }

        if (ev.type === 'red_card' && ev.playerId) removed.add(ev.playerId);
      }
      // An event break (shot, foul, restart…) interrupts the flow — the next
      // open-play minute (re)builds rather than continuing a stale move.
      flowTeam = null;
    } else {
      // Possession ebbs and flows, biased by momentum (50/50 at neutral) and by
      // inertia (the team on the ball tends to keep it), so play strings into
      // multi-phase moves instead of flipping — and flows upfield, not resetting.
      const base = clamp(0.5 + momentum / 200, 0.1, 0.9);
      const keep = PITCH_CHOREO.POSSESSION_KEEP;
      const pHome = prevPossession === 'home' ? keep + (1 - keep) * base
        : prevPossession === 'away' ? (1 - keep) * base
        : base;
      const possession: 'home' | 'away' = rng() < pHome ? 'home' : 'away';
      const retained = possession === prevPossession;
      if (prevPossession && !retained) emitTurnover(minute, possession);
      // Reset the flow line when the ball changes hands (or after an event break);
      // otherwise keep it where it was so the move continues up the pitch.
      if (!retained || flowTeam !== possession) {
        flowFrac = prevPossession && !retained ? PITCH_CHOREO.FLOW_TURNOVER : PITCH_CHOREO.FLOW_START;
      }
      // Short passes around the current flow line this minute; advance the line
      // forward for next minute (monotonic until a turnover) so the ball flows
      // upfield continuously instead of snapping back to the defenders.
      emitPossession(minute, possession, null, undefined, { centerFrac: flowFrac, halfWidth: PITCH_CHOREO.FLOW_HALF });
      flowFrac = Math.min(flowFrac + PITCH_CHOREO.FLOW_ADVANCE, PITCH_CHOREO.FLOW_MAX);
      flowTeam = possession;
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
