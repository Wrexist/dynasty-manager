/**
 * Sunday League — entity generation.
 *
 * Builds the player's club, its squad, the opposition, the guests dragged in to
 * make up numbers, and the recruits who might one day be signed. Everything is
 * drawn from the seeded RNG, so a save's cast is a property of its seed.
 *
 * WHY NOT `generatePlayer`. The elite generator rolls professional attribute
 * bands (a bad Premier League squad player is ~62 overall), reads nationality
 * name pools, generates FC26-derived economics, and uses `Math.random()`
 * throughout. None of that is wanted here: a Sunday footballer is 20-55, is
 * called Baz, has no transfer value, and must be reproducible. It shares the
 * `Player` SHAPE — which is what lets the match engine simulate him — and
 * nothing else.
 */
import type {
  Player, Position, PlayerAttributes, Club, SundaySquadMember, SundayArchetypeId,
  SundayClubPersonalityId, SundayDivisionId, SundayRecruit, SundayClubIdentity,
  PlayerAppearance,
} from '@/types/game';
import { calculateOverall } from '@/utils/playerGen';
import { PLAYER_SKIN_TONES, PLAYER_HAIR_STYLES, PLAYER_HAIR_COLORS } from '@/config/playerAppearance';
import {
  SUNDAY_ARCHETYPES, SUNDAY_ARCHETYPE_SHARE, SUNDAY_FAVOURED_ARCHETYPE_WEIGHT,
  SUNDAY_HAPPINESS_START, SUNDAY_OVERALL_CEILING, SUNDAY_OVERALL_FLOOR,
  sundayRecruitFee, SUNDAY_RECRUIT_FEE_JITTER, SUNDAY_RECRUIT_QUALITY_BASE,
  SUNDAY_RECRUIT_QUALITY_PER_TIER, sundayDivisionTier,
  SUNDAY_RECRUIT_QUALITY_PER_REP, SUNDAY_RECRUIT_QUALITY_SPREAD, SUNDAY_RECRUIT_WEEKS,
  SUNDAY_RINGER_QUALITY_MAX, SUNDAY_RINGER_QUALITY_MIN, getSundayDivision,
  getSundayPersonality, SUNDAY_CLUBHOUSE_RECRUIT_PER_LEVEL,
  SUNDAY_MAX_FRIENDS, SUNDAY_MAX_RIVALS,
} from '@/config/sundayLeague';
import {
  SUNDAY_CLUB_PREFIX, SUNDAY_CLUB_SUFFIX, SUNDAY_FIRST_NAMES, SUNDAY_JOBS,
  SUNDAY_KIT_COLORS, SUNDAY_LAST_NAMES, SUNDAY_NICKNAMES, SUNDAY_TOWNS, SUNDAY_VENUES,
} from '@/data/sundayNames';
import type { SundayRng } from './rng';
import { createSundayRng, subSeed } from './rng';

