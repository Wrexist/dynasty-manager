import type { CupRound } from '@/types/game';

// ── Legacy fabricated qualifiers ──
/** Id prefix of the fabricated filler clubs the draw used to invent when the
 *  qualification tables came up short of 32. Nothing creates these any more
 *  (`generateContinentalDraw` backfills with real clubs), but saves drawn
 *  before the fix can still carry them, so every consumer that could promote
 *  one into a playable fixture must screen for the prefix. */
export const PLACEHOLDER_CLUB_PREFIX = 'placeholder-';

/** True for a fabricated filler club id — no squad, no club data, unplayable. */
export function isPlaceholderClubId(clubId: string): boolean {
  return typeof clubId === 'string' && clubId.startsWith(PLACEHOLDER_CLUB_PREFIX);
}

// ── Continental Tournament Groups ──
export const CONTINENTAL_GROUPS = 8;
export const CONTINENTAL_TEAMS_PER_GROUP = 4;
export const CONTINENTAL_TOTAL_TEAMS = CONTINENTAL_GROUPS * CONTINENTAL_TEAMS_PER_GROUP; // 32

// Keep old exports as aliases for backwards compatibility in imports
export const CHAMPIONS_CUP_GROUPS = CONTINENTAL_GROUPS;
export const CHAMPIONS_CUP_TEAMS_PER_GROUP = CONTINENTAL_TEAMS_PER_GROUP;

// ── Rank-Based Qualification Spots ──
// Leagues are ranked 1-30 based on coefficient + reputation.
// Spots per league rank for each continental competition.

// Champions Cup: 32 teams total
// Rank 1-4: 4 spots, Rank 5: 3, Rank 6-8: 2, Rank 9-15: 1 (champion), 16+: 0
// + 1 reserved for Shield Cup holder (bumps out last slot if needed)
export const CHAMPIONS_CUP_SPOTS_BY_RANK: Record<number, number> = {
  1: 4, 2: 4, 3: 4, 4: 4,
  5: 3,
  6: 2, 7: 2, 8: 2,
  9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
};

// Shield Cup: 32 teams total
// Rank 1-4: 2 spots (positions after CL), Rank 5: 2, Rank 6-8: 1,
// Rank 9-15: 1 (runner-up or cup winner), Rank 16-27: 1 (cup winner)
//
// IMPORTANT — the league spots below must sum to CONTINENTAL_TOTAL_TEAMS (32)
// ON THEIR OWN. The Conference Cup holder's guaranteed spot is a BONUS that
// only materialises when that club hasn't already qualified via its league,
// so a table that relies on it to reach 32 is short in the common case, and
// `generateContinentalDraw` then has to invent filler. Sum: 2*5 + 1*3 + 1*7
// + 1*12 = 32.
export const SHIELD_CUP_SPOTS_BY_RANK: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 2,
  6: 1, 7: 1, 8: 1,
  9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
  16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1,
  23: 1, 24: 1, 25: 1, 26: 1, 27: 1,
};

// Conference Cup: 32 teams total
// Rank 1-5: 1 spot (next position after Shield), Rank 6-15: 1 spot,
// Rank 16-32: 1 spot (champion or cup winner)
//
// Sums to exactly 32 league spots (ranks 1-32 of the 37 ranked top-tier
// leagues). It previously stopped at rank 30 and leaned on the domestic cup
// winner to reach 31 — leaving the draw two teams short EVERY season, which
// `generateContinentalDraw` padded with reputation-1 `placeholder-N` clubs.
// Those could top a group, win the whole competition, and then be pushed
// into the next season's Shield Cup as the holder with no `virtualClubs`
// entry — which made the player's match that week unplayable.
export const CONFERENCE_CUP_SPOTS_BY_RANK: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
  16: 1, 17: 1, 18: 1, 19: 1, 20: 1,
  21: 1, 22: 1, 23: 1, 24: 1, 25: 1,
  26: 1, 27: 1, 28: 1, 29: 1, 30: 1,
  31: 1, 32: 1,
};

