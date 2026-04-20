// Maps a league-data club `id` to the key used in `CLUB_TEMPLATES`
// (src/data/squads/*.ts). Only entries where the two differ live here —
// matching ids are found directly.
//
// Every value MUST correspond to a real key in CLUB_TEMPLATES. A test in
// src/test/clubTemplateAliases.test.ts enforces this.
export const CLUB_TEMPLATE_ALIASES: Record<string, string> = {
  // england (Premier League)
  'ipswich-town': 'ipswich',
  'manchester-united': 'man-utd',
  'newcastle-united': 'newcastle-utd',
  'nottingham-forest': 'nottm-forest',
  'tottenham-hotspur': 'spurs',
  'west-ham-united': 'west-ham',
  'wolverhampton-wanderers': 'wolves',

  // spain (La Liga)
  'athletic-bilbao': 'athletic-club',
  'atletico-madrid': 'atletico-de-madrid',
  'barcelona': 'fc-barcelona',
  'celta-vigo': 'rc-celta',
  'deportivo-alaves': 'd-alaves',
  'espanyol': 'rcd-espanyol',
  'getafe': 'getafe-cf',
  'girona': 'girona-fc',
  'las-palmas': 'ud-las-palmas',
  'leganes': 'cd-leganes',
  'mallorca': 'rcd-mallorca',
  'osasuna': 'ca-osasuna',
  'real-valladolid': 'r-valladolid-cf',
  'sevilla': 'sevilla-fc',
  'valencia': 'valencia-cf',
  'villarreal': 'villarreal-cf',

  // italy (Serie A)
  'ac-milan': 'milano-fc',
  'atalanta': 'bergamo-calcio',
  'inter-milan': 'lombardia-fc',
  'lazio': 'latium',
  'napoli': 'ssc-napoli',

  // germany (Bundesliga)
  'augsburg': 'fc-augsburg',
  'bayer-leverkusen': 'leverkusen',
  'bayern-munich': 'fc-bayern-munchen',
  'bochum': 'vfl-bochum-1848',
  'borussia-monchengladbach': 'mgladbach',
  'eintracht-frankfurt': 'frankfurt',
  'fc-heidenheim': 'heidenheim',
  'freiburg': 'sc-freiburg',
  'hoffenheim': 'tsg-hoffenheim',
  'mainz-05': '1-fsv-mainz-05',
  'st-pauli': 'fc-st-pauli',
  'stuttgart': 'vfb-stuttgart',
  'werder-bremen': 'sv-werder-bremen',
  'wolfsburg': 'vfl-wolfsburg',

  // france (Ligue 1)
  'angers': 'angers-sco',
  'auxerre': 'aj-auxerre',
  'brest': 'stade-brestois-29',
  'le-havre': 'havre-ac',
  'lens': 'rc-lens',
  'lille': 'losc-lille',
  'lyon': 'ol',
  'marseille': 'om',
  'monaco': 'as-monaco',
  'nantes': 'fc-nantes',
  'nice': 'ogc-nice',
  'paris-saint-germain': 'paris-sg',
  'reims': 'stade-de-reims',
  'rennes': 'stade-rennais-fc',
  'saint-etienne': 'as-saint-etienne',
  'toulouse': 'toulouse-fc',

  // netherlands (Eredivisie)
  'almere-city': 'almere-city-fc',
  'az-alkmaar': 'az',
  'heerenveen': 'sc-heerenveen',
  'psv-eindhoven': 'psv',

  // portugal (Primeira Liga)
  'avs': 'avs-futebol-sad',
  'benfica': 'sl-benfica',
  'boavista': 'boavista-fc',
  'braga': 'sc-braga',
  'casa-pia': 'casa-pia-ac',
  'estoril': 'estoril-praia',
  'famalicao': 'fc-famalico',
  'moreirense': 'moreirense-fc',
  'porto': 'fc-porto',
  'rio-ave': 'rio-ave-fc',
  'vitoria-guimaraes': 'vitoria-sc',

  // belgium (Pro League)
  'anderlecht': 'rsc-anderlecht',
  'antwerp': 'royal-antwerp-fc',
  'beerschot': 'k-beerschot-va',
  'charleroi': 'sp-charleroi',
  'dender': 'fcv-dender-eh',
  'genk': 'krc-genk',
  'gent': 'kaa-gent',
  'kortrijk': 'kv-kortrijk',
  'mechelen': 'kv-mechelen',
  'sint-truiden': 'stvv',
  'union-sg': 'r-union-st-g',
  'westerlo': 'kvc-westerlo',

  // austria (Bundesliga)
  'altach': 'scr-altach',
  'austria-wien': 'fk-austria-wien',
  'hartberg': 'tsv-hartberg',
  'rapid-wien': 'sk-rapid',
  'sturm-graz': 'sk-sturm-graz',

  // denmark (Superliga)
  'aarhus-gf': 'agf',
  'brondby': 'brndby-if',
  'fc-copenhagen': 'fc-kbenhavn',
  'fc-nordsjaelland': 'fc-nordsjlland',
  'lyngby': 'lyngby-bk',
  'silkeborg': 'silkeborg-if',
  'sonderjyske': 'snderjyske',
  'vejle': 'vejle-boldklub',
  'viborg': 'viborg-ff',

  // sweden (Allsvenskan)
  'djurgarden': 'djurgrdens-if',
  'elfsborg': 'if-elfsborg',
  'hacken': 'bk-hacken',
  'halmstad': 'halmstads-bk',
  'hammarby': 'hammarby-if',
  'mjallby': 'mjallby-aif',
  'sirius': 'ik-sirius',
  'varnamo': 'ifk-varnamo',
  'vasteras-sk': 'vasters-sk',

  // scotland (Premiership)
  'dundee': 'dundee-fc',

  // poland (Ekstraklasa)
  'jagiellonia-bialystok': 'jagiellonia',
  'lech-poznan': 'lech-pozna',
  'lechia-gdansk': 'lechia-gdask',
  'legia-warsaw': 'legia-warszawa',
  'pogon-szczecin': 'pogo-szczecin',
  'puszcza-niepolomice': 'puszcza',
  'rakow-czestochowa': 'rakow',
  'slask-wroclaw': 'lsk-wrocaw',
  'zaglebie-lubin': 'zagbie-lubin',

  // turkey (Süper Lig)
  'besiktas': 'beikta',
  'gaziantep-fk': 'gaziantep',
  'istanbul-basaksehir': 'baakehir',
  'kasimpasa': 'kasmpaa',

  // ireland (Premier Division)
  'st-patricks-athletic': 'st-pats',

  // norway (Eliteserien)
  'bodo-glimt': 'fk-bodglimt',
  'brann': 'sk-brann',
  'fredrikstad': 'fredrikstad-fk',
  'hamkam': 'hamkam-fotball',
  'haugesund': 'fk-haugesund',
  'kristiansund': 'kristiansund-bk',
  'lillestrom': 'lillestrm-sk',
  'molde': 'molde-fk',
  'odd': 'odds-bk',
  'rosenborg': 'rosenborg-bk',
  'sarpsborg': 'sarpsborg-08',
  'stromsgodset': 'strmsgodset-if',
  'tromso': 'troms-il',
  'viking': 'viking-fk',

  // czechia (Fortuna Liga)
  'slavia-prague': 'slavia-praha',
  'sparta-prague': 'sparta-praha',
  'viktoria-plzen': 'viktoria-plze',

  // greece (Super League)
  'olympiacos': 'olympiacos-fc',
  'paok': 'paok-fc',

  // cyprus (First Division)
  'apoel': 'apoel-fc',

  // hungary (NB I)
  'ferencvaros': 'ferencvarosi-tc',
};

/** Resolve a league club id to the matching `CLUB_TEMPLATES` key. */
export function resolveSquadKey(clubId: string): string {
  return CLUB_TEMPLATE_ALIASES[clubId] || clubId;
}
