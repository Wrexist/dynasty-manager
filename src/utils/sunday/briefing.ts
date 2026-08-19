/**
 * Sunday League — what the manager already knows before kick-off.
 *
 * Pure functions over state the mode ALREADY keeps. No new fields, no new
 * storage: the last meeting with this opponent is sitting in `state.fixtures`
 * with its own event array, and the appearance a man is one game away from is
 * sitting in `clubApps`. Both were being thrown away at the one moment they
 * are worth something — standing in a car park working out what today is.
 *
 * Everything here is derived and factual. A line is only produced when the
 * state supports it; there is no "no previous meeting" filler, because a
 * briefing that always says something teaches the player to skim it.
 */
import type { Match, Player, SundaySquadMember } from '@/types/game';
import { SUNDAY_APP_MILESTONES, findMatchWinner } from './memories';

/** The most recent PLAYED fixture between these two clubs this season. */
export function findSundayReverseFixture(
  fixtures: readonly Match[],
  clubId: string,
  opponentClubId: string,
): Match | null {
  let best: Match | null = null;
  for (const m of fixtures) {
    if (!m.played) continue;
    const pair = (m.homeClubId === clubId && m.awayClubId === opponentClubId)
      || (m.awayClubId === clubId && m.homeClubId === opponentClubId);
    if (!pair) continue;
    if (!best || m.week > best.week) best = m;
  }
  return best;
}

/** The last goal of the match for one side, by the engine's own event order. */
function lastGoalFor(match: Match, clubId: string): { playerId?: string; minute: number } | null {
  for (let i = match.events.length - 1; i >= 0; i--) {
    const ev = match.events[i];
    const isGoal = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_scored'
      || ev.type === 'free_kick_goal' || ev.type === 'long_range_goal' || ev.type === 'counter_attack_goal'
      || ev.type === 'header_goal' || ev.type === 'solo_goal' || ev.type === 'goalkeeper_error'
      || ev.type === 'extra_time_goal';
    if (!isGoal || ev.clubId !== clubId) continue;
    return { playerId: ev.playerId, minute: ev.minute };
  }
  return null;
}

/**
 * "Lost 2-1 over there in week 6. Their winner came in the 89th minute."
 *
 * Returns null when these two have not met yet this season — which is most of
 * the first half of it. The decisive-goal sentence is only added when the
 * match was actually decided by one goal; a 4-0 had no winner to name.
 */
export function sundayReverseFixtureRecall(
  fixtures: readonly Match[],
  clubId: string,
  opponentClubId: string,
  players: Record<string, Player>,
): string | null {
  const match = findSundayReverseFixture(fixtures, clubId, opponentClubId);
  if (!match) return null;
  const isHome = match.homeClubId === clubId;
  const ourGoals = isHome ? match.homeGoals : match.awayGoals;
  const theirGoals = isHome ? match.awayGoals : match.homeGoals;
  const verdict = ourGoals > theirGoals ? 'Won' : ourGoals < theirGoals ? 'Lost' : 'Drew';
  const where = isHome ? 'at home' : 'over there';
  // Football English: you win 2-1 and you lose 2-1. The winning side's goals
  // are said first either way, which is also how the club's own records write
  // it (`biggest-win` / `worst-defeat` in `runSundayMatch`).
  const score = ourGoals >= theirGoals ? `${ourGoals}-${theirGoals}` : `${theirGoals}-${ourGoals}`;
  let line = `${verdict} ${score} ${where} in week ${match.week}.`;

  if (ourGoals - theirGoals === 1) {
    const winner = findMatchWinner(match, clubId, isHome);
    const name = winner?.playerId ? players[winner.playerId]?.firstName : null;
    if (winner && name) line += ` ${name} settled it in the ${winner.minute}th.`;
  } else if (theirGoals - ourGoals === 1) {
    const theirs = lastGoalFor(match, isHome ? match.awayClubId : match.homeClubId);
    if (theirs) line += ` Their winner came in the ${theirs.minute}th.`;
  }
  return line;
}

/**
 * "Ben would hit 50 appearances today."
 *
 * Read off `clubApps + 1` for the men actually named, which is the same
 * arithmetic `captureMatchMemories` uses after the whistle — so the briefing
 * cannot promise a milestone the biography will not record. The biggest one
 * wins when two men are on the same afternoon.
 */
export function sundayMilestoneToday(
  squad: readonly SundaySquadMember[],
  players: Record<string, Player>,
  namedIds: readonly string[],
): string | null {
  const named = new Set(namedIds);
  let best: { name: string; apps: number } | null = null;
  for (const m of squad) {
    if (!named.has(m.playerId)) continue;
    const apps = m.clubApps + 1;
    if (!(SUNDAY_APP_MILESTONES as readonly number[]).includes(apps)) continue;
    const p = players[m.playerId];
    if (!p) continue;
    if (!best || apps > best.apps) best = { name: p.firstName, apps };
  }
  return best ? `${best.name} would hit ${best.apps} appearances for the club today.` : null;
}
