/**
 * International nations data — 51 nations with FIFA-style rankings and confederations.
 * Used for national team selection and international tournament generation.
 */

import type { Player } from '@/types/game';
import { NATIONAL_PLAYER_POOL } from '@/data/nationalPlayerPool';

export interface NationData {
  name: string;
  confederation: 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF';
  baseRanking: number; // Real FIFA ranking (lower = better)
  color: string;
  secondaryColor: string;
}

export const NATIONS: NationData[] = [
  // UEFA (Europe) — 24 nations, sorted by baseRanking ascending
  { name: 'France', confederation: 'UEFA', baseRanking: 1, color: '#002395', secondaryColor: '#FFFFFF' },
  { name: 'Spain', confederation: 'UEFA', baseRanking: 2, color: '#AA151B', secondaryColor: '#F1BF00' },
  { name: 'England', confederation: 'UEFA', baseRanking: 4, color: '#FFFFFF', secondaryColor: '#CF081F' },
  { name: 'Portugal', confederation: 'UEFA', baseRanking: 5, color: '#006600', secondaryColor: '#FF0000' },
  { name: 'Netherlands', confederation: 'UEFA', baseRanking: 7, color: '#FF6600', secondaryColor: '#FFFFFF' },
  { name: 'Belgium', confederation: 'UEFA', baseRanking: 9, color: '#ED2939', secondaryColor: '#FAE042' },
  { name: 'Germany', confederation: 'UEFA', baseRanking: 10, color: '#000000', secondaryColor: '#FFFFFF' },
  { name: 'Croatia', confederation: 'UEFA', baseRanking: 11, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Italy', confederation: 'UEFA', baseRanking: 12, color: '#009246', secondaryColor: '#FFFFFF' },
  { name: 'Switzerland', confederation: 'UEFA', baseRanking: 19, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Denmark', confederation: 'UEFA', baseRanking: 20, color: '#C8102E', secondaryColor: '#FFFFFF' },
  { name: 'Turkey', confederation: 'UEFA', baseRanking: 22, color: '#E30A17', secondaryColor: '#FFFFFF' },
  { name: 'Austria', confederation: 'UEFA', baseRanking: 24, color: '#ED2939', secondaryColor: '#FFFFFF' },
  { name: 'Norway', confederation: 'UEFA', baseRanking: 31, color: '#BA0C2F', secondaryColor: '#00205B' },
  { name: 'Ukraine', confederation: 'UEFA', baseRanking: 32, color: '#005BBB', secondaryColor: '#FFD500' },
  { name: 'Poland', confederation: 'UEFA', baseRanking: 35, color: '#FFFFFF', secondaryColor: '#DC143C' },
  { name: 'Wales', confederation: 'UEFA', baseRanking: 37, color: '#C8102E', secondaryColor: '#00A651' },
  { name: 'Sweden', confederation: 'UEFA', baseRanking: 38, color: '#006AA7', secondaryColor: '#FECC02' },
  { name: 'Serbia', confederation: 'UEFA', baseRanking: 39, color: '#C6363C', secondaryColor: '#0C4076' },
  { name: 'Czech Republic', confederation: 'UEFA', baseRanking: 41, color: '#11457E', secondaryColor: '#D7141A' },
  { name: 'Hungary', confederation: 'UEFA', baseRanking: 42, color: '#436F4D', secondaryColor: '#CE2939' },
  { name: 'Scotland', confederation: 'UEFA', baseRanking: 43, color: '#003078', secondaryColor: '#FFFFFF' },
  { name: 'Greece', confederation: 'UEFA', baseRanking: 47, color: '#0D5EAF', secondaryColor: '#FFFFFF' },
  { name: 'Ireland', confederation: 'UEFA', baseRanking: 55, color: '#169B62', secondaryColor: '#FFFFFF' },

  // CONMEBOL (South America) — 8 nations, sorted by baseRanking ascending
  { name: 'Argentina', confederation: 'CONMEBOL', baseRanking: 3, color: '#75AADB', secondaryColor: '#FFFFFF' },
  { name: 'Brazil', confederation: 'CONMEBOL', baseRanking: 6, color: '#009C3B', secondaryColor: '#FFDF00' },
  { name: 'Colombia', confederation: 'CONMEBOL', baseRanking: 13, color: '#FCD116', secondaryColor: '#003893' },
  { name: 'Uruguay', confederation: 'CONMEBOL', baseRanking: 17, color: '#5CBFEB', secondaryColor: '#FFFFFF' },
  { name: 'Ecuador', confederation: 'CONMEBOL', baseRanking: 23, color: '#FFD100', secondaryColor: '#034EA2' },
  { name: 'Paraguay', confederation: 'CONMEBOL', baseRanking: 40, color: '#D52B1E', secondaryColor: '#0038A8' },
  { name: 'Chile', confederation: 'CONMEBOL', baseRanking: 49, color: '#D52B1E', secondaryColor: '#FFFFFF' },
  { name: 'Peru', confederation: 'CONMEBOL', baseRanking: 64, color: '#D91023', secondaryColor: '#FFFFFF' },

  // CAF (Africa) — 10 nations, sorted by baseRanking ascending
  { name: 'Morocco', confederation: 'CAF', baseRanking: 8, color: '#C1272D', secondaryColor: '#006233' },
  { name: 'Senegal', confederation: 'CAF', baseRanking: 14, color: '#00853F', secondaryColor: '#FDEF42' },
  { name: 'Nigeria', confederation: 'CAF', baseRanking: 26, color: '#008751', secondaryColor: '#FFFFFF' },
  { name: 'Algeria', confederation: 'CAF', baseRanking: 28, color: '#006233', secondaryColor: '#FFFFFF' },
  { name: 'Egypt', confederation: 'CAF', baseRanking: 29, color: '#CE1126', secondaryColor: '#FFFFFF' },
  { name: 'Ivory Coast', confederation: 'CAF', baseRanking: 34, color: '#FF8200', secondaryColor: '#009A44' },
  { name: 'Cameroon', confederation: 'CAF', baseRanking: 45, color: '#007A5E', secondaryColor: '#CE1126' },
  { name: 'Ghana', confederation: 'CAF', baseRanking: 53, color: '#006B3F', secondaryColor: '#FCD116' },
  { name: 'Mali', confederation: 'CAF', baseRanking: 62, color: '#14B53A', secondaryColor: '#FCD116' },
  { name: 'Gabon', confederation: 'CAF', baseRanking: 65, color: '#009E49', secondaryColor: '#3A75C4' },

  // AFC (Asia) — 4 nations, sorted by baseRanking ascending
  { name: 'Japan', confederation: 'AFC', baseRanking: 18, color: '#000080', secondaryColor: '#FFFFFF' },
  { name: 'South Korea', confederation: 'AFC', baseRanking: 25, color: '#CD2E3A', secondaryColor: '#003478' },
  { name: 'Australia', confederation: 'AFC', baseRanking: 27, color: '#FFCD00', secondaryColor: '#00843D' },
  { name: 'Saudi Arabia', confederation: 'AFC', baseRanking: 57, color: '#006C35', secondaryColor: '#FFFFFF' },

  // CONCACAF (North/Central America + Caribbean) — 5 nations, sorted by baseRanking ascending
  { name: 'Mexico', confederation: 'CONCACAF', baseRanking: 15, color: '#006847', secondaryColor: '#FFFFFF' },
  { name: 'USA', confederation: 'CONCACAF', baseRanking: 16, color: '#002868', secondaryColor: '#BF0A30' },
  { name: 'Canada', confederation: 'CONCACAF', baseRanking: 30, color: '#FF0000', secondaryColor: '#FFFFFF' },
  { name: 'Costa Rica', confederation: 'CONCACAF', baseRanking: 51, color: '#002B7F', secondaryColor: '#CE1126' },
  { name: 'Jamaica', confederation: 'CONCACAF', baseRanking: 60, color: '#009B3A', secondaryColor: '#FED100' },
];

/**
 * Build minimal Player objects for the top 3 stars of a nation, drawn from
 * NATIONAL_PLAYER_POOL (FC26-derived rosters). Used by the nation-selection
 * screen to render PlayerCard previews so names + stats stay consistent
 * with the rest of the game. Cached per-nation since the pool is static.
 */
const nationStarPlayerCache = new Map<string, Player[]>();

export function getNationStarPlayers(nationName: string): Player[] {
  const cached = nationStarPlayerCache.get(nationName);
  if (cached) return cached;
  const pool = NATIONAL_PLAYER_POOL[nationName];
  if (!pool || pool.length === 0) {
    nationStarPlayerCache.set(nationName, []);
    return [];
  }
  const players: Player[] = pool.slice(0, 3).map((t, i) => ({
    id: `nation-star-${nationName}-${i}`,
    firstName: t.fn,
    lastName: t.ln,
    age: t.age,
    nationality: nationName,
    position: t.pos,
    overall: t.ovr,
    potential: t.pot ?? t.ovr,
    attributes: {
      pace: t.pace ?? 70,
      shooting: t.shooting ?? 70,
      passing: t.passing ?? 70,
      defending: t.defending ?? 70,
      physical: t.physical ?? 70,
      mental: t.mental ?? 70,
    },
    clubId: '',
    wage: 0,
    value: 0,
    contractEnd: 0,
    fitness: 100,
    morale: 100,
    form: 100,
    injured: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    appearances: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerAppearances: 0,
    yellowCards: 0,
    redCards: 0,
    skillMoves: t.skillMoves ?? 3,
    alternatePositions: t.altPos,
    source: t.source,
    fcId: t.fcId,
    heightCm: t.heightCm,
    weightKg: t.weightKg,
  } as Player));
  nationStarPlayerCache.set(nationName, players);
  return players;
}

/** Get a nation by name */
export function getNation(name: string): NationData | undefined {
  return NATIONS.find(n => n.name === name);
}

/** Get all nation names */
export function getAllNationNames(): string[] {
  return NATIONS.map(n => n.name);
}

/** Display rank for a nation — falls back to a mid-table 50 if missing. */
export function getNationRanking(name: string): number {
  return getNation(name)?.baseRanking ?? 50;
}

/**
 * Continental tournament label keyed by confederation. Used for the cup name
 * (and countdown UI) when the player nation is in that confederation.
 */
export const CONTINENTAL_TOURNAMENT_NAMES: Record<NationData['confederation'], string> = {
  UEFA: 'European Championship',
  CONMEBOL: 'Copa America',
  CAF: 'Africa Cup of Nations',
  AFC: 'AFC Asian Cup',
  CONCACAF: 'CONCACAF Gold Cup',
};
