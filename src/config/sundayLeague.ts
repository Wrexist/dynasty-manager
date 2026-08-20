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
  FormationType, TacticalInstructions, SundayArchetypeId, SundayChainId,
  SundayClubPersonalityId, SundayDivisionId, SundayTacticId, SundayUpgradeId,
  SundayUpgradeEffectKey,
} from '@/types/game';

// ── Schema ──────────────────────────────────────────────────────────────────

/** Bumped when `SundayState`'s shape changes. `validateSundayState` refuses a
 *  state whose `v` it does not recognise rather than reading missing fields.
 *  v2: player memories + promises, the arrival phase, the rival's manager,
 *  event-chain flags, record context lines. Migrated in saveMigration v85.
 *  v3: the match report carries its own discipline/injury counts and the
 *  man-of-the-match name, `onceFiredIds` outlives the capped event log,
 *  `pendingLedger` holds mid-week money, `divisionStyles` records how each AI
 *  club plays, `chains` holds the live multi-step stories, squad members carry
 *  `formerTeammates` / `appsWith` (and friends/rivals that are actually
 *  maintained), recruits carry `voucherId`, and the dead `eventQueue` is gone.
 *  Migrated in saveMigration v86 — which is unreleased, so later waves EXTEND
 *  that step rather than adding another. */
export const SUNDAY_STATE_VERSION = 3;

/**
 * Stable id for the player's Sunday club. One per save; the mode is
 * single-club by definition.
 *
 * LIVES IN CONFIG, NOT IN `boot.ts`, because it is read by things that must
 * not drag the boot module in behind them: `sundayKitSpec` and
 * `sundayCrestSpec` are seeded off the club id, so the setup screen has to
 * know it to draw the strip the player is actually about to be given — and
 * importing a store slice from a route would pull the whole mode into that
 * route's chunk.
 */
export const SUNDAY_CLUB_ID = 'sunday-club';

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
  /**
   * Multiplier on the costs that used to be identical at every level: the
   * referee's envelope, the away travel and the weekly kit upkeep.
   *
   * WHY IT EXISTS. Promotion changed exactly five things, and the ledger was
   * not really one of them: gate rose 22 → 54 while pitch hire rose 34 → 68,
   * so going up made the club two pounds POORER per home match while every
   * other cost stood still. A County Premier referee charges County Premier
   * money, the away trips are further, and the kit gets washed more often
   * because somebody photographs the team now.
   *
   * THE DESIGN THIS SERVES, stated plainly: promotion does NOT make the weekly
   * ledger comfortable. It makes it TIGHTER and the rewards much larger — the
   * gate more than triples, the title is worth eight times as much, sponsors
   * pay `SUNDAY_SPONSOR_TIER_MULT` more, and the bills rise to meet all of it.
   * A club that goes up and then does not attract a sponsor is in trouble by
   * the third week, which is exactly the pressure the mode loses when money
   * stops being a constraint.
   */
  costMult: number;
}

/** Bottom to top. `SUNDAY_DIVISIONS[0]` is where a new club starts. */
export const SUNDAY_DIVISIONS: readonly SundayDivisionInfo[] = [
  { id: 'sun-4',    name: 'Sunday League Division Four', shortName: 'Div 4',   teamCount: 8,  oppQuality: 42, oppSpread: 8,  promotionSpots: 2, relegationSpots: 0, titlePrize: 150, leagueFee: 110, pitchHire: 34, gateBase: 22, costMult: 1.00 },
  { id: 'sun-3',    name: 'Sunday League Division Three', shortName: 'Div 3',  teamCount: 8,  oppQuality: 47, oppSpread: 8,  promotionSpots: 2, relegationSpots: 2, titlePrize: 250, leagueFee: 150, pitchHire: 40, gateBase: 28, costMult: 1.08 },
  { id: 'sun-2',    name: 'Sunday League Division Two', shortName: 'Div 2',    teamCount: 10, oppQuality: 52, oppSpread: 8,  promotionSpots: 2, relegationSpots: 2, titlePrize: 400, leagueFee: 200, pitchHire: 48, gateBase: 38, costMult: 1.20 },
  { id: 'sun-1',    name: 'Sunday League Division One', shortName: 'Div 1',    teamCount: 10, oppQuality: 57, oppSpread: 9,  promotionSpots: 2, relegationSpots: 2, titlePrize: 650, leagueFee: 280, pitchHire: 56, gateBase: 50, costMult: 1.35 },
  { id: 'sun-prem', name: 'County Sunday Premier', shortName: 'County Prem',   teamCount: 12, oppQuality: 63, oppSpread: 9,  promotionSpots: 0, relegationSpots: 2, titlePrize: 1200, leagueFee: 420, pitchHire: 68, gateBase: 74, costMult: 1.55 },
] as const;

export function getSundayDivision(id: SundayDivisionId): SundayDivisionInfo {
  return SUNDAY_DIVISIONS.find(d => d.id === id) ?? SUNDAY_DIVISIONS[0];
}

/** Index in the pyramid, 0 = bottom. -1 when unknown. */
export function sundayDivisionTier(id: SundayDivisionId): number {
  return SUNDAY_DIVISIONS.findIndex(d => d.id === id);
}

// ── Opposition scaling ──────────────────────────────────────────────────────
//
// THE DIFFICULTY CEILING, in one block. `oppQuality` was a static per-division
// constant regenerated identically every summer with no reference to the
// player's own history, while the player's side kept improving — recruits
// scale with reputation, young players grow, upgrades stack. Measured over 24
// careers, by season 7-8 in the top division a well-run club permanently
// outclassed everything in front of it: the pyramid runs out after four
// promotions and there is nothing left to climb.
//
// The lift below is GENTLE and CAPPED, and it is a property of the LEVEL, not
// a leash. A club with a big reputation and a trophy or two attracts better
// opposition to its division the way a real local league churns: the good
// sides in the area hear there is a proper league up the road. It is applied
// only to generated opposition — never to the player's squad, never to the
// match engine — and at its ceiling it is worth less than one division's
// worth of quality (5 points), so it can never turn a promotion into a
// demotion in disguise.

