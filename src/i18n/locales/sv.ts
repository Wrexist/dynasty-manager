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

  'common.cancel': 'Avbryt',
  'common.confirm': 'Bekräfta',
  'common.close': 'Stäng',
  'common.back': 'Tillbaka',
};

export default { messages };
