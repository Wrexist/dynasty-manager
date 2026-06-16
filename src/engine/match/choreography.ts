// MatchChoreographer — the spatial-synthesis layer for the 2.5D pitch view.
//
// The match engine (src/engine/match.ts) emits a flat, non-spatial event list
// and is Math.random-driven. This module is a PURE, DETERMINISTIC transform that
// turns a *finished* Match into a MatchTimeline: a sequence of "beats" carrying
// ball + 22-player positions, a ball-carrier, motion curves and camera hints.
//
// Realism model: each possession is a short chain of passes between the
// possessing team's players (the ball lives at a carrier's feet, then travels to
// the next), shaped by each side's tactics (width, mentality, defensive line,
// tempo) with wide players making forward runs when attacking. Terminal events
// (shots, set-pieces, fouls) stage the right player on the ball using event +
// set-piece-taker data and player attributes. It NEVER touches the engine, never
// calls Math.random (its own id-seeded PRNG keeps a match animating identically),
// and produces nothing persisted — so no balance or save-migration risk.
//
// Coordinates: 0-100, home goal at y=0, away goal at y=100. Home attacks +y.

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
const FORWARD_POS = new Set<Position>(['ST', 'LW', 'RW', 'CAM']);

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
  /** Kickoff/restart posture: both teams in resting formation, no block shift. */
  kickoff?: boolean;
}

/** Position all 22 players for a beat: tactical rest pose + attack/defend block
 *  shift + forward runs for wide attackers + a *smooth deterministic* idle sway
 *  (so players glide rather than vibrate). */
function placeBeatPlayers(
  baseHome: BasePlayer[], baseAway: BasePlayer[],
  possession: 'home' | 'away',
  homeTactics: TacticalInstructions, awayTactics: TacticalInstructions,
  removed: Set<string>, highlight: Set<string>, o: PlaceOpts,
): ChoreoPlayer[] {
  const attackDir = possession === 'home' ? 1 : -1;
  const out: ChoreoPlayer[] = [];
  const place = (squad: BasePlayer[], team: 'home' | 'away', tactics: TacticalInstructions) => {
    const attacking = team === possession;
    const push = attacking ? PITCH_CHOREO.ATTACK_SHIFT * MENTALITY_PUSH[tactics.mentality] : PITCH_CHOREO.DEFEND_SHIFT;
    const shift = o.kickoff ? 0 : attackDir * push;
    for (const p of squad) {
      if (p.id && removed.has(p.id)) continue;
      const isGK = p.pos === 'GK';
      // Smooth, deterministic sway — per-player phase, evolves with beat time.
      const seedp = (team === 'home' ? 1 : 101) + p.number * 7;
      const amp = (isGK ? PITCH_CHOREO.SWAY_AMP * PITCH_CHOREO.GK_SWAY_FACTOR : PITCH_CHOREO.SWAY_AMP);
      const swayX = amp * Math.sin(seedp * 0.7 + o.phaseTime * PITCH_CHOREO.SWAY_FREQ);
      const swayY = amp * Math.cos(seedp * 1.3 + o.phaseTime * PITCH_CHOREO.SWAY_FREQ);
      let runPush = 0;
      if (!o.kickoff && attacking && !isGK && (WIDE_POS.has(p.pos) || FORWARD_POS.has(p.pos))) {
        runPush = attackDir * PITCH_CHOREO.RUN_PUSH * (tactics.width === 'wide' && WIDE_POS.has(p.pos) ? 1.2 : 0.8);
      }
      const appliedShift = isGK ? shift * PITCH_CHOREO.GK_SHIFT_FACTOR : shift + runPush;
      out.push({
        id: p.id,
        team,
        pos: p.pos,
        number: p.number,
        name: p.id ? o.lookup?.[p.id]?.lastName : undefined,
        point: { x: clamp(p.base.x + swayX, 2, 98), y: clamp(p.base.y + appliedShift + swayY, 2, 98) },
        highlighted: p.id != null && highlight.has(p.id),
      });
    }
  };
  place(baseHome, 'home', homeTactics);
  place(baseAway, 'away', awayTactics);
  return out;
}

const advancement = (team: 'home' | 'away', y: number) => (team === 'home' ? y : 100 - y);

/** Build a forward-progressing chain of carrier ids for a possession, weighted
 *  toward better passers, ending at `endId` if supplied (the event's player). */