/** Reputation at which the lift starts. Below this it is zero. */
export const SUNDAY_OPP_SCALE_REP_BASE = 30;
/** Quality points added per point of reputation above the base. */
export const SUNDAY_OPP_SCALE_PER_REP = 0.06;
/** Quality points added per division title already won. */
export const SUNDAY_OPP_SCALE_PER_TITLE = 0.6;
/** Ceiling on the whole lift, in quality points. Deliberately below the 5-6
 *  point gap between two divisions: standing still must never feel like being
 *  quietly promoted. */
export const SUNDAY_OPP_SCALE_MAX = 4.5;

/**
 * How much better than the division's baseline the opposition is generated,
 * for a club of this standing.
 *
 * Pure, exported and tested: it is the one place the mode is allowed to react
 * to the player's success, and it must be readable at a glance.
 */
export function sundayOppositionLift(reputation: number, titles: number): number {
  const fromRep = Math.max(0, reputation - SUNDAY_OPP_SCALE_REP_BASE) * SUNDAY_OPP_SCALE_PER_REP;
  const fromTitles = Math.max(0, titles) * SUNDAY_OPP_SCALE_PER_TITLE;
  return Math.min(SUNDAY_OPP_SCALE_MAX, fromRep + fromTitles);
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

// ── Squad numbers ───────────────────────────────────────────────────────────
//
// A Sunday club's numbers come off a bag of shirts, so the range is the real
// printable one and the preferences are the traditional ones — a keeper takes
// 1, a right-back takes 2 — rather than anything the simulation reads. Nothing
// in the engine, the economy or availability touches these: they exist so the
// squad screen can print a number that does not change when the array does.
export const SUNDAY_SHIRT_MIN = 1;
export const SUNDAY_SHIRT_MAX = 99;

/** Numbers each position reaches for first, in order of preference. */
export const SUNDAY_SHIRT_PREFERENCES: Readonly<Record<string, readonly number[]>> = {
  GK: [1, 13, 12],
  RB: [2, 12],
  LB: [3, 14],
  CB: [5, 6, 4, 15],
  CDM: [4, 6, 16],
  CM: [8, 6, 16],
  CAM: [10, 18],
  RM: [7, 17],
  LM: [11, 19],
  RW: [7, 17],
  LW: [11, 19],
  ST: [9, 10, 20],
};

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
/**
 * Added per point of `happiness` above 50 (so ±0.20 at the ends).
 *
 * WIDENED 0.002 → 0.004. At 0.002 the entire happiness range moved
 * availability by ±0.10, which meant a dressing room in open revolt emptied
 * the car park by one man in ten — the single most important feedback loop in
 * the mode, and it was worth less than the away-day penalty. Every lever the
 * manager has over happiness (selection, promises, the armband, chasing subs,
 * signing over somebody's head) pays out here, so a weak coupling made all of
 * them weak at once.
 *
 * RETUNED CAREFULLY, because this is the defining curve and it feeds a loop:
 * unhappy squad → thin turnout → defeats → unhappier squad. The counterweight
 * is `SUNDAY_HAPPINESS_DRIFT` pulling individuals back toward neutral every
 * week, and the `SUNDAY_AVAIL_MIN` floor. Measured across 24 careers x 10
 * seasons the change moves mean squad availability by about a point and does
 * not move the fold rate; at 0.006 the spiral became visible in the fold
 * numbers, which is why it is not 0.006.
 */
export const SUNDAY_AVAIL_PER_HAPPINESS = 0.004;
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

// ── The armband ─────────────────────────────────────────────────────────────
//
// It was nearly cosmetic: one happiness modifier for benching him and one
// event. Everything else about the captain — that he is the man who runs the
// club, chases people on a Saturday night and sets the tone in the dressing
// room — was flavour text. These three constants make appointing him a real
// decision, and all three read the SAME attribute the appointment screen sorts
// on (`influence`), so the choice the manager is offered is the choice that
// pays out.

/** Extra weight the captain's own mood carries in the dressing room's
 *  influence-weighted average. He sets the tone; a miserable captain drags the
 *  room down faster than a miserable reserve. */
export const SUNDAY_CAPTAIN_MOOD_WEIGHT = 2;
/** Added to a ring-round's chance, per point of the captain's influence. He
 *  makes the second call, and people answer it. Worth about +0.09 for a
 *  well-chosen captain and nothing at all for a badly-chosen one. */
export const SUNDAY_CAPTAIN_RINGROUND_PER_INFLUENCE = 0.006;
/** Floor under the captain's OWN availability. Whatever else happens, the man
 *  with the armband unlocks the changing rooms — but only while he is happy
 *  enough to still want the job, so the floor lifts from the base rather than
 *  overriding a dressing-room collapse. */
export const SUNDAY_CAPTAIN_AVAIL_BONUS = 0.10;
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

// ── Relationships ───────────────────────────────────────────────────────────
//
// Small, few and readable. There is no social screen and no hidden stat web:
// a dressing room carries a HANDFUL of live links, and each one does exactly
// four things (match-day chemistry, the mood when somebody leaves, who vouched
// for the new lad, and one line on the squad screen).
//
// MEASURED over six four-season careers with these numbers: founding draws 3-8
// friendship pairs, another 1-5 form across the four seasons, and departures
// scrub some of both — a 11-14 man squad finishes with 4-8 live pairs and 1-2
// feuds. That is the target. At the first pass (20 shared matches, 0.14 a week,
// three friends each) the same careers finished with 15 pairs in a 14-man
// squad, which is a web: a Sunday side fields eleven out of thirteen every
// week, so EVERY pair clears a low shared-appearance bar by season two. The
// per-man cap does most of the limiting work; the threshold and the weekly
// chance do the rest.
//
// Everything that CAN be derived is derived and stored nowhere: who is stuck
// behind whom is `position + streaks`, and who is mentoring whom is
// `age + commitment + position group`. Only friendship, enmity, the count of
// shared afternoons and the names of the departed are persisted.

/** Most friends / rivals one player carries. Founding generation uses the same
 *  caps, so nothing that forms later can change the shape of the room. */
export const SUNDAY_MAX_FRIENDS = 2;
export const SUNDAY_MAX_RIVALS = 2;
/** Former team-mates remembered per player, newest first. */
export const SUNDAY_FORMER_TEAMMATES_MAX = 3;

/** Matches two men must have played TOGETHER before they start car-sharing.
 *  A season and a half of both being picked — long enough that a friendship
 *  means they have actually been through something, and high enough that the
 *  whole squad does not clear it at once (see the measurement above). */
export const SUNDAY_FRIENDSHIP_APPS = 32;
/** Weekly chance the best-qualified pair in the squad actually becomes one. */
export const SUNDAY_FRIENDSHIP_CHANCE = 0.14;
/** Multiplier on that chance when one of the two has just been talked round or
 *  had a promise kept. A good week is when people bond. */
export const SUNDAY_FRIENDSHIP_GOODWILL_MULT = 1.8;
/** How recently such a moment counts as "just", in weeks. */
export const SUNDAY_FRIENDSHIP_GOODWILL_WEEKS = 6;

/** Consecutive weeks of one man starting while another in his position watches
 *  before the one watching starts taking it personally. Also the threshold the
 *  squad screen's "stuck behind" line reads.
 *
 *  RARE BY STRUCTURE, not by tuning. A Sunday club fields eleven out of a
 *  thirteen-man squad, so there is hardly ever a bench to be stuck on:
 *  `benchedStreak` topped out at 2-4 across whole measured careers and the
 *  candidate existed in single-figure weeks out of three hundred. That is
 *  honest — an understudy is a professional-football problem — and it is why
 *  the armband path below exists as the other, event-driven source of friction.
 *  A club that recruits toward `SUNDAY_MAX_SQUAD` will meet this one. */
export const SUNDAY_POSITION_RIVAL_STREAK = 3;
/** Chance it hardens into a real one on a week the candidate exists. High,
 *  precisely because those weeks are so rare: when a man has genuinely sat out
 *  a month watching somebody else in his shirt, it should usually mean
 *  something rather than needing to happen four times over. */
export const SUNDAY_POSITION_RIVAL_CHANCE = 0.25;
/** Ego at or above which losing the armband makes an enemy rather than a sulk. */
export const SUNDAY_RIVAL_EGO_MIN = 13;
/** At most this many links form per week, whatever the squad. A dressing room
 *  that rearranges itself every Sunday is noise, not narrative. */
export const SUNDAY_LINKS_PER_WEEK = 1;

/** Match-day chemistry, in points of `mental`, for a starter with a mate / an
 *  enemy alongside him. Deliberately tiny: ±2 on one attribute for two or three
 *  men is a fraction of a goal across a season, which is the right size for
 *  something the manager cannot buy and can only barely see. Applied ONCE per
 *  player however many mates are on the pitch — a clique is not a multiplier. */
export const SUNDAY_CHEMISTRY_FRIEND = 2;
export const SUNDAY_CHEMISTRY_RIVAL = -2;
/** Named pairs the match-day breakdown lists before it stops naming them. */
export const SUNDAY_CHEMISTRY_ROWS_MAX = 2;

/** Happiness a man loses when a mate leaves the club, and gains when someone he
 *  could not stand does. The loss is deliberately larger than a bad afternoon:
 *  losing your lift to the ground is why people stop playing. */
export const SUNDAY_FRIEND_LEFT_HAPPINESS = -8;
export const SUNDAY_RIVAL_LEFT_HAPPINESS = 3;
/** Most players who may follow a mate out of the door in the SAME week. The
 *  friend-left hit feeds the ordinary quit roll, so two mates going together is
 *  emergent — but a squad holds three or four overlapping friendships and an
 *  uncapped cascade could empty half of it on one Sunday. */
export const SUNDAY_CASCADE_QUIT_MAX = 1;

/** Mentoring. A veteran of this age with the commitment (or the standing) to
 *  bother, in the same position group as a prospect under
 *  `SUNDAY_MENTOR_PROSPECT_AGE`, multiplies the young man's yearly growth. One
 *  multiplier, applied at the rollover, worth about half a season of extra
 *  development over three years — visible in a career, invisible in a week. */
export const SUNDAY_MENTOR_AGE = 32;
export const SUNDAY_MENTOR_COMMITMENT = 15;
export const SUNDAY_MENTOR_PROSPECT_AGE = 21;
export const SUNDAY_MENTOR_GROWTH_MULT = 1.3;

/** Who gets to say "I know a lad". Influence is who the room listens to;
 *  commitment is who is still around to be asked. */
export const SUNDAY_VOUCH_PER_INFLUENCE = 1;
export const SUNDAY_VOUCH_PER_COMMITMENT = 0.5;

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

// ── "Ring round" ────────────────────────────────────────────────────────────
//
// Spend an afternoon on the phone to un-cancel someone.
//
// THE EXPLOIT IT USED TO BE. There was no cap and no cooldown: a manager could
// work down the whole `out` column every week for a tenner a call, and the
// measured pilot did — 70 to 85 calls a season, lifting squad availability
// from 77.7% to 88.9% and points-per-game by 0.17. The morale cost was −1
// clamped at zero, so once the dressing room had bottomed out the calls were
// free of everything except money the late-game club had spare.
//
// The binding constraint is now the ATTEMPT CAP, deliberately, rather than the
// morale: a cost that clamps to nothing is not a cost, and pushing morale
// harder would have punished exactly the club least able to absorb it. Two
// calls is one Sunday morning's worth of favours.

/** Base cost of one call. */
export const SUNDAY_RINGROUND_COST = 10;
/** Calls the manager can make in one week. */
export const SUNDAY_RINGROUND_ATTEMPTS_PER_WEEK = 2;
/** Each call after the first costs this much more than the one before it —
 *  the second favour of the morning is a harder ask than the first. */
export const SUNDAY_RINGROUND_COST_ESCALATION = 1;
/** Cost of the `n`-th call of the week (0-based). */
export function sundayRingRoundCost(attemptsUsed: number): number {
  return Math.round(SUNDAY_RINGROUND_COST * (1 + attemptsUsed * SUNDAY_RINGROUND_COST_ESCALATION));
}
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
    description: 'Two banks of four, a holding man behind those, and one lonely striker. Keeps the score down against better sides and makes for a joyless morning.',
    // 4-1-4-1, not the 5-3-2 this used to be: the description always said two
    // banks of four, and a Sunday squad has five defenders on the books, so a
    // back five put a striker at left-back every week. Measured, the back four
    // is worth ~0.04 ppg to the tactic for that reason alone.
    formation: '4-1-4-1', shortFormation: '4-5-1',
    // THE BUS IS A DEEP LINE AND A DEFENSIVE MENTALITY. It used to be those
    // PLUS narrow PLUS slow PLUS a pressing intensity of 25, and in the shared
    // engine those last three are volume levers whose only compensations
    // (counter-vulnerability, shot quality) pay much less at a level where the
    // defending has already been destroyed by the tilt. Stacked, they made Park
    // the Bus a structural loser: −0.24 to −0.33 ppg against every other
    // tactic, in every squad shape, including the ones it fits best.
    //
    // `narrow` was the worst of the three and is now gone entirely: in the
    // shared engine it is −0.10 team strength AND it hands any wide opponent
    // WIDE_VS_NARROW_BONUS, with no upside anywhere. It is a strictly dominated
    // option, and no Sunday tactic should be built out of one.
    instructions: { mentality: 'defensive', width: 'normal', tempo: 'normal', defensiveLine: 'deep', pressingIntensity: 40 },
    // Defending is weighted down from 5 for the same reason passing left Proper
    // Football: only the five defensive positions' `defending` reaches
    // `getDefenseQuality`, so more than half of a defending-only delta landed
    // on forwards and did nothing. Physical and mental are read for everybody.
    wants: { defending: 3, physical: 2, mental: 2 }, varianceMult: 0.55,
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
 * CALIBRATION. The pre-change audit measured a full 0→1 fit swing at 0.246 ppg
 * and projected 0.556 at k = 0.35. Re-measured after the change (8 squad
 * shapes × 4 tactics × 900 matches), the within-shape slope came out at 0.59
 * ppg per unit of fit — but the accessible fit range on real squads is 0.37,
 * not the 0.52 the audit projected, so the swing a manager can actually reach
 * was 0.22 ppg against a 0.25-0.45 design target. k was raised 0.35 → 0.42 on
 * that measurement. The squad-quality span across the same shapes is ~1.4 ppg,
 * so who you can get out of bed still outranks how you set up by five to one.
 */
export const SUNDAY_FIT_OVERALL_PER_POINT = 0.42;
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
  /**
   * The effects this upgrade actually has, named.
   *
   * NOT decoration: `sundayUpgrades.test.ts` probes every key against the
   * system that implements it, and the union is exhaustive, so an effect
   * cannot be claimed on a card without something in the codebase doing it.
   * Three cards used to lie — see `SundayUpgradeEffectKey`.
   */
  effects: readonly SundayUpgradeEffectKey[];
  maxLevel: number;
  /** Cost of level 1; each subsequent level multiplies by `costMult`. */
  baseCost: number;
  costMult: number;
  /** Reputation the club needs before this can be bought. */
  minReputation: number;
}

