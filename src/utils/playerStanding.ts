/**
 * Player standing — turning what the simulation already recorded into
 * something the manager can feel.
 *
 * Dynasty Manager tracks every number this file reads: season-by-season
 * growth (the cap needs it), career appearances and goals (season end folds
 * them in), the season a player joined, whether he came through the academy.
 * None of it reached the player. A squad list of overalls and values does not
 * tell you that the 19-year-old you gave a run of games to has gone +5 this
 * season, or that your right-back has been here longer than you have.
 *
 * Everything here is DERIVED. No new persisted state, so no save migration,
 * and nothing here can drift out of sync with the save: if the numbers are
 * right, the story is right.
 *
 * Standing never feeds back into the sim. See `config/playerStanding.ts`.
 */

import type { Player, PlayerMilestone, PlayerStanding } from '@/types/game';
import {
  APPEARANCE_MILESTONES,
  GOAL_MILESTONES,
  BREAKTHROUGH_MIN_SEASON_GROWTH,
  BREAKTHROUGH_MAX_AGE,
  LATE_BLOOMER_MIN_AGE,
  LOYAL_SERVICE_SEASONS,
  ONE_CLUB_SEASONS,
} from '@/config/playerStanding';

/** Highest marks in each list that `total` has reached. */
function passedMarks(total: number, marks: readonly number[]): number[] {
  return marks.filter(m => total >= m).sort((a, b) => b - a);
}

/** Career marks a player has passed, largest first. */
export function getPlayerMilestones(player: Player): PlayerMilestone[] {
  const out: PlayerMilestone[] = [];
  for (const value of passedMarks(player.careerGoals || 0, GOAL_MILESTONES)) {
    out.push({ kind: 'goals', value, label: `${value} career goals` });
  }
  for (const value of passedMarks(player.careerAppearances || 0, APPEARANCE_MILESTONES)) {
    out.push({ kind: 'appearances', value, label: `${value} career appearances` });
  }
  return out;
}

/**
 * Marks crossed between two snapshots of the same player — the basis for
 * announcing a milestone exactly once, without storing "already announced"
 * anywhere. Career totals only move at season end, so this is called with the
 * before/after of that fold.
 *
 * Returns only marks newly reached, so a player who was already past 100 does
 * not re-announce it every season.
 */
export function getMilestonesCrossed(before: Player, after: Player): PlayerMilestone[] {
  const had = new Set(getPlayerMilestones(before).map(m => `${m.kind}:${m.value}`));
  return getPlayerMilestones(after).filter(m => !had.has(`${m.kind}:${m.value}`));
}

/** True when this season's growth has just crossed the breakthrough mark.
 *  Stateless by design: the crossing IS the event, so nothing needs to
 *  remember that it fired. */
export function crossedBreakthrough(growthBefore: number, growthAfter: number): boolean {
  return growthBefore < BREAKTHROUGH_MIN_SEASON_GROWTH
    && growthAfter >= BREAKTHROUGH_MIN_SEASON_GROWTH;
}

/** How a player's age frames a big season of growth. */
export function describeGrowthArc(age: number): 'breakthrough' | 'late-bloomer' | 'improving' {
  if (age <= BREAKTHROUGH_MAX_AGE) return 'breakthrough';
  if (age >= LATE_BLOOMER_MIN_AGE) return 'late-bloomer';
  return 'improving';
}

/**
 * The one line worth saying about this player, or null.
 *
 * Deliberately returns null for most of the squad: if every player has a
 * headline, none of them do. Ordered by what a manager would actually notice
 * first — this season's form of development, then long service, then the
 * career weight he carries.
 */
function buildHeadline(
  player: Player,
  seasonGrowth: number,
  seasonsAtClub: number | null,
  milestones: PlayerMilestone[],
): string | null {
  if (seasonGrowth >= BREAKTHROUGH_MIN_SEASON_GROWTH) {
    const arc = describeGrowthArc(player.age);
    if (arc === 'breakthrough') return `Breakthrough season — +${seasonGrowth} overall`;
    if (arc === 'late-bloomer') return `Still improving at ${player.age} — +${seasonGrowth} overall`;
    return `Up +${seasonGrowth} overall this season`;
  }

  if (seasonsAtClub !== null) {
    if (player.isFromYouthAcademy && seasonsAtClub >= ONE_CLUB_SEASONS) {
      return `One-club man — ${seasonsAtClub} seasons since the academy`;
    }
    if (seasonsAtClub >= LOYAL_SERVICE_SEASONS) {
      return `${seasonsAtClub} seasons at the club`;
    }
  }

  // Career weight is the quietest of the three, so it only speaks when the
  // player has nothing more current to say about himself.
  const top = milestones[0];
  if (top) return `Past ${top.label}`;

  if (player.isFromYouthAcademy) return 'Academy graduate';
  return null;
}

/**
 * Derive a player's standing.
 *
 * `seasonGrowth` is passed in rather than read from the store so this stays a
 * pure function of its inputs — the caller has `GameState.seasonGrowthTracker`
 * and the tracker is the only place that number lives.
 */
export function derivePlayerStanding(
  player: Player,
  opts: { season: number; seasonGrowth?: number },
): PlayerStanding {
  const seasonGrowth = Math.max(0, Math.round(opts.seasonGrowth || 0));
  // `joinedSeason` is optional on older records. Absent means unknown, which
  // is not the same as zero — claiming "0 seasons at the club" for a player
  // who has been here for years would be worse than saying nothing.
  const seasonsAtClub = typeof player.joinedSeason === 'number'
    ? Math.max(0, opts.season - player.joinedSeason)
    : null;
  const milestones = getPlayerMilestones(player);

  return {
    seasonGrowth,
    seasonsAtClub,
    academyGraduate: player.isFromYouthAcademy === true,
    milestones,
    headline: buildHeadline(player, seasonGrowth, seasonsAtClub, milestones),
  };
}
