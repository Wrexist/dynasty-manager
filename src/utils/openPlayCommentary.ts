import type { MatchTimeline, MatchBeat, PitchMotionKind, Player } from '@/types/game';

// Open-play commentary for the live pitch caption.
//
// The match engine emits events only for goals/fouls/cards/subs, so between
// them the broadcast caption sat silent (and a stale line lingered). This
// synthesises a short, context-accurate line from what the 2.5D pitch is
// actually showing that minute — the team in possession, the zone the ball is
// in, and the carrier — so the feed reads continuously live and in sync with
// the action. Pure + deterministic (seeded by matchId+minute) so a replay says
// the same thing every time. It NEVER invents match events; it's purely
// descriptive flavour for the silent open-play minutes.

const advForPoss = (poss: 'home' | 'away', y: number) => (poss === 'home' ? y : 100 - y);

type Zone = 'own' | 'mid' | 'final' | 'box';
function zoneOf(adv: number): Zone {
  if (adv >= 82) return 'box';
  if (adv >= 62) return 'final';
  if (adv >= 38) return 'mid';
  return 'own';
}

// {team} = club short name, {carrier} = carrier surname. Carrier lines are only
// offered when a carrier is known, so a placeholder never leaks through.
const TEAM_LINES: Record<Zone, readonly string[]> = {
  own: [
    '{team} build patiently from the back',
    '{team} knock it around in their own half',
    '{team} look to play out from defence',
  ],
  mid: [
    '{team} work it through midfield',
    '{team} probe for an opening',
    '{team} keep possession across the middle',
  ],
  final: [
    '{team} pressing in the final third',
    '{team} sense a chance here',
    '{team} work it toward the box',
  ],
  box: [
    '{team} pile forward into the box',
    '{team} camped in the final third',
    '{team} hunting the breakthrough',
  ],
};
const CARRIER_LINES: Record<Zone, readonly string[]> = {
  own: ['{carrier} brings it out for {team}', '{carrier} steps forward with it'],
  mid: ['{carrier} pulls the strings in midfield', '{carrier} carries it into space'],
  final: ['{carrier} drives at the defence', '{carrier} looks for the killer ball'],
  box: ['{carrier} goes looking for a way through', '{carrier} probes inside the box'],
};
const MOTION_LINES: Partial<Record<PitchMotionKind, readonly string[]>> = {
  longball: ['{team} switch it long', '{carrier} launches one forward'],
  cross: ['{carrier} swings in a cross', '{team} whip it into the area'],
};

// Small FNV-ish hash so line choice varies by match + minute but is stable for
// a given pair (deterministic replays, no Math.random).
function hash(matchId: string, minute: number): number {
  let h = (2166136261 ^ minute) >>> 0;
  for (let i = 0; i < matchId.length; i++) {
    h ^= matchId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build a single open-play line for the given context. Pure + deterministic. */
export function openPlayLine(opts: {
  matchId: string;
  minute: number;
  teamShort: string;
  carrierName?: string;
  advancement: number;
  motion?: PitchMotionKind;
}): string {
  const z = zoneOf(opts.advancement);
  const pool: string[] = [];
  const motionLines = opts.motion ? MOTION_LINES[opts.motion] : undefined;
  if (motionLines) {
    for (const l of motionLines) {
      if (l.includes('{carrier}') && !opts.carrierName) continue;
      pool.push(l);
    }
  }
  pool.push(...TEAM_LINES[z]);
  if (opts.carrierName) pool.push(...CARRIER_LINES[z]);
  const line = pool[hash(opts.matchId, opts.minute) % pool.length];
  return line
    .replace('{team}', opts.teamShort || 'They')
    .replace('{carrier}', opts.carrierName || opts.teamShort || 'They');
}

/** The open-play caption for a minute, derived from the beat the pitch is
 *  showing then. Returns null when the minute has no open-play beat (e.g. it's
 *  an all-events minute, where the event caption already speaks). */
export function openPlayCaptionAt(
  timeline: MatchTimeline,
  minute: number,
  homeShort: string,
  awayShort: string,
  players?: Record<string, Player>,
): { minute: string; text: string } | null {
  if (minute < 1) return null;
  let filler: MatchBeat | null = null;
  for (let i = timeline.beats.length - 1; i >= 0; i--) {
    const b = timeline.beats[i];
    if (b.minute !== minute) {
      if (b.minute < minute) break; // scanned past this minute — none open-play
      continue; // a later minute — keep scanning back
    }
    if (b.eventType === null) { filler = b; break; }
  }
  if (!filler) return null;
  const poss = filler.possession;
  const teamShort = poss === 'home' ? homeShort : awayShort;
  const adv = advForPoss(poss, filler.ball.y);
  const carrierName = filler.ballCarrierId ? players?.[filler.ballCarrierId]?.lastName : undefined;
  const text = openPlayLine({
    matchId: timeline.matchId, minute, teamShort, carrierName, advancement: adv, motion: filler.ballMotion,
  });
  return { minute: `${minute}'`, text };
}