/** Squad shape a Sunday side is built to. One keeper, and a prayer. */
const SQUAD_SHAPE: readonly Position[] = [
  'GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST',
  'GK', 'CB', 'CM', 'CAM', 'ST', 'LW', 'RW', 'CB', 'CM', 'ST',
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/** Deterministic id. Sunday entities never use `crypto.randomUUID` because the
 *  whole point is that the same seed rebuilds the same people. */
function sundayId(prefix: string, seed: number, n: number): string {
  return `${prefix}-${(seed >>> 0).toString(36)}-${n.toString(36)}`;
}

// ── Attributes ──────────────────────────────────────────────────────────────

/** Per-position attribute emphasis, on the 0-100 `PlayerAttributes` scale.
 *  Multiplied against the player's quality so a good Sunday centre-half is
 *  good at defending and still cannot pass. */
const POSITION_EMPHASIS: Record<string, Partial<Record<keyof PlayerAttributes, number>>> = {
  GK:  { defending: 1.20, mental: 1.10, physical: 1.05, pace: 0.70, shooting: 0.60, passing: 0.80 },
  CB:  { defending: 1.25, physical: 1.20, pace: 0.85, shooting: 0.80, passing: 0.85 },
  LB:  { defending: 1.10, pace: 1.15, physical: 1.00, shooting: 0.85, passing: 0.95 },
  RB:  { defending: 1.10, pace: 1.15, physical: 1.00, shooting: 0.85, passing: 0.95 },
  CDM: { defending: 1.15, physical: 1.15, passing: 1.00, mental: 1.05, shooting: 0.90 },
  CM:  { passing: 1.15, mental: 1.10, physical: 1.00, defending: 0.95, shooting: 1.00 },
  CAM: { passing: 1.20, shooting: 1.15, mental: 1.05, defending: 0.70 },
  LM:  { pace: 1.20, passing: 1.05, defending: 0.85, shooting: 1.10 },
  RM:  { pace: 1.20, passing: 1.05, defending: 0.85, shooting: 1.10 },
  LW:  { pace: 1.30, shooting: 1.20, defending: 0.65, passing: 1.00 },
  RW:  { pace: 1.30, shooting: 1.20, defending: 0.65, passing: 1.00 },
  ST:  { shooting: 1.35, physical: 1.10, pace: 1.10, defending: 0.60, passing: 0.80 },
};

/**
 * Per-attribute normalisation for `POSITION_EMPHASIS`.
 *
 * WHY. The emphasis table gives each position its character — a centre-half
 * defends, a striker shoots — but a first XI is defender-heavy, so summed
 * across the eleven the multipliers do NOT average out: physical came out ~6%
 * above the squad's own mean and shooting ~6% below. That is invisible in
 * isolation and fatal to `sundayTacticFit`, which measures a tactic's wanted
 * attributes AGAINST the squad's average: Route One (which wants physicality)
 * scored best for every squad ever generated, and Proper Football worst, for
 * reasons that had nothing to do with the players.
 *
 * Dividing by the mean keeps every positional difference intact while making
 * the squad-wide average of each attribute equal, so a differential in the fit
 * metric means what it says.
 *
 * Normalised over the OUTFIELD ten, not the eleven: `sundayTacticFit` excludes
 * the goalkeeper (every tactic wants the same thing from him), and normalising
 * over a pool the metric does not use reintroduced the same bias one attribute
 * over — the keeper's high defending and low shooting.
 */
const EMPHASIS_NORM: Record<keyof PlayerAttributes, number> = (() => {
  const keys: (keyof PlayerAttributes)[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'];
  const outfieldXI = SQUAD_SHAPE.slice(1, 11);
  const out = {} as Record<keyof PlayerAttributes, number>;
  for (const key of keys) {
    const total = outfieldXI.reduce((n, pos) => n + (POSITION_EMPHASIS[pos]?.[key] ?? 1), 0);
    out[key] = total / outfieldXI.length || 1;
  }
  return out;
})();

function rollAttributes(rng: SundayRng, position: Position, quality: number, variance: number): PlayerAttributes {
  const emphasis = POSITION_EMPHASIS[position] || {};
  const roll = (key: keyof PlayerAttributes): number => {
    const mult = (emphasis[key] ?? 1) / (EMPHASIS_NORM[key] || 1);
    return clamp(rng.around(quality * mult, 7 * variance), 5, 92);
  };
  return {
    pace: roll('pace'),
    shooting: roll('shooting'),
    passing: roll('passing'),
    defending: roll('defending'),
    physical: roll('physical'),
    mental: roll('mental'),
  };
}

function rollAppearance(rng: SundayRng): PlayerAppearance {
  return {
    skinTone: rng.int(0, PLAYER_SKIN_TONES.length - 1),
    hairStyle: rng.int(0, PLAYER_HAIR_STYLES.length - 1),
    hairColor: rng.int(0, PLAYER_HAIR_COLORS.length - 1),
    height: rng.int(0, 2),
    build: rng.int(0, 2),
    facialHair: rng.int(0, 4),
    accessory: rng.chance(0.15) ? rng.int(1, 4) : 0,
    bootColor: rng.int(0, 3),
  };
}

// ── Archetypes ──────────────────────────────────────────────────────────────

/**
 * Pick the archetype a generated player will be built toward.
 *
 * Clubs skew toward their favoured archetypes but never guarantee them, and a
 * healthy share of any squad is deliberately unremarkable — a dressing room
 * where every single player is a running joke stops being funny by week three.
 */
export function pickSundayArchetype(
  rng: SundayRng,
  personality: SundayClubPersonalityId,
  taken: readonly SundayArchetypeId[],
): SundayArchetypeId {
  if (!rng.chance(SUNDAY_ARCHETYPE_SHARE)) return 'journeyman';
  const favoured = new Set(getSundayPersonality(personality).favouredArchetypes);
  const named = SUNDAY_ARCHETYPES.filter(a => a.id !== 'journeyman');
  const chosen = rng.weighted(named, a => {
    // Each already-present copy halves the odds of another. One Ex-Pro is a
    // character; three is a squad list nobody can tell apart.
    const dupes = taken.filter(t => t === a.id).length;
    const base = favoured.has(a.id) ? SUNDAY_FAVOURED_ARCHETYPE_WEIGHT : 1;
    return base / Math.pow(2, dupes);
  });
  return chosen?.id ?? 'journeyman';
}

function rollSundayTraits(
  rng: SundayRng,
  archetype: SundayArchetypeId,
  personality: SundayClubPersonalityId,
): Omit<SundaySquadMember, 'playerId' | 'archetype' | 'job' | 'availability' | 'joinedSeason'> {
  const gen = SUNDAY_ARCHETYPES.find(a => a.id === archetype)?.gen ?? {};
  const p = getSundayPersonality(personality);
  const band = (range: [number, number] | undefined, fallbackMid = 10): number =>
    range ? rng.int(range[0], range[1]) : clamp(rng.around(fallbackMid, 4.5), 1, 20);
  return {
    commitment: clamp(band(gen.commitment) + p.commitmentMod, 1, 20),
    punctuality: clamp(band(gen.punctuality), 1, 20),
    ego: clamp(band(gen.ego, 9) + p.egoMod, 1, 20),
    loyalty: clamp(band(gen.loyalty, 11), 1, 20),
    temper: clamp(band(gen.temper, 9), 1, 20),
    influence: clamp(band(gen.influence, 9), 1, 20),
    condition: clamp(band(gen.condition, 10), 1, 20),
    injuryProne: clamp(band(gen.injuryProne, 8), 1, 20),
    happiness: clamp(SUNDAY_HAPPINESS_START + rng.around(0, 10) + p.moraleMod * 0.5, 5, 95),
    benchedStreak: 0,
    startedStreak: 0,
    clubApps: 0,
    clubGoals: 0,
    clubAssists: 0,
    clubMotm: 0,
    friends: [],
    rivals: [],
    formerTeammates: [],
    appsWith: {},
    unsettled: false,
    subsOwed: 0,
    memories: [],
    promise: null,
  };
}

// ── Players ─────────────────────────────────────────────────────────────────

export interface GeneratedSundayPlayer {
  player: Player;
  member: SundaySquadMember;
}

export interface GenerateSundayPlayerOptions {
  rng: SundayRng;
  id: string;
  clubId: string;
  position: Position;
  /** 0-100 football quality the attributes are rolled around. */
  quality: number;
  ageMin: number;
  ageMax: number;
  season: number;
  personality: SundayClubPersonalityId;
  archetype?: SundayArchetypeId;
  /** Widens the attribute spread — Chaos FC squads are all over the place. */
  variance?: number;
}

/** One Sunday footballer: a `Player` for the engine and a `SundaySquadMember`
 *  for everything the engine does not care about. */
export function generateSundayPlayer(opts: GenerateSundayPlayerOptions): GeneratedSundayPlayer {
  const { rng, id, clubId, position, quality, ageMin, ageMax, season, personality } = opts;
  const archetype = opts.archetype ?? 'journeyman';
  const arch = SUNDAY_ARCHETYPES.find(a => a.id === archetype);
  const variance = opts.variance ?? 1;
  const effQuality = clamp(quality + (arch?.gen.quality ?? 0), 16, 84);
  const attributes = rollAttributes(rng, position, effQuality, variance);
  const overall = clamp(calculateOverall(attributes, position), SUNDAY_OVERALL_FLOOR, SUNDAY_OVERALL_CEILING);
  const age = rng.int(ageMin, ageMax);
  const firstName = rng.pick(SUNDAY_FIRST_NAMES) ?? 'Dave';
  const lastName = rng.pick(SUNDAY_LAST_NAMES) ?? 'Yates';

  const player: Player = {
    id,
    firstName,
    lastName,
    age,
    // Sunday League is unapologetically local. Nationality is only used for
    // the avatar's skin-tone bias and the flag chip, and a local park side is
    // a local park side; the name pool already carries the actual diversity.
    nationality: 'England',
    position,
    attributes,
    overall,
    // Potential is capped at the Sunday ceiling: nobody here is being scouted.
    potential: clamp(overall + (age < 23 ? rng.int(2, 9) : rng.int(0, 3)), overall, SUNDAY_OVERALL_CEILING),
    clubId,
    // No wages and no transfer value: this economy runs on match fees and a
    // raffle. Leaving these at 0 keeps every elite-game money path a no-op.
    wage: 0,
    value: 0,
    contractEnd: season + 99,
    fitness: rng.int(72, 100),
    morale: clamp(rng.around(65, 12), 20, 95),
    form: clamp(rng.around(60, 10), 25, 90),
    injured: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
    minutesPlayed: 0,
    yellowCards: 0,
    redCards: 0,
    appearance: rollAppearance(rng),
    joinedSeason: season,
    source: 'generated',
  };

  const traits = rollSundayTraits(rng, archetype, personality);
  const member: SundaySquadMember = {
    playerId: id,
    archetype,
    job: rng.pick(SUNDAY_JOBS) ?? 'between things',
    ...traits,
    joinedSeason: season,
    availability: { status: 'available', reason: null, note: null, warned: true, weeksRemaining: 0 },
  };

  return { player, member };
}

// ── The player's club ───────────────────────────────────────────────────────

/** Build a club identity from the seed. The setup screen can re-roll it or
 *  override any field. */
export function generateSundayIdentity(rng: SundayRng, personality: SundayClubPersonalityId): SundayClubIdentity {
  const prefix = rng.pick(SUNDAY_CLUB_PREFIX) ?? 'Marsh Lane';
  const suffix = rng.pick(SUNDAY_CLUB_SUFFIX) ?? 'FC';
  const colors = rng.pick(SUNDAY_KIT_COLORS) ?? (['#D92B2B', '#FFFFFF'] as const);
  const name = `${prefix} ${suffix}`;
  return {
    name,
    shortName: shortenClubName(prefix),
    nickname: rng.pick(SUNDAY_NICKNAMES) ?? 'The Lads',
    color: colors[0],
    secondaryColor: colors[1],
    personality,
    venue: rng.pick(SUNDAY_VENUES) ?? 'The Rec',
    town: rng.pick(SUNDAY_TOWNS) ?? 'Ashworth',
  };
}

/** Short names have to fit a league table row — 12 characters, hard. */
export function shortenClubName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 12) return trimmed;
  const words = trimmed.split(/\s+/);
  if (words.length > 1 && words[0].length <= 12) return words[0];
  return trimmed.slice(0, 12).trim();
}

