/**
 * Sunday League — balance constants.
 *
 * Every tunable number for the mode lives here. Nothing in `src/utils/sunday/*`
 * or `src/store/slices/sunday*` may hardcode a balance value; if you find one,
 * it belongs in this file.
 *
 * SCALE NOTE. Money is in whole POUNDS, not thousands. A good week is £120 of
 * income. That is the entire point of the mode's economy: the elite game asks
 * whether you can afford a £40M striker, this one asks whether you can afford
 * to get the kit washed. `formatMoney` renders values under £1,000 as whole
 * pounds, so these numbers display correctly without a second formatter.
 *
 * TUNING PROVENANCE. The opposition-quality bands and the availability curve
 * were set by measurement, not intuition — `src/test/sundayBalance.test.ts`
 * simulates full seasons across every division and asserts the resulting
 * points-per-game, goals-per-game, availability and survival rates stay in
 * the bands documented next to each constant. Change a number here and that
 * test tells you what it did.
 */
import type {
  FormationType, TacticalInstructions, SundayArchetypeId, SundayClubPersonalityId,
  SundayDivisionId, SundayTacticId, SundayUpgradeId,
} from '@/types/game';

// ── Schema ──────────────────────────────────────────────────────────────────

/** Bumped when `SundayState`'s shape changes. `validateSundayState` refuses a
 *  state whose `v` it does not recognise rather than reading missing fields.
 *  v2: player memories + promises, the arrival phase, the rival's manager,
 *  event-chain flags, record context lines. Migrated in saveMigration v85.
 *  v3: the match report carries its own discipline/injury counts and the
 *  man-of-the-match name, `onceFiredIds` outlives the capped event log,
 *  `pendingLedger` holds mid-week money, and the dead `eventQueue` is gone.
 *  Migrated in saveMigration v86. */
export const SUNDAY_STATE_VERSION = 3;

// ── The pyramid ─────────────────────────────────────────────────────────────

export interface SundayDivisionInfo {
  id: SundayDivisionId;
  name: string;
  shortName: string;
  /** Total clubs including the player's. Even numbers only — the fixture
   *  generator handles odd counts with byes, but a bye week in a 14-week
   *  season is a wasted week the player cannot do anything with. */
  teamCount: number;
  /** Average opposition player quality (0-100 on the generator's scale). The
   *  bottom division is genuinely bad football. */
  oppQuality: number;
  /** Random spread applied per club around `oppQuality`. */
  oppSpread: number;
  /** Clubs auto-promoted from this division. */
  promotionSpots: number;
  /** Clubs relegated to the division below (0 for the bottom). */
  relegationSpots: number;
  /** Season prize for winning the division, in pounds. */
  titlePrize: number;
  /** Per-season registration fee, charged in week 1. */
  leagueFee: number;
  /** Weekly pitch hire at this level — better leagues use better pitches. */
  pitchHire: number;
  /** Baseline gate/bucket-collection income per home match. */
  gateBase: number;
}

/** Bottom to top. `SUNDAY_DIVISIONS[0]` is where a new club starts. */
export const SUNDAY_DIVISIONS: readonly SundayDivisionInfo[] = [
  { id: 'sun-4',    name: 'Sunday League Division Four', shortName: 'Div 4',   teamCount: 8,  oppQuality: 42, oppSpread: 8,  promotionSpots: 2, relegationSpots: 0, titlePrize: 150, leagueFee: 110, pitchHire: 34, gateBase: 22 },
  { id: 'sun-3',    name: 'Sunday League Division Three', shortName: 'Div 3',  teamCount: 8,  oppQuality: 47, oppSpread: 8,  promotionSpots: 2, relegationSpots: 2, titlePrize: 250, leagueFee: 140, pitchHire: 40, gateBase: 26 },
  { id: 'sun-2',    name: 'Sunday League Division Two', shortName: 'Div 2',    teamCount: 10, oppQuality: 52, oppSpread: 8,  promotionSpots: 2, relegationSpots: 2, titlePrize: 400, leagueFee: 170, pitchHire: 48, gateBase: 32 },
  { id: 'sun-1',    name: 'Sunday League Division One', shortName: 'Div 1',    teamCount: 10, oppQuality: 57, oppSpread: 9,  promotionSpots: 2, relegationSpots: 2, titlePrize: 650, leagueFee: 210, pitchHire: 56, gateBase: 40 },
  { id: 'sun-prem', name: 'County Sunday Premier', shortName: 'County Prem',   teamCount: 12, oppQuality: 63, oppSpread: 9,  promotionSpots: 0, relegationSpots: 2, titlePrize: 1200, leagueFee: 280, pitchHire: 68, gateBase: 54 },
] as const;

export function getSundayDivision(id: SundayDivisionId): SundayDivisionInfo {
  return SUNDAY_DIVISIONS.find(d => d.id === id) ?? SUNDAY_DIVISIONS[0];
}

/** Index in the pyramid, 0 = bottom. -1 when unknown. */
export function sundayDivisionTier(id: SundayDivisionId): number {
  return SUNDAY_DIVISIONS.findIndex(d => d.id === id);
}

/** Points awarded, kept explicit so the table builder and the AI agree. */
export const SUNDAY_POINTS_WIN = 3;
export const SUNDAY_POINTS_DRAW = 1;

// ── Season shape ────────────────────────────────────────────────────────────

/** Cup rounds are slotted between league weeks; the last one is the final. */
export const SUNDAY_CUP_ROUNDS = 3;
/** Prize per cup round survived, in pounds (the final pays double). */
export const SUNDAY_CUP_ROUND_PRIZE = 90;
/** Weeks with no fixture at all — a break to fundraise, socialise, recover. */
export const SUNDAY_FREE_WEEKS_PER_SEASON = 2;

// ── Squad shape ─────────────────────────────────────────────────────────────

/** Fewest players that can legally start a match. Below this it is abandoned
 *  — the real FA rule, and the best possible source of Sunday League tension. */
export const SUNDAY_MIN_START = 7;
export const SUNDAY_FULL_XI = 11;
/** Most named substitutes. */
export const SUNDAY_MAX_BENCH = 5;
/** Registered-squad ceiling. Beyond this, players start asking why they came. */
export const SUNDAY_MAX_SQUAD = 22;
/** Below this the club is in a staffing crisis and events react to it. */
export const SUNDAY_THIN_SQUAD = 13;

/** Guests dragged in when the squad cannot raise seven. Capped so the mode
 *  never silently plays itself: at 3 ringers the manager has clearly lost
 *  control of the week and the narrative says so. */
