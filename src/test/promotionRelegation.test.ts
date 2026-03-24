import { describe, it, expect } from 'vitest';
import { determineZones, generatePlayoffBracket } from '@/utils/promotionRelegation';
import { DIVISIONS } from '@/data/league';
import type { LeagueTableEntry } from '@/types/game';

function makeTable(count: number): LeagueTableEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    clubId: `club-${i + 1}`,
    played: 46,
    won: 20 - i,
    drawn: 10,
    lost: 16 + i,
    goalsFor: 50 - i,
    goalsAgainst: 30 + i,
    goalDifference: 20 - 2 * i,
    points: 70 - i * 3,
    form: [],
    cleanSheets: 0,
  }));
}

describe('Promotion/Relegation', () => {
  describe('determineZones', () => {
    it('should determine zones for div-2 (2 auto-promote, 4 playoff, 3 auto-relegate)', () => {
      const div2 = DIVISIONS.find(d => d.id === 'div-2')!;
      const table = makeTable(24);
      const zones = determineZones(table, div2);

      expect(zones.autoPromoted).toHaveLength(2);
      expect(zones.autoPromoted).toEqual(['club-1', 'club-2']);
      expect(zones.playoffContenders).toHaveLength(4);
      expect(zones.playoffContenders).toEqual(['club-3', 'club-4', 'club-5', 'club-6']);
      expect(zones.autoRelegated).toHaveLength(3);
      expect(zones.autoRelegated).toEqual(['club-22', 'club-23', 'club-24']);
      expect(zones.replaced).toHaveLength(0);
    });

    it('should determine zones for div-4 (2 auto-promote, 4 playoff, 0 relegate, 2 replaced)', () => {
      const div4 = DIVISIONS.find(d => d.id === 'div-4')!;
      const table = makeTable(24);
      const zones = determineZones(table, div4);

      expect(zones.autoPromoted).toHaveLength(2);
      expect(zones.playoffContenders).toHaveLength(4);
      expect(zones.autoRelegated).toHaveLength(0);
      expect(zones.replaced).toHaveLength(2);
      expect(zones.replaced).toEqual(['club-23', 'club-24']);
    });

    it('should determine zones for div-1 (top flight, no promotion, 3 relegate)', () => {
      const div1 = DIVISIONS.find(d => d.id === 'div-1')!;
      const table = makeTable(20);
      const zones = determineZones(table, div1);

      expect(zones.autoPromoted).toHaveLength(0);
      expect(zones.playoffContenders).toHaveLength(0);
      expect(zones.autoRelegated).toHaveLength(3);
      expect(zones.autoRelegated).toEqual(['club-18', 'club-19', 'club-20']);
    });

    it('should place all clubs in exactly one zone', () => {
      const div3 = DIVISIONS.find(d => d.id === 'div-3')!;
      const table = makeTable(24);
      const zones = determineZones(table, div3);
      const allIds = [
        ...zones.autoPromoted,
        ...zones.playoffContenders,
        ...zones.midTable,
        ...zones.autoRelegated,
        ...zones.replaced,
      ];
      expect(allIds).toHaveLength(24);
      expect(new Set(allIds).size).toBe(24);
    });
  });

  describe('generatePlayoffBracket', () => {
    it('should generate a valid bracket with 4 contenders', () => {
      const contenders = ['club-3', 'club-4', 'club-5', 'club-6'];
      const bracket = generatePlayoffBracket(contenders, 'div-2');

      expect(bracket.divisionId).toBe('div-2');
      expect(bracket.bracket.length).toBeGreaterThanOrEqual(2);
      expect(bracket.currentRound).toBe('semi-leg1');
      expect(bracket.promotedClubId).toBeNull();
    });

    it('should auto-promote highest-ranked contender with fewer than 4 contenders', () => {
      const bracket = generatePlayoffBracket(['club-3', 'club-4'], 'div-2');
      expect(bracket.bracket).toHaveLength(0);
      expect(bracket.currentRound).toBeNull();
      expect(bracket.promotedClubId).toBe('club-3');
    });

    it('should auto-promote the only contender when just 1 exists', () => {
      const bracket = generatePlayoffBracket(['club-3'], 'div-3');
      expect(bracket.bracket).toHaveLength(0);
      expect(bracket.promotedClubId).toBe('club-3');
    });

    it('should return null promotedClubId with 0 contenders', () => {
      const bracket = generatePlayoffBracket([], 'div-2');
      expect(bracket.bracket).toHaveLength(0);
      expect(bracket.promotedClubId).toBeNull();
    });

    it('should create 5 ties (2 semi-leg1, 2 semi-leg2, 1 final) with 4 contenders', () => {
      const bracket = generatePlayoffBracket(['a', 'b', 'c', 'd'], 'div-2');
      expect(bracket.bracket).toHaveLength(5);
      expect(bracket.bracket.filter(t => t.round === 'semi-leg1')).toHaveLength(2);
      expect(bracket.bracket.filter(t => t.round === 'semi-leg2')).toHaveLength(2);
      expect(bracket.bracket.filter(t => t.round === 'final')).toHaveLength(1);
    });

    it('should seed 1st vs 4th and 2nd vs 3rd in semis', () => {
      const bracket = generatePlayoffBracket(['a', 'b', 'c', 'd'], 'div-2');
      const semis = bracket.bracket.filter(t => t.round === 'semi-leg1');
      expect(semis[0].homeClubId).toBe('a');
      expect(semis[0].awayClubId).toBe('d');
      expect(semis[1].homeClubId).toBe('b');
      expect(semis[1].awayClubId).toBe('c');
    });
  });
});
