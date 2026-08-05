/**
 * English message catalogue — the source of truth.
 *
 * Always loaded, and every other locale is a Partial of this, so a missing
 * translation falls back here rather than showing an id. Keys are namespaced
 * ids rather than English text so that copy edits do not silently orphan every
 * translation.
 *
 * Only strings the PLAYER READS belong here. Game data, config, save contents
 * and engine output stay English — see the note in `src/i18n/index.ts`.
 */
export const en = {
  // ── Title screen ──
  // Keys mirror the strings the screen actually renders. An invented key with
  // no call site is dead weight in every locale file that copies it.
  'title.newGame': 'New Game',
  'title.newGameSubtitle': 'Slot {slot} · Start a new dynasty',
  'title.newGameAria': 'Start new game in slot {slot}',
  'title.continueAria': 'Continue — {club}, Season {season} Week {week}',
  'title.settings': 'Settings',
  'title.settingsSubtitle': 'Speed · display · purchases',
  'title.whatsNew': "What's New!",
  'title.whatsNewAria': 'What\u2019s new',
  'title.whatsNewAriaUnread': 'What\u2019s new — unread update',
  'title.openSettings': 'Open settings',

  // ── Season summary ──
  'season.complete': 'Season {season} Complete',
  'season.promoted': 'PROMOTED!',
  'season.promotedBody': "Congratulations! You've earned promotion to a higher division.",
  'season.relegated': 'RELEGATED',
  'season.relegatedBody': 'Your club has been relegated to a lower division.',
  'season.playoff': 'Promotion Playoff',
  'season.playoffWon': 'You came through the playoff.',
  'season.playoffLost': 'Your playoff run ended here.',
  'season.playoffFinal': 'Final',
  'season.playoffSemi': 'Semi',

  // ── Common ──
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  'common.back': 'Back',
} as const;

export default en;
