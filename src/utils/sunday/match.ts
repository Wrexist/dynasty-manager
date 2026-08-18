/**
 * Sunday League — the bridge to the match engine.
 *
 * The mode does NOT have its own simulation. It uses `simulateMatch` — the same
 * minute-by-minute, event-driven engine every other mode uses — and shapes the
 * inputs so the output is Sunday football. That buys believable scorelines,
 * xG, cards, injuries, ratings and momentum for free, and means a Sunday result
 * can always be explained the same way an elite one can.
 *
 * HOW THE MODE'S OWN SYSTEMS REACH THE ENGINE. The engine takes `Player`
 * objects, so every Sunday-specific effect is expressed as a deliberate,
 * ENUMERATED adjustment to a throwaway copy of the XI:
 *
 *   pitch quality      → passing/pace for BOTH sides (a ploughed field is fair)
 *   match balls        → passing/shooting for the club that bought them
 *   goalkeeper gloves  → the keeper's defending
 *   off-pitch condition→ physical/pace, and it decays through the match anyway
 *   tactical fit       → the attributes the tactic leans on, weighted by how
 *                        much it wants each, AND `overall` (the only input
 *                        `computeStrengths` reads) — for BOTH sides
 *   tactic variance    → the level tilt below, scaled by `varianceMult`
 *   morale + happiness → mental
 *
 * `buildMatchdayAdjustments` returns those as a list so the post-match report
 * can show the player exactly what helped and what did not. Nothing is applied
 * anywhere else, and no copy is ever written back into the store.
 *
 * WHY `playerClubId` IS NOT PASSED. `isSquadValid` demands eleven players from
 * whichever club is named as the player's, and forfeits below that. Turning up
 * with nine is the mode's signature situation, so the club is not named and the
 * engine's seven-player minimum applies to both sides. The consequences are
 * handled deliberately: the numerical-disadvantage penalty in `computeStrengths`
 * still fires (that is the cost of being short), and the manager's tactical edge
 * arrives through the attribute adjustments above rather than through the
 * `tacticalFamiliarity` channel, which is gated on the same club id.
 */
import type {
  Club, FormationType, Match, MatchEvent, MatchWeather, PitchCondition, Player,
  PlayerMatchRating, SundayMatchReport, SundaySquadMember, SundayTacticId,
  WeatherCondition, InjuryDetails,
} from '@/types/game';
import { simulateMatch } from '@/engine/match';
import { selectBestLineup } from '@/utils/playerGen';
import {
  SUNDAY_BALLS_ATTR_PER_LEVEL, SUNDAY_FIT_SPREAD,
  SUNDAY_GLOVES_GK_PER_LEVEL, SUNDAY_MIN_START, SUNDAY_FULL_XI, SUNDAY_PITCH_POOR,
  SUNDAY_LEVEL_DEFENDING_PENALTY, SUNDAY_LEVEL_GK_PENALTY, SUNDAY_LEVEL_SHOOTING_BONUS,
  SUNDAY_FIT_DELTA_RANGE, SUNDAY_FIT_OVERALL_PER_POINT, SUNDAY_VARIANCE_TILT_SHARE,
  SUNDAY_TACTICS, getSundayTactic, SUNDAY_COACH_FIT_PER_LEVEL,
} from '@/config/sundayLeague';
import { SUNDAY_AMBIENCE, SUNDAY_RINGER_LINES, SUNDAY_SHORT_SIDE_LINES } from '@/data/sundayNames';
import type { SundayRng } from './rng';

const clamp = (v: number, lo = 1, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)));

// ── Pitch and weather ───────────────────────────────────────────────────────

/**
 * Map a 0-100 Sunday pitch quality onto the engine's four-state condition.
 *
 * The thresholds are deliberately lower than a professional ground's would be.
 * `PITCH_SHOT_MOD` subtracts a flat 0.04 from every goal chance on a "poor"
 * surface, which against this level's ~0.17 base is a quarter of the scoring;
 * with the elite thresholds an unimproved Sunday pitch was permanently "poor"
 * and the tax was unconditional rather than something the manager could spend
 * their way out of. As mapped, a maintained pitch reaches "good", a well-
 * maintained one "excellent", and winter drops an unimproved one to "poor".
 */
export function pitchConditionFor(quality: number): PitchCondition {
  if (quality >= 58) return 'excellent';
  if (quality >= 32) return 'good';
  if (quality >= 14) return 'poor';
  return 'waterlogged';
}

