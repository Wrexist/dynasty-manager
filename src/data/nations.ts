/**
 * International nations data — 51 nations with FIFA-style rankings and confederations.
 * Used for national team selection and international tournament generation.
 */

export interface NationData {
  name: string;
  confederation: 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF';
  baseRanking: number; // 1-51 (lower = better)
  color: string;
  secondaryColor: string;
}

export const NATIONS: NationData[] = [
  // UEFA (Europe) — 24 nations
  { name: 'France', confederation: 'UEFA', baseRanking: 1, color: '#002395', secondaryColor: '#FFFFFF' },
  { name: 'Spain', confederation: 'UEFA', baseRanking: 4, color: '#AA151B', secondaryColor: '#F1BF00' },
  { name: 'England', confederation: 'UEFA', baseRanking: 5, color: '#FFFFFF', secondaryColor: '#CF081F' },
  { name: 'Germany', confederation: 'UEFA', baseRanking: 6, color: '#000000', secondaryColor: '#FFFFFF' },
  { name: 'Italy', confederation: 'UEFA', baseRanking: 7, color: '#009246', secondaryColor: '#FFFFFF' },
  { name: 'Portugal', confederation: 'UEFA', baseRanking: 8, color: '#006600', secondaryColor: '#FF0000' },
  { name: 'Netherlands', confederation: 'UEFA', baseRanking: 9, color: '#FF6600', secondaryColor: '#FFFFFF' },
  { name: 'Belgium', confederation: 'UEFA', baseRanking: 10, color: '#ED2939', secondaryColor: '#FAE042' },
  { name: 'Croatia', confederation: 'UEFA', baseRanking: 11, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Denmark', confederation: 'UEFA', baseRanking: 16, color: '#C8102E', secondaryColor: '#FFFFFF' },
  { name: 'Switzerland', confederation: 'UEFA', baseRanking: 19, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Poland', confederation: 'UEFA', baseRanking: 23, color: '#FFFFFF', secondaryColor: '#DC143C' },
  { name: 'Turkey', confederation: 'UEFA', baseRanking: 25, color: '#E30A17', secondaryColor: '#FFFFFF' },
  { name: 'Serbia', confederation: 'UEFA', baseRanking: 27, color: '#C6363C', secondaryColor: '#0C4076' },
  { name: 'Czech Republic', confederation: 'UEFA', baseRanking: 29, color: '#11457E', secondaryColor: '#D7141A' },
  { name: 'Austria', confederation: 'UEFA', baseRanking: 30, color: '#ED2939', secondaryColor: '#FFFFFF' },
  { name: 'Ukraine', confederation: 'UEFA', baseRanking: 31, color: '#005BBB', secondaryColor: '#FFD500' },
  { name: 'Scotland', confederation: 'UEFA', baseRanking: 33, color: '#003078', secondaryColor: '#FFFFFF' },
  { name: 'Sweden', confederation: 'UEFA', baseRanking: 21, color: '#006AA7', secondaryColor: '#FECC02' },
  { name: 'Wales', confederation: 'UEFA', baseRanking: 35, color: '#C8102E', secondaryColor: '#00A651' },
  { name: 'Norway', confederation: 'UEFA', baseRanking: 36, color: '#BA0C2F', secondaryColor: '#00205B' },
  { name: 'Hungary', confederation: 'UEFA', baseRanking: 38, color: '#436F4D', secondaryColor: '#CE2939' },
  { name: 'Ireland', confederation: 'UEFA', baseRanking: 41, color: '#169B62', secondaryColor: '#FFFFFF' },
  { name: 'Greece', confederation: 'UEFA', baseRanking: 43, color: '#0D5EAF', secondaryColor: '#FFFFFF' },

  // CONMEBOL (South America) — 8 nations
  { name: 'Brazil', confederation: 'CONMEBOL', baseRanking: 2, color: '#009C3B', secondaryColor: '#FFDF00' },
  { name: 'Argentina', confederation: 'CONMEBOL', baseRanking: 3, color: '#75AADB', secondaryColor: '#FFFFFF' },
  { name: 'Uruguay', confederation: 'CONMEBOL', baseRanking: 14, color: '#5CBFEB', secondaryColor: '#FFFFFF' },
  { name: 'Colombia', confederation: 'CONMEBOL', baseRanking: 15, color: '#FCD116', secondaryColor: '#003893' },
  { name: 'Ecuador', confederation: 'CONMEBOL', baseRanking: 39, color: '#FFD100', secondaryColor: '#034EA2' },
  { name: 'Chile', confederation: 'CONMEBOL', baseRanking: 37, color: '#D52B1E', secondaryColor: '#FFFFFF' },
  { name: 'Peru', confederation: 'CONMEBOL', baseRanking: 40, color: '#D91023', secondaryColor: '#FFFFFF' },
  { name: 'Paraguay', confederation: 'CONMEBOL', baseRanking: 45, color: '#D52B1E', secondaryColor: '#0038A8' },

  // CAF (Africa) — 10 nations
  { name: 'Morocco', confederation: 'CAF', baseRanking: 12, color: '#C1272D', secondaryColor: '#006233' },
  { name: 'Senegal', confederation: 'CAF', baseRanking: 20, color: '#00853F', secondaryColor: '#FDEF42' },
  { name: 'Nigeria', confederation: 'CAF', baseRanking: 22, color: '#008751', secondaryColor: '#FFFFFF' },
  { name: 'Cameroon', confederation: 'CAF', baseRanking: 28, color: '#007A5E', secondaryColor: '#CE1126' },
  { name: 'Ghana', confederation: 'CAF', baseRanking: 32, color: '#006B3F', secondaryColor: '#FCD116' },
  { name: 'Egypt', confederation: 'CAF', baseRanking: 34, color: '#CE1126', secondaryColor: '#FFFFFF' },
  { name: 'Ivory Coast', confederation: 'CAF', baseRanking: 42, color: '#FF8200', secondaryColor: '#009A44' },
  { name: 'Algeria', confederation: 'CAF', baseRanking: 44, color: '#006233', secondaryColor: '#FFFFFF' },
  { name: 'Mali', confederation: 'CAF', baseRanking: 47, color: '#14B53A', secondaryColor: '#FCD116' },
  { name: 'Gabon', confederation: 'CAF', baseRanking: 51, color: '#009E49', secondaryColor: '#3A75C4' },

  // AFC (Asia) — 4 nations
  { name: 'Japan', confederation: 'AFC', baseRanking: 17, color: '#000080', secondaryColor: '#FFFFFF' },
  { name: 'South Korea', confederation: 'AFC', baseRanking: 24, color: '#CD2E3A', secondaryColor: '#003478' },
  { name: 'Australia', confederation: 'AFC', baseRanking: 26, color: '#FFCD00', secondaryColor: '#00843D' },
  { name: 'Saudi Arabia', confederation: 'AFC', baseRanking: 46, color: '#006C35', secondaryColor: '#FFFFFF' },

  // CONCACAF (North/Central America + Caribbean) — 5 nations
  { name: 'USA', confederation: 'CONCACAF', baseRanking: 13, color: '#002868', secondaryColor: '#BF0A30' },
  { name: 'Mexico', confederation: 'CONCACAF', baseRanking: 18, color: '#006847', secondaryColor: '#FFFFFF' },
  { name: 'Canada', confederation: 'CONCACAF', baseRanking: 49, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Jamaica', confederation: 'CONCACAF', baseRanking: 48, color: '#009B3A', secondaryColor: '#FED100' },
  { name: 'Costa Rica', confederation: 'CONCACAF', baseRanking: 50, color: '#002B7F', secondaryColor: '#CE1126' },
];

/** Notable star players per nation for display in selection screen */
export interface NationStarPlayer {
  name: string;
  position: string;
  rating: number;
}

export const NATION_STARS: Record<string, NationStarPlayer[]> = {
  // UEFA
  'England': [
    { name: 'J. Bellingham', position: 'CM', rating: 91 },
    { name: 'B. Saka', position: 'RW', rating: 89 },
    { name: 'C. Palmer', position: 'CAM', rating: 88 },
  ],
  'France': [
    { name: 'K. Mbappé', position: 'ST', rating: 93 },
    { name: 'A. Tchouaméni', position: 'CDM', rating: 87 },
    { name: 'A. Griezmann', position: 'CAM', rating: 86 },
  ],
  'Spain': [
    { name: 'R. Yamal', position: 'RW', rating: 91 },
    { name: 'P. Gavi', position: 'CM', rating: 87 },
    { name: 'D. Olmo', position: 'CAM', rating: 87 },
  ],
  'Germany': [
    { name: 'F. Wirtz', position: 'CAM', rating: 90 },
    { name: 'J. Kimmich', position: 'CDM', rating: 88 },
    { name: 'N. Schlotterbeck', position: 'CB', rating: 86 },
  ],
  'Italy': [
    { name: 'G. Donnarumma', position: 'GK', rating: 87 },
    { name: 'N. Barella', position: 'CM', rating: 87 },
    { name: 'F. Dimarco', position: 'LB', rating: 86 },
  ],
  'Portugal': [
    { name: 'B. Silva', position: 'CAM', rating: 89 },
    { name: 'R. Dias', position: 'CB', rating: 87 },
    { name: 'R. Leão', position: 'LW', rating: 86 },
  ],
  'Netherlands': [
    { name: 'F. de Jong', position: 'CM', rating: 87 },
    { name: 'C. Gakpo', position: 'LW', rating: 87 },
    { name: 'X. Simons', position: 'CAM', rating: 86 },
  ],
  'Belgium': [
    { name: 'K. De Bruyne', position: 'CAM', rating: 90 },
    { name: 'J. Doku', position: 'RW', rating: 86 },
    { name: 'A. Onana', position: 'CM', rating: 85 },
  ],
  'Croatia': [
    { name: 'J. Gvardiol', position: 'CB', rating: 87 },
    { name: 'L. Modrić', position: 'CM', rating: 87 },
    { name: 'M. Kovačić', position: 'CM', rating: 85 },
  ],
  'Denmark': [
    { name: 'R. Højlund', position: 'ST', rating: 86 },
    { name: 'P. Højbjerg', position: 'CDM', rating: 84 },
    { name: 'A. Christensen', position: 'CB', rating: 83 },
  ],
  'Switzerland': [
    { name: 'G. Xhaka', position: 'CM', rating: 86 },
    { name: 'M. Akanji', position: 'CB', rating: 85 },
    { name: 'D. Ndoye', position: 'RW', rating: 82 },
  ],
  'Poland': [
    { name: 'R. Lewandowski', position: 'ST', rating: 88 },
    { name: 'P. Zieliński', position: 'CM', rating: 84 },
    { name: 'J. Kiwior', position: 'CB', rating: 82 },
  ],
  'Turkey': [
    { name: 'H. Çalhanoğlu', position: 'CM', rating: 86 },
    { name: 'A. Güler', position: 'CAM', rating: 85 },
    { name: 'F. Kadıoğlu', position: 'LB', rating: 83 },
  ],
  'Serbia': [
    { name: 'D. Vlahović', position: 'ST', rating: 86 },
    { name: 'S. Milinković-Savić', position: 'CM', rating: 85 },
    { name: 'N. Pavlović', position: 'CB', rating: 82 },
  ],
  'Czech Republic': [
    { name: 'P. Schick', position: 'ST', rating: 83 },
    { name: 'T. Souček', position: 'CDM', rating: 82 },
    { name: 'A. Černý', position: 'RW', rating: 81 },
  ],
  'Austria': [
    { name: 'M. Sabitzer', position: 'CM', rating: 84 },
    { name: 'K. Laimer', position: 'CM', rating: 83 },
    { name: 'P. Lienhart', position: 'CB', rating: 81 },
  ],
  'Ukraine': [
    { name: 'A. Dovbyk', position: 'ST', rating: 84 },
    { name: 'O. Zinchenko', position: 'LB', rating: 84 },
    { name: 'M. Mudryk', position: 'LW', rating: 83 },
  ],
  'Scotland': [
    { name: 'A. Robertson', position: 'LB', rating: 85 },
    { name: 'S. McTominay', position: 'CM', rating: 84 },
    { name: 'J. McGinn', position: 'CM', rating: 82 },
  ],
  'Wales': [
    { name: 'B. Johnson', position: 'LW', rating: 82 },
    { name: 'E. Ampadu', position: 'CB', rating: 80 },
    { name: 'D. James', position: 'RW', rating: 79 },
  ],
  'Norway': [
    { name: 'E. Haaland', position: 'ST', rating: 94 },
    { name: 'M. Ødegaard', position: 'CAM', rating: 90 },
    { name: 'S. Berge', position: 'CDM', rating: 82 },
  ],
  'Sweden': [
    { name: 'V. Gyökeres', position: 'ST', rating: 88 },
    { name: 'A. Isak', position: 'ST', rating: 87 },
    { name: 'D. Kulusevski', position: 'RW', rating: 85 },
  ],
  'Hungary': [
    { name: 'D. Szoboszlai', position: 'CAM', rating: 85 },
    { name: 'P. Gulácsi', position: 'GK', rating: 82 },
    { name: 'W. Orbán', position: 'CB', rating: 81 },
  ],
  'Ireland': [
    { name: 'C. Ogbene', position: 'LW', rating: 78 },
    { name: 'A. Omobamidele', position: 'CB', rating: 76 },
    { name: 'J. Molumby', position: 'CM', rating: 75 },
  ],
  'Greece': [
    { name: 'V. Pavlidis', position: 'ST', rating: 81 },
    { name: 'K. Mavropanos', position: 'CB', rating: 80 },
    { name: 'A. Bakasetas', position: 'CAM', rating: 78 },
  ],

  // CONMEBOL
  'Brazil': [
    { name: 'V. Jr.', position: 'LW', rating: 93 },
    { name: 'R. Goes', position: 'RW', rating: 88 },
    { name: 'E. Militão', position: 'CB', rating: 87 },
  ],
  'Argentina': [
    { name: 'J. Álvarez', position: 'ST', rating: 89 },
    { name: 'C. Romero', position: 'CB', rating: 87 },
    { name: 'R. De Paul', position: 'CM', rating: 85 },
  ],
  'Uruguay': [
    { name: 'F. Valverde', position: 'CM', rating: 88 },
    { name: 'D. Núñez', position: 'ST', rating: 87 },
    { name: 'R. Araújo', position: 'CB', rating: 85 },
  ],
  'Colombia': [
    { name: 'L. Díaz', position: 'LW', rating: 87 },
    { name: 'J. Arias', position: 'RW', rating: 83 },
    { name: 'R. Ríos', position: 'CDM', rating: 83 },
  ],
  'Ecuador': [
    { name: 'M. Caicedo', position: 'CDM', rating: 85 },
    { name: 'P. Hincapié', position: 'CB', rating: 81 },
    { name: 'G. Plata', position: 'RW', rating: 80 },
  ],
  'Paraguay': [
    { name: 'M. Almirón', position: 'CAM', rating: 80 },
    { name: 'J. Enciso', position: 'RW', rating: 79 },
    { name: 'G. Gómez', position: 'CB', rating: 79 },
  ],
  'Chile': [
    { name: 'A. Sánchez', position: 'ST', rating: 82 },
    { name: 'C. Aránguiz', position: 'CM', rating: 80 },
    { name: 'G. Medel', position: 'CB', rating: 78 },
  ],
  'Peru': [
    { name: 'P. Guerrero', position: 'ST', rating: 78 },
    { name: 'R. Tapia', position: 'CDM', rating: 77 },
    { name: 'A. Carrillo', position: 'RW', rating: 76 },
  ],

  // CAF
  'Nigeria': [
    { name: 'V. Osimhen', position: 'ST', rating: 88 },
    { name: 'S. Lookman', position: 'LW', rating: 85 },
    { name: 'W. Ndidi', position: 'CDM', rating: 83 },
  ],
  'Senegal': [
    { name: 'S. Mané', position: 'LW', rating: 86 },
    { name: 'K. Koulibaly', position: 'CB', rating: 84 },
    { name: 'I. Sarr', position: 'RW', rating: 83 },
  ],
  'Morocco': [
    { name: 'A. Hakimi', position: 'RB', rating: 89 },
    { name: 'Y. En-Nesyri', position: 'ST', rating: 84 },
    { name: 'S. Amrabat', position: 'CDM', rating: 83 },
  ],
  'Ghana': [
    { name: 'M. Kudus', position: 'CAM', rating: 85 },
    { name: 'T. Partey', position: 'CDM', rating: 84 },
    { name: 'A. Fatawu', position: 'RW', rating: 82 },
  ],
  'Ivory Coast': [
    { name: 'S. Haller', position: 'ST', rating: 82 },
    { name: 'F. Kessié', position: 'CM', rating: 81 },
    { name: 'S. Fofana', position: 'CM', rating: 80 },
  ],
  'Cameroon': [
    { name: 'A. Onana', position: 'GK', rating: 86 },
    { name: 'M. Mbeumo', position: 'RW', rating: 84 },
    { name: 'F. Anguissa', position: 'CDM', rating: 84 },
  ],
  'Egypt': [
    { name: 'M. Salah', position: 'RW', rating: 90 },
    { name: 'O. Marmoush', position: 'LW', rating: 84 },
    { name: 'M. Elneny', position: 'CDM', rating: 79 },
  ],
  'Algeria': [
    { name: 'R. Mahrez', position: 'RW', rating: 84 },
    { name: 'I. Bennacer', position: 'CM', rating: 82 },
    { name: 'A. Atal', position: 'RB', rating: 80 },
  ],
  'Mali': [
    { name: 'A. Traoré', position: 'CM', rating: 80 },
    { name: 'M. Djenepo', position: 'LW', rating: 78 },
    { name: 'Y. Koné', position: 'CB', rating: 77 },
  ],
  'Gabon': [
    { name: 'P. Aubameyang', position: 'ST', rating: 82 },
    { name: 'D. Bouanga', position: 'LW', rating: 79 },
    { name: 'B. Ecuele Manga', position: 'CB', rating: 75 },
  ],

  // AFC
  'Japan': [
    { name: 'T. Kubo', position: 'RW', rating: 86 },
    { name: 'K. Mitoma', position: 'LW', rating: 85 },
    { name: 'W. Endo', position: 'CDM', rating: 83 },
  ],
  'South Korea': [
    { name: 'H. Son', position: 'LW', rating: 88 },
    { name: 'K. Min-jae', position: 'CB', rating: 87 },
    { name: 'L. Kang-in', position: 'CAM', rating: 84 },
  ],
  'Saudi Arabia': [
    { name: 'S. Al-Dawsari', position: 'LW', rating: 80 },
    { name: 'H. Al-Shahrani', position: 'LB', rating: 78 },
    { name: 'F. Al-Muwallad', position: 'ST', rating: 77 },
  ],
  'Australia': [
    { name: 'M. Leckie', position: 'RW', rating: 79 },
    { name: 'J. McGree', position: 'CM', rating: 78 },
    { name: 'T. Ryan', position: 'GK', rating: 77 },
  ],

  // CONCACAF
  'USA': [
    { name: 'C. Pulisic', position: 'CAM', rating: 86 },
    { name: 'T. Adams', position: 'CDM', rating: 84 },
    { name: 'W. McKennie', position: 'CM', rating: 82 },
  ],
  'Mexico': [
    { name: 'S. Giménez', position: 'ST', rating: 84 },
    { name: 'H. Lozano', position: 'RW', rating: 83 },
    { name: 'E. Álvarez', position: 'CDM', rating: 82 },
  ],
  'Jamaica': [
    { name: 'L. Bailey', position: 'LW', rating: 83 },
    { name: 'M. Antonio', position: 'ST', rating: 79 },
    { name: 'E. Palmer', position: 'CB', rating: 76 },
  ],
  'Canada': [
    { name: 'A. Davies', position: 'LB', rating: 86 },
    { name: 'J. David', position: 'ST', rating: 85 },
    { name: 'T. Buchanan', position: 'RW', rating: 80 },
  ],
  'Costa Rica': [
    { name: 'K. Navas', position: 'GK', rating: 83 },
    { name: 'J. Campbell', position: 'ST', rating: 78 },
    { name: 'B. Calvo', position: 'CB', rating: 76 },
  ],
};

/** Get a nation by name */
export function getNation(name: string): NationData | undefined {
  return NATIONS.find(n => n.name === name);
}

/** Get all nation names */
export function getAllNationNames(): string[] {
  return NATIONS.map(n => n.name);
}