// Magnitudes the cards quote directly. They sit above the table because the
// `effectText` strings interpolate them: a card and its effect cannot drift
// apart if they are the same number.

/** A new kit is a good week: a one-off bump the week it arrives. */
export const SUNDAY_KIT_MORALE_PER_LEVEL = 3;
export const SUNDAY_KIT_REP_PER_LEVEL = 2;
/** Nets: nobody has to take anybody's word for it. */
export const SUNDAY_NETS_REP = 1;
/** Floodlights: the club is visibly a real club now. */
export const SUNDAY_FLOODLIGHT_REP = 3;
/**
 * Commitment every squad member gains per season while the lights are up.
 *
 * THE CARD'S CLAIM, FINALLY BUILT. Floodlights are the most expensive thing
 * in the mode at £450 and advertised "+1 commitment growth" that was
 * implemented nowhere at all. Commitment is the biggest term in the
 * availability curve (`SUNDAY_AVAIL_PER_COMMITMENT`), so this is a genuine
 * long-game hook: train through the winter and, a season at a time, more of
 * them turn up. Applied at the rollover, clamped at the 1-20 ceiling, so it
 * cannot run away.
 */
export const SUNDAY_FLOODLIGHT_COMMITMENT_GROWTH = 1;
/**
 * Squad morale after every home match, per clubhouse level.
 *
 * Also a card that lied: "post-match morale boost" was a single +2 at the
 * till and nothing afterwards. Small on purpose — half the fixtures are at
 * home, and the morale system moves in single figures.
 */
