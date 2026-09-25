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
  Club, CupState, ContinentalTournamentState, LeagueCupState, LeagueTableEntry, Match, Player,
  SeasonPhase, SuperCupMatch,
} from '@/types/game';
import {
  RACE_MODE_WINDOW_WEEKS, TITLE_RACE_MAX_POSITION, TITLE_RACE_MAX_POINTS_GAP,
  RELEGATION_BATTLE_BOTTOM_PLACES, SPRING_PHASE_END_WEEK, COACH_CHECKLIST_MAX_SEASON,
} from '@/config/gameBalance';
import type { TransferWindows } from '@/config/transfers';
import { computeObjectiveProgress, type ObjectiveInstance } from '@/utils/weeklyObjectives';

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

/** Which part of the season a week falls in — was written out twice, inline. */
export function getSeasonStage(week: number, windows: TransferWindows): SeasonStage {
  if (week <= windows.summerEnd) return 'preSeason';
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
