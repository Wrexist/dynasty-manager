/**
 * Sunday League — player memories.
 *
 * The storytelling spine. Memories are written where the simulation actually
 * produced the moment (match processing, the week loop, the rollover) and read
 * everywhere a story is told: the squad biography, legend citations, record
 * context, the season's defining moment, and event conditions.
 *
 * TWO RULES, both load-bearing:
 *   1. A memory is only ever derived from real state — the scorer, the minute,
 *      the scoreline all come from the engine's own events. Nothing here may
 *      invent a fact (§57 of the design brief: never cheat the player).
 *   2. The list is CAPPED. `rememberMoment` keeps the heaviest dozen, newest
 *      winning ties, so a ten-season veteran carries his career highlights and
 *      not a database. Save size and UI legibility both depend on this.
 */
import type {
  Match, Player, PlayerMatchRating, SundayMatchReport, SundayMemory,
  SundayMemoryKind, SundaySquadMember,
} from '@/types/game';
import { SUNDAY_MEMORIES_MAX, SUNDAY_MEMORY_WEIGHTS } from '@/config/sundayLeague';

/** Add one memory, keeping the list bounded. Returns a NEW array. */
export function rememberMoment(
  memories: readonly SundayMemory[],
  memory: SundayMemory,
): SundayMemory[] {
  const next = [...memories, memory];
  if (next.length <= SUNDAY_MEMORIES_MAX) return next;
  // Prune the LIGHTEST, oldest-first among equals — a debut (weight 3) will
  // eventually give way to a cup final winner (weight 9), never the reverse.
  let lightest = 0;
  for (let i = 1; i < next.length; i++) {
    if (next[i].weight < next[lightest].weight) lightest = i;
  }
  next.splice(lightest, 1);
  return next;
}

export function makeMemory(
  season: number, week: number, kind: SundayMemoryKind, text: string,
): SundayMemory {
  return { season, week, kind, text, weight: SUNDAY_MEMORY_WEIGHTS[kind] ?? 3 };
}

/** The heaviest memory a list holds, newest breaking ties. Null when empty. */
export function definingMemory(memories: readonly SundayMemory[]): SundayMemory | null {
  let best: SundayMemory | null = null;
  for (const m of memories) {
    if (!best || m.weight > best.weight
      || (m.weight === best.weight && (m.season > best.season || (m.season === best.season && m.week >= best.week)))) {
      best = m;
    }
  }
  return best;
}

/** The heaviest memory written in `season` across a whole squad — the
 *  "moment of the season" on the presentation night. */
export function momentOfSeason(
  squad: readonly SundaySquadMember[],
  season: number,
): SundayMemory | null {
  let best: SundayMemory | null = null;
  for (const member of squad) {
    for (const m of member.memories) {
      if (m.season !== season) continue;
      if (!best || m.weight > best.weight) best = m;
    }
  }
  return best;
}

// ── Match capture ───────────────────────────────────────────────────────────

export interface MatchMemoryInput {
  rating: PlayerMatchRating | undefined;
  report: Pick<SundayMatchReport, 'goalsFor' | 'goalsAgainst' | 'opponentName' | 'season' | 'week'>;
  /** True when this fixture was against the persistent rival. */
  isDerby: boolean;
  isCup: boolean;
  /** English cup round name when a cup tie, e.g. "Final". */
  cupRound: string | null;
  /** Minute of the club's decisive goal when this player scored it, else null. */
  winnerMinute: number | null;
  motm: boolean;
  /** True when he took part at all (started or came on). */
  played: boolean;
  sentOff: boolean;
  injuryWeeks: number;
  /** Club-career totals BEFORE this match was added. */
  prevApps: number;
  prevGoals: number;
  /** He scored the winner AND was one of the three worst players on the pitch
   *  by overall. Judged by the caller, which is the only place that knows who
   *  else was out there. */
  unlikelyHero?: boolean;
}

/** Apps/goals milestones worth a memory and a mention. */
export const SUNDAY_APP_MILESTONES = [50, 100, 150, 200] as const;
export const SUNDAY_GOAL_MILESTONES = [25, 50, 75, 100] as const;

