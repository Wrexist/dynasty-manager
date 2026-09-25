/**
 * Dashboard rules, as pure functions.
 *
 * These used to be computed inline in `pages/Dashboard.tsx`, where they could
 * only be tested by rendering a 2,000-line page — so they were not tested at
 * all. Two of them had already gone wrong there:
 *
 *   - `seasonOver` compared the phase against 'playoffs' (the phase is
 *     'playoff') behind an `as string` cast, which kept the season "over"
 *     through the whole playoff phase and hid the only way to play the tie.
 *   - `objectivesWithProgress` read cup / continental / friendly state through
 *     `useGameStore.getState()` inside a `useMemo` whose dependency list did not
 *     name any of it, so a goal in a cup tie did not move "Goal Fest" until
 *     something unrelated re-ran the memo.
 *
 * Everything here takes plain values and returns plain values. The page selects
 * what it needs from the store and passes it in, so every input is a real
 * dependency of the memo that calls these.
 */
import type {
  BoardUltimatum, Club, CupState, ContinentalTournamentState, GameScreen, LeagueCupState, LeagueTableEntry, Match,
  Player, SeasonPhase, SuperCupMatch,
} from '@/types/game';
import {
  RACE_MODE_WINDOW_WEEKS, TITLE_RACE_MAX_POSITION, TITLE_RACE_MAX_POINTS_GAP,
  RELEGATION_BATTLE_BOTTOM_PLACES, SPRING_PHASE_END_WEEK, COACH_CHECKLIST_MAX_SEASON,
  LINEUP_SIZE, MIN_SQUAD_SIZE, MAX_SQUAD_SIZE, BOARD_ATTENTION_CRITICAL_CONFIDENCE,
  PRESEASON_DEFAULT_FIRST_LEAGUE_WEEK,
} from '@/config/gameBalance';
import { CONFIDENCE_CRITICAL_THRESHOLD } from '@/config/ui';
import { getSuffix, isAwayOnLoan } from '@/utils/helpers';
import type { TransferWindows } from '@/config/transfers';
import { computeObjectiveProgress, objectiveXpMultiplier, type ObjectiveInstance } from '@/utils/weeklyObjectives';

// ── Season state ──

export interface SeasonOverInput {
  fixtures: Match[];
  playerClubId: string;
  week: number;
  totalWeeks: number;
  seasonPhase: SeasonPhase;
}

/**
 * The player's league season is finished and the next step is the season
 * summary. Never true during the promotion playoffs: the tie still has to be
 * played, and treating the season as over hides the button that plays it.
 */
export function isSeasonOver({ fixtures, playerClubId, week, totalWeeks, seasonPhase }: SeasonOverInput): boolean {
  if (seasonPhase === 'playoff') return false;
  if (week > totalWeeks) return true;
  const allMatchesPlayed = fixtures
    .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId)
    .every(m => m.played);
  return allMatchesPlayed && fixtures.some(m => m.played);
}

export type RaceMode = 'title' | 'relegation' | null;

export interface RaceModeInput {
  seasonOver: boolean;
  seasonPhase: SeasonPhase;
  week: number;
  totalWeeks: number;
  leagueTable: LeagueTableEntry[];
  playerClubId: string;
  /** Relegation places in the player's league. 0 = the bottom is safe. */
  relegationSpots: number;
}

/**
 * Title race / relegation battle — the final-stretch framing. Null outside the
 * last `RACE_MODE_WINDOW_WEEKS`, during the playoffs, once the season is over,
 * and (for the relegation half) in a league nobody can go down from: the old
 * inline version told the bottom three of the lowest tier they were in a
 * "Relegation Battle" they could not lose.
 */
export function getRaceMode(input: RaceModeInput): RaceMode {
  const { seasonOver, seasonPhase, week, totalWeeks, leagueTable, playerClubId, relegationSpots } = input;
  if (seasonOver || seasonPhase === 'playoff') return null;
  if (totalWeeks - week > RACE_MODE_WINDOW_WEEKS) return null;
  const idx = leagueTable.findIndex(e => e.clubId === playerClubId);
  if (idx === -1) return null;
  const position = idx + 1;
  if (position <= TITLE_RACE_MAX_POSITION) {
    const gap = (leagueTable[0]?.points || 0) - (leagueTable[idx].points || 0);
    if (gap <= TITLE_RACE_MAX_POINTS_GAP) return 'title';
  }
  if (relegationSpots > 0 && position > leagueTable.length - RELEGATION_BATTLE_BOTTOM_PLACES) return 'relegation';
  return null;
}