export const SUNDAY_CLUBHOUSE_POSTMATCH_MORALE = 1;

export const SUNDAY_UPGRADES: readonly SundayUpgradeInfo[] = [
  { id: 'kit', name: 'Matching Kit', description: 'Numbered shirts that all came from the same order.', effectText: `+${SUNDAY_KIT_MORALE_PER_LEVEL} morale and +${SUNDAY_KIT_REP_PER_LEVEL} reputation the week it arrives`, effects: ['morale-on-purchase', 'reputation-on-purchase'], maxLevel: 3, baseCost: 140, costMult: 1.8, minReputation: 0 },
  { id: 'pitch', name: 'Pitch Maintenance', description: 'A groundsman, a roller, and a man who owns a line-marker.', effectText: `+${SUNDAY_PITCH_PER_UPGRADE} pitch quality per level`, effects: ['pitch-quality'], maxLevel: 3, baseCost: 200, costMult: 1.9, minReputation: 8 },
  { id: 'balls', name: 'Decent Match Balls', description: 'Not the one from the garden with the split seam.', effectText: 'Small boost to passing and shooting', effects: ['outfield-attributes'], maxLevel: 2, baseCost: 70, costMult: 1.6, minReputation: 0 },
  { id: 'nets', name: 'Goal Nets', description: 'So nobody has to argue about whether it went in.', effectText: `+${SUNDAY_NETS_REP} reputation, and the disputed-goal row stops happening`, effects: ['reputation-on-purchase', 'no-disputed-goal-row'], maxLevel: 1, baseCost: 90, costMult: 1, minReputation: 0 },
  { id: 'physio', name: 'Physio on the Touchline', description: 'A sports-science student who works for beer.', effectText: 'Injuries heal faster and cost nothing to treat', effects: ['injury-treatment-free', 'injury-heal-faster'], maxLevel: 3, baseCost: 180, costMult: 1.7, minReputation: 12 },
  { id: 'minibus', name: 'Club Minibus', description: "Fourteen seats and a smell nobody can explain.", effectText: 'Halves travel cost, cancels the away availability penalty', effects: ['travel-half', 'away-availability'], maxLevel: 1, baseCost: 320, costMult: 1, minReputation: 15 },
  { id: 'floodlights', name: 'Floodlights', description: 'Training after work, in November, like a real club.', effectText: `Winter training: +${SUNDAY_FLOODLIGHT_COMMITMENT_GROWTH} commitment across the squad every season, +${SUNDAY_FLOODLIGHT_REP} reputation`, effects: ['commitment-growth', 'reputation-on-purchase'], maxLevel: 1, baseCost: 450, costMult: 1, minReputation: 30 },
  { id: 'clubhouse', name: 'Clubhouse Access', description: 'Somewhere to have a pint and a post-mortem.', effectText: `+${SUNDAY_CLUBHOUSE_POSTMATCH_MORALE} morale after every home match per level, and better recruits`, effects: ['post-match-morale', 'recruit-quality'], maxLevel: 2, baseCost: 260, costMult: 1.8, minReputation: 20 },
  { id: 'coach', name: 'An Actual Coach', description: 'Someone who has read a book about football.', effectText: 'Players improve faster; tactical fit improves', effects: ['growth-rate', 'tactical-fit'], maxLevel: 3, baseCost: 240, costMult: 1.9, minReputation: 18 },
  { id: 'keeper-gloves', name: 'Goalkeeper Gloves', description: 'Because he has been going in bare-handed.', effectText: 'Improves whoever is in goal', effects: ['keeper-quality'], maxLevel: 2, baseCost: 60, costMult: 1.7, minReputation: 0 },
] as const;