/**
 * Everything one match can write into one player's story.
 *
 * Returns the memories to append (possibly empty). Thresholds are deliberately
 * strict — a memory that fires every week is noise, and noise is what the
 * weight-pruning would silently drown a real career highlight in.
 */
export function captureMatchMemories(input: MatchMemoryInput): SundayMemory[] {
  const {
    rating, report, isDerby, isCup, cupRound, winnerMinute,
    motm, played, sentOff, injuryWeeks, prevApps, prevGoals, unlikelyHero,
  } = input;
  const out: SundayMemory[] = [];
  const { season, week } = report;
  const won = report.goalsFor > report.goalsAgainst;
  const score = `${report.goalsFor}-${report.goalsAgainst}`;
  const goals = rating?.goals ?? 0;
  const mem = (kind: SundayMemoryKind, text: string) => out.push(makeMemory(season, week, kind, text));

  if (!played) return out;

  if (prevApps === 0) {
    mem('debut', `Made his debut against ${report.opponentName}.`);
  }
  if (goals > 0 && prevGoals === 0) {
    mem('first-goal', `Scored his first goal for the club against ${report.opponentName}.`);
  }
  if (goals >= 3) {
    mem('hat-trick', `A hat-trick against ${report.opponentName}. The ball went home with him.`);
  }
  if (winnerMinute != null && won) {
    // The same goal, told two ways. A winner from one of the worst players on
    // the pitch is the story the club actually retells, so it outranks the
    // ordinary version rather than sitting next to it.
    if (unlikelyHero) {
      mem('unlikely-hero', winnerMinute >= 85
        ? `Of all people, HE won it in the ${winnerMinute}th against ${report.opponentName}. Nobody has let it go since.`
        : `Won the match against ${report.opponentName} ${score}. Him. Ask anyone who was there.`);
    } else {
      mem('winner', winnerMinute >= 85
        ? `Won it in the ${winnerMinute}th minute against ${report.opponentName}. Scenes.`
        : `Scored the goal that beat ${report.opponentName} ${score}.`);
    }
  }
  if (isDerby && goals > 0) {
    mem('derby-goal', `Scored against ${report.opponentName} in the derby. Free drinks for a month.`);
  }
  if (isCup && won && (goals > 0 || motm)) {
    mem('cup-hero', `The man of the ${cupRound ?? 'cup tie'} against ${report.opponentName}.`);
  }
  if (motm && (rating?.rating ?? 0) >= 8.2 && winnerMinute == null && !(isCup && won)) {
    mem('motm', `Ran the game against ${report.opponentName} — ${rating!.rating.toFixed(1)} and everyone knew it.`);
  }
  if ((rating?.rating ?? 10) <= 4.3) {
    mem('bad-day', `Had an absolute nightmare against ${report.opponentName}. Nobody mentioned it. Everybody mentioned it.`);
  }
  if (sentOff) {
    mem('red-card', `Sent off against ${report.opponentName}${isDerby ? ', in the derby of all games' : ''}.`);
  }
  if (injuryWeeks >= 3) {
    mem('injury', `Carried off against ${report.opponentName}. ${injuryWeeks} weeks on the sofa.`);
  }
  const apps = prevApps + 1;
  if ((SUNDAY_APP_MILESTONES as readonly number[]).includes(apps)) {
    mem('milestone', `${apps} appearances for the club. They passed a shirt round the pub for him.`);
  }
  const totalGoals = prevGoals + goals;
  for (const target of SUNDAY_GOAL_MILESTONES) {
    if (prevGoals < target && totalGoals >= target) {
      mem('milestone', `Goal number ${target} for the club.`);
      break;
    }
  }
  return out;
}

/**
 * The decisive goal of a one-goal win: the scorer of the winning side's LAST
 * goal, by the engine's own event order. Returns scorer id + minute, or null
 * for any other scoreline.
 */
