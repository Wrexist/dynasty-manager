/**
 * EA league name -> the game's league id.
 *
 * EA brands competitions with their sponsor ("Ligue 1 McDonald's", "Serie
 * BKT", "PKO BP Ekstraklasa") and abbreviates others ("Hellas Liga",
 * "Finnliiga"), so the two name sets barely overlap even where the
 * competition is identical. Each entry below is a competition identity, not a
 * spelling guess.
 *
 * `null` means "EA has this competition, the game does not" — recorded rather
 * than omitted so the gap is visible instead of looking like a matching bug.
 */
export const LEAGUE_ALIASES = {
  // Identical or near-identical names
  'Premier League': 'eng',
  'EFL Championship': 'eng-2',
  'EFL League One': 'eng-3',
  'EFL League Two': 'eng-4',
  'Eredivisie': 'ned',
  'K League 1': 'kor',
  'MLS': 'mls',
  'Allsvenskan': 'swe',
  'Eliteserien': 'nor',

  // Sponsor-branded
  'LALIGA EA SPORTS': 'esp',
  'LALIGA HYPERMOTION': 'esp-2',
  'Serie A Enilive': 'ita',
  'Serie BKT': 'ita-2',
  'Bundesliga': 'ger',
  'Bundesliga 2': 'ger-2',
  '3. Liga': 'ger-3',
  "Ligue 1 McDonald's": 'fra',
  'Ligue 2 BKT': 'fra-2',
  'PKO BP Ekstraklasa': 'pol',
  'Trendyol Süper Lig': 'tur',
  'ROSHN Saudi League': 'sau',
  '3F Superliga': 'den',
  'Brack Super League': 'che',
  'SSE Airtricity PD': 'irl',

  // Abbreviated / localised
  'Liga Portugal': 'por',
  '1A Pro League': 'bel',
  'Ö. Bundesliga': 'aut',
  'Scottish Prem': 'sco',
  'Hellas Liga': 'gre',
  'Česká Liga': 'cze',
  'Liga Hrvatska': 'cro',
  'Ukrayina Liha': 'ukr',
  'Magyar Liga': 'hun',
  'Liga Cyprus': 'cyp',
  'Finnliiga': 'fin',
  'LPF': 'arg',
  'ISL': 'ind',
  'A-League': 'aus',
  // Romanian top flight. Disambiguated by its clubs (FC Rapid 1923, FCSB),
  // NOT by the name: Denmark and Serbia both also call theirs "Superliga".
  'SUPERLIGA': 'rou',

  // Continental cups, not leagues. EA files South American club players under
  // the cup their club is in, which is why Brazil looks empty. The club, not
  // this field, decides the league for these rows.
  'Libertadores': null,
  'Sudamericana': null,

  // Competitions the game does not model.
  'CSL': null,
  'Liga Chile': null,
  'Liga Azerbaijan': null,
  'United Emirates League': null,
};

/** Game leagues with no EA counterpart at all — no data exists to import. */
export const LEAGUES_WITHOUT_EA_SOURCE = ['srb', 'bgr', 'svk', 'isl', 'isr'];