/** The player's club as a normal `Club`, so every shared system works on it. */
export function buildSundayClub(id: string, identity: SundayClubIdentity, divisionId: SundayDivisionId, reputation: number): Club {
  return {
    id,
    name: identity.name,
    shortName: identity.shortName,
    color: identity.color,
    secondaryColor: identity.secondaryColor,
    // Budget/wageBill are the elite game's fields and stay at zero here: the
    // Sunday economy lives in `SundayState.balance`. Nothing in this mode
    // reads `club.budget`, and leaving it at 0 means a stray elite code path
    // cannot quietly hand the club forty million pounds.
    budget: 0,
    wageBill: 0,
    reputation: Math.round(reputation),
    facilities: 20,
    youthRating: 20,
    fanBase: 200,
    boardPatience: 50,
    playerIds: [],
    formation: '4-4-2',
    lineup: [],
    subs: [],
    divisionId,
    stadiumName: identity.venue,
    stadiumCapacity: 0,
  };
}

// ── The opposition ──────────────────────────────────────────────────────────

export interface GeneratedSundayOpponent {
  club: Club;
  players: Player[];
}

/**
 * Build the rest of a division.
 *
 * TWO STREAMS, AND THE SPLIT IS THE POINT.
 *
 *   WHO THE CLUB IS — its name, its colours, the field it plays on — comes
 *   from `subSeed(rootSeed, 'club:<div>:<n>')`, which carries NO season. Club
 *   ids (`sun-opp-<div>-<n>`) are already season-independent, so before this
 *   split the rival kept its id and its grudge across a rollover while
 *   silently becoming a differently-named club: the hub printed a feud story,
 *   a defector and a taunt about "Dog & Duck" over a fixture against "The
 *   Ferrets". Identity now survives as long as the id does, which is also what
 *   makes cross-season head-to-head coherent.
 *
 *   WHO IS IN IT — quality, shape and the squad itself — comes from
 *   `subSeed(rootSeed, 'squad:<div>:<season>:<n>')`. Sunday teams re-form every
 *   summer, so a fresh cast each year is truthful; the badge on the shirt is
 *   what stays.
 *
 * Both are derived from the SAVE's root seed rather than a running cursor, so
 * the division is a property of the seed and nothing else. Callers must pass
 * the root seed, not a per-season derivative.
 */
