import { describe, it, expect } from 'vitest';
import { CLUB_TEMPLATES } from '@/data/playerTemplates';
import { ALL_CLUBS } from '@/data/league';
import type { Position } from '@/types/game';

const VALID_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

const VALID_NATIONALITIES = [
  'England', 'Spain', 'France', 'Germany', 'Italy', 'Brazil', 'Argentina', 'Portugal',
  'Netherlands', 'Belgium', 'Colombia', 'Uruguay', 'Croatia', 'Denmark', 'Norway',
  'Sweden', 'Switzerland', 'Nigeria', 'Senegal', 'Morocco', 'Japan', 'South Korea',
  'Scotland', 'Wales', 'Ireland', 'Ghana', 'Ivory Coast', 'Cameroon', 'Poland',
  'Turkey', 'Serbia', 'Czech Republic', 'Austria', 'USA',
  'Egypt', 'Ukraine', 'Jamaica', 'Hungary', 'Ecuador', 'Mexico', 'Mali',
  'Paraguay', 'Algeria', 'Gabon', 'Israel', 'Albania', 'Romania', 'Slovakia',
  'Greece', 'Chile', 'Finland', 'Iceland', 'Slovenia', 'Bulgaria',
];

const allClubIds = new Set(ALL_CLUBS.map(c => c.id));

describe('playerTemplates', () => {
  it('all template club IDs exist in league data', () => {
    for (const clubId of Object.keys(CLUB_TEMPLATES)) {
      expect(allClubIds.has(clubId), `Unknown club ID: ${clubId}`).toBe(true);
    }
  });

  it('every template has valid fields', () => {
    for (const [clubId, templates] of Object.entries(CLUB_TEMPLATES)) {
      for (const t of templates) {
        expect(t.fn.length, `${clubId}: empty firstName`).toBeGreaterThan(0);
        expect(t.ln.length, `${clubId}: empty lastName`).toBeGreaterThan(0);
        expect(VALID_POSITIONS, `${clubId} ${t.fn} ${t.ln}: invalid pos ${t.pos}`).toContain(t.pos);
        expect(VALID_NATIONALITIES, `${clubId} ${t.fn} ${t.ln}: invalid nat ${t.nat}`).toContain(t.nat);
        expect(t.age, `${clubId} ${t.fn} ${t.ln}: age too low`).toBeGreaterThanOrEqual(16);
        expect(t.age, `${clubId} ${t.fn} ${t.ln}: age too high`).toBeLessThanOrEqual(42);
        expect(t.ovr, `${clubId} ${t.fn} ${t.ln}: ovr too low`).toBeGreaterThanOrEqual(50);
        expect(t.ovr, `${clubId} ${t.fn} ${t.ln}: ovr too high`).toBeLessThanOrEqual(99);
        if (t.pot !== undefined) {
          expect(t.pot, `${clubId} ${t.fn} ${t.ln}: pot < ovr`).toBeGreaterThanOrEqual(t.ovr);
        }
      }
    }
  });

  it('no duplicate names within same club', () => {
    for (const [clubId, templates] of Object.entries(CLUB_TEMPLATES)) {
      const names = templates.map(t => `${t.fn} ${t.ln}`);
      const unique = new Set(names);
      expect(unique.size, `${clubId} has duplicate names: ${names.filter((n, i) => names.indexOf(n) !== i)}`).toBe(names.length);
    }
  });

  it('each club has at least 2 GK', () => {
    for (const [clubId, templates] of Object.entries(CLUB_TEMPLATES)) {
      const gks = templates.filter(t => t.pos === 'GK');
      expect(gks.length, `${clubId} needs at least 2 GK`).toBeGreaterThanOrEqual(2);
    }
  });

  it('each club has 18-22 templates', () => {
    for (const [clubId, templates] of Object.entries(CLUB_TEMPLATES)) {
      expect(templates.length, `${clubId} has ${templates.length} templates`).toBeGreaterThanOrEqual(18);
      expect(templates.length, `${clubId} has ${templates.length} templates`).toBeLessThanOrEqual(22);
    }
  });
});