export const SUNDAY_MAX_RINGERS = 3;
/** Cost per ringer — his lunch, his registration, and a pint afterwards. */
export const SUNDAY_RINGER_COST = 15;
/** Squad-morale hit per ringer fielded. */
export const SUNDAY_RINGER_MORALE = 2;
/** Quality band ringers are generated in. Deliberately dreadful. */
export const SUNDAY_RINGER_QUALITY_MIN = 26;
export const SUNDAY_RINGER_QUALITY_MAX = 46;

// ── Availability ────────────────────────────────────────────────────────────
//
// THE defining system. Availability must feel like a real constraint without
// becoming a random tax: the curve below gives a committed player ~93% and a
// ghost ~45%, and most absences arrive with a week's warning so the manager can
// plan around them. Measured squad-wide availability across a season sits at
// 78-86% for a normal squad — enough to make depth matter, not enough to make
// the teamsheet a lottery.

/** Availability floor and ceiling after every modifier. Nobody is certain. */
export const SUNDAY_AVAIL_MIN = 0.30;
export const SUNDAY_AVAIL_MAX = 0.95;
/** Base probability before attributes. */
export const SUNDAY_AVAIL_BASE = 0.46;
/** Added per point of `commitment` (1-20). 20 commitment = +0.44. */
export const SUNDAY_AVAIL_PER_COMMITMENT = 0.022;
/** Added per point of `happiness` above 50, per point (so ±0.10 at the ends). */
export const SUNDAY_AVAIL_PER_HAPPINESS = 0.002;
/** A player benched repeatedly stops bothering. Per consecutive benched week. */
export const SUNDAY_AVAIL_BENCHED_PENALTY = 0.035;
/** Cup ties and derbies get people out of bed. */
export const SUNDAY_AVAIL_BIG_GAME_BONUS = 0.08;
/** Away trips cost you the marginal attendee; a minibus buys it back. */
export const SUNDAY_AVAIL_AWAY_PENALTY = 0.05;
/** Chance an absent player gave warning, base + per point of punctuality. */
export const SUNDAY_WARN_BASE = 0.30;
export const SUNDAY_WARN_PER_PUNCTUALITY = 0.032;
/** A warned absence is shown as a `doubt` rather than an `out` this often —
 *  "should be alright" is the most Sunday League sentence there is. */
export const SUNDAY_DOUBT_SHARE = 0.35;
/** Chance a `doubt` resolves in the club's favour at kickoff. */
export const SUNDAY_DOUBT_TURNS_UP = 0.6;

/** Multi-week absence lengths, in weeks. */
export const SUNDAY_HOLIDAY_WEEKS_MIN = 2;
export const SUNDAY_HOLIDAY_WEEKS_MAX = 3;
/** Chance a given absence is a multi-week holiday rather than a one-off. */
export const SUNDAY_HOLIDAY_SHARE = 0.14;

/** Reasons a one-week absence can carry, weighted. Weights are relative. */
export const SUNDAY_ABSENCE_WEIGHTS: Readonly<Record<string, number>> = {
  work: 26, family: 20, hungover: 12, wedding: 6, travel: 8, school: 4,
  'fell-out': 3, 'other-team': 4, 'cant-be-bothered': 9, 'no-show': 8,
};

// ── Morale, happiness and relationships ─────────────────────────────────────

export const SUNDAY_MORALE_START = 62;
export const SUNDAY_HAPPINESS_START = 65;
/** Squad morale moves this far toward the result's target each week. */
export const SUNDAY_MORALE_WIN = 7;
export const SUNDAY_MORALE_DRAW = 1;
export const SUNDAY_MORALE_LOSS = -6;
export const SUNDAY_MORALE_HEAVY_LOSS = -11;
/** Heavy defeat threshold (goal difference). */
export const SUNDAY_HEAVY_LOSS_MARGIN = 4;
export const SUNDAY_MORALE_FORFEIT = -18;
/** How far squad morale moves toward the (influence-weighted) average mood of
 *  the dressing room each week. Replaces an earlier per-player accumulation
 *  that summed a positive term over every squad member and pinned morale at
 *  100 by about week eight. */
export const SUNDAY_MORALE_MOOD_PULL = 0.22;
export const SUNDAY_MORALE_NEUTRAL = 55;

/** Happiness change for starting / being an unused sub / not being picked. */
export const SUNDAY_HAPPY_STARTED = 2;
export const SUNDAY_HAPPY_SUB_USED = 1;
export const SUNDAY_HAPPY_SUB_UNUSED = -3;
export const SUNDAY_HAPPY_AVAILABLE_UNPICKED = -5;
/** Extra penalty per point of ego above 12 when left out. */
export const SUNDAY_HAPPY_EGO_MULT = 0.4;
/** Captain benched — he is not going to let this go. */
export const SUNDAY_HAPPY_CAPTAIN_BENCHED = -6;
/** Below this, the player becomes unsettled and starts fielding calls. */
export const SUNDAY_UNSETTLED_THRESHOLD = 28;
/** Below this (and unsettled), he leaves. */
export const SUNDAY_QUIT_THRESHOLD = 14;
/** Weekly chance an unsettled player at the quit threshold actually walks,
 *  reduced by loyalty. */
export const SUNDAY_QUIT_BASE_CHANCE = 0.30;
export const SUNDAY_QUIT_PER_LOYALTY = 0.012;
/** Share of the gap to `SUNDAY_MORALE_NEUTRAL` each player's happiness closes
 *  per week. Without it the +2 a starter gains every Sunday compounds over a
 *  season and the whole squad sits at 100 by Christmas regardless of results. */
export const SUNDAY_HAPPINESS_DRIFT = 0.11;

// ── Money ───────────────────────────────────────────────────────────────────

/** Match fee each player pays to play. Collecting it is a running battle. */
export const SUNDAY_SUBS_PER_PLAYER = 6;
/** Chance a given player actually hands over his subs on the day, base and
 *  per point of commitment. What he doesn't pay goes on his tab. */