/**
 * Weather for a Sunday morning, weighted by where in the season we are.
 *
 * Deliberately seeded rather than left to the engine's own
 * `generateMatchWeather`: the weather is a talking point in this mode (it
 * drives availability copy, postponements and the pitch), so it has to be the
 * same on a reload.
 */
export function rollSundayWeather(rng: SundayRng, week: number, totalWeeks: number, pitchQuality: number): MatchWeather {
  const midSeason = totalWeeks > 0 && week / totalWeeks > 0.3 && week / totalWeeks < 0.75;
  // Weighted so bad weather is a talking point rather than a tax. Rain
  // subtracts 0.08 from every goal chance in the engine, which at this level is
  // roughly half the scoring — at the first pass rain fell on 45% of mid-season
  // Sundays and the whole division stopped scoring from October to February.
  const weather = rng.weighted(
    ['clear', 'rain', 'wind', 'snow'] as WeatherCondition[],
    w => {
      if (w === 'clear') return midSeason ? 6 : 8;
      if (w === 'rain') return midSeason ? 3 : 1.6;
      if (w === 'wind') return midSeason ? 2.5 : 2;
      return midSeason ? 0.5 : 0.1;
    },
  ) ?? 'clear';
  return { weather, pitch: pitchConditionFor(pitchQuality) };
}

// ── Tactical fit ────────────────────────────────────────────────────────────

/**
 * How well the XI on the pitch suits the chosen tactic, 0-1.
 *
 * MEASURED RELATIVE TO THE SQUAD'S OWN LEVEL, deliberately. The first version
 * compared the wanted attributes against a fixed scale, which meant a good
 * squad scored well on EVERY tactic and a bad one scored badly on every tactic
 * — "fit" was just a second quality bonus, and the tactical choice carried no
 * information. Comparing against the same XI's overall attribute average makes
 * it measure SHAPE: a side whose passing sits above its own average suits
 * Proper Football, whichever division it is in. Quality already reaches the
 * engine directly through the attributes themselves.
 *
 * Goalkeepers are excluded — every tactic wants the same thing from him.
 */
export function sundayTacticFit(tacticId: SundayTacticId, xi: readonly Player[], coachLevel = 0): number {
  const tactic = getSundayTactic(tacticId);
  const outfield = xi.filter(p => p.position !== 'GK');
  const pool = outfield.length ? outfield : xi;
  if (!pool.length) return 0.5;

  const ATTRS = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'] as const;
  const mean = (attr: (typeof ATTRS)[number]) =>
    pool.reduce((n, p) => n + (p.attributes[attr] ?? 0), 0) / pool.length;

  const baseline = ATTRS.reduce((n, a) => n + mean(a), 0) / ATTRS.length;

  let weightTotal = 0;
  let wanted = 0;
  for (const [attr, weight] of Object.entries(tactic.wants)) {
    if (!weight) continue;
    wanted += mean(attr as (typeof ATTRS)[number]) * weight;
    weightTotal += weight;
  }
  if (weightTotal <= 0) return 0.5;

  const differential = wanted / weightTotal - baseline + coachLevel * SUNDAY_COACH_FIT_PER_LEVEL;
  return Math.max(0, Math.min(1, 0.5 + differential / SUNDAY_FIT_SPREAD));
}

/**
 * The tactic this XI suits best.
 *
 * Deterministic and unseeded on purpose: it is a pure function of the squad, so
 * an AI club derives the same style from the same generated squad every time it
 * is asked, on a fresh boot and after a reload alike. Ties break on
 * `SUNDAY_TACTICS` order, which is fixed. That is what lets the style be
 * persisted once at world build and still be safely re-derivable for any save
 * that predates the field.
 */
export function bestSundayTactic(xi: readonly Player[], coachLevel = 0): SundayTacticId {
  let best: SundayTacticId = SUNDAY_TACTICS[0].id;
  let bestFit = -Infinity;
  for (const tactic of SUNDAY_TACTICS) {
    const fit = sundayTacticFit(tactic.id, xi, coachLevel);
    if (fit > bestFit) { bestFit = fit; best = tactic.id; }
  }
  return best;
}

/** The eleven a club nominally puts out, for anything that needs a shape
 *  rather than this week's availability. */
function nominalXI(club: Club, players: Record<string, Player>): Player[] {
  const ids = club.lineup.length >= SUNDAY_FULL_XI ? club.lineup : club.playerIds;
  return ids.slice(0, SUNDAY_FULL_XI).map(id => players[id]).filter((p): p is Player => !!p);
}

