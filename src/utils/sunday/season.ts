/**
 * Sunday League — season structure and rollover.
 *
 * Owns the calendar (which weeks are league, cup or free), the knockout cup,
 * the end-of-season table maths, promotion and relegation across the local
 * pyramid, player ageing, and the club's permanent record of itself.
 *
 * THE CALENDAR IS DERIVED, NOT STORED. A week's kind is read back off the
 * fixtures rather than kept in a parallel array, so the two can never disagree
 * — a bug class the elite game has been bitten by (see the cup-week
 * choreography note in `src/data/cup.ts`).
 */
import type {
  LeagueTableEntry, Match, Player, SundayCupState, SundayCupTie, SundayDivisionId,
  SundayLegend, SundayRecordEntry, SundaySeasonRecord, SundaySquadMember, SundayState,
} from '@/types/game';
import {
  SUNDAY_CUP_ROUNDS, SUNDAY_DECLINE_AGE, SUNDAY_DECLINE_PER_SEASON,
  SUNDAY_FREE_WEEKS_PER_SEASON, SUNDAY_GROWTH_AGE, SUNDAY_GROWTH_MINUTES_TARGET,
  SUNDAY_GROWTH_PER_SEASON, SUNDAY_LEGEND_APPS, SUNDAY_LEGEND_GOALS, SUNDAY_LEGENDS_MAX,
  SUNDAY_OVERALL_CEILING, SUNDAY_OVERALL_FLOOR, SUNDAY_POINTS_DRAW, SUNDAY_POINTS_WIN,
  SUNDAY_RECORDS_MAX, SUNDAY_COACH_GROWTH_PER_LEVEL, SUNDAY_DIVISIONS,
  getSundayDivision, sundayDivisionTier,
} from '@/config/sundayLeague';
import { SUNDAY_RECORD_LABELS } from '@/data/sundayNames';
import { calculateOverall } from '@/utils/playerGen';
import type { SundayRng } from './rng';

const clampAttr = (v: number) => Math.max(1, Math.min(99, Math.round(v)));

// ── Calendar ────────────────────────────────────────────────────────────────

/** League rounds a division needs: a full double round-robin. */
export function sundayLeagueRounds(teamCount: number): number {
  return teamCount % 2 === 0 ? 2 * (teamCount - 1) : 2 * teamCount;
}

/** Total weeks in a Sunday season, including cup and free weeks. */
export function sundaySeasonWeeks(divisionId: SundayDivisionId): number {
  const div = getSundayDivision(divisionId);
  return sundayLeagueRounds(div.teamCount) + SUNDAY_CUP_ROUNDS + SUNDAY_FREE_WEEKS_PER_SEASON;
}

/**
 * Weeks the cup rounds sit on.
 *
 * Spread evenly with the final on the last week of the season, so the season
 * ends on the biggest possible afternoon rather than trailing off after it.
 */
export function sundayCupWeeks(divisionId: SundayDivisionId): number[] {
  const total = sundaySeasonWeeks(divisionId);
  const weeks: number[] = [];
  for (let r = 1; r <= SUNDAY_CUP_ROUNDS; r++) {
    weeks.push(Math.round((total * r) / SUNDAY_CUP_ROUNDS));
  }
  // Round-off can collide two rounds on one week in a short season; push
  // duplicates back so every round has an afternoon of its own.
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] <= weeks[i - 1]) weeks[i] = weeks[i - 1] + 1;
  }
  return weeks;
}

/**
 * Build a season's league fixtures: a full double round-robin.
 *
 * Rolled by hand rather than reusing `generateFixtures` from
 * `src/data/league.ts` for two reasons, both of which bit during development:
 * that helper shuffles with `Math.random()` and mints `crypto.randomUUID()`
 * ids, so the same seed produced a different calendar on every boot and the
 * ids changed on every rebuild; and it already emits BOTH halves, which is
 * easy to mirror a second time by mistake and end up with 112 fixtures in a
 * 14-round season.
 *
 * Rounds are laid onto the weeks that are NOT cup weeks, in order, so a league
 * fixture can never collide with a cup tie — the collision class the elite
 * game documents at length in `src/data/cup.ts` is designed out here rather
 * than choreographed around.
 */