export const SUNDAY_SUBS_PAID_BASE = 0.62;
export const SUNDAY_SUBS_PAID_PER_COMMITMENT = 0.025;
/** Referee's fee per match, home or away. Cash, in an envelope. */
export const SUNDAY_REFEREE_FEE = 26;
/** Weekly kit wash / equipment upkeep. */
export const SUNDAY_UPKEEP = 8;
/** Travel cost for an away fixture, halved when the club owns a minibus. */
export const SUNDAY_AWAY_TRAVEL = 28;
/** Fine for failing to fulfil a fixture. */
export const SUNDAY_FORFEIT_FINE = 50;
/** Fine per red card, levied by the league. */
export const SUNDAY_RED_CARD_FINE = 20;
/** Treatment cost per injury when the club has no physio. */
export const SUNDAY_INJURY_COST = 30;
/** Bucket-collection income per point of reputation, on top of the division's
 *  base. Deliberately the club's one income stream that does NOT scale with
 *  squad size: match fees do, so without this a thin, low-commitment squad had
 *  40% less income than a full one against identical fixed costs, and folded
 *  regardless of how well it was run. */
export const SUNDAY_GATE_PER_REPUTATION = 0.6;
/** Overdraft floor. Past this the club cannot pay its way and folds. */
export const SUNDAY_BANKRUPT_FLOOR = -400;
/** Balance below which a week counts as "in debt". Being twenty pounds down
 *  for a fortnight is a Sunday club operating normally; the countdown should
 *  only start when the hole is real. */
export const SUNDAY_DEBT_FLOOR = -60;
/** Consecutive weeks below `SUNDAY_DEBT_FLOOR` before the club folds. Long
 *  enough that a fundraiser, a sponsor or a cup run can save it. */
export const SUNDAY_BANKRUPT_GRACE_WEEKS = 7;

/** A fundraiser: raffle, car wash, sponsored something. Once per N weeks. */
export const SUNDAY_FUNDRAISER_COOLDOWN = 5;
export const SUNDAY_FUNDRAISER_MIN = 40;
export const SUNDAY_FUNDRAISER_MAX = 140;
/** Fundraisers cost goodwill — everyone has to stand outside Tesco. */
export const SUNDAY_FUNDRAISER_MORALE = -3;

/** "Ring round" — spend an afternoon on the phone to un-cancel someone. */
export const SUNDAY_RINGROUND_COST = 10;
export const SUNDAY_RINGROUND_MORALE = -1;
/** Chance per attempt that a given `out` player can be talked round, scaled
 *  by his commitment. */
export const SUNDAY_RINGROUND_BASE = 0.34;
export const SUNDAY_RINGROUND_PER_COMMITMENT = 0.018;

/** Chasing unpaid subs: recovers this share of the tab, at a morale cost. */
export const SUNDAY_CHASE_SUBS_RECOVERY = 0.7;
export const SUNDAY_CHASE_SUBS_MORALE = -4;

/** Share of `titlePrize` paid for finishing 1st / 2nd / 3rd. Anything lower
 *  gets nothing, which is what makes a title race worth money as well as
 *  bragging rights. */
export const SUNDAY_PRIZE_SHARES: readonly number[] = [1, 0.5, 0.25];
/** Flat bonus for going up, on top of any prize money. */
export const SUNDAY_PROMOTION_BONUS = 220;

// ── Reputation ──────────────────────────────────────────────────────────────

export const SUNDAY_REPUTATION_START = 20;
export const SUNDAY_REP_WIN = 1.2;
export const SUNDAY_REP_DRAW = 0.3;
export const SUNDAY_REP_LOSS = -0.6;
export const SUNDAY_REP_FORFEIT = -6;
export const SUNDAY_REP_PROMOTION = 12;
export const SUNDAY_REP_RELEGATION = -8;
export const SUNDAY_REP_TITLE = 6;
export const SUNDAY_REP_MIN = 0;
export const SUNDAY_REP_MAX = 100;

// ── Club personalities ──────────────────────────────────────────────────────

export interface SundayPersonalityInfo {
  id: SundayClubPersonalityId;
  name: string;
  tagline: string;
  description: string;
  /** Starting bank balance, pounds. */
  startBalance: number;
  /** Registered squad size at kickoff. */
  squadSize: number;
  /** Added to every generated squad member's football quality. */
  qualityMod: number;
  /** Added to every squad member's commitment (1-20 scale). */
  commitmentMod: number;
  /** Added to every squad member's ego. */
  egoMod: number;
  /** Multiplies the spread of generated attributes — chaos is wider. */
  varianceMult: number;
  /** Starting squad morale offset. */
  moraleMod: number;
  /** Starting reputation offset. */
  reputationMod: number;
  /** Age band for the starting squad. */
  ageMin: number;
  ageMax: number;
  /** Archetypes this club is disproportionately likely to produce. */
  favouredArchetypes: SundayArchetypeId[];
  /** Weekly income multiplier — how good the club is at collecting money. */
  incomeMult: number;
}