export function generateSundayDivision(
  rootSeed: number,
  divisionId: SundayDivisionId,
  count: number,
  season: number,
  excludeNames: readonly string[] = [],
  /**
   * Quality points added to this division's baseline because of who the
   * player's club has become — `sundayOppositionLift`, computed by the caller
   * from reputation and titles. Zero for a brand-new club.
   *
   * Applied to the GENERATED OPPOSITION ONLY. Nothing here touches the
   * player's squad or the match engine; the lift is a statement about who else
   * is in this league, which is the honest version of "the game got harder".
   */
  qualityLift = 0,
): GeneratedSundayOpponent[] {
  const div = getSundayDivision(divisionId);
  const out: GeneratedSundayOpponent[] = [];
  const used = new Set(excludeNames.map(n => n.toLowerCase()));

  for (let i = 0; i < count; i++) {
    const identity = createSundayRng(subSeed(rootSeed, `club:${divisionId}:${i}`));
    const squadSeed = subSeed(rootSeed, `squad:${divisionId}:${season}:${i}`);
    const rng = createSundayRng(squadSeed);
    let name = '';
    // Names are drawn from a 45x23 space, so a collision inside one division
    // is unlikely but not impossible; retry a bounded number of times and fall
    // back to a numbered suffix rather than shipping two identical rows.
    // Deterministic given the same `excludeNames`, so the resolution is stable
    // across seasons too.
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = `${identity.pick(SUNDAY_CLUB_PREFIX)} ${identity.pick(SUNDAY_CLUB_SUFFIX)}`;
      if (!used.has(candidate.toLowerCase())) { name = candidate; break; }
    }
    if (!name) name = `${identity.pick(SUNDAY_CLUB_PREFIX)} ${identity.pick(SUNDAY_CLUB_SUFFIX)} ${i + 1}`;
    used.add(name.toLowerCase());

    const colors = identity.pick(SUNDAY_KIT_COLORS) ?? (['#1E4FD8', '#FFFFFF'] as const);
    const venue = identity.pick(SUNDAY_VENUES) ?? 'The Rec';
    const clubId = `sun-opp-${divisionId}-${i}`;
    // Clubs in a division are not equal — a spread of quality is what makes a
    // table worth reading.
    const quality = clamp(rng.around(div.oppQuality + qualityLift, div.oppSpread), 22, 80);
    const club: Club = {
      id: clubId,
      name,
      shortName: shortenClubName(name),
      color: colors[0],
      secondaryColor: colors[1],
      budget: 0,
      wageBill: 0,
      reputation: clamp(quality * 0.8, 1, 90),
      facilities: 20,
      youthRating: 20,
      fanBase: 150,
      boardPatience: 50,
      playerIds: [],
      formation: rng.pick(['4-4-2', '4-3-3', '5-3-2', '3-5-2', '4-5-1'] as const) ?? '4-4-2',
      lineup: [],
      subs: [],
      divisionId,
      stadiumName: venue,
      stadiumCapacity: 0,
    };

    // 14-16 registered: enough that the AI side can also lose people to work,
    // family and hangovers without ever being unable to raise a team.
    const squadSize = rng.int(14, 16);
    const players: Player[] = [];
    for (let s = 0; s < squadSize; s++) {
      const position = SQUAD_SHAPE[s % SQUAD_SHAPE.length];
      const { player } = generateSundayPlayer({
        rng,
        id: sundayId(`sun-p-${divisionId}-${i}`, squadSeed, s),
        clubId,
        position,
        quality,
        ageMin: 18,
        ageMax: 42,
        season,
        personality: 'pub',
        archetype: 'journeyman',
      });
      players.push(player);
      club.playerIds.push(player.id);
    }
    // A nominal XI so anything reading `club.lineup` (chemistry alignment, the
    // team-detail screen) has something sensible; the actual match XI is chosen
    // fresh each week from who is available.
    club.lineup = players.slice(0, 11).map(p => p.id);
    club.subs = players.slice(11, 16).map(p => p.id);
    out.push({ club, players });
  }
  return out;
}