/**
 * Work out how every AI club in the division plays.
 *
 * Each club is given the tactic its OWN squad suits best, which is what makes
 * the matchup channel real: before this every opponent was hardcoded to Route
 * One, so `getTacticalMatchupBonus` returned zero for the manager in all four
 * tactics while the AI collected +0.20 against Park the Bus — measurably
 * turning one of the four into a structural loser (−0.24 to −0.33 ppg
 * everywhere, including the squads it fits best).
 *
 * Assigned ONCE, at world build and at each rollover, and persisted: a club
 * that changes shape week to week cannot be learned, and learning the division
 * is the point. The derivation is a pure function of the seeded squad, so it is
 * stable across a reload with or without the stored map.
 */
export function deriveSundayDivisionStyles(
  divisionClubIds: readonly string[],
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  playerClubId: string,
): Record<string, SundayTacticId> {
  const out: Record<string, SundayTacticId> = {};
  for (const id of divisionClubIds) {
    if (id === playerClubId) continue;
    const club = clubs[id];
    if (!club) continue;
    out[id] = bestSundayTactic(nominalXI(club, players));
  }
  return out;
}

/**
 * How a given club plays, from the persisted map when it is there and from the
 * squad when it is not.
 *
 * The fallback is not defensive padding: a save written before the map existed
 * carries no styles, and re-deriving gives it exactly the value the map would
 * have held rather than silently reverting that division to Route One.
 */
export function sundayStyleOf(
  styles: Readonly<Record<string, SundayTacticId>> | undefined,
  clubId: string,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
): SundayTacticId {
  const stored = styles?.[clubId];
  if (stored && SUNDAY_TACTICS.some(t => t.id === stored)) return stored;
  const club = clubs[clubId];
  return club ? bestSundayTactic(nominalXI(club, players)) : SUNDAY_TACTICS[0].id;
}

// ── Match-day adjustments ───────────────────────────────────────────────────

/** One reason the team is better or worse than its attributes suggest. */
export interface SundayAdjustment {
  /** English label for the post-match breakdown. */
  label: string;
  /** Signed magnitude in attribute points, for display. */
  delta: number;
}

export interface MatchdayAdjustmentInput {
  xi: readonly Player[];
  squad: readonly SundaySquadMember[];
  tacticId: SundayTacticId;
  pitchQuality: number;
  ballsLevel: number;
  glovesLevel: number;
  coachLevel: number;
  teamMorale: number;
  /** Only the player's own club gets equipment adjustments and a coach. Tactical
   *  fit is computed and applied for BOTH sides — the opposition pick a tactic
   *  too, and an edge only the manager can hold is not a tactical system. */
  isPlayerClub: boolean;
}

export interface MatchdayTeam {
  /** Adjusted copies, safe to hand to the engine. Never written to the store. */
  players: Player[];
  adjustments: SundayAdjustment[];
  fit: number;
}

/**
 * Produce the XI the engine actually simulates, plus the human-readable list of
 * why it differs from the squad on paper.
 *
 * Every copy is fresh (`{...p, attributes: {...}}`) — mutating a stored Player
 * here would permanently bake a wet pitch into his passing. That includes
 * `overall`, which the fit adjustment now moves: the copies are handed to
 * `simulateMatch` and thrown away, and nothing in this file or its callers
 * writes one back into `players`.
 *
 * HOW THE FIT DELTA IS SPREAD. The tactic's `wants` weights decide the fit
 * SCORE, so they decide the delta too — a flat `+delta` on every wanted
 * attribute threw that information away. Each wanted attribute moves by
 * `delta × weight / meanWeight`, where the mean is taken over the wanted
 * attributes only. The multipliers therefore average exactly 1, so the total
 * attribute points a perfect fit is worth is unchanged (`SUNDAY_FIT_DELTA_RANGE`
 * per wanted attribute, as before) and only their distribution differs — Route
 * One's physicality now moves nearly twice as far as its shooting instead of
 * the same distance.
 */