export const SUNDAY_PERSONALITIES: readonly SundayPersonalityInfo[] = [
  {
    id: 'pub', name: 'Pub FC', tagline: 'Sponsored by the bar you got changed in.',
    description: 'Founded in a beer garden and run out of one. Cheap, cheerful, and utterly incapable of defending a set piece.',
    startBalance: 320, squadSize: 15, qualityMod: -2, commitmentMod: -1, egoMod: 0,
    varianceMult: 1.05, moraleMod: 6, reputationMod: 0, ageMin: 24, ageMax: 38,
    favouredArchetypes: ['legend', 'retriever', 'warrior'], incomeMult: 1.1,
  },
  {
    id: 'family', name: 'Family Club', tagline: 'Three brothers and their dad.',
    description: 'Everyone is related to someone. Nobody misses a match, nobody is any good, and every defeat is discussed at Christmas.',
    startBalance: 380, squadSize: 14, qualityMod: -4, commitmentMod: 4, egoMod: -3,
    varianceMult: 0.8, moraleMod: 8, reputationMod: -2, ageMin: 19, ageMax: 44,
    favouredArchetypes: ['warrior', 'captain', 'retriever'], incomeMult: 1.0,
  },
  {
    id: 'serious', name: 'Serious Amateur Club', tagline: 'We train. On a Tuesday.',
    description: 'Cones, bibs, a WhatsApp group with rules. Genuinely organised, and quietly furious about it.',
    startBalance: 450, squadSize: 16, qualityMod: 3, commitmentMod: 3, egoMod: 1,
    varianceMult: 0.85, moraleMod: 0, reputationMod: 6, ageMin: 20, ageMax: 34,
    favouredArchetypes: ['captain', 'prospect', 'warrior'], incomeMult: 1.15,
  },
  {
    id: 'washed', name: 'Washed Professionals', tagline: 'He had a trial at Wigan, you know.',
    description: 'Genuine ability, genuine hamstrings, genuinely convinced the league is beneath them.',
    startBalance: 340, squadSize: 13, qualityMod: 8, commitmentMod: -4, egoMod: 6,
    varianceMult: 1.0, moraleMod: -4, reputationMod: 8, ageMin: 28, ageMax: 41,
    favouredArchetypes: ['ex-pro', 'glass', 'hothead'], incomeMult: 0.95,
  },
  {
    id: 'chaos', name: 'Chaos FC', tagline: 'Nobody knows what happens next.',
    description: 'Could win 6-0. Could concede 6-0. Could arrive with nine men and one of them in jeans.',
    startBalance: 340, squadSize: 14, qualityMod: 0, commitmentMod: -3, egoMod: 2,
    varianceMult: 1.5, moraleMod: 2, reputationMod: 0, ageMin: 18, ageMax: 42,
    favouredArchetypes: ['ghost', 'hothead', 'legend'], incomeMult: 0.9,
  },
  {
    id: 'youth', name: 'Youth Development', tagline: 'Everyone here is nineteen.',
    description: 'Raw, quick, tactically illiterate. In three seasons half of them will be very good and the other half will have discovered nightclubs.',
    startBalance: 330, squadSize: 16, qualityMod: -5, commitmentMod: 1, egoMod: 1,
    varianceMult: 1.15, moraleMod: 4, reputationMod: -4, ageMin: 17, ageMax: 23,
    favouredArchetypes: ['prospect', 'ghost', 'retriever'], incomeMult: 0.85,
  },
  {
    id: 'moneyball', name: 'Moneyball', tagline: 'The spreadsheet says we are fine.',
    description: 'A treasurer who alphabetises the kit and a squad assembled entirely on value for money. The books are immaculate. The football is not.',
    startBalance: 520, squadSize: 15, qualityMod: -3, commitmentMod: 2, egoMod: -2,
    varianceMult: 0.9, moraleMod: -2, reputationMod: 2, ageMin: 21, ageMax: 36,
    favouredArchetypes: ['journeyman', 'warrior', 'captain'], incomeMult: 1.2,
  },
  {
    id: 'eleven', name: 'We Just Need 11 Players', tagline: 'Anyone. Literally anyone.',
    description: 'No money, no depth, no plan. What you do have is a group chat and a refusal to fold.',
    startBalance: 270, squadSize: 12, qualityMod: -1, commitmentMod: 0, egoMod: -1,
    varianceMult: 1.25, moraleMod: -2, reputationMod: -6, ageMin: 18, ageMax: 45,
    favouredArchetypes: ['ghost', 'shift', 'legend'], incomeMult: 1.0,
  },
] as const;

export function getSundayPersonality(id: SundayClubPersonalityId): SundayPersonalityInfo {
  return SUNDAY_PERSONALITIES.find(p => p.id === id) ?? SUNDAY_PERSONALITIES[0];
}

// ── Archetypes ──────────────────────────────────────────────────────────────
//
// An archetype is a GENERATION TARGET, not a label stapled on afterwards: the
// bands below are what a player of that archetype is rolled from, so a player
// is "The Ghost" because his commitment really is 4. `pickSundayArchetype`
// chooses which one a generated player is built toward.

export interface SundayArchetypeInfo {
  id: SundayArchetypeId;
  name: string;
  blurb: string;
  /** Attribute targets used when GENERATING a player of this archetype. Any
   *  omitted field is rolled normally. Values are on the 1-20 Sunday scale
   *  except `quality`, which is a 0-100 football-quality offset. */
  gen: {
    quality?: number;
    commitment?: [number, number];
    punctuality?: [number, number];
    ego?: [number, number];
    loyalty?: [number, number];
    temper?: [number, number];
    influence?: [number, number];
    condition?: [number, number];
    injuryProne?: [number, number];
  };
}

export const SUNDAY_ARCHETYPES: readonly SundayArchetypeInfo[] = [
  { id: 'warrior', name: 'The Sunday Warrior', blurb: 'Has not missed a match since 2019. Cannot trap a bag of sand.', gen: { quality: -8, commitment: [17, 20], punctuality: [15, 20], ego: [3, 8], loyalty: [16, 20], condition: [12, 18], injuryProne: [3, 8] } },
  { id: 'ex-pro', name: 'The Ex-Pro', blurb: 'Two years in a youth academy and a lifetime of reminding you.', gen: { quality: 16, commitment: [5, 11], punctuality: [4, 11], ego: [16, 20], loyalty: [4, 10], temper: [11, 17], influence: [12, 18], condition: [8, 14] } },
  { id: 'shift', name: 'The Shift Worker', blurb: 'Genuinely good. Genuinely on nights every other week.', gen: { quality: 7, commitment: [12, 17], punctuality: [8, 14], ego: [5, 11], loyalty: [12, 18] } },
  { id: 'legend', name: 'The Pub Legend', blurb: 'Average footballer. Structurally load-bearing human being.', gen: { quality: -2, commitment: [11, 16], punctuality: [5, 11], ego: [8, 14], loyalty: [15, 20], influence: [17, 20], condition: [5, 11] } },
  { id: 'glass', name: 'The Glass Ankle', blurb: 'Outstanding for the eleven minutes a season he is fit.', gen: { quality: 12, commitment: [12, 18], ego: [7, 13], loyalty: [12, 18], injuryProne: [16, 20], condition: [6, 12] } },
  { id: 'retriever', name: 'The Golden Retriever', blurb: 'Everybody loves him. Nobody would pick him.', gen: { quality: -10, commitment: [15, 20], punctuality: [13, 19], ego: [2, 6], loyalty: [17, 20], temper: [2, 6], influence: [14, 19] } },
  { id: 'hothead', name: 'The Hothead', blurb: 'First to every tackle, every argument and every disciplinary hearing.', gen: { quality: 4, commitment: [13, 18], ego: [12, 18], temper: [17, 20], influence: [8, 14], condition: [12, 18] } },
  { id: 'ghost', name: 'The Ghost', blurb: 'In the group chat. Never at the ground.', gen: { quality: 5, commitment: [2, 6], punctuality: [2, 8], ego: [8, 14], loyalty: [3, 9] } },
  { id: 'prospect', name: 'The Young Star', blurb: 'Raw, quick and about to be much better than all of you.', gen: { quality: -4, commitment: [10, 16], punctuality: [8, 15], ego: [8, 14], loyalty: [7, 13], condition: [14, 20], injuryProne: [4, 10] } },
  { id: 'captain', name: 'The Old Captain', blurb: 'Two yards short. Runs the entire football club.', gen: { quality: 2, commitment: [16, 20], punctuality: [16, 20], ego: [10, 15], loyalty: [17, 20], influence: [17, 20], condition: [4, 10] } },
  { id: 'journeyman', name: 'The Journeyman', blurb: 'Turns up, plays, goes home. The backbone of every Sunday side.', gen: {} },
] as const;