// ── Ringers ─────────────────────────────────────────────────────────────────

/**
 * A guest, produced from thin air because you had six players and a fixture.
 *
 * Ringers are ephemeral: created at kickoff, and removed from `players`
 * immediately after the match (see `clearSundayRingers`). Their ids carry the
 * `sun-ringer-` prefix so the cleanup can find them with no bookkeeping, which
 * is the same trick the continental tournament uses for its `vc-` players.
 */
export function generateSundayRinger(rng: SundayRng, clubId: string, season: number, index: number): Player {
  const position: Position = index === 0 ? 'CM' : (rng.pick(['CB', 'CM', 'ST', 'LM', 'RB'] as const) ?? 'CM');
  const quality = rng.int(SUNDAY_RINGER_QUALITY_MIN, SUNDAY_RINGER_QUALITY_MAX);
  const { player } = generateSundayPlayer({
    // The id must be unique per match, not per seed, or two ringers in
    // consecutive weeks would collide in the `players` map.
    rng, id: `sun-ringer-${clubId}-${season}-${index}-${rng.int(1000, 9999)}`,
    clubId, position, quality, ageMin: 16, ageMax: 52, season,
    personality: 'eleven', archetype: 'journeyman',
  });
  player.fitness = rng.int(45, 80);
  return player;
}