// ── Living World (Phase 6) ──
// `initGame` historically instantiated `Club` + squad objects ONLY for the
// player's own country, so 92 of 756 clubs were real in an English save and
// 18 in a Dutch one. Every continental opponent was an ephemeral throwaway
// (`createEphemeralClub`) — a name plus a squad generated on demand from
// reputation and discarded after the match. Real Madrid in the Champions Cup
// was effectively the integer 5.
//
// The living world instantiates the top tier of the strongest foreign
// leagues as REAL, PERSISTED clubs: they play their own domestic season,
// develop, accumulate goals/assists (so the Ballon d'Or is a global award
// again), carry Elo + continental coefficients, and can be scouted and
// bought from.
//
// This is the single most expensive knob in the game: each instantiated
// league costs ~18 clubs / ~380 players (~550 kB of save payload) and a full
// round of AI match simulation every week. Measured on an English save
// (Manchester City, 38-week season, node/jsdom — an iPhone is slower):
//
//   N   init      save @ wk12    save @ season end   ms / week (full season)
//   0   210 ms    2.58 MB        3.78 MB             127
//   3   217 ms    3.86 MB        —                   214 (12-week sample)
//   4   220 ms    4.26 MB        6.41 MB             238
//   5   254 ms    4.58 MB        —                   252 (12-week sample)
//   8   324 ms    5.62 MB        —                   344 (12-week sample)
//
// 4 is the chosen point: init is essentially unchanged, the save grows 1.7x
// (inside the "must not much more than double" budget), the weekly tick stays
// well under the 500 ms target from docs/perf-baseline.md, and for a top-5
// country it instantiates exactly the OTHER four of the big five — Real
// Madrid, Barcelona, Bayern, Dortmund, Inter, Milan, Juventus, PSG all become
// real. N=8 buys three more mid-tier leagues for a save that no longer fits
// the ~5 MB WKWebView localStorage mirror (IndexedDB still holds it, but every
// autosave then writes 5.6 MB+ and re-mirrors on every tick).
//
// Note that a single-tier home country pays proportionally more: a Dutch save
// goes 0.61 MB → 2.34 MB (3.8x) because its own pyramid is only 18 clubs. The
// absolute number is what matters, and 2.34 MB is still below what an English
// save has always shipped.
//
// Re-measure before changing this.
export const LIVING_WORLD_LEAGUE_COUNT = 4;

/** Cap on the squad size instantiated for a foreign living-world club.
 *  Club templates hand out ~28-man squads; foreign clubs are AI-only, so we
 *  keep the best `N` (stars first — the recognisable names are the entire
 *  point) plus a guaranteed second keeper. Trims ~30% of the save cost. */
export const LIVING_WORLD_SQUAD_SIZE = 20;

// ── Legacy tier-based exports (kept for any remaining references) ──
export const CHAMPIONS_CUP_SPOTS: Record<number, number> = { 1: 4, 2: 2, 3: 1, 4: 0 };
export const CHAMPIONS_CUP_TIER3_MAX = 4;
export const SHIELD_CUP_TOTAL_TEAMS = 32;
export const SHIELD_CUP_SPOTS: Record<number, number> = { 1: 3, 2: 2, 3: 1, 4: 1 };
export const SHIELD_CUP_TIER3_MAX = 10;
export const SHIELD_CUP_TIER4_MAX = 7;

// ── Week Schedule ──
// ALL week constants below describe the REFERENCE 46-week calendar. Most
// leagues run shorter seasons (state.totalWeeks, 18–58): consumers must go
// through getCompetitionCalendar(totalWeeks), which compresses the schedule
// while preserving the load-bearing run-in ordering (see below). Using the
// raw constants in a 38-week league put the Cup Final (week 43) and the
// continental knockouts (weeks 38-44) AFTER the season had already ended —
// they silently never happened in 40 of 45 leagues.

// Continental group stage matchdays (6 matchdays) — shared by all 3 competitions
export const CONTINENTAL_GROUP_WEEKS = [6, 10, 16, 22, 26, 30] as const;
// Continental knockout rounds (2-leg ties, except final which is single leg)
export const CONTINENTAL_R16_WEEKS = [34, 35] as const;
export const CONTINENTAL_QF_WEEKS = [38, 39] as const;
export const CONTINENTAL_SF_WEEKS = [41, 42] as const;
export const CONTINENTAL_FINAL_WEEK = 44;

// ── Domestic League Cup ──
export const LEAGUE_CUP_WEEKS: Record<CupRound, number> = {
  R1: 3,
  R2: 7,
  R3: 12,
  R4: 18,
  QF: 24,
  SF: 32,
  F: 40,
};

// ── Super Cups ──
export const DOMESTIC_SUPER_CUP_WEEK = 1;
export const CONTINENTAL_SUPER_CUP_WEEK = 2;

// ── Calendar Scaling ──
// Reference Dynasty Cup round weeks (the canonical copy — src/data/cup.ts
// imports this so config never depends on data/).
export const REF_CUP_WEEKS: Record<CupRound, number> = {
  R1: 4,
  R2: 8,
  R3: 14,
  R4: 20,
  QF: 28,
  SF: 36,
  F: 43,
};