export type SeasonStage = 'preSeason' | 'autumn' | 'winter' | 'spring' | 'runIn';

/** The week of the club's first league fixture this season, or the configured
 *  default when the club has none (e.g. between seasons). */
export function getFirstLeagueWeek(fixtures: Match[], clubId: string): number {
  let first = Infinity;
  for (const m of fixtures) {
    if ((m.homeClubId === clubId || m.awayClubId === clubId) && m.week < first) first = m.week;
  }
  return Number.isFinite(first) ? first : PRESEASON_DEFAULT_FIRST_LEAGUE_WEEK;
}

/**
 * Which part of the season a week falls in — was written out twice, inline.
 *
 * Pre-season is the weeks BEFORE the club's first league fixture
 * (`firstLeagueWeek`, see `getFirstLeagueWeek`). It used to be every week up
 * to the summer transfer window's close, so "Season 1 · Week 5 · Pre-Season"
 * sat over a league table with four rounds played (R2). The open window and
 * the season stage are separate facts.
 */
export function getSeasonStage(
  week: number,
  windows: TransferWindows,
  firstLeagueWeek: number = PRESEASON_DEFAULT_FIRST_LEAGUE_WEEK,
): SeasonStage {
  if (week < firstLeagueWeek) return 'preSeason';
  if (week < windows.winterStart) return 'autumn';
  if (week <= windows.winterEnd) return 'winter';
  if (week <= SPRING_PHASE_END_WEEK) return 'spring';
  return 'runIn';
}

// ── Monthly objectives ──

export interface ObjectiveProgressInput {
  weeklyObjectives: ObjectiveInstance[];
  club: Club | null | undefined;
  players: Record<string, Player>;
  playerClubId: string;
  fixtures: Match[];
  leagueTable: LeagueTableEntry[];
  week: number;
  season: number;
  friendlies?: Match[];
  cup?: CupState | null;
  leagueCup?: LeagueCupState | null;
  championsCup?: ContinentalTournamentState | null;
  shieldCup?: ContinentalTournamentState | null;
  conferenceCup?: ContinentalTournamentState | null;
  domesticSuperCup?: SuperCupMatch | null;
  continentalSuperCup?: SuperCupMatch | null;
}

/**
 * Live progress for each monthly objective, counting EVERY match source — a
 * pre-season friendly or a cup tie moves "Goal Fest" the same as a league game.
 * Every source is an explicit input so the caller's memo re-runs when it moves.
 */
export function selectObjectivesWithProgress(input: ObjectiveProgressInput): ObjectiveInstance[] {
  const { weeklyObjectives, club } = input;
  if (!club) return weeklyObjectives;
  return computeObjectiveProgress(weeklyObjectives, {
    playerClubId: input.playerClubId,
    players: input.players,
    playerIds: club.playerIds,
    fixtures: input.fixtures,
    leagueTable: input.leagueTable,
    week: input.week,
    season: input.season,
    lineup: club.lineup || [],
    friendlies: input.friendlies,
    cupTies: input.cup?.ties,
    leagueCupTies: input.leagueCup?.ties,
    championsCup: input.championsCup,
    shieldCup: input.shieldCup,
    conferenceCup: input.conferenceCup,
    domesticSuperCup: input.domesticSuperCup,
    continentalSuperCup: input.continentalSuperCup,
  });
}

/** XP an objective pays on claim — the same multiplier weeklyObjectives and
 *  weekAdvance use, so the number shown can never drift from the number paid. */
export function effectiveObjectiveXp(obj: Pick<ObjectiveInstance, 'xpReward' | 'rarity'>): number {
  return obj.xpReward * objectiveXpMultiplier(obj);
}

/** Completed monthly objectives whose XP has not been collected yet. */
export function countClaimableObjectives(objectives: ObjectiveInstance[]): number {
  return objectives.filter(o => o.completed && !o.claimed).length;
}

// ── Getting Started checklist ──

/**
 * Which part of the ONE Getting Started checklist is showing.
 *
 * There used to be three onboarding systems on the Dashboard in week 1: a
 * welcome modal, the first-session checklist, and a separate coach checklist
 * with XP claims — two cards and a blocking popup teaching overlapping things.
 * They are now one card with two stages:
 *   - 'first-session' — season 1, week 1 of a first career: the walkthrough
 *     rows (set a plan, sign the sponsor, send a scout, play the match);
 *   - 'coach' — afterwards, through `COACH_CHECKLIST_MAX_SEASON`: the claimable
 *     coach tasks, until every one is claimed.
 * One dismissal (`settings.hideOnboarding`) hides both.
 */