/**
 * The one-off squad-morale bump the till pays when `id` is bought.
 *
 * HERE RATHER THAN AT THE TILL. `buySundayUpgrade` used to hold this ternary
 * inline, which meant the only way a card could quote the number was to write
 * it out a second time — and a card quoting its own copy of an effect is
 * precisely how `effectText` drifted away from what the game did in the first
 * place. The buy action and the Clubhouse's before/after preview now read the
 * same function, so they cannot disagree.
 */
export function sundayUpgradeMoraleBump(id: SundayUpgradeId): number {
  return id === 'kit' ? SUNDAY_KIT_MORALE_PER_LEVEL : 0;
}

/** The one-off reputation bump the till pays when `id` is bought — and hands
 *  back when the level is sold. Same reasoning as the morale bump above. */
export function sundayUpgradeRepBump(id: SundayUpgradeId): number {
  return id === 'kit'
    ? SUNDAY_KIT_REP_PER_LEVEL
    : id === 'nets' ? SUNDAY_NETS_REP
      : id === 'floodlights' ? SUNDAY_FLOODLIGHT_REP : 0;
}

export function getSundayUpgrade(id: SundayUpgradeId): SundayUpgradeInfo {
  return SUNDAY_UPGRADES.find(u => u.id === id) ?? SUNDAY_UPGRADES[0];
}

/** Cost of taking `id` from `level` to `level + 1`. */
export function sundayUpgradeCost(id: SundayUpgradeId, level: number): number {
  const info = getSundayUpgrade(id);
  return Math.round(info.baseCost * Math.pow(info.costMult, level));
}

/**
 * Weekly upkeep, per level of upgrade owned, in pounds.
 *
 * THE MISSING TRADE-OFF AND THE MISSING SINK, in one number. Measured over 24
 * careers x 10 seasons, the whole 21-level, £6,648 tree was maxed by median
 * season 6 — after which the club had NO expense that scaled with anything it
 * had built, income kept climbing with reputation, and the median balance ran
 * from £1,417 at season six to £12,071 at season ten. Money stopped being a
 * constraint permanently, which the audit named as quit-reason number one.
 *
 * Owning things costs money. The groundsman does not do it for love, the
 * floodlights are on a meter, the minibus needs an MOT. A maxed club carries
 * roughly £60 a week of standing cost against a good week's income of £250 —
 * enough that the last few levels are a decision rather than a formality, and
 * enough that a relegated club with a full trophy cabinet has a real problem.
 *
 * Scaled by the division's `costMult`, like every other standing cost: a
 * County Premier ground is held to a County Premier standard, and that is also
 * where the money piles up. A relegated club's bills fall with it.
 *
 * The escape valve is `mothballSundayUpgrade`, not a discount: a club in
 * trouble can sell the roller back and stop paying for it. Measured, that
 * valve is load-bearing — a pilot that buys every upgrade and never sells one
 * folds 13-17 times in 24 ten-season careers, and the same pilot selling a
 * level back after two weeks in the red folds 9, which is where the pre-upkeep
 * baseline sat (8).
 */