export function buildMatchdayTeam(input: MatchdayAdjustmentInput): MatchdayTeam {
  const { xi, squad, tacticId, pitchQuality, ballsLevel, glovesLevel, coachLevel, teamMorale, isPlayerClub } = input;
  const byId = new Map(squad.map(m => [m.playerId, m]));
  const adjustments: SundayAdjustment[] = [];
  const fit = sundayTacticFit(tacticId, xi, isPlayerClub ? coachLevel : 0);
  const tactic = getSundayTactic(tacticId);

  // Pitch: applies to both sides. A bad surface punishes passing hardest,
  // which is precisely why Proper Football is a gamble in November.
  const pitchDelta = Math.round((pitchQuality - SUNDAY_PITCH_POOR) * 0.12);
  if (pitchDelta !== 0) adjustments.push({ label: `Pitch (${Math.round(pitchQuality)}/100)`, delta: pitchDelta });

  // Tactical fit: up to ±8 on the attributes the tactic leans on, weighted by
  // how much it wants each of them, plus a nudge to `overall` so the fit
  // reaches team strength as well as shot quality.
  const fitDelta = (fit - 0.5) * SUNDAY_FIT_DELTA_RANGE;
  const fitOverall = Math.round(fitDelta * SUNDAY_FIT_OVERALL_PER_POINT);
  if (fitDelta !== 0) adjustments.push({ label: `${tactic.name} suits the XI`, delta: Math.round(fitDelta) });

  const ballsDelta = isPlayerClub ? ballsLevel * SUNDAY_BALLS_ATTR_PER_LEVEL : 0;
  if (ballsDelta) adjustments.push({ label: 'Decent match balls', delta: ballsDelta });

  const glovesDelta = isPlayerClub ? glovesLevel * SUNDAY_GLOVES_GK_PER_LEVEL : 0;
  if (glovesDelta) adjustments.push({ label: 'Goalkeeper gloves', delta: glovesDelta });

  const moraleDelta = Math.round((teamMorale - 55) * 0.10);
  if (moraleDelta !== 0) adjustments.push({ label: moraleDelta > 0 ? 'Confident dressing room' : 'Flat dressing room', delta: moraleDelta });

  // Per-attribute fit multipliers: the tactic's own weights, normalised to
  // average 1 over the attributes it actually wants.
  const wantEntries = Object.entries(tactic.wants).filter(([, w]) => (w ?? 0) > 0) as [keyof Player['attributes'], number][];
  const weightMean = wantEntries.length
    ? wantEntries.reduce((n, [, w]) => n + w, 0) / wantEntries.length
    : 1;
  const fitByAttr = new Map<keyof Player['attributes'], number>(
    wantEntries.map(([attr, w]) => [attr, Math.round(fitDelta * (w / weightMean))]),
  );

  // The level itself. See the "Nobody defends on a Sunday" block in
  // `config/sundayLeague.ts` for why this exists and what it is worth in goals.
  // Each side's own tactic scales it: Chaos Ball really does produce more
  // shooting and worse marking than Park the Bus, rather than merely saying so.
  const varianceTilt = 1 + (tactic.varianceMult - 1) * SUNDAY_VARIANCE_TILT_SHARE;
  const levelShooting = Math.round(SUNDAY_LEVEL_SHOOTING_BONUS * varianceTilt);
  const levelDefending = Math.round(SUNDAY_LEVEL_DEFENDING_PENALTY * varianceTilt);
  const levelGk = Math.round(SUNDAY_LEVEL_GK_PENALTY * varianceTilt);
  adjustments.push({ label: 'Sunday League football', delta: levelShooting });

  const players = xi.map(p => {
    const m = byId.get(p.id);
    // Off-pitch condition is what separates a Sunday footballer from a
    // professional: the ability is there, the legs are not.
    const conditionDelta = m ? Math.round((m.condition - 10) * 0.9) : 0;
    const happinessDelta = m ? Math.round((m.happiness - 55) * 0.08) : 0;
    const attrs = { ...p.attributes };

    attrs.passing = clamp(attrs.passing + pitchDelta + ballsDelta);
    attrs.pace = clamp(attrs.pace + Math.round(pitchDelta * 0.5) + Math.round(conditionDelta * 0.5));
    attrs.shooting = clamp(attrs.shooting + ballsDelta + levelShooting);
    attrs.physical = clamp(attrs.physical + conditionDelta);
    attrs.mental = clamp(attrs.mental + moraleDelta + happinessDelta);
    attrs.defending = clamp(attrs.defending - levelDefending);
    if (p.position === 'GK') attrs.defending = clamp(attrs.defending + glovesDelta - levelGk);
    for (const [key, delta] of fitByAttr) {
      if (key in attrs) attrs[key] = clamp(attrs[key] + delta);
    }

    // `computeStrengths` reads `overall`, never the attributes — so without
    // this line the tactical choice cannot move possession or event share at
    // all. Copies only: see the header.
    return { ...p, attributes: attrs, overall: clamp(p.overall + fitOverall, 1, 99) };
  });

  return { players, adjustments, fit };
}

