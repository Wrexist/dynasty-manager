/**
 * What the manager may do this week, and the one thing he probably should.
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
import type { TranslationKey } from '@/i18n';
import type { GameScreen, SundayState } from '@/types/game';

/**
 * The side is settled and can no longer be changed.
 *
 * True from the moment the Sunday morning resolves for this week — the arrival
 * tells the manager who cried off, so re-picking after reading it is naming a
 * team with the answers in front of you — and while a match is paused at half
 * time, when the men on the pitch are fixed on the pause.
 *
 * Lives here, pure, because BOTH the store action and the Teamsheet screen
 * have to agree about it. They did not: the screen kept asking "have guests
 * been paid for?" after the store stopped, so a tap the store refused was
 * swallowed with no explanation.
 */
export function sundaySideIsSettled(sunday: SundayState, season: number, week: number): boolean {
  const forThisWeek = (x: { season: number; week: number } | null | undefined) =>
    !!x && x.season === season && x.week === week;
  return forThisWeek(sunday.arrival) || forThisWeek(sunday.halfTime);
}

export type SundayPrimaryKind = 'review' | 'play' | 'pick' | 'advance';

export interface SundayPrimary {
  kind: SundayPrimaryKind;
  /** i18n key for the button text. Typed, so a renamed key fails the
   *  build rather than rendering a raw id. */
  labelKey: TranslationKey;
  /** Where the action goes. `undefined` for `advance`, which is not a
   *  navigation — it runs the week. */
  screen?: GameScreen;
}

/**
 * @param sunday      the mode's state
 * @param hasFixture  whether the club has an unplayed fixture this week
 *                    (league or cup — see `findSundayFixture`)
 * @param week        the week the state is on, to tell a live half-time pause
 *                    from one left behind by an earlier week
 */
export function sundayPrimaryAction(sunday: SundayState, hasFixture: boolean, week: number): SundayPrimary {
  // A MATCH PAUSED AT THE BREAK OUTRANKS EVERYTHING. The side that kicked off
  // is fixed on the pause, so the one thing to do is go back and finish it —
  // and the sheet it was named from is deliberately no longer a live question.
  // Without this the hub sent a manager whose morning had gutted the XI to the
  // teamsheet instead, which is a screen that can only refuse him.
  if (sunday.halfTime && sunday.halfTime.week === week) {
    return { kind: 'play', labelKey: 'sunday.hub.resumeMatch', screen: 'sunday-match' };
  }
  // The season being over outranks everything else: there is no fixture to play
  // and no week left to advance into until the summary has been read.
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