export function buildSundayFixtures(rng: SundayRng, divisionId: SundayDivisionId, clubIds: readonly string[]): Match[] {
  const teams = rng.shuffle(clubIds);
  if (teams.length < 2) return [];
  // Circle method needs an even field; an odd one gets a bye that is skipped.
  const field = teams.length % 2 === 0 ? [...teams] : [...teams, '__bye__'];
  const n = field.length;
  const roundsPerHalf = n - 1;

  const cupWeeks = new Set(sundayCupWeeks(divisionId));
  const total = sundaySeasonWeeks(divisionId);
  const playableWeeks: number[] = [];
  for (let w = 1; w <= total && playableWeeks.length < roundsPerHalf * 2; w++) {
    if (!cupWeeks.has(w)) playableWeeks.push(w);
  }
  // A short calendar (only possible if the constants are edited badly) must not
  // silently pile fixtures onto the last week — pad with weeks past the end so
  // the invariant check surfaces the misconfiguration instead of hiding it.
  while (playableWeeks.length < roundsPerHalf * 2) {
    playableWeeks.push((playableWeeks[playableWeeks.length - 1] ?? 0) + 1);
  }

  const out: Match[] = [];
  const rotating = [...field];
  for (let round = 0; round < roundsPerHalf; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = rotating[i];
      const away = rotating[n - 1 - i];
      if (home === '__bye__' || away === '__bye__') continue;
      // Alternate home advantage by round so no club is at home for the whole
      // first half of the season.
      const flip = round % 2 === 1;
      const h = flip ? away : home;
      const a = flip ? home : away;
      out.push({
        id: `sun-lg-${divisionId}-${round}-${h}-${a}`,
        week: playableWeeks[round],
        homeClubId: h, awayClubId: a,
        played: false, homeGoals: 0, awayGoals: 0, events: [],
      });
      out.push({
        id: `sun-lg-${divisionId}-${round + roundsPerHalf}-${a}-${h}`,
        week: playableWeeks[round + roundsPerHalf],
        homeClubId: a, awayClubId: h,
        played: false, homeGoals: 0, awayGoals: 0, events: [],
      });
    }
    // Rotate: first team fixed, the rest cycle.
    const last = rotating.pop();
    if (last) rotating.splice(1, 0, last);
  }

  return out.sort((x, y) => x.week - y.week);
}

// ── Cup ─────────────────────────────────────────────────────────────────────

/**
 * Draw the local cup: eight clubs, three rounds, the player's club always in.
 *
 * Only round one is drawn up front. Later rounds are drawn from the actual
 * winners as they emerge (`advanceSundayCup`), which is both how a cup works
 * and the only way to guarantee a bracket can never name a club that has
 * already been knocked out.
 */
export function drawSundayCup(rng: SundayRng, divisionId: SundayDivisionId, clubIds: readonly string[], playerClubId: string): SundayCupState {
  const others = rng.shuffle(clubIds.filter(id => id !== playerClubId)).slice(0, 7);
  const entrants = rng.shuffle([playerClubId, ...others]);
  const weeks = sundayCupWeeks(divisionId);
  const ties: SundayCupTie[] = [];
  for (let i = 0; i < entrants.length; i += 2) {
    if (!entrants[i + 1]) break;
    ties.push({
      round: 1, week: weeks[0],
      homeClubId: entrants[i], awayClubId: entrants[i + 1],
      played: false, homeGoals: 0, awayGoals: 0, winnerClubId: null, shootout: null,
    });
  }
  return { name: 'The Sunday Cup', entrants, ties, eliminated: false, winnerClubId: null };
}