export const SUNDAY_UPGRADE_UPKEEP_PER_LEVEL = 3;
/**
 * Share of a level's purchase price recovered when it is mothballed.
 *
 * Deliberately punitive. Selling the club's kit back is what you do when the
 * alternative is folding, not a way to time the market — but it MUST exist,
 * because upkeep without a way out would turn a relegation into an
 * unrecoverable spiral for a club that had built well.
 */
export const SUNDAY_UPGRADE_MOTHBALL_REFUND = 0.25;
/** Squad morale hit for selling something the club owned. */
export const SUNDAY_UPGRADE_MOTHBALL_MORALE = -4;

// Per-upgrade effect magnitudes, so the systems that read them agree.
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
export const SUNDAY_CLUBHOUSE_RECRUIT_PER_LEVEL = 3;

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
/** Added to the multiplier per division above the bottom. The local sandwich
 *  shop pays more to be on a County Premier shirt, and at that level it has to:
 *  the referee, the pitch and the travel all cost `costMult` more. */
export const SUNDAY_SPONSOR_TIER_MULT = 0.18;
/** Sign-on is this many weeks of the weekly payment. */
export const SUNDAY_SPONSOR_SIGNON_WEEKS = 4;
/**
 * Bonus paid when a conditional deal's condition is met at expiry, in weeks of
 * the weekly payment.
 *
 * RAISED 8 → 12 alongside the retargeting below. The bonus used to be
 * guaranteed money — four of the five conditions passed on their own — so its
 * size did not matter. Now that a competent club fails one from time to time
 * it has to be worth chasing, and it is measured against a maxed club's
 * `SUNDAY_UPGRADE_UPKEEP_PER_LEVEL` bill rather than against nothing.
 */
export const SUNDAY_SPONSOR_BONUS_WEEKS = 12;
/** Reputation lost when a conditional deal is failed. */
export const SUNDAY_SPONSOR_FAIL_REP = 3;

// ── What a sponsor actually asks for ────────────────────────────────────────
//
// FOUR OF THE FIVE CONDITIONS USED TO PASS ON THEIR OWN. Measured over 24
// careers x 10 seasons of a competently-run club:
//
//   best win run      p25 2  p50 3  p75 4  p90 6   — asked for 2-4
//   best unbeaten run p25 3  p50 5  p75 7  p90 9   — asked for 3-6
//   goals for         p25 25 p50 33 p75 42 p90 50  — asked for 18-32
//   full XI fielded   ~every match (guests count)  — asked for 4-8
//
// So the "conditional" deal was a flat bonus with a sentence on it. The bands
// below sit around the 35th-50th percentile of that distribution, which is
// where a good season passes and an ordinary one is genuinely in doubt — and
// a struggling club fails most of them. The two that scale with the season's
// length do so explicitly: a County Premier campaign is 22 league matches and
// a Division Four one is 14, and asking both for the same 25 goals is how the
// band became meaningless at the top of the pyramid in the first place.

export const SUNDAY_SPONSOR_WIN_STREAK_MIN = 3;
export const SUNDAY_SPONSOR_WIN_STREAK_MAX = 4;
export const SUNDAY_SPONSOR_UNBEATEN_MIN = 4;
export const SUNDAY_SPONSOR_UNBEATEN_MAX = 6;
/** Goals asked for, per league match in the season. */
export const SUNDAY_SPONSOR_GOALS_PER_MATCH_MIN = 1.85;
export const SUNDAY_SPONSOR_GOALS_PER_MATCH_MAX = 2.25;
/**
 * Share of the season's league matches that must be started with a full XI of
 * the club's OWN players.
 *
 * The counter used to accept any eleven shirts, and guests are drafted to make
 * the numbers up, so it scored on essentially every fixture. Counting only
 * your own men makes it a condition about availability — which is the mode's
 * subject — rather than about whether the fixture went ahead.
 */
export const SUNDAY_SPONSOR_FULL_XI_SHARE_MIN = 0.85;
export const SUNDAY_SPONSOR_FULL_XI_SHARE_MAX = 1.00;
/** No-shows and forfeits tolerated, per league match in the season. Measured
 *  pooled across 24 careers x 10 seasons: p25 13, p50 18, p75 22 against 14-22
 *  league matches, so a rate of about 1.3 is the median club's own record. */
export const SUNDAY_SPONSOR_DISCIPLINE_PER_MATCH_MIN = 1.25;
export const SUNDAY_SPONSOR_DISCIPLINE_PER_MATCH_MAX = 1.70;

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
/** Added per division above the bottom. The standard of player who walks past
 *  a County Premier pitch and asks who to speak to is not the standard who
 *  walks past a Division Four one — and it is half the reason his signing-on
 *  fee is higher up there too (`sundayRecruitFee`). */
export const SUNDAY_RECRUIT_QUALITY_PER_TIER = 2;
/**
 * Signings the club may register in one season.
 *
 * WHY THERE IS A CAP AT ALL. Measured over 24 careers x 3 seasons, "sign every
 * recruit" was worth +0.30 ppg against the same pilot doing nothing else —
 * six times the whole upgrade tree and five times the tactic lever — for a
 * signing-on fee of at most sixty pounds. It was not a decision, it was a
 * button, and the mode's difficulty collapsed to whether the player had found
 * it. Three a season means every offer is measured against the two behind it,
 * which is what a Sunday club's registration window actually feels like.
 */