/** True for a player who only exists for one match. */
export function isSundayRinger(playerId: string): boolean {
  return playerId.startsWith('sun-ringer-');
}

/** Drop every ringer from a players map. Returns a new map only if any were
 *  found, so callers can skip a pointless state write. */
export function clearSundayRingers(players: Record<string, Player>): Record<string, Player> | null {
  const ids = Object.keys(players).filter(isSundayRinger);
  if (!ids.length) return null;
  const next = { ...players };
  for (const id of ids) delete next[id];
  return next;
}

// ── Recruits ────────────────────────────────────────────────────────────────

const RECRUIT_SOURCE_TEXT: Record<SundayRecruit['source'], readonly string[]> = {
  mate: [
    '{who} knows him from school.',
    'A mate of {who}. Plays a bit.',
    '{who} has vouched for him, which is worrying.',
  ],
  work: [
    'Works with {who}. Talks about football constantly.',
    '{who} met him on a job in {town}.',
    'On {who}’s crew. Says he "used to be decent".',
  ],
  trial: [
    'Turned up to training and asked for a game.',
    'Came down for a look and stayed the whole session.',
    'Has actually trained with you twice now.',
  ],
  poached: [
    'Falling out with his current lot and taking calls.',
    'Wants away from {rival} and has made that clear.',
    'His manager has dropped him. He is not over it.',
  ],
  'walk-up': [
    'Walked past, watched ten minutes, asked who to speak to.',
    'Lives across from the pitch and has been meaning to ask.',
    'Was here with his dog. Now he is here about a shirt.',
  ],
  returning: [
    'Used to play for the club. Fancies another go.',
    'Back in the area after a few years away.',
    'Retired two seasons ago and is already bored.',
  ],
};