/** Round `round` is complete when every one of its ties has been played. */
export function isSundayCupRoundComplete(cup: SundayCupState, round: number): boolean {
  const ties = cup.ties.filter(t => t.round === round);
  return ties.length > 0 && ties.every(t => t.played);
}

/**
 * Draw the next cup round from the winners of the last.
 *
 * Idempotent: if the next round already exists it returns the state unchanged,
 * so a double-advance (a re-render, a resumed save, a rapid double tap) cannot
 * produce a duplicate bracket.
 */
export function advanceSundayCup(cup: SundayCupState, divisionId: SundayDivisionId, round: number): SundayCupState {
  if (!isSundayCupRoundComplete(cup, round)) return cup;
  if (cup.ties.some(t => t.round === round + 1)) return cup;
  const winners = cup.ties.filter(t => t.round === round).map(t => t.winnerClubId).filter((id): id is string => !!id);
  if (winners.length <= 1) {
    return { ...cup, winnerClubId: winners[0] ?? cup.winnerClubId };
  }
  if (round >= SUNDAY_CUP_ROUNDS) {
    return { ...cup, winnerClubId: winners[0] ?? cup.winnerClubId };
  }
  const weeks = sundayCupWeeks(divisionId);
  const ties: SundayCupTie[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break;
    ties.push({
      round: round + 1, week: weeks[round] ?? weeks[weeks.length - 1],
      homeClubId: winners[i], awayClubId: winners[i + 1],
      played: false, homeGoals: 0, awayGoals: 0, winnerClubId: null, shootout: null,
    });
  }
  return { ...cup, ties: [...cup.ties, ...ties] };
}

/** English name for a cup round, given how many rounds there are. */
export function sundayCupRoundName(round: number): string {
  const fromEnd = SUNDAY_CUP_ROUNDS - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-Final';
  if (fromEnd === 2) return 'Quarter-Final';
  return `Round ${round}`;
}

// ── Table ───────────────────────────────────────────────────────────────────

/**
 * Build the division table from played fixtures.
 *
 * Deliberately NOT `buildLeagueTable` from `src/data/league.ts`: that one is
 * memoised on a cache key built from the fixture list, and Sunday fixture ids
 * are stable across seasons, so a season-two table could be served from a
 * season-one cache entry. Sunday tables are small (8-12 rows), so building
 * them outright is cheaper than being clever about it.
 */
export function buildSundayTable(fixtures: readonly Match[], clubIds: readonly string[]): LeagueTableEntry[] {
  const rows = new Map<string, LeagueTableEntry>();
  for (const id of clubIds) {
    rows.set(id, {
      clubId: id, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: [], cleanSheets: 0,
    });
  }
  for (const m of fixtures) {
    if (!m.played) continue;
    const home = rows.get(m.homeClubId);
    const away = rows.get(m.awayClubId);
    if (!home || !away) continue;
    home.played++; away.played++;
    home.goalsFor += m.homeGoals; home.goalsAgainst += m.awayGoals;
    away.goalsFor += m.awayGoals; away.goalsAgainst += m.homeGoals;
    if (m.awayGoals === 0) home.cleanSheets++;
    if (m.homeGoals === 0) away.cleanSheets++;
    if (m.homeGoals > m.awayGoals) {
      home.won++; away.lost++;
      home.points += SUNDAY_POINTS_WIN;
      home.form.push('W'); away.form.push('L');
    } else if (m.homeGoals < m.awayGoals) {
      away.won++; home.lost++;
      away.points += SUNDAY_POINTS_WIN;
      away.form.push('W'); home.form.push('L');
    } else {
      home.drawn++; away.drawn++;
      home.points += SUNDAY_POINTS_DRAW; away.points += SUNDAY_POINTS_DRAW;
      home.form.push('D'); away.form.push('D');
    }
  }
  const table = [...rows.values()];
  for (const r of table) {
    r.goalDifference = r.goalsFor - r.goalsAgainst;
    r.form = r.form.slice(-5);
  }
  table.sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || a.clubId.localeCompare(b.clubId));
  return table;
}

