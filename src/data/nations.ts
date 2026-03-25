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
  { name: 'England', confederation: 'UEFA', baseRanking: 4, color: '#FFFFFF', secondaryColor: '#CF081F' },
  { name: 'France', confederation: 'UEFA', baseRanking: 1, color: '#002395', secondaryColor: '#FFFFFF' },
  { name: 'Spain', confederation: 'UEFA', baseRanking: 3, color: '#AA151B', secondaryColor: '#F1BF00' },
  { name: 'Germany', confederation: 'UEFA', baseRanking: 5, color: '#000000', secondaryColor: '#FFFFFF' },
  { name: 'Italy', confederation: 'UEFA', baseRanking: 6, color: '#009246', secondaryColor: '#FFFFFF' },
  { name: 'Portugal', confederation: 'UEFA', baseRanking: 7, color: '#006600', secondaryColor: '#FF0000' },
  { name: 'Netherlands', confederation: 'UEFA', baseRanking: 8, color: '#FF6600', secondaryColor: '#FFFFFF' },
  { name: 'Belgium', confederation: 'UEFA', baseRanking: 9, color: '#ED2939', secondaryColor: '#FAE042' },
  { name: 'Croatia', confederation: 'UEFA', baseRanking: 10, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Denmark', confederation: 'UEFA', baseRanking: 14, color: '#C8102E', secondaryColor: '#FFFFFF' },
  { name: 'Switzerland', confederation: 'UEFA', baseRanking: 16, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Poland', confederation: 'UEFA', baseRanking: 20, color: '#FFFFFF', secondaryColor: '#DC143C' },
  { name: 'Turkey', confederation: 'UEFA', baseRanking: 22, color: '#E30A17', secondaryColor: '#FFFFFF' },
  { name: 'Serbia', confederation: 'UEFA', baseRanking: 24, color: '#C6363C', secondaryColor: '#0C4076' },
  { name: 'Czech Republic', confederation: 'UEFA', baseRanking: 26, color: '#11457E', secondaryColor: '#D7141A' },
  { name: 'Austria', confederation: 'UEFA', baseRanking: 27, color: '#ED2939', secondaryColor: '#FFFFFF' },
  { name: 'Ukraine', confederation: 'UEFA', baseRanking: 28, color: '#005BBB', secondaryColor: '#FFD500' },
  { name: 'Scotland', confederation: 'UEFA', baseRanking: 30, color: '#003078', secondaryColor: '#FFFFFF' },
  { name: 'Wales', confederation: 'UEFA', baseRanking: 32, color: '#C8102E', secondaryColor: '#00A651' },
  { name: 'Norway', confederation: 'UEFA', baseRanking: 33, color: '#BA0C2F', secondaryColor: '#00205B' },
  { name: 'Sweden', confederation: 'UEFA', baseRanking: 18, color: '#006AA7', secondaryColor: '#FECC02' },
  { name: 'Hungary', confederation: 'UEFA', baseRanking: 35, color: '#436F4D', secondaryColor: '#CE2939' },
  { name: 'Ireland', confederation: 'UEFA', baseRanking: 38, color: '#169B62', secondaryColor: '#FFFFFF' },
  { name: 'Greece', confederation: 'UEFA', baseRanking: 40, color: '#0D5EAF', secondaryColor: '#FFFFFF' },

  // CONMEBOL (South America) — 8 nations
  { name: 'Brazil', confederation: 'CONMEBOL', baseRanking: 2, color: '#009C3B', secondaryColor: '#FFDF00' },
  { name: 'Argentina', confederation: 'CONMEBOL', baseRanking: 2, color: '#75AADB', secondaryColor: '#FFFFFF' },
  { name: 'Uruguay', confederation: 'CONMEBOL', baseRanking: 12, color: '#5CBFEB', secondaryColor: '#FFFFFF' },
  { name: 'Colombia', confederation: 'CONMEBOL', baseRanking: 13, color: '#FCD116', secondaryColor: '#003893' },
  { name: 'Ecuador', confederation: 'CONMEBOL', baseRanking: 36, color: '#FFD100', secondaryColor: '#034EA2' },
  { name: 'Paraguay', confederation: 'CONMEBOL', baseRanking: 42, color: '#D52B1E', secondaryColor: '#0038A8' },
  { name: 'Chile', confederation: 'CONMEBOL', baseRanking: 34, color: '#D52B1E', secondaryColor: '#FFFFFF' },
  { name: 'Peru', confederation: 'CONMEBOL', baseRanking: 37, color: '#D91023', secondaryColor: '#FFFFFF' },

  // CAF (Africa) — 10 nations
  { name: 'Nigeria', confederation: 'CAF', baseRanking: 19, color: '#008751', secondaryColor: '#FFFFFF' },
  { name: 'Senegal', confederation: 'CAF', baseRanking: 17, color: '#00853F', secondaryColor: '#FDEF42' },
  { name: 'Morocco', confederation: 'CAF', baseRanking: 11, color: '#C1272D', secondaryColor: '#006233' },
  { name: 'Ghana', confederation: 'CAF', baseRanking: 29, color: '#006B3F', secondaryColor: '#FCD116' },
  { name: 'Ivory Coast', confederation: 'CAF', baseRanking: 39, color: '#FF8200', secondaryColor: '#009A44' },
  { name: 'Cameroon', confederation: 'CAF', baseRanking: 25, color: '#007A5E', secondaryColor: '#CE1126' },
  { name: 'Egypt', confederation: 'CAF', baseRanking: 31, color: '#CE1126', secondaryColor: '#FFFFFF' },
  { name: 'Algeria', confederation: 'CAF', baseRanking: 41, color: '#006233', secondaryColor: '#FFFFFF' },
  { name: 'Mali', confederation: 'CAF', baseRanking: 44, color: '#14B53A', secondaryColor: '#FCD116' },
  { name: 'Gabon', confederation: 'CAF', baseRanking: 50, color: '#009E49', secondaryColor: '#3A75C4' },

  // AFC (Asia) — 4 nations
  { name: 'Japan', confederation: 'AFC', baseRanking: 15, color: '#000080', secondaryColor: '#FFFFFF' },
  { name: 'South Korea', confederation: 'AFC', baseRanking: 21, color: '#CD2E3A', secondaryColor: '#003478' },
  { name: 'Saudi Arabia', confederation: 'AFC', baseRanking: 43, color: '#006C35', secondaryColor: '#FFFFFF' },
  { name: 'Australia', confederation: 'AFC', baseRanking: 23, color: '#FFCD00', secondaryColor: '#00843D' },

  // CONCACAF (North/Central America + Caribbean) — 5 nations
  { name: 'USA', confederation: 'CONCACAF', baseRanking: 11, color: '#002868', secondaryColor: '#BF0A30' },
  { name: 'Mexico', confederation: 'CONCACAF', baseRanking: 15, color: '#006847', secondaryColor: '#FFFFFF' },
  { name: 'Jamaica', confederation: 'CONCACAF', baseRanking: 45, color: '#009B3A', secondaryColor: '#FED100' },
  { name: 'Canada', confederation: 'CONCACAF', baseRanking: 46, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Costa Rica', confederation: 'CONCACAF', baseRanking: 47, color: '#002B7F', secondaryColor: '#CE1126' },
];

/** Notable star players per nation for display in selection screen */
export interface NationStarPlayer {
  name: string;
  position: string;
  rating: number;
}

export const NATION_STARS: Record<string, NationStarPlayer[]> = {
  'Brazil': [
    { name: 'R. Nascimento', position: 'ST', rating: 92 },
    { name: 'L. Ferreira', position: 'CAM', rating: 89 },
    { name: 'D. Santos', position: 'LW', rating: 88 },
  ],
  'Argentina': [
    { name: 'M. Álvarez', position: 'ST', rating: 91 },
    { name: 'F. Romero', position: 'CM', rating: 88 },
    { name: 'S. Gutiérrez', position: 'RW', rating: 87 },
  ],
  'France': [
    { name: 'K. Mbarra', position: 'ST', rating: 93 },
    { name: 'A. Camara', position: 'CM', rating: 89 },
    { name: 'T. Ndombé', position: 'CB', rating: 87 },
  ],
  'Spain': [
    { name: 'P. Hernández', position: 'CM', rating: 90 },
    { name: 'A. Moreno', position: 'CAM', rating: 88 },
    { name: 'D. Vidal', position: 'CB', rating: 86 },
  ],
  'England': [
    { name: 'J. Palmer', position: 'CAM', rating: 89 },
    { name: 'M. Saka', position: 'RW', rating: 88 },
    { name: 'R. Bellingham', position: 'CM', rating: 90 },
  ],
  'Germany': [
    { name: 'F. Wirtz', position: 'CAM', rating: 89 },
    { name: 'K. Müller', position: 'ST', rating: 87 },
    { name: 'N. Schlotterbeck', position: 'CB', rating: 86 },
  ],
  'Italy': [
    { name: 'N. Barella', position: 'CM', rating: 88 },
    { name: 'F. Dimarco', position: 'LB', rating: 86 },
    { name: 'G. Donnarumma', position: 'GK', rating: 87 },
  ],
  'Portugal': [
    { name: 'B. Silva', position: 'RW', rating: 89 },
    { name: 'R. Dias', position: 'CB', rating: 87 },
    { name: 'V. Gyökeres', position: 'ST', rating: 88 },
  ],
  'Netherlands': [
    { name: 'C. Gakpo', position: 'LW', rating: 87 },
    { name: 'V. de Jong', position: 'CM', rating: 86 },
    { name: 'X. Simons', position: 'CAM', rating: 87 },
  ],
  'Belgium': [
    { name: 'K. De Bruyne', position: 'CAM', rating: 90 },
    { name: 'J. Doku', position: 'RW', rating: 85 },
    { name: 'A. Onana', position: 'CM', rating: 84 },
  ],
  'Croatia': [
    { name: 'L. Modrić', position: 'CM', rating: 87 },
    { name: 'J. Gvardiol', position: 'CB', rating: 86 },
    { name: 'M. Kovačić', position: 'CM', rating: 85 },
  ],
  'Morocco': [
    { name: 'A. Hakimi', position: 'RB', rating: 88 },
    { name: 'S. Amrabat', position: 'CDM', rating: 84 },
    { name: 'Y. En-Nesyri', position: 'ST', rating: 83 },
  ],
  'Uruguay': [
    { name: 'F. Valverde', position: 'CM', rating: 88 },
    { name: 'D. Núñez', position: 'ST', rating: 86 },
    { name: 'R. Araújo', position: 'CB', rating: 85 },
  ],
  'Colombia': [
    { name: 'L. Díaz', position: 'LW', rating: 86 },
    { name: 'J. Arias', position: 'RW', rating: 84 },
    { name: 'R. Ríos', position: 'CDM', rating: 83 },
  ],
  'Denmark': [
    { name: 'R. Højlund', position: 'ST', rating: 85 },
    { name: 'P. Højbjerg', position: 'CDM', rating: 84 },
    { name: 'A. Christensen', position: 'CB', rating: 83 },
  ],
  'Japan': [
    { name: 'T. Kubo', position: 'RW', rating: 85 },
    { name: 'K. Mitoma', position: 'LW', rating: 84 },
    { name: 'W. Endo', position: 'CDM', rating: 83 },
  ],
  'Mexico': [
    { name: 'H. Lozano', position: 'RW', rating: 83 },
    { name: 'E. Álvarez', position: 'CDM', rating: 82 },
    { name: 'S. Giménez', position: 'ST', rating: 83 },
  ],
  'Switzerland': [
    { name: 'G. Xhaka', position: 'CM', rating: 86 },
    { name: 'M. Akanji', position: 'CB', rating: 85 },
    { name: 'D. Ndoye', position: 'RW', rating: 82 },
  ],
  'Senegal': [
    { name: 'S. Mané', position: 'LW', rating: 86 },
    { name: 'K. Koulibaly', position: 'CB', rating: 84 },
    { name: 'I. Sarr', position: 'RW', rating: 82 },
  ],
  'Sweden': [
    { name: 'A. Isak', position: 'ST', rating: 86 },
    { name: 'D. Kulusevski', position: 'RW', rating: 85 },
    { name: 'V. Gyökeres', position: 'ST', rating: 84 },
  ],
  'Nigeria': [
    { name: 'V. Osimhen', position: 'ST', rating: 87 },
    { name: 'S. Lookman', position: 'LW', rating: 84 },
    { name: 'W. Ndidi', position: 'CDM', rating: 83 },
  ],
  'Poland': [
    { name: 'R. Lewandowski', position: 'ST', rating: 88 },
    { name: 'P. Zieliński', position: 'CM', rating: 84 },
    { name: 'J. Kiwior', position: 'CB', rating: 82 },
  ],
  'South Korea': [
    { name: 'H. Son', position: 'LW', rating: 87 },
    { name: 'M. Kim', position: 'CB', rating: 84 },
    { name: 'J. Lee', position: 'CM', rating: 82 },
  ],
  'Turkey': [
    { name: 'H. Çalhanoğlu', position: 'CM', rating: 86 },
    { name: 'A. Güler', position: 'CAM', rating: 84 },
    { name: 'F. Kadıoğlu', position: 'LB', rating: 83 },
  ],
  'Australia': [
    { name: 'J. McGree', position: 'CM', rating: 78 },
    { name: 'C. Goodwin', position: 'LB', rating: 77 },
    { name: 'M. Duke', position: 'ST', rating: 76 },
  ],
  'Serbia': [
    { name: 'D. Vlahović', position: 'ST', rating: 86 },
    { name: 'S. Milinković-Savić', position: 'CM', rating: 85 },
    { name: 'N. Pavlović', position: 'CB', rating: 82 },
  ],
  'Cameroon': [
    { name: 'A. Onana', position: 'GK', rating: 85 },
    { name: 'M. Mbeumo', position: 'RW', rating: 83 },
    { name: 'C. Ekambi', position: 'ST', rating: 81 },
  ],
  'Czech Republic': [
    { name: 'P. Schick', position: 'ST', rating: 83 },
    { name: 'A. Černý', position: 'RW', rating: 81 },
    { name: 'T. Souček', position: 'CDM', rating: 82 },
  ],
  'Austria': [
    { name: 'M. Sabitzer', position: 'CM', rating: 84 },
    { name: 'K. Laimer', position: 'CM', rating: 83 },
    { name: 'P. Lienhart', position: 'CB', rating: 81 },
  ],
  'Ukraine': [
    { name: 'O. Zinchenko', position: 'LB', rating: 84 },
    { name: 'M. Mudryk', position: 'LW', rating: 83 },
    { name: 'A. Dovbyk', position: 'ST', rating: 84 },
  ],
  'Ghana': [
    { name: 'M. Kudus', position: 'CAM', rating: 84 },
    { name: 'T. Partey', position: 'CDM', rating: 84 },
    { name: 'I. Williams', position: 'RW', rating: 82 },
  ],
  'Scotland': [
    { name: 'A. Robertson', position: 'LB', rating: 85 },
    { name: 'S. McTominay', position: 'CM', rating: 83 },
    { name: 'J. McGinn', position: 'CM', rating: 82 },
  ],
  'Egypt': [
    { name: 'M. Salah', position: 'RW', rating: 89 },
    { name: 'O. Marmoush', position: 'LW', rating: 83 },
    { name: 'M. Elneny', position: 'CDM', rating: 79 },
  ],
  'Wales': [
    { name: 'B. Johnson', position: 'LW', rating: 82 },
    { name: 'E. Ampadu', position: 'CB', rating: 80 },
    { name: 'D. James', position: 'RW', rating: 79 },
  ],
  'Norway': [
    { name: 'E. Haaland', position: 'ST', rating: 93 },
    { name: 'M. Ødegaard', position: 'CAM', rating: 89 },
    { name: 'S. Berge', position: 'CDM', rating: 82 },
  ],
  'Chile': [
    { name: 'A. Sánchez', position: 'ST', rating: 82 },
    { name: 'C. Aránguiz', position: 'CM', rating: 80 },
    { name: 'G. Medel', position: 'CB', rating: 78 },
  ],
  'Hungary': [
    { name: 'D. Szoboszlai', position: 'CAM', rating: 84 },
    { name: 'W. Orbán', position: 'CB', rating: 81 },
    { name: 'P. Gulácsi', position: 'GK', rating: 82 },
  ],
  'Ecuador': [
    { name: 'M. Caicedo', position: 'CDM', rating: 85 },
    { name: 'G. Plata', position: 'RW', rating: 80 },
    { name: 'P. Hincapié', position: 'CB', rating: 81 },
  ],
  'USA': [
    { name: 'C. Pulisic', position: 'CAM', rating: 85 },
    { name: 'W. McKennie', position: 'CM', rating: 82 },
    { name: 'T. Adams', position: 'CDM', rating: 83 },
  ],
  'Ireland': [
    { name: 'M. Obafemi', position: 'ST', rating: 76 },
    { name: 'J. Molumby', position: 'CM', rating: 75 },
    { name: 'A. Omobamidele', position: 'CB', rating: 76 },
  ],
  'Ivory Coast': [
    { name: 'S. Haller', position: 'ST', rating: 82 },
    { name: 'F. Kessié', position: 'CM', rating: 81 },
    { name: 'N. Pépé', position: 'RW', rating: 80 },
  ],
  'Greece': [
    { name: 'V. Pavlidis', position: 'ST', rating: 80 },
    { name: 'K. Mavropanos', position: 'CB', rating: 79 },
    { name: 'A. Bakasetas', position: 'CAM', rating: 78 },
  ],
  'Algeria': [
    { name: 'R. Mahrez', position: 'RW', rating: 84 },
    { name: 'I. Bennacer', position: 'CM', rating: 82 },
    { name: 'A. Atal', position: 'RB', rating: 80 },
  ],
  'Paraguay': [
    { name: 'M. Almirón', position: 'CAM', rating: 80 },
    { name: 'G. Gómez', position: 'CB', rating: 79 },
    { name: 'J. Enciso', position: 'RW', rating: 78 },
  ],
  'Jamaica': [
    { name: 'L. Bailey', position: 'LW', rating: 82 },
    { name: 'M. Antonio', position: 'ST', rating: 79 },
    { name: 'E. Palmer', position: 'CB', rating: 76 },
  ],
  'Saudi Arabia': [
    { name: 'S. Al-Dawsari', position: 'LW', rating: 80 },
    { name: 'F. Al-Muwallad', position: 'ST', rating: 77 },
    { name: 'A. Al-Boleahi', position: 'CDM', rating: 76 },
  ],
  'Peru': [
    { name: 'P. Guerrero', position: 'ST', rating: 78 },
    { name: 'R. Tapia', position: 'CDM', rating: 77 },
    { name: 'A. Carrillo', position: 'RW', rating: 76 },
  ],
  'Mali': [
    { name: 'A. Traoré', position: 'CM', rating: 80 },
    { name: 'M. Djenepo', position: 'LW', rating: 78 },
    { name: 'Y. Koné', position: 'CB', rating: 77 },
  ],
  'Canada': [
    { name: 'A. Davies', position: 'LB', rating: 85 },
    { name: 'J. David', position: 'ST', rating: 84 },
    { name: 'T. Buchanan', position: 'RW', rating: 80 },
  ],
  'Costa Rica': [
    { name: 'K. Navas', position: 'GK', rating: 82 },
    { name: 'J. Campbell', position: 'ST', rating: 78 },
    { name: 'B. Calvo', position: 'CB', rating: 76 },
  ],
  'Gabon': [
    { name: 'P. Aubameyang', position: 'ST', rating: 82 },
    { name: 'D. Bouanga', position: 'LW', rating: 78 },
    { name: 'B. Ecuele Manga', position: 'CB', rating: 75 },
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
