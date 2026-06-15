// MatchChoreographer — the spatial-synthesis layer for the 2.5D pitch view.
//
// The match engine (src/engine/match.ts) emits a flat, non-spatial event list
// and is Math.random-driven. This module is a PURE, DETERMINISTIC transform that
// turns a *finished* Match into a MatchTimeline: a sequence of "beats" carrying
// ball + 22-player positions, motion curves, and camera hints that a renderer
// can interpolate. It NEVER touches the engine, never calls Math.random (its own
// seeded PRNG keeps the same match animating identically), and produces nothing
// that is persisted — so it carries no balance or save-migration risk.
//
// Coordinate convention: 0-100, home goal at y=0, away goal at y=100. Home
// attacks toward +y, away toward 0.

import {
  FORMATION_POSITIONS,
  type Match,
  type Club,
  type MatchEvent,
  type MatchTimeline,
  type MatchBeat,
  type ChoreoPlayer,
  type PitchPoint,
  type PitchMotionKind,
  type FormationSlot,
  type Position,
} from '@/types/game';
import { PITCH_CHOREO } from '@/config/pitchChoreography';

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
  // Avoid a zero seed (mulberry32 still works at 0, but a non-zero start is tidier).
  return (h ^ 0x9e3779b9) >>> 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const GOAL_EVENTS = new Set<MatchEvent['type']>([
  'goal', 'own_goal', 'penalty_scored', 'header_goal', 'solo_goal',
  'long_range_goal', 'counter_attack_goal', 'free_kick_goal', 'extra_time_goal',
]);
const SHOT_EVENTS = new Set<MatchEvent['type']>([
  'shot_saved', 'shot_missed', 'hit_woodwork', 'goal_line_clearance',
  'goalkeeper_error', 'penalty_missed',
]);
const DUEL_EVENTS = new Set<MatchEvent['type']>([
  'foul', 'yellow_card', 'red_card', 'var_check', 'var_disallowed',
]);
const SIDELINE_EVENTS = new Set<MatchEvent['type']>(['injury', 'substitution']);

interface BasePlayer {
  id: string | null;
  pos: Position;
  number: number;
  base: PitchPoint;
}

/** Resolve a team's resting formation positions in home-oriented pitch coords. */
function baseTeam(club: Club, team: 'home' | 'away'): BasePlayer[] {
  const slots: FormationSlot[] = FORMATION_POSITIONS[club.formation] || FORMATION_POSITIONS['4-4-2'];
  const lineup = club.lineup || [];
  return slots.map((slot, i) => {
    const ownHalfY = slot.y * PITCH_CHOREO.HALF_SCALE; // 0..~41 (own half)
    const base: PitchPoint = team === 'home'
      ? { x: slot.x, y: ownHalfY }
      : { x: 100 - slot.x, y: 100 - ownHalfY };
    return { id: lineup[i] ?? null, pos: slot.pos, number: i + 1, base };
  });
}

interface Stage {
  ball: PitchPoint;
  motion: PitchMotionKind;
  zoom: number;
}

/** Map an event's semantics to a staged ball location (no coordinates exist in
 *  the event itself). `isHome` flips the attacking direction. */
function stageEvent(ev: MatchEvent, isHome: boolean, rng: () => number): Stage {
  const cx = 50 + (rng() * 2 - 1) * 16;
  const mirrorY = (y: number) => (isHome ? y : 100 - y);
  if (GOAL_EVENTS.has(ev.type)) {
    return { ball: { x: clamp(cx, 6, 94), y: mirrorY(PITCH_CHOREO.BOX_Y) }, motion: 'shot', zoom: PITCH_CHOREO.ZOOM_GOAL };
  }
  if (SHOT_EVENTS.has(ev.type)) {
    return { ball: { x: clamp(cx, 8, 92), y: mirrorY(PITCH_CHOREO.ATTACK_THIRD_Y + 8) }, motion: 'shot', zoom: PITCH_CHOREO.ZOOM_ATTACK };
  }
  if (DUEL_EVENTS.has(ev.type)) {
    return { ball: { x: clamp(cx, 10, 90), y: mirrorY(PITCH_CHOREO.MIDFIELD_Y + 6) }, motion: 'idle', zoom: PITCH_CHOREO.ZOOM_WIDE };
  }
  if (SIDELINE_EVENTS.has(ev.type)) {
    return { ball: { x: rng() < 0.5 ? 6 : 94, y: PITCH_CHOREO.MIDFIELD_Y }, motion: 'idle', zoom: PITCH_CHOREO.ZOOM_WIDE };
  }
  // Ambient (kickoff, full_time, commentary, …): centre circle.
  return { ball: { x: 50, y: 50 }, motion: 'restart', zoom: PITCH_CHOREO.ZOOM_WIDE };
}

/** Keep-ball filler between events so motion never freezes. */
function stagePossession(possession: 'home' | 'away', rng: () => number): Stage {
  const isHome = possession === 'home';
  const y = lerp(PITCH_CHOREO.MIDFIELD_Y - 6, PITCH_CHOREO.ATTACK_THIRD_Y, rng());
  return {
    ball: { x: clamp(20 + rng() * 60, 6, 94), y: isHome ? y : 100 - y },
    motion: rng() < 0.5 ? 'pass' : 'dribble',
    zoom: y > PITCH_CHOREO.ATTACK_THIRD_Y - 6 ? PITCH_CHOREO.ZOOM_ATTACK : PITCH_CHOREO.ZOOM_WIDE,
  };
}