/** 1-based position of a club in a table, or the table length when absent. */
export function sundayPosition(table: readonly LeagueTableEntry[], clubId: string): number {
  const idx = table.findIndex(r => r.clubId === clubId);
  return idx >= 0 ? idx + 1 : table.length;
}

// ── Promotion and relegation ────────────────────────────────────────────────

export interface SundayOutcome {
  promoted: boolean;
  relegated: boolean;
  champion: boolean;
  nextDivisionId: SundayDivisionId;
}

/** Where the club ends up next season. */
export function resolveSundayOutcome(divisionId: SundayDivisionId, position: number, tableSize: number): SundayOutcome {
  const div = getSundayDivision(divisionId);
  const tier = sundayDivisionTier(divisionId);
  const promoted = div.promotionSpots > 0 && position <= div.promotionSpots;
  const relegated = div.relegationSpots > 0 && position > tableSize - div.relegationSpots;
  let nextTier = tier;
  if (promoted) nextTier = Math.min(SUNDAY_DIVISIONS.length - 1, tier + 1);
  else if (relegated) nextTier = Math.max(0, tier - 1);
  return {
    promoted,
    relegated,
    champion: position === 1,
    nextDivisionId: SUNDAY_DIVISIONS[nextTier].id,
  };
}

// ── Ageing and development ──────────────────────────────────────────────────

export interface DevelopmentResult {
  player: Player;
  /** English one-liner when something worth mentioning happened, else null. */
  note: string | null;
  /** True when the player has aged out and should be offered a testimonial. */
  retiring: boolean;
}

/**
 * Age a Sunday footballer by one season.
 *
 * Growth is driven by MINUTES, not appearances: an unused substitute does not
 * improve, which is what makes squad rotation a real decision rather than a
 * courtesy. Decline is gentler than the elite game's because a 36-year-old
 * Sunday centre-half is not being asked to press for ninety minutes — he is
 * being asked to head it away, which he can still do.
 */
export function developSundayPlayer(
  rng: SundayRng,
  player: Player,
  member: SundaySquadMember,
  coachLevel: number,
): DevelopmentResult {
  const next: Player = { ...player, attributes: { ...player.attributes }, age: player.age + 1 };
  const minutes = player.minutesPlayed ?? 0;
  const playedShare = Math.min(1, minutes / SUNDAY_GROWTH_MINUTES_TARGET);
  let note: string | null = null;

  if (next.age <= SUNDAY_GROWTH_AGE) {
    const gain = (SUNDAY_GROWTH_PER_SEASON + coachLevel * SUNDAY_COACH_GROWTH_PER_LEVEL)
      * (0.35 + 0.65 * playedShare)
      * (0.6 + member.commitment / 20);
    if (gain > 0.4) {
      const keys = rng.sample(['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'] as const, rng.int(2, 3));
      for (const k of keys) next.attributes[k] = clampAttr(next.attributes[k] + gain);
      note = `${next.firstName} has come on this year.`;
    }
  } else if (next.age >= SUNDAY_DECLINE_AGE) {
    const yearsPast = next.age - SUNDAY_DECLINE_AGE;
    const drop = SUNDAY_DECLINE_PER_SEASON * (1 + yearsPast * 0.22);
    next.attributes.pace = clampAttr(next.attributes.pace - drop * 1.5);
    next.attributes.physical = clampAttr(next.attributes.physical - drop);
    // Experience is the one thing that keeps improving out here.
    next.attributes.mental = clampAttr(next.attributes.mental + 0.6);
    note = `${next.firstName} has lost another yard.`;
  }

  next.overall = Math.max(
    SUNDAY_OVERALL_FLOOR,
    Math.min(SUNDAY_OVERALL_CEILING, calculateOverall(next.attributes, next.position)),
  );
  // Season counters reset; career counters do not.
  next.goals = 0; next.assists = 0; next.appearances = 0; next.minutesPlayed = 0;
  next.yellowCards = 0; next.redCards = 0;
  next.seasonRatingTotal = 0; next.seasonRatedMatches = 0;
  next.suspendedUntilWeek = undefined;
  next.injured = false; next.injuryWeeks = 0; next.injuryDetails = undefined;
  next.fitness = 100;

  // Nobody plays Sunday football forever. Past 44 the odds of another season
  // fall away fast, and a low-commitment veteran goes sooner.
  const retiring = next.age >= 40
    && rng.chance(Math.min(0.85, (next.age - 39) * 0.16 + (20 - member.commitment) * 0.015));

  return { player: next, note, retiring };
}