export type ChecklistStage = 'first-session' | 'coach' | null;

export interface ChecklistStageInput {
  season: number;
  week: number;
  prestigeLevel: number;
  hideOnboarding: boolean;
  /** The first-session rows were completed this session. */
  firstSessionDone: boolean;
  seasonOver: boolean;
  coachTaskCount: number;
  coachTasksClaimed: number;
}

export function selectChecklistStage(input: ChecklistStageInput): ChecklistStage {
  if (input.hideOnboarding) return null;
  if (input.season === 1 && input.week === 1 && input.prestigeLevel === 0 && !input.firstSessionDone) {
    return 'first-session';
  }
  if (
    input.season <= COACH_CHECKLIST_MAX_SEASON && !input.seasonOver
    && input.coachTaskCount > 0 && input.coachTasksClaimed < input.coachTaskCount
  ) {
    return 'coach';
  }
  return null;
}

// ── The Continue button ──

export type PrimaryAction =
  | { kind: 'season-summary' }
  | { kind: 'match-prep' }
  | { kind: 'advance'; nextWeek: number; canSkipToNextMatch: boolean };

export interface PrimaryActionInput {
  seasonOver: boolean;
  /** A match (league, cup, continental or playoff) this week with a known opponent. */
  hasMatchThisWeek: boolean;
  /** Any fixture resolved for this week, even one whose opponent did not resolve. */
  hasFixtureThisWeek: boolean;
  seasonPhase: SeasonPhase;
  week: number;
  totalWeeks: number;
}

/**
 * The ONE thing the Dashboard asks the player to do next: roll the season,
 * prepare for this week's match, or advance a training week (optionally
 * skipping straight to the next match in the regular season).
 */
export function selectPrimaryAction(input: PrimaryActionInput): PrimaryAction {
  if (input.seasonOver) return { kind: 'season-summary' };
  if (input.hasMatchThisWeek) return { kind: 'match-prep' };
  return {
    kind: 'advance',
    nextWeek: input.week + 1,
    canSkipToNextMatch: !input.hasFixtureThisWeek && input.seasonPhase === 'regular' && input.week < input.totalWeeks,
  };
}

/** The player's next unplayed league fixture after this week, or null. */
export function selectNextFixture(fixtures: Match[], playerClubId: string, week: number): Match | null {
  let next: Match | null = null;
  for (const m of fixtures) {
    if (m.played || m.week <= week) continue;
    if (m.homeClubId !== playerClubId && m.awayClubId !== playerClubId) continue;
    if (!next || m.week < next.week) next = m;
  }
  return next;
}

// ── Needs your attention ──

export type AttentionId =
  | 'ultimatum' | 'board' | 'lineup' | 'injuries' | 'contracts' | 'offers' | 'deadline'
  | 'squad-short' | 'squad-full' | 'job-offers' | 'youth'
  // A storyline decision waiting on the player. It used to render as a large
  // card ABOVE the Continue button (playthrough 2026-09, R17).
  | 'storyline';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: AttentionId;
  severity: AttentionSeverity;
  /** Where tapping the row goes — the screen that resolves it. */
  screen: GameScreen;
  /** Interpolation values for the row's copy. */
  params: Record<string, string | number>;
}

export interface AttentionInput {
  club: Club;
  players: Record<string, Player>;
  playerClubId: string;
  season: number;
  week: number;
  incomingOffers: number;
  boardConfidence: number;
  boardUltimatum: BoardUltimatum | null;
  /** 1-based league position, or 0 when not in a table. */
  leaguePosition: number;
  transferWindowOpen: boolean;
  windows: TransferWindows;
  jobOffers: number;
  youthReady: number;
  hasMatchThisWeek: boolean;
  /** The pending storyline decision, if any: its title and number of choices. */
  storyline?: { title: string; choices: number } | null;
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };

function ordinal(n: number): string {
  return `${n}${getSuffix(n)}`;
}

function names(list: Player[], max = 2): string {
  const shown = list.slice(0, max).map(p => p.lastName).join(', ');
  return list.length > max ? `${shown} +${list.length - max}` : shown;
}

/**
 * Everything on the club that needs a decision, most urgent first — and only
 * that. These used to render as separate panels BELOW the XP bar, sagas,
 * objectives, achievements and cliffhangers, so the injury list and the
 * expiring contracts were the last thing on the page.
 *
 * Every item names the screen that resolves it. Nothing informational belongs
 * here: if there is no action, it is not attention.
 */