export function findMatchWinner(
  result: Match,
  clubId: string,
  isHome: boolean,
): { playerId: string; minute: number } | null {
  const ourGoals = isHome ? result.homeGoals : result.awayGoals;
  const theirGoals = isHome ? result.awayGoals : result.homeGoals;
  if (ourGoals - theirGoals !== 1) return null;
  for (let i = result.events.length - 1; i >= 0; i--) {
    const ev = result.events[i];
    const isGoal = ev.type === 'goal' || ev.type === 'penalty_scored' || ev.type === 'free_kick_goal'
      || ev.type === 'long_range_goal' || ev.type === 'counter_attack_goal' || ev.type === 'header_goal'
      || ev.type === 'solo_goal' || ev.type === 'goalkeeper_error' || ev.type === 'extra_time_goal';
    if (!isGoal || ev.clubId !== clubId) continue;
    // An own goal credits the club but names an OPPONENT defender — that is
    // not "he scored the winner", so require the scorer to be ours (checked
    // by the caller against the squad).
    if (!ev.playerId) return null;
    return { playerId: ev.playerId, minute: ev.minute };
  }
  return null;
}

/**
 * The swing that decided the match, in one English line — or null when the
 * match never turned. Derived strictly from the goal sequence: a comeback, a
 * thrown-away lead, or a very late decider. A 3-0 that was always 3-0 has no
 * turning point and gets no invented one.
 */
export function findTurningPoint(
  result: Match,
  clubId: string,
  isHome: boolean,
  players: Record<string, Player>,
): string | null {
  interface GoalBeat { ours: boolean; minute: number; scorer: string }
  const beats: GoalBeat[] = [];
  for (const ev of result.events) {
    const isGoal = ev.type === 'goal' || ev.type === 'own_goal' || ev.type === 'penalty_scored'
      || ev.type === 'free_kick_goal' || ev.type === 'long_range_goal' || ev.type === 'counter_attack_goal'
      || ev.type === 'header_goal' || ev.type === 'solo_goal' || ev.type === 'goalkeeper_error'
      || ev.type === 'extra_time_goal';
    if (!isGoal) continue;
    beats.push({
      ours: ev.clubId === clubId,
      minute: ev.minute,
      scorer: ev.playerId && players[ev.playerId] ? players[ev.playerId].firstName : 'someone',
    });
  }
  if (!beats.length) return null;

  const ourFinal = isHome ? result.homeGoals : result.awayGoals;
  const theirFinal = isHome ? result.awayGoals : result.homeGoals;
  const won = ourFinal > theirFinal;
  const lost = ourFinal < theirFinal;

  // Deepest deficit / biggest lead along the way.
  let ours = 0, theirs = 0, worstDeficit = 0, bestLead = 0;
  for (const b of beats) {
    if (b.ours) ours++; else theirs++;
    worstDeficit = Math.max(worstDeficit, theirs - ours);
    bestLead = Math.max(bestLead, ours - theirs);
  }

  if (won && worstDeficit >= 2) {
    return `From ${worstDeficit} down to winning it. Nobody left early and nobody regrets it.`;
  }
  if (lost && bestLead >= 2) {
    return `${bestLead} up and it still got away. The car park inquest ran long.`;
  }
  const last = beats[beats.length - 1];
  if (last.minute >= 88 && ourFinal !== theirFinal) {
    // WHOSE GOAL IT WAS IS NOT ENOUGH — the RESULT decides the sentence. A
    // consolation in the 90th was being announced as having "settled it at the
    // death" in a 1-2 defeat, which is the one thing this layer must never do:
    // contradict the scoreline printed directly above it.
    if (last.ours) {
      return won
        ? `${last.scorer}'s ${last.minute}th-minute goal settled it at the death.`
        : `${last.scorer} scored in the ${last.minute}th. Far too late to be worth anything.`;
    }
    return lost
      ? `They took it off you in the ${last.minute}th minute. Silence in the changing room.`
      : `They pulled one back in the ${last.minute}th and you had to hang on for it.`;
  }
  if (won && worstDeficit >= 1) {
    return 'Behind at one point, in front when it mattered.';
  }
  return null;
}