export interface GenerateRecruitOptions {
  rng: SundayRng;
  season: number;
  week: number;
  reputation: number;
  personality: SundayClubPersonalityId;
  /** Positions the squad is short of — recruits skew toward filling them. */
  needs: readonly Position[];
  /** Clubhouse upgrade level. A place to have a pint attracts better players. */
  clubhouseLevel: number;
  rivalName: string | null;
  /** A squad member's first name, for "a mate of Kev's". */
  vouchName: string;
  /** That squad member's id, so signing the lad can make the two of them mates
   *  rather than leaving the source line as decoration. */
  voucherId?: string | null;
  town: string;
  /** Unique suffix so two recruits in the same week cannot share an id. */
  index: number;
  /** Force the source (used by events that produce a specific recruit). */
  source?: SundayRecruit['source'];
  /** Division the club is playing in. Scales both the fee he asks for and the
   *  standard of player who bothers turning up. */
  divisionId: SundayDivisionId;
}

export function generateSundayRecruit(opts: GenerateRecruitOptions): SundayRecruit {
  const { rng, season, week, reputation, personality, needs, clubhouseLevel } = opts;
  const source = opts.source ?? (rng.weighted(
    ['mate', 'work', 'trial', 'poached', 'walk-up', 'returning'] as const,
    s => s === 'trial' ? 2 + clubhouseLevel : s === 'poached' ? (opts.rivalName ? 1.5 : 0) : 2,
  ) ?? 'mate');

  const position = needs.length && rng.chance(0.7)
    ? (rng.pick(needs) ?? 'CM')
    : (rng.pick(['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'ST'] as const) ?? 'CM');

  const quality = clamp(
    rng.around(
      SUNDAY_RECRUIT_QUALITY_BASE
      + reputation * SUNDAY_RECRUIT_QUALITY_PER_REP
      + clubhouseLevel * SUNDAY_CLUBHOUSE_RECRUIT_PER_LEVEL
      // The standard of player who bothers walking up to a County Premier
      // pitch. Half the reason his fee is higher up there as well.
      + Math.max(0, sundayDivisionTier(opts.divisionId)) * SUNDAY_RECRUIT_QUALITY_PER_TIER
      // A poached player is already playing at this level and is usually the
      // best thing on the board — that is what makes taking him tempting, and
      // what makes the rivalry worse.
      + (source === 'poached' ? 8 : 0),
      SUNDAY_RECRUIT_QUALITY_SPREAD,
    ),
    22, 76,
  );

  const archetype = pickSundayArchetype(rng, personality, []);
  const { player, member } = generateSundayPlayer({
    rng,
    id: `sun-rec-${season}-${week}-${opts.index}-${rng.int(1000, 9999)}`,
    clubId: '',
    position,
    quality,
    ageMin: source === 'returning' ? 27 : 17,
    ageMax: source === 'returning' ? 44 : 38,
    season,
    personality,
    archetype,
  });

  const template = rng.pick(RECRUIT_SOURCE_TEXT[source]) ?? '';
  const sourceText = template
    .replace('{who}', opts.vouchName)
    .replace('{town}', opts.town)
    .replace('{rival}', opts.rivalName ?? 'his old lot');

  // The recruit is not on the books yet, so his squad record carries no
  // `playerId` until he signs — strip it rather than storing a dangling id.
  const { playerId: _unsigned, ...memberWithoutId } = member;

  return {
    id: player.id,
    player,
    member: memberWithoutId,
    source,
    sourceText,
    voucherId: opts.voucherId ?? null,
    // What he wants for signing on, from his own quality and the level the
    // club is playing at — not a flat band that priced a County Premier
    // arrival the same as a Division Four one. The jitter is a haggle, not a
    // reroll.
    fee: Math.max(0, Math.round(
      sundayRecruitFee(player.overall, opts.divisionId, source === 'poached')
      * rng.float(1 - SUNDAY_RECRUIT_FEE_JITTER, 1 + SUNDAY_RECRUIT_FEE_JITTER),
    )),
    expiresWeek: week + SUNDAY_RECRUIT_WEEKS,
    // A trialist has been seen with your own eyes. Everyone else is a rumour,
    // and the numbers on his card are within `SUNDAY_RECRUIT_RUMOUR_ERROR` of
    // the truth — which is the entire risk of Sunday League recruitment.
    revealed: source === 'trial',
  };
}

// ── Starting squad ──────────────────────────────────────────────────────────

/** Build the squad a new club starts with. */
export function generateSundayStartingSquad(
  rng: SundayRng,
  clubId: string,
  personality: SundayClubPersonalityId,
  season: number,
): GeneratedSundayPlayer[] {
  const p = getSundayPersonality(personality);
  const out: GeneratedSundayPlayer[] = [];
  const taken: SundayArchetypeId[] = [];
  const baseQuality = 44 + p.qualityMod;

  for (let i = 0; i < p.squadSize; i++) {
    const position = SQUAD_SHAPE[i % SQUAD_SHAPE.length];
    const archetype = pickSundayArchetype(rng, personality, taken);
    taken.push(archetype);
    out.push(generateSundayPlayer({
      rng,
      id: `sun-p-${clubId}-${i}`,
      clubId,
      position,
      quality: baseQuality,
      ageMin: p.ageMin,
      ageMax: p.ageMax,
      season,
      personality,
      archetype,
      variance: p.varianceMult,
    }));
  }

  // Friendships and feuds, drawn once so the dressing room has a shape from
  // day one. Kept small — the same caps everything formed later respects — and
  // never symmetric-by-accident: a mutual friendship is written on both sides
  // explicitly. From here on these lists are LIVE data: `formSundayLinks` adds
  // to them out of shared history and `applySundayDeparture` scrubs them, so
  // nothing below may write an id that will not be maintained.
  const ids = out.map(g => g.player.id);
  for (const g of out) {
    if (rng.chance(0.45)) {
      // The reciprocal push below can already have named this pair from the
      // other side, so the duplicate guard is on BOTH ends. Without it a
      // mutual draw wrote the same id into one man's list twice — invisible
      // while nothing read these arrays, and now an invariant violation.
      const friend = rng.pick(ids.filter(id => id !== g.player.id));
      if (friend && !g.member.friends.includes(friend) && g.member.friends.length < SUNDAY_MAX_FRIENDS) {
        g.member.friends.push(friend);
        const other = out.find(o => o.player.id === friend);
        if (other && other.member.friends.length < SUNDAY_MAX_FRIENDS && !other.member.friends.includes(g.player.id)) {
          other.member.friends.push(g.player.id);
        }
      }
    }
    if (rng.chance(0.16)) {
      const foe = rng.pick(ids.filter(id => id !== g.player.id && !g.member.friends.includes(id)));
      if (foe && !g.member.rivals.includes(foe) && g.member.rivals.length < SUNDAY_MAX_RIVALS) {
        g.member.rivals.push(foe);
      }
    }
  }
  // A feud and a friendship with the same man cannot both be true. The draws
  // above are independent, so the rare overlap is resolved here, in favour of
  // the friendship — which is also the invariant the validator checks.
  for (const g of out) {
    g.member.rivals = g.member.rivals.filter(id => !g.member.friends.includes(id));
  }

  return out;
}

/** Positions the squad is thin in — feeds recruit generation. */
export function sundaySquadNeeds(players: readonly Player[]): Position[] {
  const counts = new Map<string, number>();
  for (const p of players) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  const needs: Position[] = [];
  if ((counts.get('GK') ?? 0) < 2) needs.push('GK');
  const defenders = ['CB', 'LB', 'RB'].reduce((n, k) => n + (counts.get(k) ?? 0), 0);
  if (defenders < 5) needs.push('CB', 'LB', 'RB');
  const mids = ['CDM', 'CM', 'CAM', 'LM', 'RM'].reduce((n, k) => n + (counts.get(k) ?? 0), 0);
  if (mids < 5) needs.push('CM', 'CM', 'LM');
  const forwards = ['ST', 'LW', 'RW'].reduce((n, k) => n + (counts.get(k) ?? 0), 0);
  if (forwards < 3) needs.push('ST', 'ST');
  return needs;
}
