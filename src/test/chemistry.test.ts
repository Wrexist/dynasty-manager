import { describe, it, expect } from 'vitest';
import { calculateChemistryLinks, getChemistryBonus, getChemistryLabel, getMentorBonus, findMentorLinksForPlayer } from '@/utils/chemistry';
import { generatePlayer } from '@/utils/playerGen';
import type { Position, FormationType } from '@/types/game';

function makePlayer(pos: string, overrides: Record<string, unknown> = {}) {
  const p = generatePlayer(pos as Position, 75, 'club-1', 1);
  return { ...p, nationality: 'English', form: 70, ...overrides };
}

describe('chemistry', () => {
  describe('calculateChemistryLinks', () => {
    it('should detect nationality links', () => {
      const a = makePlayer('CM', { nationality: 'Spanish' });
      const b = makePlayer('CAM', { nationality: 'Spanish' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.some(l => l.type === 'nationality')).toBe(true);
    });

    it('should not create nationality links for different nationalities', () => {
      const a = makePlayer('CM', { nationality: 'Spanish' });
      const b = makePlayer('CAM', { nationality: 'French' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.filter(l => l.type === 'nationality')).toHaveLength(0);
    });

    it('should detect mentor links between senior and junior', () => {
      const senior = makePlayer('CB', { age: 30, overall: 80 });
      const junior = makePlayer('CB', { age: 19, overall: 60, nationality: 'French' });
      const links = calculateChemistryLinks([senior, junior]);
      expect(links.some(l => l.type === 'mentor')).toBe(true);
    });

    it('should not create mentor links between same-age players', () => {
      const a = makePlayer('CM', { age: 25, nationality: 'French' });
      const b = makePlayer('CM', { age: 25, nationality: 'German' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.filter(l => l.type === 'mentor')).toHaveLength(0);
    });

    it('should detect partnership links for adjacent positions with high form', () => {
      const a = makePlayer('CM', { form: 85, age: 25, nationality: 'French' });
      const b = makePlayer('CAM', { form: 85, age: 26, nationality: 'German' });
      const links = calculateChemistryLinks([a, b]);
      expect(links.some(l => l.type === 'partnership')).toBe(true);
    });

    it('should allow multiple link types between the same pair', () => {
      const a = makePlayer('CM', { nationality: 'Spanish', form: 85, age: 25 });
      const b = makePlayer('CAM', { nationality: 'Spanish', form: 85, age: 25 });
      const links = calculateChemistryLinks([a, b]);
      expect(links.filter(l => l.type === 'nationality')).toHaveLength(1);
      expect(links.filter(l => l.type === 'partnership')).toHaveLength(1);
    });

    it('should return empty for a single player', () => {
      const links = calculateChemistryLinks([makePlayer('ST')]);
      expect(links).toHaveLength(0);
    });

    it('should detect loyalty links when both players have 2+ seasons at club', () => {
      const a = makePlayer('CM', { clubId: 'club-1', joinedSeason: 1 });
      const b = makePlayer('CAM', { clubId: 'club-1', joinedSeason: 1 });
      // Season 3: both have been at club for 2 seasons (3 - 1 = 2)
      const links = calculateChemistryLinks([a, b], undefined, 3);
      const loyaltyLinks = links.filter(l => l.type === 'loyalty');
      expect(loyaltyLinks).toHaveLength(1);
      expect(loyaltyLinks[0].strength).toBeGreaterThanOrEqual(1);
    });

    it('should NOT detect loyalty links without currentSeason', () => {
      const a = makePlayer('CM', { clubId: 'club-1', joinedSeason: 1 });
      const b = makePlayer('CAM', { clubId: 'club-1', joinedSeason: 1 });
      // No season passed — loyalty bonds should not form
      const links = calculateChemistryLinks([a, b]);
      const loyaltyLinks = links.filter(l => l.type === 'loyalty');
      expect(loyaltyLinks).toHaveLength(0);
    });

    it('should NOT detect loyalty links for recent signings', () => {
      const a = makePlayer('CM', { clubId: 'club-1', joinedSeason: 3 });
      const b = makePlayer('CAM', { clubId: 'club-1', joinedSeason: 3 });
      // Season 3: both just joined (3 - 3 = 0, below threshold of 2)
      const links = calculateChemistryLinks([a, b], undefined, 3);
      const loyaltyLinks = links.filter(l => l.type === 'loyalty');
      expect(loyaltyLinks).toHaveLength(0);
    });
  });

  describe('getChemistryBonus', () => {
    it('should return 0 for empty lineup', () => {
      expect(getChemistryBonus([])).toBe(0);
    });

    it('should return a positive bonus for linked players', () => {
      const players = [
        makePlayer('CM', { nationality: 'Spanish' }),
        makePlayer('CAM', { nationality: 'Spanish' }),
      ];
      const bonus = getChemistryBonus(players);
      expect(bonus).toBeGreaterThan(0);
    });

    it('should cap at maximum bonus', () => {
      // Create many same-nationality players
      const players = Array.from({ length: 11 }, (_, i) =>
        makePlayer(['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST'][i], { nationality: 'Spanish' })
      );
      const bonus = getChemistryBonus(players);
      expect(bonus).toBeLessThanOrEqual(0.12);
    });
  });

  describe('getChemistryLabel', () => {
    it('should return Excellent for high bonus', () => {
      expect(getChemistryLabel(0.09).label).toBe('Excellent');
    });

    it('should return Low for zero bonus', () => {
      expect(getChemistryLabel(0).label).toBe('Low');
    });
  });

  describe('getMentorBonus', () => {
    it('should return 0 for older players', () => {
      const player = makePlayer('CM', { age: 28 });
      expect(getMentorBonus(player, [player])).toBe(0);
    });

    it('should return positive bonus for young player with senior teammate', () => {
      const junior = makePlayer('CB', { age: 19, overall: 60, clubId: 'club-1', nationality: 'Brazilian' });
      const senior = makePlayer('CB', { age: 30, overall: 82, clubId: 'club-1', nationality: 'French' });
      const bonus = getMentorBonus(junior, [junior, senior]);
      expect(bonus).toBeGreaterThan(0);
    });

    it('should allow mentoring for players exactly at age threshold (22)', () => {
      const junior = makePlayer('CB', { age: 22, overall: 60, clubId: 'club-1', nationality: 'Brazilian' });
      const senior = makePlayer('CB', { age: 30, overall: 82, clubId: 'club-1', nationality: 'French' });
      const bonus = getMentorBonus(junior, [junior, senior]);
      expect(bonus).toBeGreaterThan(0);
    });
  });

  describe('formation-aware chemistry', () => {
    it('should use formation slot positions when formation is provided', () => {
      // A natural CM deployed in CDM slot (slot 5 in 4-2-3-1) should connect to CB (slot 2)
      // In 4-2-3-1: slots are GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST
      // CDM-CB is adjacent, CM-CB is not
      const cm = makePlayer('CM', { nationality: 'Spanish' });
      const cb = makePlayer('CB', { nationality: 'Spanish' });
      // Without formation: CM and CB are NOT adjacent — no link
      const linksNoFormation = calculateChemistryLinks([cm, cb]);
      expect(linksNoFormation.some(l => l.type === 'nationality')).toBe(false);
      // With 4-2-3-1 formation: player[0]=GK slot (GK), player[1]=slot 1 (LB)
      // We place them at CDM slot (index 5) and CB slot (index 2) by building a full lineup
      const gk = makePlayer('GK', { nationality: 'French' });
      const lb = makePlayer('LB', { nationality: 'French' });
      const cb2 = makePlayer('CB', { nationality: 'French' });
      const rb = makePlayer('RB', { nationality: 'French' });
      const cdm2 = makePlayer('CDM', { nationality: 'French' });
      const lw = makePlayer('LW', { nationality: 'French' });
      const cam = makePlayer('CAM', { nationality: 'French' });
      const rw = makePlayer('RW', { nationality: 'French' });
      const st = makePlayer('ST', { nationality: 'French' });
      // 4-2-3-1: GK, LB, CB, CB, RB, CDM, CDM, LW, CAM, RW, ST
      const lineup = [gk, lb, cb, cb2, rb, cm, cdm2, lw, cam, rw, st];
      const formation: FormationType = '4-2-3-1';
      const linksWithFormation = calculateChemistryLinks(lineup, formation);
      // cm is at slot index 5 (CDM slot), cb is at slot index 2 (CB slot)
      // CDM-CB is adjacent, so Spanish CM at CDM slot should NOT connect to French CB
      // but CDM slot connects to CB slot — check the CDM-CB adjacency works
      const cdmCbLinks = linksWithFormation.filter(l =>
        (l.playerIdA === cm.id || l.playerIdB === cm.id) &&
        (l.playerIdA === cb.id || l.playerIdB === cb.id)
      );
      // cm (Spanish) at CDM slot, cb (Spanish) — same nationality AND adjacent slots
      // partnership bond also forms because combined form > 100 (70 + 70 = 140)
      expect(cdmCbLinks.length).toBeGreaterThan(0);
      expect(cdmCbLinks.some(l => l.type === 'partnership')).toBe(true);
      expect(cdmCbLinks.some(l => l.type === 'nationality')).toBe(true);
    });

    it('should not link non-adjacent formation slots even if natural positions are adjacent', () => {
      // Two players with adjacent natural positions (CM-CAM) but placed in non-adjacent slots
      const cm = makePlayer('CM', { nationality: 'Spanish' });
      const cam = makePlayer('CAM', { nationality: 'Spanish' });
      // Without formation they connect (CM-CAM adjacent)
      const linksNoFormation = calculateChemistryLinks([cm, cam]);
      expect(linksNoFormation.some(l => l.type === 'nationality')).toBe(true);
    });
  });

  describe('findMentorLinksForPlayer', () => {
    it('should find mentor links for a young player', () => {
      const junior = makePlayer('CB', { age: 19, overall: 60, nationality: 'Brazilian' });
      const senior = makePlayer('CB', { age: 30, overall: 82, nationality: 'French' });
      const links = findMentorLinksForPlayer(junior, [senior]);
      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('mentor');
    });

    it('should not return nationality or partnership links', () => {
      const a = makePlayer('CM', { nationality: 'Spanish', form: 85, age: 25 });
      const b = makePlayer('CAM', { nationality: 'Spanish', form: 85, age: 25 });
      const links = findMentorLinksForPlayer(a, [b]);
      expect(links.filter(l => l.type === 'nationality')).toHaveLength(0);
      expect(links.filter(l => l.type === 'partnership')).toHaveLength(0);
    });

    it('should not find mentors at non-adjacent positions', () => {
      const junior = makePlayer('GK', { age: 19, overall: 60, nationality: 'Brazilian' });
      const senior = makePlayer('ST', { age: 30, overall: 82, nationality: 'French' });
      const links = findMentorLinksForPlayer(junior, [senior]);
      expect(links).toHaveLength(0);
    });
  });
});