// ── Records and legends ─────────────────────────────────────────────────────

/** Record a club record if it beats the existing one. Returns the new list. */
export function recordSundayRecord(
  records: readonly SundayRecordEntry[],
  id: string,
  value: string,
  numeric: number,
  season: number,
  week: number,
  compare: 'higher' | 'lower' = 'higher',
  /** English context line — what makes the number a story. */
  detail?: string,
): SundayRecordEntry[] {
  const existing = records.find(r => r.id === id);
  if (existing) {
    const prev = parseFloat(existing.value.replace(/[^0-9.-]/g, ''));
    const beaten = compare === 'higher' ? numeric > prev : numeric < prev;
    if (!beaten || Number.isNaN(prev)) return [...records];
  }
  const label = SUNDAY_RECORD_LABELS[id] ?? id;
  const next = records.filter(r => r.id !== id);
  next.push({ id, label, value, season, week, ...(detail ? { detail } : {}) });
  return next.slice(-SUNDAY_RECORDS_MAX);
}

/** Whether a departing player has done enough to be remembered. */
export function qualifiesAsLegend(member: SundaySquadMember): boolean {
  return member.clubApps >= SUNDAY_LEGEND_APPS || member.clubGoals >= SUNDAY_LEGEND_GOALS;
}

export function addSundayLegend(
  legends: readonly SundayLegend[],
  member: SundaySquadMember,
  name: string,
  reason: string,
  season: number,
): SundayLegend[] {
  if (legends.some(l => l.playerId === member.playerId)) return [...legends];
  return [
    ...legends,
    {
      playerId: member.playerId,
      name,
      reason,
      apps: member.clubApps,
      goals: member.clubGoals,
      seasons: Math.max(1, season - member.joinedSeason + 1),
    },
  ].slice(-SUNDAY_LEGENDS_MAX);
}

// ── Season record ───────────────────────────────────────────────────────────

export interface BuildSeasonRecordInput {
  state: SundayState;
  table: readonly LeagueTableEntry[];
  playerClubId: string;
  season: number;
  outcome: SundayOutcome;
  topScorer: { name: string; goals: number } | null;
  playerOfTheSeason: { name: string; rating: number } | null;
  momentOfTheSeason: string | null;
  cupResult: string | null;
  highlights: string[];
}

export function buildSundaySeasonRecord(input: BuildSeasonRecordInput): SundaySeasonRecord {
  const { state, table, playerClubId, season, outcome } = input;
  const row = table.find(r => r.clubId === playerClubId);
  const div = getSundayDivision(state.divisionId);
  return {
    season,
    divisionId: state.divisionId,
    divisionName: div.name,
    position: sundayPosition(table, playerClubId),
    played: row?.played ?? 0,
    won: row?.won ?? 0,
    drawn: row?.drawn ?? 0,
    lost: row?.lost ?? 0,
    goalsFor: row?.goalsFor ?? 0,
    goalsAgainst: row?.goalsAgainst ?? 0,
    points: row?.points ?? 0,
    promoted: outcome.promoted,
    relegated: outcome.relegated,
    folded: state.folded,
    cupResult: input.cupResult,
    topScorer: input.topScorer,
    playerOfTheSeason: input.playerOfTheSeason,
    momentOfTheSeason: input.momentOfTheSeason,
    balanceEnd: Math.round(state.balance),
    highlights: input.highlights,
  };
}