/** Length of the reference calendar all week constants are authored against. */
export const REF_TOTAL_WEEKS = 46;
/** First week of the choreographed run-in (continental QF leg 1). Everything
 *  from here on keeps its OFFSET FROM SEASON END when the calendar is
 *  compressed, so the load-bearing ordering — continental QF legs → League
 *  Cup Final → continental SF legs → Cup Final → continental Final — stays
 *  intact and collision-free at every season length (min totalWeeks is 18;
 *  the run-in needs the last 9 weeks). */
const REF_TAIL_START = 38;

/** Map a reference-calendar week onto a `totalWeeks`-week season.
 *  - 46+ week seasons use the reference calendar unchanged.
 *  - Run-in weeks (>= REF_TAIL_START) keep their offset from season end.
 *  - Earlier weeks compress proportionally into the body, capped one week
 *    short of the run-in. */
export function scaleCompetitionWeek(refWeek: number, totalWeeks: number): number {
  if (!totalWeeks || totalWeeks >= REF_TOTAL_WEEKS) return refWeek;
  if (refWeek >= REF_TAIL_START) {
    return Math.max(2, totalWeeks - (REF_TOTAL_WEEKS - refWeek));
  }
  const bodyEnd = Math.max(2, totalWeeks - (REF_TOTAL_WEEKS - REF_TAIL_START) - 1);
  // NOTE: the body deliberately starts at week 1 and can therefore land on the
  // Super Cup weeks (raw constants 1 and 2). Raising the floor to clear them
  // squeezes the 18-week body hard enough to make continental milestones collide
  // with each other, which is worse. The Super Cups are protected instead by the
  // `week >= scheduledWeek` catch-up in `weekAdvance` and `playCurrentMatchImpl`,
  // so a collision can delay them by a week but never strand them.
  return Math.min(bodyEnd, Math.max(1, Math.round((refWeek * bodyEnd) / (REF_TAIL_START - 1))));
}

export interface CompetitionCalendar {
  cupWeeks: Record<CupRound, number>;
  leagueCupWeeks: Record<CupRound, number>;
  groupWeeks: readonly number[];
  r16Weeks: readonly [number, number];
  qfWeeks: readonly [number, number];
  sfWeeks: readonly [number, number];
  finalWeek: number;
}

/** Scale a sequence of reference weeks, enforcing strictly-increasing weeks
 *  (consecutive rounds can never share a week — round N's result feeds round
 *  N+1's draw). */
function scaleSequence(refWeeks: readonly number[], totalWeeks: number): number[] {
  let prev = 0;
  return refWeeks.map(ref => {
    const scaled = Math.max(scaleCompetitionWeek(ref, totalWeeks), prev + 1);
    prev = scaled;
    return scaled;
  });
}

const calendarCache = new Map<number, CompetitionCalendar>();

/**
 * The full competition calendar for a season of `totalWeeks` weeks.
 * Memoized per length. Invariants (covered by competitionCalendar.test.ts):
 * every week is within [1, totalWeeks]; rounds within a competition are
 * strictly increasing; the run-in keeps LC Final < continental SF legs <
 * Cup Final < continental Final distinct. In ultra-short calendars (18-22
 * weeks) body-week collisions ACROSS competitions are tolerated — the
 * weekAdvance catch-up recovery auto-sims any player match left behind by
 * a same-week collision, so a collision can no longer hang a tournament.
 */
export function getCompetitionCalendar(totalWeeks?: number): CompetitionCalendar {
  const w = totalWeeks && totalWeeks > 0 ? Math.round(totalWeeks) : REF_TOTAL_WEEKS;
  const cached = calendarCache.get(w);
  if (cached) return cached;

  const rounds: CupRound[] = ['R1', 'R2', 'R3', 'R4', 'QF', 'SF', 'F'];
  const buildCupRecord = (ref: Record<CupRound, number>): Record<CupRound, number> => {
    // Body rounds (R1..SF) scale proportionally + monotonic; the Final is
    // run-in-anchored by scaleCompetitionWeek itself.
    const body = scaleSequence(rounds.slice(0, 6).map(r => ref[r]), w);
    const rec = {} as Record<CupRound, number>;
    rounds.slice(0, 6).forEach((r, i) => { rec[r] = body[i]; });
    rec.F = scaleCompetitionWeek(ref.F, w);
    return rec;
  };

  const groupAndR16 = scaleSequence([...CONTINENTAL_GROUP_WEEKS, ...CONTINENTAL_R16_WEEKS], w);
  const calendar: CompetitionCalendar = {
    cupWeeks: buildCupRecord(REF_CUP_WEEKS),
    leagueCupWeeks: buildCupRecord(LEAGUE_CUP_WEEKS),
    groupWeeks: groupAndR16.slice(0, 6),
    r16Weeks: [groupAndR16[6], groupAndR16[7]],
    qfWeeks: [scaleCompetitionWeek(CONTINENTAL_QF_WEEKS[0], w), scaleCompetitionWeek(CONTINENTAL_QF_WEEKS[1], w)],
    sfWeeks: [scaleCompetitionWeek(CONTINENTAL_SF_WEEKS[0], w), scaleCompetitionWeek(CONTINENTAL_SF_WEEKS[1], w)],
    finalWeek: scaleCompetitionWeek(CONTINENTAL_FINAL_WEEK, w),
  };
  calendarCache.set(w, calendar);
  return calendar;
}

