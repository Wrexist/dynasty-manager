/**
 * The one thing to do this week.
 *
 * Sunday League has exactly one primary action at any moment and it changes
 * with the state of the week: name a side, play the match, move on, or look
 * back at the season. That state machine used to live inline on the hub, which
 * meant the shell-level week bar could not show the same button without
 * copying it — and a copy is a second answer waiting to disagree.
 *
 * Pure. No store access, no `t()` — the caller resolves `labelKey`.
 */
import { SUNDAY_MIN_START } from '@/config/sundayLeague';
import type { GameScreen, SundayState } from '@/types/game';

export type SundayPrimaryKind = 'review' | 'play' | 'pick' | 'advance';

export interface SundayPrimary {
  kind: SundayPrimaryKind;
  /** i18n key for the button text. */
  labelKey: string;
  /** Where the action goes. `undefined` for `advance`, which is not a
   *  navigation — it runs the week. */
  screen?: GameScreen;
}

/**
 * @param sunday      the mode's state
 * @param hasFixture  whether the club has an unplayed fixture this week
 *                    (league or cup — see `findSundayFixture`)
 */
export function sundayPrimaryAction(sunday: SundayState, hasFixture: boolean): SundayPrimary {
  // The season being over outranks everything: there is no fixture to play and
  // no week left to advance into until the summary has been read.
  if (sunday.seasonComplete) {
    return { kind: 'review', labelKey: 'sunday.hub.viewSeason', screen: 'sunday-history' };
  }
  if (hasFixture) {
    return sunday.teamsheet.length >= SUNDAY_MIN_START
      ? { kind: 'play', labelKey: 'sunday.hub.playMatch', screen: 'sunday-match' }
      : { kind: 'pick', labelKey: 'sunday.hub.pickTeam', screen: 'sunday-teamsheet' };
  }
  return { kind: 'advance', labelKey: 'sunday.hub.nextWeek' };
}