export const SUNDAY_RECRUIT_SIGNINGS_PER_SEASON = 3;

// ── What a signing costs ────────────────────────────────────────────────────
//
// A Sunday signing-on fee is not a transfer fee. It is his subs covered for
// the season, a shirt with his name nowhere on it, and a pair of boots if he
// is any good — so the band stays in tens of pounds at the bottom of the
// pyramid and reaches three figures only for a genuinely good player at a
// genuinely established club. The old flat 0-60 band priced a 60-rated County
// Premier arrival identically to a 38-rated Division Four one.

/** What anybody costs before quality and division are considered. */
export const SUNDAY_RECRUIT_FEE_BASE = 8;
/** Overall at which a recruit is "the ordinary standard" and costs the base. */
export const SUNDAY_RECRUIT_FEE_QUALITY_FLOOR = 38;
/** Pounds per point of overall above that floor. */
export const SUNDAY_RECRUIT_FEE_PER_QUALITY = 2.4;
/** Added to the multiplier per division above the bottom, so the County
 *  Premier pays 2.4x what Division Four pays for the same man. */
export const SUNDAY_RECRUIT_FEE_TIER_MULT = 0.35;
/** A poached rival costs more: he knows he is wanted, and so do they. */
export const SUNDAY_RECRUIT_FEE_POACH_MULT = 1.6;
/** Random spread around the computed fee, as a share of it. */
export const SUNDAY_RECRUIT_FEE_JITTER = 0.18;

/**
 * The signing-on fee for one recruit, in whole pounds.
 *
 * Pure and exported so the recruit card, the generator and the tests all read
 * the same number from the same place.
 */
export function sundayRecruitFee(
  overall: number,
  divisionId: SundayDivisionId,
  poached: boolean,
): number {
  const tier = Math.max(0, sundayDivisionTier(divisionId));
  const quality = Math.max(0, overall - SUNDAY_RECRUIT_FEE_QUALITY_FLOOR);
  const raw = (SUNDAY_RECRUIT_FEE_BASE + quality * SUNDAY_RECRUIT_FEE_PER_QUALITY)
    * (1 + tier * SUNDAY_RECRUIT_FEE_TIER_MULT)
    * (poached ? SUNDAY_RECRUIT_FEE_POACH_MULT : 1);
  return Math.max(0, Math.round(raw));
}

/**
 * Happiness cost to the man whose shirt the new arrival has come for.
 *
 * Deliberately the SAME arithmetic the match-day "available and not picked"
 * branch uses — the hit is scaled by ego through `SUNDAY_HAPPY_EGO_MULT` — so
 * the dressing room reacts to being replaced the way it already reacts to
 * being left out, rather than through a second, parallel grudge system.
 */
export const SUNDAY_SIGNING_DISPLACED_HAPPINESS = -6;
/** How many squad members in the arrival's position feel it. */
export const SUNDAY_SIGNING_DISPLACED_MAX = 2;
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
/** Weeks a story marker in `SundayState.flags` survives before it is swept. */
export const SUNDAY_FLAG_EXPIRY_WEEKS = 6;

// ── Clustering protection ───────────────────────────────────────────────────
//
// Randomness is managed, not removed. Left alone, a 0.55 weekly roll over a
// pool with plenty of negative entries produces runs — a forfeit, then somebody
// walking out, then a bill, three Sundays in a row — which reads as the game
// piling on rather than as a season having a bad month. Two rules, both
// deterministic off the existing week-keyed stream:
//
//   1. the week AFTER something genuinely bad, negative events are down-WEIGHTED
//      (never zeroed: a bad month is allowed to be a bad month)
//   2. no two departure-causing events inside `SUNDAY_EVENT_DEPARTURE_GAP`
//
// Chain beats are exempt from both. A story that has started must be allowed to
// finish on schedule, and its beats are already rationed by the chain cap.

/** Weight multiplier on `tone: 'negative'` events the week after a forfeit, a
 *  walk-out, or an event resolution that cost the club money or morale. */
export const SUNDAY_EVENT_NEGATIVE_DAMPING = 0.35;
/** Weeks that must pass between two events that can cost the club a player. */
export const SUNDAY_EVENT_DEPARTURE_GAP = 5;
/** Marker set for the week after something genuinely bad happened. */
export const SUNDAY_ROUGH_WEEK_FLAG = 'rough-week';
/** Marker set the week an event cost the club a player. */
export const SUNDAY_DEPARTURE_FLAG = 'departure';

// ── Event chains ────────────────────────────────────────────────────────────

/** How one chain behaves. Content lives in `src/data/sundayEvents.ts`; this is
 *  the shape and the clock. */
export interface SundayChainInfo {
  id: SundayChainId;
  /** A player chain is ABOUT somebody and binds its beats to him; a club chain
   *  is about the club. ONE OF EACH may be live at a time — that cap is what
   *  stops the mode telling four tangled stories about the same fortnight. */
  kind: 'player' | 'club';
  /** Weeks the next beat has to arrive on its own before it is forced. Short
   *  enough that a story keeps moving, long enough that it can be interrupted
   *  by an ordinary Sunday or two. */
  durationWeeks: number;
  /** The last step. Every definition at this step must end the chain, which
   *  `sundayEvents.test.ts` enforces — that is what guarantees termination. */
  terminalStep: number;
}