// ── Opposition selection ────────────────────────────────────────────────────

/**
 * Choose an AI side's XI for the week.
 *
 * The opposition suffers from Sunday League too — they lose 0-4 players to work
 * and hangovers like everyone else. Doing this here rather than fielding their
 * best eleven every week is what keeps the division competitive from the bottom
 * as well as the top, and it is why a good side can be turned over by a bad one.
 *
 * They are also picked INTO their own tactic's shape, exactly as the player's
 * side is: a club whose style is Park the Bus lines up 5-3-2, which is what
 * makes the formation matchup channel (and the pre-match intel that describes
 * it) mean something.
 */
export function pickSundayOppositionXI(
  rng: SundayRng,
  club: Club,
  players: Record<string, Player>,
  week: number,
  tacticId: SundayTacticId,
): { xi: Player[]; bench: Player[]; missing: number; formation: FormationType } {
  const squad = club.playerIds
    .map(id => players[id])
    .filter((p): p is Player => !!p && !p.injured && !(p.suspendedUntilWeek != null && p.suspendedUntilWeek > week));

  // 0-4 absentees, skewed low. Same distribution the player's club faces on a
  // typical week, so neither side is quietly advantaged.
  const missing = rng.weighted([0, 1, 2, 3, 4], n => [3, 5, 4, 2, 1][n] ?? 1) ?? 1;
  const availableCount = Math.max(SUNDAY_MIN_START, squad.length - missing);
  const available = rng.sample(squad, Math.min(squad.length, availableCount));

  const tactic = getSundayTactic(tacticId);
  const formation = available.length >= SUNDAY_FULL_XI ? tactic.formation : tactic.shortFormation;
  const { lineup, subs } = selectBestLineup(available, formation, week);
  return { xi: lineup, bench: subs, missing: squad.length - available.length, formation };
}

// ── Narrative ───────────────────────────────────────────────────────────────

/** Sunday-voice rewrites for the engine's goal descriptions, keyed by event
 *  type. `{scorer}` is the scorer's first name; `{score}` the running score. */
const GOAL_LINES: Readonly<Record<string, readonly string[]>> = {
  goal: [
    '{scorer} bundles one in. Nobody is quite sure how. ({score})',
    '{scorer} scores, and immediately does a celebration he has clearly practised. ({score})',
    'It falls to {scorer} six yards out and he does not miss. ({score})',
    '{scorer} finishes, and the man on the touchline with the dog applauds. ({score})',
  ],
  long_range_goal: [
    '{scorer} hits one from thirty-five yards and it flies in. He will talk about this for years. ({score})',
    'From absolutely nowhere, {scorer} lets fly. Top corner. ({score})',
  ],
  header_goal: [
    '{scorer} rises above a defender who was watching the ball, not him. ({score})',
    'A corner, a scramble, and {scorer}’s forehead. ({score})',
  ],
  free_kick_goal: [
    '{scorer} steps up, everyone groans, and it goes in off the underside. ({score})',
    '{scorer} takes it himself despite loud objections. He was right. ({score})',
  ],
  counter_attack_goal: [
    'Three passes, forty yards, {scorer}. Nobody tracked back. ({score})',
    'They lose it, {scorer} is away, and it is done in eight seconds. ({score})',
  ],
  solo_goal: [
    '{scorer} beats three men, which at this level is roughly a whole team. ({score})',
    '{scorer} goes on one of his runs. This time it works. ({score})',
  ],
  penalty_scored: [
    '{scorer} sends the keeper the wrong way. ({score})',
    'Penalty. Long argument. {scorer} scores anyway. ({score})',
  ],
  own_goal: [
    '{scorer} has put it in his own net and is looking at the sky. ({score})',
    'A clearance off {scorer}’s shin and in. ({score})',
  ],
  goalkeeper_error: [
    'The keeper spills it and {scorer} taps in. Silence, then swearing. ({score})',
    'It goes straight through the keeper. {scorer} accepts the gift. ({score})',
  ],
};

/** Context-first goal lines. When a goal has a story — a late winner, a derby
 *  goal, a veteran rolling back the years — the story outranks the mechanism.
 *  Same contract as every pool: the minute, scorer and score are the event's. */
