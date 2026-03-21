/**
 * Nationality Utilities
 * Flag emojis and 3-letter codes for all nationalities in the game.
 */

export const NATIONALITY_DATA: Record<string, { flag: string; code: string }> = {
  'England': { flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', code: 'ENG' },
  'Spain': { flag: '\u{1F1EA}\u{1F1F8}', code: 'ESP' },
  'France': { flag: '\u{1F1EB}\u{1F1F7}', code: 'FRA' },
  'Germany': { flag: '\u{1F1E9}\u{1F1EA}', code: 'GER' },
  'Italy': { flag: '\u{1F1EE}\u{1F1F9}', code: 'ITA' },
  'Brazil': { flag: '\u{1F1E7}\u{1F1F7}', code: 'BRA' },
  'Argentina': { flag: '\u{1F1E6}\u{1F1F7}', code: 'ARG' },
  'Portugal': { flag: '\u{1F1F5}\u{1F1F9}', code: 'POR' },
  'Netherlands': { flag: '\u{1F1F3}\u{1F1F1}', code: 'NED' },
  'Belgium': { flag: '\u{1F1E7}\u{1F1EA}', code: 'BEL' },
  'Colombia': { flag: '\u{1F1E8}\u{1F1F4}', code: 'COL' },
  'Uruguay': { flag: '\u{1F1FA}\u{1F1FE}', code: 'URU' },
  'Croatia': { flag: '\u{1F1ED}\u{1F1F7}', code: 'CRO' },
  'Denmark': { flag: '\u{1F1E9}\u{1F1F0}', code: 'DEN' },
  'Norway': { flag: '\u{1F1F3}\u{1F1F4}', code: 'NOR' },
  'Sweden': { flag: '\u{1F1F8}\u{1F1EA}', code: 'SWE' },
  'Switzerland': { flag: '\u{1F1E8}\u{1F1ED}', code: 'SUI' },
  'Nigeria': { flag: '\u{1F1F3}\u{1F1EC}', code: 'NGA' },
  'Senegal': { flag: '\u{1F1F8}\u{1F1F3}', code: 'SEN' },
  'Morocco': { flag: '\u{1F1F2}\u{1F1E6}', code: 'MAR' },
  'Japan': { flag: '\u{1F1EF}\u{1F1F5}', code: 'JPN' },
  'South Korea': { flag: '\u{1F1F0}\u{1F1F7}', code: 'KOR' },
};

/** Get emoji flag for a nationality string */
export function getFlag(nationality: string): string {
  return NATIONALITY_DATA[nationality]?.flag || '\u{1F3F3}\u{FE0F}';
}

/** Get 3-letter country code for a nationality string */
export function getNatCode(nationality: string): string {
  return NATIONALITY_DATA[nationality]?.code || nationality.slice(0, 3).toUpperCase();
}
