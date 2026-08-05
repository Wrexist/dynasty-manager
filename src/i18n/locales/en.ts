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

  // ── Settings ──
  'settings.gameplay': 'Gameplay',
  'settings.communityPack': 'Community Pack',
  'settings.display': 'Display & Accessibility',
  'settings.data': 'Data',
  'settings.backupRestore': 'Back up & restore',
  'settings.help': 'Help',
  'settings.unreadUpdate': 'Unread update',
  'settings.redeemCode': 'Redeem Code',
  'settings.enterCode': 'Enter a code…',
  'settings.redeemCodeAria': 'Redeem code',
  'settings.support': 'Support',
  'settings.legal': 'Legal',
  'settings.privacy': 'Privacy',
  'settings.dataManagement': 'Data Management',
  'settings.captureStudio': 'Capture Studio',
  'settings.developer': 'Developer',
  'settings.feedbackPlaceholder': "Tell us what's on your mind…",
  'settings.feedbackAria': 'Feedback message',

  // ── Manager creation ──
  'manager.name': 'Manager Name',
  'manager.namePlaceholder': 'Enter your name...',
  'manager.nameAria': 'Manager name',
  'manager.startingAge': 'Starting Age',
  'manager.startingAgeAria': 'Starting age',
  'manager.chooseTraits': 'Choose Your Traits',
  'manager.jobOffers': 'Job Offers',
  'manager.counterOfferAria': 'Counter-offer salary',

  // ── League table ──
  'league.table': 'League Table',
  'league.qualificationInfo': 'Qualification info',
  'league.searchClubsInTable': 'Search clubs in this table…',
  'league.searchClubsInTableAria': 'Search clubs in this table',
  'league.clearClubSearch': 'Clear club search',

  // ── Tactics ──
  'tactics.title': 'Tactics',
  'tactics.loadPreset': 'Load preset',
  'tactics.confirmDelete': 'Confirm delete',
  'tactics.deletePreset': 'Delete preset',
  'tactics.presetNamePlaceholder': 'Preset name...',

  // ── Challenges ──
  'challenge.backToChallenges': 'Back to challenges',

  // ── Weekly digest ──
  'digest.weeklySummary': 'Weekly Summary',
  'digest.development': 'Development',
  'digest.training': 'Training',
  'digest.objectives': 'Objectives',

  // ── Common ──
  'common.goBack': 'Go back',
  'common.settings': 'Settings',
  'common.shop': 'Shop',
  'common.clearSearch': 'Clear search',
  'common.searchClubs': 'Search clubs...',
  'common.searchClubsAria': 'Search clubs',
  'common.searchNations': 'Search nations...',
  'common.searchNationsAria': 'Search nations',
  'common.searchLeagues': 'Search leagues...',
  'common.previousWeek': 'Previous week',
  'common.nextWeek': 'Next week',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  'common.back': 'Back',
} as const;

export default en;