export function getSundayArchetype(id: SundayArchetypeId): SundayArchetypeInfo {
  return SUNDAY_ARCHETYPES.find(a => a.id === id) ?? SUNDAY_ARCHETYPES[SUNDAY_ARCHETYPES.length - 1];
}

/** How often a generated squad member is a named archetype rather than a
 *  journeyman. Too high and every squad is a sitcom cast. */
export const SUNDAY_ARCHETYPE_SHARE = 0.62;
/** Extra weight given to a club personality's favoured archetypes. */
export const SUNDAY_FAVOURED_ARCHETYPE_WEIGHT = 3;

// ── Tactics ─────────────────────────────────────────────────────────────────
//
// Four tactics, each with an honest trade-off and a squad it wants. `fit` is
// measured against the XI actually on the pitch and reaches the engine through
// `buildMatchdayTeam`: it moves the wanted attributes (in proportion to the
// weights below) AND the throwaway copies' `overall`, which is what
// `computeStrengths` reads. So picking Proper Football with a squad who cannot
// keep the ball is a real, measurable penalty rather than a flavour note.
//
// NOT through `tacticalFamiliarity`: that channel is gated on `playerClubId`,
// which this mode deliberately does not pass (a short side must be allowed to
// play — see the header of `utils/sunday/match.ts`).

export interface SundayTacticInfo {
  id: SundayTacticId;
  name: string;
  tagline: string;
  description: string;
  formation: FormationType;
  /** Formation used when the XI is short — a back five with eight men is not
   *  a plan, it is a surrender. */
  shortFormation: FormationType;
  instructions: TacticalInstructions;
  /** Attribute weights the fit score is measured on. Keys are `PlayerAttributes`.
   *  The SAME weights scale the delta that is applied to the XI's attributes —
   *  see the normalisation note on `buildMatchdayTeam`. A tactic that wants
   *  physicality four times as much as pace now moves physicality four times as
   *  far, which is what makes the four tactics feel like different instructions
   *  rather than four labels on one bonus. */
  wants: Partial<Record<'pace' | 'shooting' | 'passing' | 'defending' | 'physical' | 'mental', number>>;
  /** Scales how far this tactic pushes the level's own "nobody defends on a
   *  Sunday" tilt — see `SUNDAY_VARIANCE_TILT_SHARE`. Above 1 means more goals
   *  at both ends and therefore a wilder scoreline; below 1 means a tighter,
   *  duller, more predictable morning. */
  varianceMult: number;
}

export const SUNDAY_TACTICS: readonly SundayTacticInfo[] = [
  {
    id: 'route-one', name: 'Route One', tagline: 'Big lad up top. Aim at him.',
    description: 'Kick it long, chase it, and let the centre-forward and gravity do the rest. Needs a target man and a squad that can run; needs nothing else at all.',
    formation: '4-4-2', shortFormation: '4-5-1',
    instructions: { mentality: 'balanced', width: 'wide', tempo: 'fast', defensiveLine: 'normal', pressingIntensity: 55 },
    wants: { physical: 4, shooting: 2, pace: 1 }, varianceMult: 1.1,
  },
  {
    id: 'park-the-bus', name: 'Park the Bus', tagline: 'Everybody behind the ball. Everybody.',
    description: 'Two banks of four, a third bank behind those, and one lonely striker. Keeps the score down against better sides and makes for a joyless morning.',
    formation: '5-3-2', shortFormation: '4-5-1',
    instructions: { mentality: 'defensive', width: 'narrow', tempo: 'slow', defensiveLine: 'deep', pressingIntensity: 25 },
    wants: { defending: 5, physical: 2, mental: 1 }, varianceMult: 0.75,
  },
  {
    id: 'chaos-ball', name: 'Chaos Ball', tagline: 'Everyone forward. Sort it out later.',
    description: 'No shape, no discipline, no plan beyond outscoring them. Produces 5-4s, 6-1s and the occasional 0-7. Never produces a boring match.',
    formation: '3-4-3', shortFormation: '3-5-2',
    instructions: { mentality: 'all-out-attack', width: 'wide', tempo: 'fast', defensiveLine: 'high', pressingIntensity: 85 },
    wants: { pace: 4, shooting: 3 }, varianceMult: 1.6,
  },
  {
    id: 'proper-football', name: 'Proper Football', tagline: 'We play out from the back.',
    description: 'Keep the ball, move it, make them chase. Devastating with technical players and suicidal without them — and on a pitch like yours it is a matter of faith.',
    formation: '4-3-3', shortFormation: '4-5-1',
    instructions: { mentality: 'balanced', width: 'normal', tempo: 'normal', defensiveLine: 'high', pressingIntensity: 65 },
    // PASSING WAS REMOVED FROM THE WEIGHTS DELIBERATELY. It is a near-null
    // channel in the shared engine: outside the assist pick and the midfielder
    // rating term, nothing reads it, so four sevenths of this tactic's fit was
    // being spent on an attribute the simulation does not price. Measured, that
    // made Proper Football the weakest of the four tactics (smallest 0→1 fit
    // swing, 0.144 ppg against 0.246 for the pack) for a reason that had
    // nothing to do with football. `mental` and `pace` both reach shot quality
    // and team strength, so the tactic now buys what it advertises: composure
    // on the ball and the legs to play out from the back. The engine's own
    // `SHOT_QUALITY_WEIGHTS` are shared with every other mode and are NOT the
    // place to fix this.
    wants: { mental: 4, pace: 3 }, varianceMult: 0.9,
  },
] as const;

export function getSundayTactic(id: SundayTacticId): SundayTacticInfo {
  return SUNDAY_TACTICS.find(tac => tac.id === id) ?? SUNDAY_TACTICS[0];
}

/**
 * Attribute-point differential between a tactic's wanted attributes and the
 * XI's own average that counts as a perfect (or hopeless) fit. ±this maps to
 * fit 1.0 / 0.0.
 *
 * RETUNED 9 → 4. At 9 the scale was calibrated for squads that do not exist:
 * real generated XIs only ever produced differentials in the middle of the
 * band, so across a measured sweep the accessible best-vs-worst fit range was
 * 0.236 of the 0-1 scale — the manager could move about a fifth of a lever that
 * was already small. At 4 the same squads span ~0.516, which together with
 * `SUNDAY_FIT_OVERALL_PER_POINT` puts the accessible swing in the target 0.3
 * ppg band. It is deliberately still smaller than the squad-quality span
 * (~1.5 ppg): who you can get out of bed must always outrank how you set up.
 */
