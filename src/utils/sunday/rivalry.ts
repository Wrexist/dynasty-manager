/**
 * Sunday League — the rival as a character.
 *
 * A rivalry is with a person, not a table row. The rival club gets a manager
 * with a name and a manner, the feud keeps a capped log of things that
 * actually happened (defections, cup eliminations, late winners), and a player
 * who leaves you FOR them stays in the story: derby build-ups name him, and
 * beating them with him on the other side is worth more heat both ways.
 *
 * Everything here is a READER and RECORDER of real events — nothing in this
 * module changes a result or a probability.
 */
import type { SundayMatchReport, SundayRivalry } from '@/types/game';
import { SUNDAY_RIVAL_HEAT_MAX, SUNDAY_RIVAL_HEAT_START } from '@/config/sundayLeague';
import {
  SUNDAY_FIRST_NAMES, SUNDAY_LAST_NAMES, SUNDAY_RIVALRY_NAMES, SUNDAY_RIVAL_MANAGER_STYLES,
} from '@/data/sundayNames';
import type { SundayRng } from './rng';

/** How many incidents the feud remembers. Oldest fall off first. */
export const SUNDAY_RIVALRY_STORY_MAX = 8;

export function buildSundayRivalry(rng: SundayRng, clubId: string): SundayRivalry {
  return {
    clubId,
    name: rng.pick(SUNDAY_RIVALRY_NAMES) ?? 'The Rec Derby',
    wins: 0, draws: 0, losses: 0,
    heat: SUNDAY_RIVAL_HEAT_START,
    lastTaunt: null,
    managerName: `${rng.pick(SUNDAY_FIRST_NAMES) ?? 'Terry'} ${rng.pick(SUNDAY_LAST_NAMES) ?? 'Grimshaw'}`,
    managerStyle: rng.pick(SUNDAY_RIVAL_MANAGER_STYLES) ?? 'Loud on the touchline, louder in the pub.',
    story: [],
    defector: null,
  };
}

/** Append an incident, keeping the log capped. Returns a NEW rivalry. */
export function recordRivalryIncident(rivalry: SundayRivalry, line: string): SundayRivalry {
  return { ...rivalry, story: [...rivalry.story, line].slice(-SUNDAY_RIVALRY_STORY_MAX) };
}

export function bumpHeat(rivalry: SundayRivalry, delta: number): SundayRivalry {
  return { ...rivalry, heat: Math.max(0, Math.min(SUNDAY_RIVAL_HEAT_MAX, rivalry.heat + delta)) };
}

/**
 * The feud's reaction to a derby result — the incident line, extra heat, and
 * whether the defector subplot fired. Derived entirely from the report.
 */
export function deriveDerbyIncident(
  rivalry: SundayRivalry,
  report: SundayMatchReport,
): { line: string | null; extraHeat: number } {
  const margin = report.goalsFor - report.goalsAgainst;
  const score = `${report.goalsFor}-${report.goalsAgainst}`;
  if (report.forfeited) {
    return { line: `Season ${report.season}: could not raise a side for the derby. They have not let it go.`, extraHeat: 2 };
  }
  if (margin >= 3) {
    return { line: `Season ${report.season}: hammered them ${score}. ${rivalry.managerName} left before the end.`, extraHeat: 1 };
  }
  if (margin <= -3) {
    return { line: `Season ${report.season}: they did you ${report.goalsAgainst}-${report.goalsFor}. Nobody went to the pub.`, extraHeat: 2 };
  }
  if (margin > 0 && rivalry.defector) {
    return { line: `Season ${report.season}: beat them ${score} with ${rivalry.defector.name} on their side. Sweeter for it.`, extraHeat: 1 };
  }
  if (margin < 0 && rivalry.defector) {
    return { line: `Season ${report.season}: lost to them with ${rivalry.defector.name} in their colours. It stings exactly as much as you would think.`, extraHeat: 2 };
  }
  return { line: null, extraHeat: 0 };
}