// ── Match Simulation ──
export const CONTINENTAL_EXTRA_TIME_GOAL_CHANCE = 0.30;
export const CONTINENTAL_PENALTY_KICKS = 5;
export const CONTINENTAL_PENALTY_CONVERSION = 0.75;

// ── Prize Money ──
export const CONTINENTAL_PRIZE_MONEY = {
  // Champions Cup (elite)
  champions_group: 300_000,       // per match (6 matches = 1.8M potential)
  champions_r16: 500_000,
  champions_qf: 750_000,
  champions_sf: 1_000_000,
  champions_winner: 3_000_000,
  champions_runner_up: 1_500_000,
  // Shield Cup (secondary)
  shield_group: 150_000,          // per match (6 matches = 900k potential)
  shield_r16: 250_000,
  shield_qf: 400_000,
  shield_sf: 600_000,
  shield_winner: 1_000_000,
  shield_runner_up: 500_000,
  // Conference Cup (third tier)
  conference_group: 75_000,       // per match (6 matches = 450k potential)
  conference_r16: 125_000,
  conference_qf: 200_000,
  conference_sf: 300_000,
  conference_winner: 500_000,
  conference_runner_up: 250_000,
  // Domestic cups
  league_cup_winner: 300_000,
  league_cup_runner_up: 100_000,
  domestic_super_cup: 100_000,
  continental_super_cup: 200_000,
  // Domestic Dynasty Cup (main domestic knockout — should feel rewarding)
  dynasty_cup_r1: 25_000,
  dynasty_cup_r2: 50_000,
  dynasty_cup_r3: 100_000,
  dynasty_cup_r4: 175_000,
  dynasty_cup_qf: 300_000,
  dynasty_cup_sf: 500_000,
  dynasty_cup_winner: 1_500_000,
  dynasty_cup_runner_up: 600_000,
} as const;

// ── Continental Coefficient System ──
/** Points awarded per achievement in continental tournaments */
export const COEFF_GROUP_WIN = 2;
export const COEFF_GROUP_DRAW = 1;
export const COEFF_QUALIFY_KNOCKOUT = 4;   // bonus for reaching knockouts
export const COEFF_R16_WIN = 2;
export const COEFF_QF_WIN = 3;
export const COEFF_SF_WIN = 4;
export const COEFF_FINAL_WIN = 5;
export const COEFF_SHIELD_MULTIPLIER = 0.7;     // Shield Cup points are worth 70% of Champions Cup
export const COEFF_CONFERENCE_MULTIPLIER = 0.5;  // Conference Cup points are worth 50% of Champions Cup
/** Number of seasons to include in coefficient calculation */
export const COEFF_SEASON_WINDOW = 5;
/** Weight decay per season (most recent = 1.0, oldest = 0.2) */
export const COEFF_SEASON_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2];
/** Blend ratio: coefficient vs reputation for seeding (0 = all reputation, 1 = all coefficient) */
export const COEFF_SEEDING_BLEND = 0.6;

// ── Reputation Rewards ──
export const REP_CHAMPIONS_CUP_WIN = 80;
export const REP_SHIELD_CUP_WIN = 50;
export const REP_CONFERENCE_CUP_WIN = 30;
export const REP_LEAGUE_CUP_WIN = 25;
export const REP_CONTINENTAL_GROUP = 15;
export const REP_CONTINENTAL_KNOCKOUT = 10; // per round advanced

// ── Group Stage Round-Robin Fixture Template ──
// For a group of 4 teams (indices 0-3), 6 matchdays
// Each tuple: [homeIndex, awayIndex]
export const GROUP_FIXTURE_TEMPLATE: [number, number][][] = [
  [[0, 1], [2, 3]], // MD1
  [[0, 2], [3, 1]], // MD2
  [[1, 2], [3, 0]], // MD3
  [[1, 0], [3, 2]], // MD4 (reverse of MD1)
  [[2, 0], [1, 3]], // MD5 (reverse of MD2)
  [[2, 1], [0, 3]], // MD6 (reverse of MD3)
];