export const SUNDAY_FIT_SPREAD = 4;
/** Attribute points a perfect fit is worth on the attributes the tactic leans
 *  on, relative to a neutral fit. Wide enough to decide matches, narrow enough
 *  that it cannot rescue a bad squad. Distributed across the wanted attributes
 *  in proportion to their weights — see `buildMatchdayTeam`. */
export const SUNDAY_FIT_DELTA_RANGE = 16;
/**
 * Overall points a point of fit delta is worth, applied to the throwaway
 * match-day copies only.
 *
 * WHY THIS EXISTS. `computeStrengths` reads `Player.overall`, not the
 * attributes — so before this constant, tactical fit could not touch team
 * strength at all, and therefore could not move possession or event share. It
 * was confined to the shot-quality / defence / goalkeeper channels and the
 * whole lever measured 0.246 ppg from a full 0→1 swing, of which real squads
 * could access a fifth. Nudging `overall` on the copies puts fit into the same
 * channel every other strength input uses, WITHOUT touching the shared engine.
 *
 * CALIBRATION: measured over a sweep of squad shapes, a full 0→1 fit swing
 * moves 0.246 → 0.556 ppg at k = 0.35 (0.37 accessible ppg at k = 0.5, which
 * over-powered it against the squad-quality span). k = 0.35 it is.
 */
export const SUNDAY_FIT_OVERALL_PER_POINT = 0.35;
/**
 * How much of a tactic's `varianceMult` reaches the level tilt below.
 *
 * The tilt ("nobody defends on a Sunday") is what produces this mode's 5-4s. A
 * tactic that advertises chaos gets MORE of it — more shooting, worse marking,
 * a worse keeper — and one that advertises a bus gets less, so the trade-off
 * the card describes is a real mechanical property of the side that chose it,
 * applied by the same code to whichever side chose it. The share is well under
 * 1 because the tilt is large: at full strength Chaos Ball would add sixteen
 * points of shooting and take thirteen off the marking, which is not a tactic,
 * it is a different sport.
 */
export const SUNDAY_VARIANCE_TILT_SHARE = 0.35;

// ── "Nobody defends on a Sunday" ────────────────────────────────────────────
//
// The shared match engine is calibrated for professional football, where a
// 30-rated squad simply converts less of everything and matches finish 1-0.
// Sunday football is the opposite: the attacking is bad and the DEFENDING AND
// GOALKEEPING ARE WORSE, which is why a local park on a Sunday produces 5-4s.
//
// These three numbers express that, and they are applied by the same code to
// both sides in `buildMatchdayTeam` — it is a property of the level, not an
// edge for the player. Measured effect (see `sundayBalance.test.ts`): total
// goals per match rises from ~1.3 to the 3.5-4.5 band, which is where a real
// Sunday league sits.
//
// Each side's own tactic scales its share of the tilt by `varianceMult`,
// damped by `SUNDAY_VARIANCE_TILT_SHARE` — the rule is identical for both
// sides, so it stays a property of the choice rather than of who made it.

/** Everybody shoots, from everywhere. */
export const SUNDAY_LEVEL_SHOOTING_BONUS = 30;
/** Marking is a rumour. */
export const SUNDAY_LEVEL_DEFENDING_PENALTY = 22;
/** The goalkeeper is an outfielder who owns gloves. */
export const SUNDAY_LEVEL_GK_PENALTY = 30;

// ── Pitch and weather ───────────────────────────────────────────────────────

/** The pitch is a character. Quality 0-100; upgrades raise it, winter drops it. */
export const SUNDAY_PITCH_BASE = 38;
export const SUNDAY_PITCH_PER_UPGRADE = 14;
/** Seasonal dip applied to pitch quality in the middle third of the season. */
export const SUNDAY_PITCH_WINTER_DROP = 14;
/** Below this the pitch actively harms technical football. */
export const SUNDAY_PITCH_POOR = 28;
/** Floor on pitch quality after every deduction. There is always SOME grass,
 *  and a surface of zero would make the engine's pitch channel a cliff. */
export const SUNDAY_PITCH_MIN = 8;
/** Most accumulated damage the surface can carry (quality points). */
export const SUNDAY_PITCH_DAMAGE_MAX = 30;
/** Damage that grows back each week. Three or four quiet weeks and a churned
 *  pitch is a pitch again — which is what makes playing on a bog a cost you
 *  can choose to absorb rather than a permanent tax. */
export const SUNDAY_PITCH_DAMAGE_HEAL = 5;
// NOTE: there are deliberately no postponement constants here. Waterlogging is
// an EVENT (`pitch-unplayable`) with a decision attached, not a silent dice
// roll that deletes the manager's week. The unreferenced `SUNDAY_POSTPONE_*`
// pair that used to sit here described a system that was never built.

// ── Upgrades ────────────────────────────────────────────────────────────────

export interface SundayUpgradeInfo {
  id: SundayUpgradeId;
  name: string;
  description: string;
  /** What each level actually does, in plain English, for the card. */
  effectText: string;
  maxLevel: number;
  /** Cost of level 1; each subsequent level multiplies by `costMult`. */
  baseCost: number;
  costMult: number;
  /** Reputation the club needs before this can be bought. */
  minReputation: number;
}