const LATE_WINNER_LINES: readonly string[] = [
  '{scorer}!! In the {minute}th minute! Absolute bedlam on the touchline. ({score})',
  'It falls to {scorer} with the referee checking his watch — and it is IN. ({score})',
  '{scorer} has won it at the death. Grown men are hugging strangers. ({score})',
];
const DERBY_GOAL_LINES: readonly string[] = [
  '{scorer} scores AGAINST THAT LOT. He will drink free on this for a month. ({score})',
  '{scorer}, in the derby. He runs the full length of the pitch to celebrate at their bench. ({score})',
];
const VETERAN_GOAL_LINES: readonly string[] = [
  '{scorer} — {age} years old and still doing it. He refuses to celebrate; his knees refuse harder. ({score})',
  '{scorer} rolls back the years. The years object, but the goal stands. ({score})',
];
const COMEBACK_LEVELLER_LINES: readonly string[] = [
  '{scorer} drags you level. From nowhere, this is a game again. ({score})',
  'All square — {scorer} finishes and the comeback is officially on. ({score})',
];

const MISS_LINES: readonly string[] = [
  '{player} skies it over the fence and into the car park. Someone has to go and get it.',
  '{player} has to score. {player} does not score.',
  '{player} hits the corner flag from eight yards.',
];

const CARD_LINES: Readonly<Record<string, readonly string[]>> = {
  yellow_card: [
    '{player} is booked, and explains at length that he got the ball.',
    'Yellow for {player}. He did not get the ball.',
    '{player} goes in the book for talking, which he has been warned about twice.',
  ],
  red_card: [
    '{player} is off. He is still talking as he crosses the touchline.',
    'Red card for {player}. He will miss next week, and he knows what everyone will say.',
    '{player} has been sent off and is now arguing with a spectator.',
  ],
};

const INJURY_LINES: readonly string[] = [
  '{player} has pulled up. He will limp for a fortnight and blame the pitch.',
  '{player} is down. There is no physio, so a man with a cold sponge does his best.',
  '{player} has gone over on his ankle and is being helped off by two people who should be defending.',
];

/** Types the narrative layer will rewrite. Everything else is passed through
 *  from the engine untouched, so nothing can be silently contradicted. */
const REWRITTEN = new Set([...Object.keys(GOAL_LINES), 'shot_missed', 'yellow_card', 'red_card', 'injury']);

export interface NarrativeInput {
  rng: SundayRng;
  events: readonly MatchEvent[];
  clubId: string;
  players: Record<string, Player>;
  /** True when this fixture is against the persistent rival. */
  isDerby: boolean;
  /** Players who did not turn up, for the pre-match beats. */
  noShowNames: readonly string[];
  ringerNames: readonly string[];
  startedWith: number;
  homeGoals: number;
  awayGoals: number;
  isHome: boolean;
}

/**
 * Turn the engine's event stream into a Sunday League match report.
 *
 * EVERY factual line is derived from a real event: the minute, the scorer and
 * the running score all come from the event itself. Ambient lines
 * (`SUNDAY_AMBIENCE`) are the only invented content and they deliberately
 * assert nothing about the football, so they can never contradict the result.
 */
