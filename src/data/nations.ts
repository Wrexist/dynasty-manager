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
  { name: 'France', confederation: 'UEFA', baseRanking: 2, color: '#002395', secondaryColor: '#FFFFFF' },
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
  { name: 'Brazil', confederation: 'CONMEBOL', baseRanking: 1, color: '#009C3B', secondaryColor: '#FFDF00' },
  { name: 'Argentina', confederation: 'CONMEBOL', baseRanking: 1, color: '#75AADB', secondaryColor: '#FFFFFF' },
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

/** Get a nation by name */
export function getNation(name: string): NationData | undefined {
  return NATIONS.find(n => n.name === name);
}

/** Get all nation names */
export function getAllNationNames(): string[] {
  return NATIONS.map(n => n.name);
}