export const SUNDAY_UPGRADES: readonly SundayUpgradeInfo[] = [
  { id: 'kit', name: 'Matching Kit', description: 'Numbered shirts that all came from the same order.', effectText: '+3 morale, +2 reputation per level', maxLevel: 3, baseCost: 140, costMult: 1.8, minReputation: 0 },
  { id: 'pitch', name: 'Pitch Maintenance', description: 'A groundsman, a roller, and a man who owns a line-marker.', effectText: `+${SUNDAY_PITCH_PER_UPGRADE} pitch quality per level`, maxLevel: 3, baseCost: 200, costMult: 1.9, minReputation: 8 },
  { id: 'balls', name: 'Decent Match Balls', description: 'Not the one from the garden with the split seam.', effectText: 'Small boost to passing and shooting', maxLevel: 2, baseCost: 70, costMult: 1.6, minReputation: 0 },
  { id: 'nets', name: 'Goal Nets', description: 'So nobody has to argue about whether it went in.', effectText: '+1 reputation, fewer refereeing rows', maxLevel: 1, baseCost: 90, costMult: 1, minReputation: 0 },
  { id: 'physio', name: 'Physio on the Touchline', description: 'A sports-science student who works for beer.', effectText: 'Injuries heal faster and cost nothing to treat', maxLevel: 3, baseCost: 180, costMult: 1.7, minReputation: 12 },
  { id: 'minibus', name: 'Club Minibus', description: "Fourteen seats and a smell nobody can explain.", effectText: 'Halves travel cost, cancels the away availability penalty', maxLevel: 1, baseCost: 320, costMult: 1, minReputation: 15 },
  { id: 'floodlights', name: 'Floodlights', description: 'Training after work, in November, like a real club.', effectText: '+1 commitment growth, +3 reputation', maxLevel: 1, baseCost: 450, costMult: 1, minReputation: 30 },
  { id: 'clubhouse', name: 'Clubhouse Access', description: 'Somewhere to have a pint and a post-mortem.', effectText: 'Post-match morale boost, better recruits', maxLevel: 2, baseCost: 260, costMult: 1.8, minReputation: 20 },
  { id: 'coach', name: 'An Actual Coach', description: 'Someone who has read a book about football.', effectText: 'Players improve faster; tactical fit improves', maxLevel: 3, baseCost: 240, costMult: 1.9, minReputation: 18 },
  { id: 'keeper-gloves', name: 'Goalkeeper Gloves', description: 'Because he has been going in bare-handed.', effectText: 'Improves whoever is in goal', maxLevel: 2, baseCost: 60, costMult: 1.7, minReputation: 0 },
] as const;

export function getSundayUpgrade(id: SundayUpgradeId): SundayUpgradeInfo {
  return SUNDAY_UPGRADES.find(u => u.id === id) ?? SUNDAY_UPGRADES[0];
}

/** Cost of taking `id` from `level` to `level + 1`. */
export function sundayUpgradeCost(id: SundayUpgradeId, level: number): number {
  const info = getSundayUpgrade(id);
  return Math.round(info.baseCost * Math.pow(info.costMult, level));
}

// Per-upgrade effect magnitudes, so the systems that read them agree.
export const SUNDAY_KIT_MORALE_PER_LEVEL = 3;
export const SUNDAY_KIT_REP_PER_LEVEL = 2;
export const SUNDAY_BALLS_ATTR_PER_LEVEL = 2;
export const SUNDAY_GLOVES_GK_PER_LEVEL = 4;
export const SUNDAY_PHYSIO_HEAL_PER_LEVEL = 0.3;
export const SUNDAY_COACH_GROWTH_PER_LEVEL = 0.5;
/** Attribute-points of fit differential a coach level is worth.
 *
 *  RETUNED 3 → 1.0 alongside `SUNDAY_FIT_SPREAD`. Three levels of coach used to
 *  add 9 differential points — a whole `SUNDAY_FIT_SPREAD` — which pinned fit
 *  at 1.0 for any tactic once the coach was maxed and deleted the choice the
 *  fit metric exists to price. At 1.0 a maxed coach is worth three quarters of
 *  the retuned spread's half-width: a real, buyable edge that still cannot
 *  make a hopeless shape work. */
export const SUNDAY_COACH_FIT_PER_LEVEL = 1.0;
export const SUNDAY_CLUBHOUSE_MORALE_PER_LEVEL = 2;
export const SUNDAY_CLUBHOUSE_RECRUIT_PER_LEVEL = 3;
export const SUNDAY_FLOODLIGHT_REP = 3;
export const SUNDAY_NETS_REP = 1;

// ── Sponsors ────────────────────────────────────────────────────────────────
//
// CONDITIONS ARE JUDGED WITHIN ONE SEASON. `conditionProgress` is reset at the
// rollover and tracked against that season's `seasonStats` only, so a two-season
// deal is measured on the season it expires in.
//
// This is not cosmetic. The counters were previously inconsistent with each
// other: `win-streak` and `avoid-defeat` carried their best run forward with a
// `Math.max` while `goals` and `discipline` read straight off `seasonStats` and
// therefore reset — so half the conditions were "best ever across the deal" and
// half were "this season", and which half you got was decided by a die roll
// when the offer was generated.

/** Reputation needed before sponsors start offering at all. */
export const SUNDAY_SPONSOR_MIN_REPUTATION = 6;
/** Chance per week of a sponsor approach, once eligible. */
export const SUNDAY_SPONSOR_OFFER_CHANCE = 0.16;
/** Most live deals at once. */
export const SUNDAY_SPONSOR_MAX_DEALS = 2;
/** Weeks an offer stays on the table. */
export const SUNDAY_SPONSOR_OFFER_WEEKS = 2;
/** Weekly payment scales with reputation. */
export const SUNDAY_SPONSOR_WEEKLY_BASE = 7;
export const SUNDAY_SPONSOR_WEEKLY_PER_REP = 0.35;
/** Sign-on is this many weeks of the weekly payment. */
export const SUNDAY_SPONSOR_SIGNON_WEEKS = 4;
/** Bonus paid when a conditional deal's condition is met at expiry. */
export const SUNDAY_SPONSOR_BONUS_WEEKS = 8;
/** Reputation lost when a conditional deal is failed. */
export const SUNDAY_SPONSOR_FAIL_REP = 3;

// ── Recruitment ─────────────────────────────────────────────────────────────

/** Chance per week that somebody becomes available. */
export const SUNDAY_RECRUIT_CHANCE = 0.42;
/** Most recruits on the board at once. */
export const SUNDAY_RECRUIT_MAX = 4;
/** Weeks a recruit hangs around before joining someone else. */
export const SUNDAY_RECRUIT_WEEKS = 3;
/** Base quality of a recruit, plus reputation-scaled bonus. */
export const SUNDAY_RECRUIT_QUALITY_BASE = 38;
export const SUNDAY_RECRUIT_QUALITY_PER_REP = 0.24;
export const SUNDAY_RECRUIT_QUALITY_SPREAD = 10;
/** Signing-on cost band, in pounds. */
export const SUNDAY_RECRUIT_FEE_MIN = 0;
export const SUNDAY_RECRUIT_FEE_MAX = 60;
/** A trialist's attributes are shown honestly; everyone else is a rumour and
 *  the numbers you see are within this much of the truth. */
export const SUNDAY_RECRUIT_RUMOUR_ERROR = 8;
/** Chance a recruit source is a poach from a rival — cheap, good, and it makes
 *  the rivalry worse. */