export function buildSundayNarrative(input: NarrativeInput): string[] {
  const { rng, events, clubId, players, isHome, isDerby } = input;
  const out: string[] = [];

  if (input.startedWith < 11) {
    const line = rng.pick(SUNDAY_SHORT_SIDE_LINES) ?? '{n} men.';
    out.push(line.replace('{n}', String(input.startedWith)));
  }
  for (const name of input.ringerNames) {
    out.push((rng.pick(SUNDAY_RINGER_LINES) ?? '{name} is playing.').replace('{name}', name));
  }
  if (input.noShowNames.length === 1) {
    out.push(`${input.noShowNames[0]} never arrived. Nobody can get hold of him.`);
  } else if (input.noShowNames.length > 1) {
    out.push(`${input.noShowNames.slice(0, -1).join(', ')} and ${input.noShowNames[input.noShowNames.length - 1]} never arrived.`);
  }

  let home = 0;
  let away = 0;
  const nameOf = (id?: string) => (id && players[id] ? players[id].firstName : 'someone');

  let htPushed = false;
  for (const ev of events) {
    // The half-time score line goes in before the first second-half event, so
    // the feed reads like a match and not a list.
    if (!htPushed && ev.minute > 45) {
      out.push(`HT ${home}-${away}.`);
      htPushed = true;
    }
    const scored = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_scored'
      || ev.type === 'extra_time_goal' || ev.type === 'free_kick_goal' || ev.type === 'long_range_goal'
      || ev.type === 'counter_attack_goal' || ev.type === 'header_goal' || ev.type === 'solo_goal'
      || ev.type === 'goalkeeper_error';
    if (scored) {
      // `clubId` on a goal event is the BENEFITING side — own goals included,
      // where the engine credits the club that gained the goal and names the
      // opposing defender in `playerId`. Tracking the engine's own accounting
      // is what guarantees the running score in the narrative can never
      // disagree with the final scoreline.
      const oursScored = ev.clubId === clubId;
      if (oursScored === isHome) home++; else away++;
    }

    if (!REWRITTEN.has(ev.type)) continue;
    const minute = ev.displayMinute ?? String(ev.minute);
    const score = `${home}-${away}`;

    if (scored && GOAL_LINES[ev.type]) {
      // Context outranks mechanism: a goal that means something gets the line
      // about what it MEANS, chosen strictly from facts the event carries.
      const ours = ev.clubId === clubId;
      const ourScore = isHome ? home : away;
      const theirScore = isHome ? away : home;
      const scorerAge = ev.playerId ? players[ev.playerId]?.age ?? 0 : 0;
      let pool: readonly string[] | null = null;
      if (ours && ev.type !== 'own_goal') {
        if (ev.minute >= 85 && ourScore === theirScore + 1) pool = LATE_WINNER_LINES;
        else if (isDerby) pool = DERBY_GOAL_LINES;
        else if (scorerAge >= 35) pool = VETERAN_GOAL_LINES;
        else if (ourScore === theirScore && theirScore >= 2) pool = COMEBACK_LEVELLER_LINES;
      }
      const template = (pool ? rng.pick(pool) : null)
        ?? rng.pick(GOAL_LINES[ev.type])
        ?? '{scorer} scores. ({score})';
      out.push(`${minute}': ${template
        .replace(/\{scorer\}/g, nameOf(ev.playerId))
        .replace('{score}', score)
        .replace('{minute}', String(ev.minute))
        .replace('{age}', String(scorerAge))}`);
      continue;
    }
    if (ev.type === 'shot_missed' && ev.clubId === clubId && rng.chance(0.3)) {
      out.push(`${minute}': ${(rng.pick(MISS_LINES) ?? '').replace(/\{player\}/g, nameOf(ev.playerId))}`);
      continue;
    }
    if ((ev.type === 'yellow_card' || ev.type === 'red_card') && ev.clubId === clubId) {
      out.push(`${minute}': ${(rng.pick(CARD_LINES[ev.type]) ?? '').replace(/\{player\}/g, nameOf(ev.playerId))}`);
      continue;
    }
    if (ev.type === 'injury' && ev.clubId === clubId) {
      out.push(`${minute}': ${(rng.pick(INJURY_LINES) ?? '').replace(/\{player\}/g, nameOf(ev.playerId))}`);
    }
  }

  if (!htPushed) out.push(`HT ${home}-${away}.`);
  out.push(`FT ${home}-${away}.`);

  // One or two ambient beats, placed at the end so they never interleave with
  // a factual sequence and read as commentary on it.
  const ambience = rng.sample(SUNDAY_AMBIENCE, rng.int(1, 2));
  out.push(...ambience);

  return out;
}

// ── Running a match ─────────────────────────────────────────────────────────

export interface SundayMatchInput {
  rng: SundayRng;
  match: Match;
  homeClub: Club;
  awayClub: Club;
  homeXI: Player[];
  awayXI: Player[];
  homeBench: Player[];
  awayBench: Player[];
  homeTacticId: SundayTacticId;
  awayTacticId: SundayTacticId;
  weather: MatchWeather;
  /** 0-3, from rivalry heat. */
  derbyIntensity: number;
  season: number;
  /** Physio level of the player's club, used as its medical rating. */
  playerPhysioLevel: number;
  /** Which side is the player's, for the medical level and the adjustments. */
  playerIsHome: boolean;
}

export interface SundayMatchOutcome {
  result: Match;
  playerRatings: PlayerMatchRating[];
  matchInjuries: Record<string, InjuryDetails>;
}