export const SUNDAY_CHAINS: readonly SundayChainInfo[] = [
  { id: 'rival-defection',  kind: 'player', durationWeeks: 4, terminalStep: 2 },
  { id: 'captain-conflict', kind: 'player', durationWeeks: 3, terminalStep: 3 },
  { id: 'star-arc',         kind: 'player', durationWeeks: 4, terminalStep: 3 },
  { id: 'wonderkid',        kind: 'player', durationWeeks: 4, terminalStep: 3 },
  { id: 'veteran-farewell', kind: 'player', durationWeeks: 3, terminalStep: 3 },
  { id: 'financial-crisis', kind: 'club',   durationWeeks: 3, terminalStep: 3 },
  // Three weeks is deliberate: the cup rounds sit roughly seven weeks apart,
  // so a beat forced on the deadline still lands between ties rather than
  // describing an afternoon that has not happened. The beats themselves check
  // `cupAlive`, which is what keeps the copy honest either way.
  { id: 'cup-run',          kind: 'club',   durationWeeks: 3, terminalStep: 3 },
] as const;

export function getSundayChain(id: SundayChainId): SundayChainInfo {
  return SUNDAY_CHAINS.find(c => c.id === id) ?? SUNDAY_CHAINS[0];
}

/**
 * Weeks of headroom a chain's deadline keeps clear of the season's end.
 *
 * ROLLOVER POLICY, stated once: no chain survives the summer. Sunday teams
 * re-form every year, the opposition is regenerated and event cooldowns are
 * meaningless across the boundary, so a half-told story would resume in a
 * different league against different people. Instead of carrying chains over,
 * every deadline is CLAMPED to `totalWeeks - SUNDAY_CHAIN_SEASON_MARGIN`, which
 * forces the remaining beats to fire and resolve while the season still exists.
 * `rolloverSundaySeason` then clears the list as a backstop.
 */
export const SUNDAY_CHAIN_SEASON_MARGIN = 2;
/** Consecutive weeks under `SUNDAY_DEBT_FLOOR` before the committee chain can
 *  open. Deliberately shorter than `SUNDAY_BANKRUPT_GRACE_WEEKS`: the crisis
 *  story has to have room to run before the fold clock runs out. */
export const SUNDAY_CHAIN_DEBT_WEEKS = 3;
/** Age at which a long-serving player starts talking about his knees. */
export const SUNDAY_CHAIN_VETERAN_AGE = 35;
/** Appearances that make him a long-SERVER rather than an old signing. */
export const SUNDAY_CHAIN_VETERAN_APPS = 20;
/** Overall at which a Sunday player is unmistakably the best thing here. */
export const SUNDAY_CHAIN_STAR_OVERALL = 48;
/** Overall a prospect must still be UNDER for the wonderkid story to be about
 *  a breakthrough rather than about somebody who has already broken through. */
export const SUNDAY_CHAIN_PROSPECT_CEILING = 52;
/** What the local rival's committee will put up for your best player when the
 *  club is desperate. Sunday-scale: a bag of cash and a set of match balls. */
export const SUNDAY_CRISIS_SALE_FEE = 85;
/** Cash a renegotiated sponsor deal pays up front, and what it does to the
 *  weekly. Real money now for less money later — a genuine trade. */
export const SUNDAY_SPONSOR_RENEGOTIATE_UPFRONT = 70;
export const SUNDAY_SPONSOR_RENEGOTIATE_MULT = 0.6;
/** The standing derby bet with the rival manager, in pounds. Staked when it is
 *  made and settled on the next derby result — see `runSundayMatch`. */
export const SUNDAY_DERBY_BET = 50;
/** Flag name the standing bet is held under. Exempt from the weekly flag
 *  sweep: the next derby can be ten weeks away and the bet is still on. */
export const SUNDAY_DERBY_BET_FLAG = 'derby-bet';

// ── The manager's own pocket ────────────────────────────────────────────────
//
// Putting your own money in used to be free: `broke`'s own-pocket branch paid
// the club £60 and cost nothing at all, so a club could stay solvent on it
// indefinitely and the bankruptcy pressure the mode is built around never
// arrived. It is a LOAN now — real cash today, paid back out of the weekly
// settlement — so it fixes cash flow without inventing money.

/** What the manager puts in when he covers the club, in pounds. */
export const SUNDAY_MANAGER_LOAN = 100;
/** Paid back per week, while the club can afford it. Six or seven weeks of
 *  a real drain on a budget where a good week is £120. */
export const SUNDAY_MANAGER_LOAN_REPAYMENT = 16;

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

// ── Narrative colour ────────────────────────────────────────────────────────

/**
 * How many lines in one match feed may come from the squad's own records
 * rather than from the event stream — the scorer's weekday job, the run of
 * form he is on.
 *
 * TWO, deliberately. These lines are the difference between "someone scored"
 * and "the scaffolder scored", and their whole value is that they are rare;
 * at one per goal they became the wallpaper they were meant to break up.
 */
export const SUNDAY_NARRATIVE_COLOUR_MAX = 2;
/**
 * Chance a qualifying goal actually takes one of those slots.
 *
 * The "in form" variant is gated on `SUNDAY_FORM_HOT` — the same threshold the
 * squad screen uses to name a streak, so the feed and the squad list agree
 * about who is playing well. Form is moved by match RATINGS
 * (`SUNDAY_FORM_PER_RATING`), so those lines may only claim something about how
 * he has been PLAYING. There is no goal-streak counter in the mode, which is
 * why nothing says "third Sunday running": that would be invented.
 */
export const SUNDAY_NARRATIVE_COLOUR_CHANCE = 0.5;

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
  'unlikely-hero': 8,
  'talked-round': 3,
};

/**
 * Weight at which a memory stops being a note and becomes one for the
 * clubhouse wall.
 *
 * Presentation only — nothing about how a memory is written or pruned changes
 * at this line. It exists so the squad biography and the season's moment can
 * mark the handful of afternoons a club actually retells.
 */
export const SUNDAY_MEMORY_LEGENDARY_WEIGHT = 8;

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