export const SUNDAY_RECRUIT_POACH_CHANCE = 0.15;
export const SUNDAY_POACH_HEAT = 2;

// ── Rivalry ─────────────────────────────────────────────────────────────────

export const SUNDAY_RIVAL_HEAT_START = 3;
export const SUNDAY_RIVAL_HEAT_MAX = 10;
export const SUNDAY_RIVAL_HEAT_LOSS = 1;
export const SUNDAY_RIVAL_HEAT_WIN = -0.5;
/** Derby intensity handed to the match engine, scaled from heat (0-3). */
export const SUNDAY_RIVAL_INTENSITY_SCALE = 0.3;
/** Extra gate money for a derby. */
export const SUNDAY_DERBY_GATE_BONUS = 25;
/** Morale swing from a derby result, on top of the normal result swing. */
export const SUNDAY_DERBY_MORALE = 4;

// ── Events ──────────────────────────────────────────────────────────────────

/** Chance per week that an event fires at all. */
export const SUNDAY_EVENT_CHANCE = 0.55;
/** Default weeks before the same event can fire again. */
export const SUNDAY_EVENT_COOLDOWN = 10;
/** Events kept in the log for the season retrospective. */
export const SUNDAY_EVENT_LOG_MAX = 60;

// ── AI-versus-AI fixtures ───────────────────────────────────────────────────
//
// The rest of the division is resolved with a cheap model rather than a full
// engine run — a Sunday week has 4-6 AI fixtures and nobody reads them
// event-by-event. The numbers below are tuned so the AI model produces the same
// goals-per-match the ENGINE produces for the player's own fixtures; if they
// drift apart the league table stops being comparable with the player's record,
// which is the one thing a table has to be. `sundayBalance.test.ts` asserts the
// two stay within 1.6 goals per match of each other.

/** Goals a side is expected to score before strength is considered. */
export const SUNDAY_AI_GOALS_BASE = 0.55;
/** Extra expected goals distributed by strength share. */
export const SUNDAY_AI_GOALS_SWING = 2.0;
/** Home advantage multiplier in the AI model. */
export const SUNDAY_AI_HOME_ADVANTAGE = 1.12;

// ── Development ─────────────────────────────────────────────────────────────

/** Age below which players grow, and above which they decline. */
export const SUNDAY_GROWTH_AGE = 25;
export const SUNDAY_DECLINE_AGE = 33;
/** Base per-season attribute movement for a young/old player. */
export const SUNDAY_GROWTH_PER_SEASON = 2.4;
export const SUNDAY_DECLINE_PER_SEASON = 1.8;
/** Minutes played this season needed for full growth. */
export const SUNDAY_GROWTH_MINUTES_TARGET = 700;
/**
 * Overall band a Sunday footballer lives in.
 *
 * WHY IT IS NOT 20-40. The shared match engine's conversion curve is
 * calibrated for professional attribute bands: drop 30-rated players into it
 * and shots convert at ~4%, producing 1.2 goals a game — the opposite of what
 * a Sunday morning looks like. Overall is a RELATIVE scale and this mode never
 * shows a Sunday player beside a Premier League one, so the band sits where the
 * engine behaves (and the "nobody defends" tilt above supplies the chaos).
 * Measured result: ~3 goals a match, cards, injuries and ratings all in their
 * designed ranges.
 */
export const SUNDAY_OVERALL_CEILING = 78;
export const SUNDAY_OVERALL_FLOOR = 20;

// ── Memories, form and promises ─────────────────────────────────────────────

/** Most memories one player carries. Pruning keeps the heaviest. */
export const SUNDAY_MEMORIES_MAX = 12;

/** Weight per memory kind, 1-10. Drives pruning, the biography's ordering and
 *  the "moment of the season". A cup-final winner must outlive a debut. */
export const SUNDAY_MEMORY_WEIGHTS: Readonly<Record<string, number>> = {
  debut: 3,
  'first-goal': 4,
  'hat-trick': 7,
  winner: 8,
  'derby-goal': 8,
  'cup-hero': 9,
  promotion: 9,
  relegation: 6,
  'red-card': 5,
  motm: 6,
  'bad-day': 4,
  injury: 5,
  milestone: 7,
  'promise-kept': 5,
  'promise-broken': 7,
  'talked-round': 3,
};

/** Form movement per match: rating pulls `Player.form` toward its own level.
 *  The engine reads form in shot quality, so a striker on a run genuinely
 *  scores more — and a slump genuinely deepens — without any hidden hand. */
export const SUNDAY_FORM_PER_RATING = 5;
export const SUNDAY_FORM_BASELINE_RATING = 6.3;
export const SUNDAY_FORM_MIN = 20;
export const SUNDAY_FORM_MAX = 95;
/** Weekly drift toward neutral for players who did not play. */
export const SUNDAY_FORM_DRIFT = 3;
export const SUNDAY_FORM_NEUTRAL = 55;
/** Display thresholds: at or above/below these the UI names the streak. */
export const SUNDAY_FORM_HOT = 76;
export const SUNDAY_FORM_COLD = 38;

/** A promised start is judged within this many weeks of being made. */
export const SUNDAY_PROMISE_WEEKS = 2;
/** Happiness swing for keeping / breaking a promised start. Breaking costs
 *  more than keeping pays — that is what makes promising a real decision. */
export const SUNDAY_PROMISE_KEPT_HAPPINESS = 10;
export const SUNDAY_PROMISE_BROKEN_HAPPINESS = -18;
/** Squad-wide morale hit when the room watches a promise get broken. */
export const SUNDAY_PROMISE_BROKEN_MORALE = -4;

// ── Records and legends ─────────────────────────────────────────────────────

/** Club appearances before a departing player is remembered forever. */
export const SUNDAY_LEGEND_APPS = 40;
/** Or this many goals. */
export const SUNDAY_LEGEND_GOALS = 25;
export const SUNDAY_RECORDS_MAX = 40;
export const SUNDAY_LEGENDS_MAX = 24;
export const SUNDAY_WEEK_LOG_MAX = 14;
export const SUNDAY_LEDGER_MAX = 60;
/** Ceiling on mid-week ledger lines awaiting the settlement. Generous — a busy
 *  week is a fundraiser, an upgrade, a signing and a couple of event payouts —
 *  and low enough that a settlement which stopped clearing the list trips the
 *  invariant instead of growing the save forever. */
export const SUNDAY_PENDING_LEDGER_MAX = 40;