/**
 * Run a Sunday fixture through the shared engine, ninety minutes in one call.
 *
 * ── HALF-TIME ADAPTATION: INVESTIGATED, NOT BUILT (Wave 1) ─────────────────
 *
 * The question was whether the manager could change tactic at half time and
 * have the second half actually simulated under the new one. The answer is
 * YES, IT IS POSSIBLE — this is not an engine limitation, and nobody should
 * re-derive that. The evidence, so the next attempt starts from it:
 *
 *   - `simulateHalf(...)` is exported from `@/engine/match` and takes explicit
 *     `startMin` / `endMin` plus a `prevState: HalfState`. `simulateMatch` is
 *     literally two calls — (1,45) then (46,90, prevState) — and `finalizeMatch`
 *     over the merged state. Second-half events already carry their real
 *     minutes, so there is no offsetting to get wrong.
 *   - `getAIReactiveTactics` is already applied between those two calls, so a
 *     per-half tactic swap is a shape the engine expects.
 *   - Mid-match state is already persistable: the elite mode keeps
 *     `halfTimeState` in the store and `saveGame` writes it out.
 *
 * It is NOT built here because it is a different wave's worth of work against
 * this file's strongest guarantee — that the result is settled the moment the
 * manager taps Kick Off, so backgrounding, killing or reloading cannot change
 * what happened. Splitting the match in two needs all of:
 *
 *   1. `runSundayMatch` split into a first half and a finish, with the
 *      exactly-once refusal re-established across two entry points instead of
 *      one, and every consequence still written in a single pass at the end.
 *   2. The second half's inputs persisted, because they cannot be re-derived:
 *      the XI, the bench, the opposition's XI and tactic, the weather, the
 *      pitch, the derby intensity, the RNG cursor — and the RINGERS, who are
 *      generated at kickoff and deleted after the whistle, so a reload at half
 *      time would resume with nine men.
 *   3. The advance-the-week path still playing the whole match in one go.
 *   4. A decision about the shared `matchPhase` / `halfTimeState` fields, which
 *      the autosave guard and the elite Match Day screen both read.
 *   5. Somewhere for the pause to live on screen.
 *
 * (5) is the tell: the interactive half-time belongs with the Match Day reveal
 * redesign, not with a balance pass. Until then the half-time score is a
 * narrative beat (`HT x-y` in `buildSundayNarrative`) and nothing more. What
 * was deliberately NOT done instead: a morale or team-talk prompt at half time
 * dressed up as a tactical change. It would not have altered the simulation,
 * and a choice that does nothing is worse than no choice at all.
 */
export function simulateSundayMatch(input: SundayMatchInput): SundayMatchOutcome {
  const {
    match, homeClub, awayClub, homeXI, awayXI, homeBench, awayBench,
    homeTacticId, awayTacticId, weather, derbyIntensity, season, playerPhysioLevel, playerIsHome,
  } = input;

  const homeTactic = getSundayTactic(homeTacticId);
  const awayTactic = getSundayTactic(awayTacticId);

  // Medical level: no physio means a knock that would be five minutes for a
  // professional is three weeks here. The opposition are assumed to be in the
  // same boat, because they are.
  const physioMedical = 2 + playerPhysioLevel * 2;
  const baselineMedical = 2;

  return simulateMatch(
    match,
    homeClub,
    awayClub,
    homeXI,
    awayXI,
    homeTactic.instructions,
    awayTactic.instructions,
    /* tacticalFamiliarity */ undefined,
    // Deliberately NOT naming the player's club — see the header. Short sides
    // must be allowed to play.
    /* playerClubId */ undefined,
    derbyIntensity,
    /* disciplinarianActive */ false,
    season,
    /* careerDisciplineMod */ 0,
    homeBench,
    awayBench,
    weather,
    /* setPieceCoachBonus */ 0,
    playerIsHome ? physioMedical : baselineMedical,
    playerIsHome ? baselineMedical : physioMedical,
  );
}

/** Highest-rated player who actually played, or null. */
export function pickMotm(ratings: readonly PlayerMatchRating[], eligibleIds: readonly string[]): PlayerMatchRating | null {
  const eligible = new Set(eligibleIds);
  let best: PlayerMatchRating | null = null;
  for (const r of ratings) {
    if (!eligible.has(r.playerId)) continue;
    if (!best || r.rating > best.rating) best = r;
  }
  return best;
}

/** A short English verdict on the result, for the hub card. */
export function sundayResultVerdict(report: SundayMatchReport): string {
  if (report.forfeited) return 'Match abandoned. You could not raise a side.';
  const diff = report.goalsFor - report.goalsAgainst;
  if (diff >= 4) return 'A hiding, in the right direction.';
  if (diff > 0 && report.startedWith < 11) return `Won it with ${report.startedWith} men.`;
  if (diff > 0) return 'Won it.';
  if (diff === 0) return 'A point, and a long conversation about the second goal.';
  if (diff <= -4) return 'That was very bad indeed.';
  if (report.startedWith < 11) return `Lost, but you were down to ${report.startedWith}.`;
  return 'Beaten.';
}
