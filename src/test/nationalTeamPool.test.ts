import { describe, it, expect } from 'vitest';
import {
  generateNationalTeamPool,
  autoSelectNationalSquad,
  resolveNationalityAliases,
} from '@/utils/international';
import { NATIONAL_PLAYER_POOL } from '@/data/nationalPlayerPool';
import type { Player } from '@/types/game';

describe('National Team Real-Player Pool', () => {
  it('resolves Ivory Coast to Côte d\'Ivoire', () => {
    const aliases = resolveNationalityAliases('Ivory Coast');
    expect(aliases).toContain('Ivory Coast');
    expect(aliases).toContain("Côte d'Ivoire");
  });

  it('resolves Netherlands to Holland', () => {
    expect(resolveNationalityAliases('Netherlands')).toContain('Holland');
  });

  it('resolves USA to United States, South Korea to Korea Republic, Ireland to Republic of Ireland', () => {
    expect(resolveNationalityAliases('USA')).toContain('United States');
    expect(resolveNationalityAliases('South Korea')).toContain('Korea Republic');
    expect(resolveNationalityAliases('Ireland')).toContain('Republic of Ireland');
  });

  it('generates a pool containing real FC25 players for France', () => {
    const pool = generateNationalTeamPool('France', {}, 1);
    const names = Object.values(pool).map(p => `${p.firstName} ${p.lastName}`);
    // Mbappé, Griezmann are the top France players in the FC25 pool
    expect(names.some(n => n.includes('Mbappé'))).toBe(true);
    expect(names.some(n => n.includes('Griezmann'))).toBe(true);
    // All players should be tagged with the canonical game nationality
    Object.values(pool).forEach(p => expect(p.nationality).toBe('France'));
  });

  it('generates real players for Ivory Coast (alias to Côte d\'Ivoire)', () => {
    const pool = generateNationalTeamPool('Ivory Coast', {}, 1);
    expect(Object.keys(pool).length).toBeGreaterThan(0);
    // All new players should be normalized to the canonical name
    Object.values(pool).forEach(p => expect(p.nationality).toBe('Ivory Coast'));
    // Should contain real Ivorian stars — e.g. Kessié is at the top of the FC25 pool
    const names = Object.values(pool).map(p => p.lastName);
    const realPool = NATIONAL_PLAYER_POOL["Côte d'Ivoire"] ?? [];
    expect(realPool.length).toBeGreaterThan(0);
    expect(names).toContain(realPool[0].ln);
  });

  it('skips pool entries that duplicate existing in-game players', () => {
    // Seed with a fake Mbappé already in a club
    const existing: Record<string, Player> = {
      mbappe: {
        id: 'mbappe',
        firstName: 'Kylian',
        lastName: 'Mbappé',
        nationality: 'France',
        age: 25,
        position: 'ST',
        overall: 91,
        potential: 93,
        attributes: { pace: 97, shooting: 90, passing: 80, defending: 36, physical: 78, mental: 88 },
        clubId: 'some-club',
        wage: 500_000,
        value: 180_000_000,
        contractEnd: 3,
        fitness: 100,
        morale: 80,
        form: 70,
        injured: false,
        injuryWeeks: 0,
        goals: 0, assists: 0, appearances: 0,
        careerGoals: 0, careerAssists: 0, careerAppearances: 0,
        yellowCards: 0, redCards: 0,
        personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 },
        appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 },
        skillMoves: 5,
        joinedSeason: 1,
      },
    };
    const pool = generateNationalTeamPool('France', existing, 1);
    const mbappeInPool = Object.values(pool).filter(p => p.lastName === 'Mbappé');
    expect(mbappeInPool.length).toBe(0); // dedup worked
  });

  it('falls back to procedural generation when a nation has no FC25 pool entry', () => {
    // Pick an obviously-missing nation name
    const pool = generateNationalTeamPool('Atlantis', {}, 1);
    // Still produces a full candidate roster (procedural)
    expect(Object.keys(pool).length).toBeGreaterThan(20);
    Object.values(pool).forEach(p => expect(p.nationality).toBe('Atlantis'));
  });

  it('autoSelectNationalSquad picks players matching any alias nationality', () => {
    // Two players labeled with different alias forms
    const players: Record<string, Player> = {
      p1: { id: 'p1', firstName: 'A', lastName: 'One', nationality: 'Netherlands', age: 25, position: 'GK', overall: 82, potential: 82, attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 }, clubId: '', wage: 0, value: 0, contractEnd: 2, fitness: 100, morale: 80, form: 70, injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0, personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 }, appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 }, skillMoves: 2, joinedSeason: 1 },
      p2: { id: 'p2', firstName: 'B', lastName: 'Two', nationality: 'Holland', age: 25, position: 'CB', overall: 80, potential: 80, attributes: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, mental: 50 }, clubId: '', wage: 0, value: 0, contractEnd: 2, fitness: 100, morale: 80, form: 70, injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0, personality: { professionalism: 10, ambition: 10, temperament: 10, loyalty: 10, leadership: 10 }, appearance: { skinTone: 2, hairStyle: 2, hairColor: 2, height: 1, build: 1, facialHair: 0 }, skillMoves: 2, joinedSeason: 1 },
    };
    const squad = autoSelectNationalSquad('Netherlands', players);
    expect(squad).toContain('p1');
    expect(squad).toContain('p2'); // "Holland" matches via alias
  });
});
