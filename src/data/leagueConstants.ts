/** Country code → flag emoji mapping (shared across ClubSelection & ChallengePicker) */
export const COUNTRY_FLAGS: Record<string, string> = {
  GB: '\u{1F1EC}\u{1F1E7}', ES: '\u{1F1EA}\u{1F1F8}', IT: '\u{1F1EE}\u{1F1F9}', DE: '\u{1F1E9}\u{1F1EA}', FR: '\u{1F1EB}\u{1F1F7}',
  NL: '\u{1F1F3}\u{1F1F1}', PT: '\u{1F1F5}\u{1F1F9}', BE: '\u{1F1E7}\u{1F1EA}', TR: '\u{1F1F9}\u{1F1F7}', CZ: '\u{1F1E8}\u{1F1FF}',
  GR: '\u{1F1EC}\u{1F1F7}', PL: '\u{1F1F5}\u{1F1F1}', DK: '\u{1F1E9}\u{1F1F0}', NO: '\u{1F1F3}\u{1F1F4}', CH: '\u{1F1E8}\u{1F1ED}',
  AT: '\u{1F1E6}\u{1F1F9}', SCO: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', SE: '\u{1F1F8}\u{1F1EA}', HR: '\u{1F1ED}\u{1F1F7}', HU: '\u{1F1ED}\u{1F1FA}',
  RS: '\u{1F1F7}\u{1F1F8}', RO: '\u{1F1F7}\u{1F1F4}', UA: '\u{1F1FA}\u{1F1E6}', BG: '\u{1F1E7}\u{1F1EC}', SK: '\u{1F1F8}\u{1F1F0}',
  FI: '\u{1F1EB}\u{1F1EE}', IS: '\u{1F1EE}\u{1F1F8}', IE: '\u{1F1EE}\u{1F1EA}', IL: '\u{1F1EE}\u{1F1F1}', CY: '\u{1F1E8}\u{1F1FE}',
};

/** League groupings by region for display purposes */
export const LEAGUE_REGIONS = [
  { label: 'Top 5 Leagues', ids: ['eng', 'esp', 'ita', 'ger', 'fra'] },
  { label: 'Strong Leagues', ids: ['ned', 'por', 'bel', 'tur', 'sco'] },
  { label: 'Central & Eastern Europe', ids: ['cze', 'pol', 'hun', 'rou', 'ukr', 'srb', 'bgr', 'svk', 'cro'] },
  { label: 'Nordic Leagues', ids: ['den', 'nor', 'swe', 'fin', 'isl'] },
  { label: 'Other Leagues', ids: ['gre', 'che', 'aut', 'irl', 'isr', 'cyp'] },
];