function pickChain(
  players: ChoreoPlayer[], possession: 'home' | 'away', endId: string | null | undefined,
  count: number, rng: () => number, lookup?: Record<string, Player>,
): ChoreoPlayer[] {
  const squad = players.filter(p => p.team === possession && p.id && p.pos !== 'GK');
  if (!squad.length) return [];
  const sorted = [...squad].sort((a, b) => advancement(possession, a.point.y) - advancement(possession, b.point.y));
  const chain: ChoreoPlayer[] = [];
  // Walk from deeper to more advanced thirds, picking a passer in each band.
  for (let k = 0; k < count; k++) {
    const lo = Math.floor((k / count) * sorted.length);
    const hi = Math.min(sorted.length - 1, Math.floor(((k + 1) / count) * sorted.length));
    const band = sorted.slice(lo, hi + 1);
    if (!band.length) continue;
    // Weight by passing attribute when available.
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

  // Emit a pass chain: ball travels carrier→carrier among the possessing team.
  const emitPossession = (minute: number, possession: 'home' | 'away', endId: string | null, captionLast?: string) => {
    const highlightFor = (id: string | null) => {
      const h = new Set<string>();
      if (id) h.add(id);
      return h;
    };
    const passes = PITCH_CHOREO.PASSES_BY_TEMPO[(possession === 'home' ? homeTactics : awayTactics).tempo] ?? 2;
    // Positions for this possession (recomputed per beat for subtle motion).
    const chain = pickChain(
      placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, removed, new Set(), { phaseTime: seq, lookup }),
      possession, endId, passes, rng, lookup,
    );
    chain.forEach((carrier, idx) => {
      const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, removed, highlightFor(carrier.id), { phaseTime: seq, lookup });
      const self = players.find(p => p.id === carrier.id) ?? carrier;
      const motion: PitchMotionKind = idx === 0 ? 'dribble' : 'pass';
      pushBeat(minute, null, possession, { ...self.point }, carrier.id, motion, zoomFor(possession, self.point),
        players, highlightFor(carrier.id), idx === chain.length - 1 ? captionLast : undefined);
    });
    return chain[chain.length - 1] ?? null;
  };

  // Always open on the team's actual formation shape (resting, both halves).
  pushBeat(0, null, 'home', { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE,
    placeBeatPlayers(baseHome, baseAway, 'home', homeTactics, awayTactics, removed, new Set(), { phaseTime: 0, lookup, kickoff: true }),
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
          // Build-up to the shooter, then the strike toward goal.
          const shooterId = SETPIECE_EVENTS.has(ev.type)
            ? (ev.type === 'penalty_scored' || ev.type === 'penalty_missed' ? club.penaltyTakerId : club.setPieceTakerId) || ev.playerId || null
            : ev.playerId || null;
          emitPossession(minute, possession, shooterId ?? null);
          // Strike beat: ball flies from the shooter to the goal mouth.
          const shotPlayers = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, removed, new Set(shooterId ? [shooterId] : []), { phaseTime: seq, lookup });
          const acc = lookup && shooterId ? (lookup[shooterId]?.attributes.shooting ?? 65) : 65;
          const spread = (1 - acc / 100) * 24;
          const gx = clamp(50 + (rng() * 2 - 1) * spread, 8, 92);
          const goalY = possession === 'home' ? PITCH_CHOREO.BOX_Y + 6 : 100 - (PITCH_CHOREO.BOX_Y + 6);
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          if (ev.assistPlayerId) hl.add(ev.assistPlayerId);
          if (ev.goalkeeperId) hl.add(ev.goalkeeperId);
          pushBeat(minute, ev.type, possession, { x: gx, y: clamp(goalY, 2, 98) }, null, 'shot', PITCH_CHOREO.ZOOM_GOAL, shotPlayers, hl, ev.description);
        } else if (DUEL_EVENTS.has(ev.type)) {
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, removed, hl, { phaseTime: seq, lookup });
          const self = ev.playerId ? players.find(p => p.id === ev.playerId) : null;
          const ball = self ? { ...self.point } : { x: clamp(50 + (rng() * 2 - 1) * 16, 10, 90), y: 50 };
          pushBeat(minute, ev.type, possession, ball, ev.playerId ?? null, 'idle', PITCH_CHOREO.ZOOM_WIDE, players, hl, ev.description);
        } else if (SIDELINE_EVENTS.has(ev.type)) {
          const hl = new Set<string>();
          if (ev.playerId) hl.add(ev.playerId);
          const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, removed, hl, { phaseTime: seq, lookup });
          pushBeat(minute, ev.type, possession, { x: rng() < 0.5 ? 6 : 94, y: PITCH_CHOREO.MIDFIELD_Y }, null, 'idle', PITCH_CHOREO.ZOOM_WIDE, players, hl, ev.description);
          // Reflect the swap: the incoming player (playerId) takes the slot of the
          // outgoing player (assistPlayerId), so subsequent beats show them on.
          if (ev.type === 'substitution' && ev.playerId && ev.assistPlayerId) {
            const squad = isHome ? baseHome : baseAway;
            const slot = squad.find(p => p.id === ev.assistPlayerId);
            if (slot) slot.id = ev.playerId;
          }
        } else {
          // Ambient: kickoff/half-time reset to the formation shape (no block
          // shift); other ambient lines keep the possessing team on the ball.
          const isReset = ev.type === 'kickoff' || ev.type === 'half_time';
          const players = placeBeatPlayers(baseHome, baseAway, possession, homeTactics, awayTactics, removed, new Set(), { phaseTime: seq, lookup, kickoff: isReset });
          pushBeat(minute, ev.type, possession, { x: 50, y: 50 }, null, 'restart', PITCH_CHOREO.ZOOM_WIDE, players, new Set(), ev.description);
        }

        if (ev.type === 'red_card' && ev.playerId) removed.add(ev.playerId);
      }
    } else {
      const possession: 'home' | 'away' = momentum >= 0 ? 'home' : 'away';
      emitPossession(minute, possession, null);
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
