/**
 * Swedish.
 *
 * A Partial of `en` on purpose: anything missing falls back to English, so this
 * file can be filled in over time without ever leaving a screen broken or
 * showing raw keys. That property is what makes translating incrementally safe.
 */
import type { LocaleMessages } from '../index';

export const messages: LocaleMessages = {
  'title.newGame': 'Nytt spel',
  'title.newGameSubtitle': 'Plats {slot} · Starta en ny dynasti',
  'title.newGameAria': 'Starta nytt spel på plats {slot}',
  'title.continueAria': 'Fortsätt — {club}, säsong {season} vecka {week}',
  'title.settings': 'Inställningar',
  'title.settingsSubtitle': 'Hastighet · visning · köp',
  'title.whatsNew': 'Nyheter!',
  'title.whatsNewAria': 'Nyheter',
  'title.whatsNewAriaUnread': 'Nyheter — oläst uppdatering',
  'title.openSettings': 'Öppna inställningar',

  'season.complete': 'Säsong {season} avslutad',
  'season.promoted': 'UPPFLYTTADE!',
  'season.promotedBody': 'Grattis! Ni har spelat er till en högre division.',
  'season.relegated': 'NEDFLYTTADE',
  'season.relegatedBody': 'Er klubb har flyttats ned till en lägre division.',
  'season.playoff': 'Playoff till uppflyttning',
  'season.playoffWon': 'Ni tog er igenom playoffet.',
  'season.playoffLost': 'Er playoffresa slutade här.',
  'season.playoffFinal': 'Final',
  'season.playoffSemi': 'Semi',

  'settings.gameplay': 'Spel',
  'settings.communityPack': 'Community-paket',
  'settings.display': 'Visning & tillgänglighet',
  'settings.data': 'Data',
  'settings.backupRestore': 'Säkerhetskopiera & återställ',
  'settings.help': 'Hjälp',
  'settings.unreadUpdate': 'Oläst uppdatering',
  'settings.redeemCode': 'Lös in kod',
  'settings.enterCode': 'Ange en kod…',
  'settings.redeemCodeAria': 'Lös in kod',
  'settings.support': 'Support',
  'settings.legal': 'Juridik',
  'settings.privacy': 'Integritet',
  'settings.dataManagement': 'Datahantering',
  'settings.captureStudio': 'Capture Studio',
  'settings.developer': 'Utvecklare',
  'settings.feedbackPlaceholder': 'Berätta vad du tycker…',
  'settings.feedbackAria': 'Feedbackmeddelande',

  'manager.name': 'Managernamn',
  'manager.namePlaceholder': 'Ange ditt namn...',
  'manager.nameAria': 'Managernamn',
  'manager.startingAge': 'Startålder',
  'manager.startingAgeAria': 'Startålder',
  'manager.chooseTraits': 'Välj dina egenskaper',
  'manager.jobOffers': 'Jobberbjudanden',
  'manager.counterOfferAria': 'Motbud lön',

  'league.table': 'Tabell',
  'league.qualificationInfo': 'Kvalinformation',
  'league.searchClubsInTable': 'Sök klubbar i tabellen…',
  'league.searchClubsInTableAria': 'Sök klubbar i tabellen',
  'league.clearClubSearch': 'Rensa klubbsökning',

  'tactics.title': 'Taktik',
  'tactics.loadPreset': 'Ladda förinställning',
  'tactics.confirmDelete': 'Bekräfta borttagning',
  'tactics.deletePreset': 'Ta bort förinställning',
  'tactics.presetNamePlaceholder': 'Namn på förinställning...',

  'challenge.backToChallenges': 'Tillbaka till utmaningar',

  'digest.weeklySummary': 'Veckosammanfattning',
  'digest.development': 'Utveckling',
  'digest.training': 'Träning',
  'digest.objectives': 'Mål',

  'common.goBack': 'Tillbaka',
  'common.settings': 'Inställningar',
  'common.shop': 'Butik',
  'common.clearSearch': 'Rensa sökning',
  'common.searchClubs': 'Sök klubbar...',
  'common.searchClubsAria': 'Sök klubbar',
  'common.searchNations': 'Sök nationer...',
  'common.searchNationsAria': 'Sök nationer',
  'common.searchLeagues': 'Sök ligor...',
  'common.previousWeek': 'Föregående vecka',
  'common.nextWeek': 'Nästa vecka',
  'common.cancel': 'Avbryt',
  'common.confirm': 'Bekräfta',
  'common.close': 'Stäng',
  'common.back': 'Tillbaka',
};

export default { messages };