export function selectAttentionItems(input: AttentionInput): AttentionItem[] {
  const { club, players, playerClubId, season, week } = input;
  const items: AttentionItem[] = [];
  const squad = club.playerIds.map(id => players[id]).filter(Boolean);
  const atClub = squad.filter(p => !isAwayOnLoan(p, playerClubId));

  const ultimatum = input.boardUltimatum && input.boardUltimatum.issuedSeason === season
    && week <= input.boardUltimatum.deadlineWeek ? input.boardUltimatum : null;
  if (ultimatum) {
    items.push({
      id: 'ultimatum', severity: 'critical', screen: 'board',
      params: {
        target: ordinal(ultimatum.targetPosition),
        deadline: ultimatum.deadlineWeek,
        weeks: Math.max(0, ultimatum.deadlineWeek - week),
        position: input.leaguePosition > 0 ? ordinal(input.leaguePosition) : '—',
      },
    });
  } else if (input.boardConfidence <= CONFIDENCE_CRITICAL_THRESHOLD) {
    // The ultimatum row already says the board is out of patience.
    items.push({
      id: 'board',
      severity: input.boardConfidence <= BOARD_ATTENTION_CRITICAL_CONFIDENCE ? 'critical' : 'warning',
      screen: 'board',
      params: { confidence: Math.round(input.boardConfidence) },
    });
  }

  // A decision only the player can make; the row opens the choice in place
  // (screen 'dashboard' — the Dashboard handles the tap, not a navigation).
  if (input.storyline) {
    items.push({
      id: 'storyline', severity: 'warning', screen: 'dashboard',
      params: { title: input.storyline.title, choices: input.storyline.choices },
    });
  }

  const isSuspended = (p: Player) => p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
  const fit = (club.lineup || [])
    .map(id => players[id])
    .filter(p => p && !p.injured && !isSuspended(p) && !isAwayOnLoan(p, playerClubId));
  const gaps = LINEUP_SIZE - Math.min(LINEUP_SIZE, fit.length);
  if (gaps > 0) {
    // The engine patches the XI from the bench, so this is never a forfeit —
    // but it is the player's team the engine is choosing.
    items.push({ id: 'lineup', severity: input.hasMatchThisWeek ? 'warning' : 'info', screen: 'tactics', params: { gaps } });
  }

  const injured = atClub.filter(p => p.injured).sort((a, b) => (b.injuryWeeks || 0) - (a.injuryWeeks || 0));
  if (injured.length > 0) {
    items.push({
      id: 'injuries', severity: 'warning', screen: 'squad',
      params: { count: injured.length, names: names(injured), weeks: injured[0].injuryWeeks || 0 },
    });
  }

  // Expiring THIS season. A borrowed player's contract is his parent club's.
  const expiring = squad
    .filter(p => p.contractEnd <= season && !(p.onLoan && p.loanToClubId === playerClubId))
    .sort((a, b) => b.overall - a.overall);
  if (expiring.length > 0) {
    items.push({ id: 'contracts', severity: 'warning', screen: 'squad', params: { count: expiring.length, names: names(expiring) } });
  }

  if (input.incomingOffers > 0) {
    items.push({ id: 'offers', severity: 'warning', screen: 'transfers', params: { count: input.incomingOffers } });
  }

  if (input.transferWindowOpen && (week === input.windows.summerEnd || week === input.windows.winterEnd)) {
    items.push({ id: 'deadline', severity: 'warning', screen: 'transfers', params: {} });
  }

  if (club.playerIds.length < MIN_SQUAD_SIZE) {
    items.push({ id: 'squad-short', severity: 'warning', screen: 'transfers', params: { size: club.playerIds.length, min: MIN_SQUAD_SIZE } });
  } else if (club.playerIds.length >= MAX_SQUAD_SIZE) {
    items.push({ id: 'squad-full', severity: 'info', screen: 'squad', params: { size: club.playerIds.length, max: MAX_SQUAD_SIZE } });
  }

  if (input.jobOffers > 0) {
    items.push({ id: 'job-offers', severity: 'info', screen: 'job-market', params: { count: input.jobOffers } });
  }
  if (input.youthReady > 0) {
    items.push({ id: 'youth', severity: 'info', screen: 'youth-academy', params: { count: input.youthReady } });
  }

  // Stable sort: severity first, then the order above.
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] || a.i - b.i)
    .map(({ item }) => item);
}