/** Position all 22 players for a beat: rest pose + attack/defend block shift +
 *  breathing jitter, with highlighted players pulled toward the ball. */
function placeBeatPlayers(
  baseHome: BasePlayer[],
  baseAway: BasePlayer[],
  possession: 'home' | 'away',
  ball: PitchPoint,
  removed: Set<string>,
  highlight: Set<string>,
  rng: () => number,
): ChoreoPlayer[] {
  const attackDir = possession === 'home' ? 1 : -1; // toward the defended goal
  const out: ChoreoPlayer[] = [];
  const place = (squad: BasePlayer[], team: 'home' | 'away') => {
    const attacking = team === possession;
    const shift = attackDir * (attacking ? PITCH_CHOREO.ATTACK_SHIFT : PITCH_CHOREO.DEFEND_SHIFT);
    for (const p of squad) {
      if (p.id && removed.has(p.id)) continue;
      const isGK = p.pos === 'GK';
      const j = isGK ? PITCH_CHOREO.GK_JITTER : PITCH_CHOREO.JITTER;
      const appliedShift = isGK ? shift * PITCH_CHOREO.GK_SHIFT_FACTOR : shift;
      let x = p.base.x + (rng() * 2 - 1) * j;
      let y = p.base.y + appliedShift + (rng() * 2 - 1) * j;
      const isHi = p.id != null && highlight.has(p.id);
      if (isHi) {
        x = lerp(x, ball.x, PITCH_CHOREO.HIGHLIGHT_PULL_X);
        y = lerp(y, ball.y, PITCH_CHOREO.HIGHLIGHT_PULL_Y);
      }
      out.push({
        id: p.id,
        team,
        pos: p.pos,
        number: p.number,
        point: { x: clamp(x, 2, 98), y: clamp(y, 2, 98) },
        highlighted: isHi,
      });
    }
  };
  place(baseHome, 'home');
  place(baseAway, 'away');
  return out;
}

/**
 * Build a deterministic 2.5D motion timeline from a finished match.
 * Pure: same (events) → same timeline, every time.
 */
export function buildMatchTimeline(match: Match, homeClub: Club, awayClub: Club): MatchTimeline {
  const events = match.events || [];
  // Seed from the stable match id, NOT the event list. During live play events
  // reveal incrementally; seeding off the growing list would re-randomize the
  // already-shown beats every tick. Seeding off the id keeps the prefix stable
  // as new events arrive, while staying fully deterministic for replays.
  const seed = hashString(match.id || '');
  const rng = makeRng(seed);
  const baseHome = baseTeam(homeClub, 'home');
  const baseAway = baseTeam(awayClub, 'away');
  const removed = new Set<string>();
  const beats: MatchBeat[] = [];
  let seq = 0;
  let momentum = 0; // +100 = home advantage (matches engine HalfState convention)

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
    minute: number,
    eventType: MatchEvent['type'] | null,
    possession: 'home' | 'away',
    stage: Stage,
    highlight: Set<string>,
    caption: string | undefined,
    durationMs: number,
  ) => {
    beats.push({
      seq: seq++,
      minute,
      eventType,
      possession,
      ball: stage.ball,
      ballMotion: stage.motion,
      ballArc: PITCH_CHOREO.ARC[stage.motion] ?? 0,
      camera: { focus: stage.ball, zoom: stage.zoom },
      players: placeBeatPlayers(baseHome, baseAway, possession, stage.ball, removed, highlight, rng),
      highlightIds: Array.from(highlight),
      caption,
      durationMs,
    });
  };

  for (let minute = 0; minute <= maxMin; minute++) {
    const evs = byMinute.get(minute);
    if (evs && evs.length) {
      for (const ev of evs) {
        if (typeof ev.momentum === 'number') momentum = ev.momentum;
        const isHome = ev.clubId === homeClub.id;
        const highlight = new Set<string>();
        if (ev.playerId) highlight.add(ev.playerId);
        if (ev.assistPlayerId) highlight.add(ev.assistPlayerId);
        if (ev.goalkeeperId) highlight.add(ev.goalkeeperId);
        const stage = stageEvent(ev, isHome, rng);
        const dur = GOAL_EVENTS.has(ev.type) ? PITCH_CHOREO.GOAL_BEAT_MS : PITCH_CHOREO.BEAT_MS;
        pushBeat(minute, ev.type, isHome ? 'home' : 'away', stage, highlight, ev.description, dur);
        // Send-off applies AFTER the beat so the player is shown being dismissed.
        if (ev.type === 'red_card' && ev.playerId) removed.add(ev.playerId);
      }
    } else {
      const possession: 'home' | 'away' = momentum >= 0 ? 'home' : 'away';
      pushBeat(minute, null, possession, stagePossession(possession, rng), new Set(), undefined, PITCH_CHOREO.BEAT_MS);
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
