import { describe, it, expect } from 'vitest';
import {
  generateYouthProspects, generateIntakePreview,
  computeAcademyProgress, getPotentialStars, getScoutVerdict,
} from '@/utils/youth';
import { ACADEMY_LEVEL_MAX, ACADEMY_PROGRESS_PER_LEVEL } from '@/config/youth';

describe('Youth Academy', () => {
  describe('generateYouthProspects', () => {
    it('should generate the correct number of prospects', () => {
      const { prospects, players } = generateYouthProspects('club-1', 5, 5, 1, 3);
      expect(prospects).toHaveLength(3);
      expect(players).toHaveLength(3);
    });

    it('should generate young players (16-18)', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 5);
      for (const p of players) {
        expect(p.age).toBeGreaterThanOrEqual(16);
        expect(p.age).toBeLessThanOrEqual(18);
      }
    });

    it('should mark all players as youth academy products', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 5);
      for (const p of players) {
        expect(p.isFromYouthAcademy).toBe(true);
      }
    });

    it('should generate higher quality with better youth rating and coach', () => {
      const lowQuality = generateYouthProspects('club-1', 1, 0, 1, 20);
      const highQuality = generateYouthProspects('club-1', 10, 10, 1, 20);

      const avgLow = lowQuality.players.reduce((s, p) => s + p.overall, 0) / lowQuality.players.length;
      const avgHigh = highQuality.players.reduce((s, p) => s + p.overall, 0) / highQuality.players.length;

      expect(avgHigh).toBeGreaterThan(avgLow);
    });

    it('should ensure potential >= overall for youth players', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 10);
      for (const p of players) {
        expect(p.potential).toBeGreaterThanOrEqual(p.overall);
      }
    });

    it('should assign valid positions', () => {
      const validPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 10);
      for (const p of players) {
        expect(validPositions).toContain(p.position);
      }
    });
  });

  describe('academyLevel scaling', () => {
    it('should produce higher average quality and potential at higher academy levels', () => {
      const N = 60;
      const level1 = generateYouthProspects('club-1', 5, 5, 1, N, undefined, 1);
      const level5 = generateYouthProspects('club-1', 5, 5, 1, N, undefined, 5);

      const avg = (ps: { overall: number; potential: number }[], key: 'overall' | 'potential') =>
        ps.reduce((s, p) => s + p[key], 0) / ps.length;

      expect(avg(level5.players, 'overall')).toBeGreaterThan(avg(level1.players, 'overall'));
      expect(avg(level5.players, 'potential')).toBeGreaterThan(avg(level1.players, 'potential'));
    });

    it('should default to level 1 behaviour when academyLevel omitted', () => {
      const withDefault = generateYouthProspects('club-1', 5, 5, 1, 5);
      expect(withDefault.players).toHaveLength(5);
      // No throw, prospects still marked as academy products.
      for (const p of withDefault.players) expect(p.isFromYouthAcademy).toBe(true);
    });
  });

  describe('computeAcademyProgress', () => {
    const grad = (id: string, overall: number, apps = 0) => ({
      id, overall, careerAppearances: apps, isFromYouthAcademy: true,
    });

    it('credits a graduate who crosses the OVR bar and increments progress', () => {
      const r = computeAcademyProgress(1, 0, [], [grad('g1', 82, 0)]);
      expect(r.newlyCredited).toEqual(['g1']);
      expect(r.progress).toBe(1);
      expect(r.level).toBe(1);
    });

    it('credits a graduate who crosses the appearance bar', () => {
      const r = computeAcademyProgress(1, 0, [], [grad('g1', 60, 55)]);
      expect(r.newlyCredited).toEqual(['g1']);
    });

    it('does not credit non-academy players or unproven graduates', () => {
      const squad = [
        { id: 'x', overall: 90, careerAppearances: 99, isFromYouthAcademy: false },
        grad('g1', 60, 10),
      ];
      const r = computeAcademyProgress(1, 0, [], squad);
      expect(r.newlyCredited).toEqual([]);
      expect(r.progress).toBe(0);
    });

    it('is idempotent — an already-credited graduate is not counted twice', () => {
      const squad = [grad('g1', 82, 0)];
      const first = computeAcademyProgress(1, 0, [], squad);
      const second = computeAcademyProgress(first.level, first.progress, first.credited, squad);
      expect(second.newlyCredited).toEqual([]);
      expect(second.progress).toBe(first.progress);
    });

    it('levels up once enough graduates are proven', () => {
      const squad = Array.from({ length: ACADEMY_PROGRESS_PER_LEVEL }, (_, i) => grad(`g${i}`, 82, 0));
      const r = computeAcademyProgress(1, 0, [], squad);
      expect(r.level).toBe(2);
      expect(r.levelsGained).toBe(1);
      expect(r.progress).toBe(0);
    });

    it('caps at ACADEMY_LEVEL_MAX', () => {
      const many = Array.from({ length: ACADEMY_PROGRESS_PER_LEVEL * 20 }, (_, i) => grad(`g${i}`, 82, 0));
      const r = computeAcademyProgress(1, 0, [], many);
      expect(r.level).toBe(ACADEMY_LEVEL_MAX);
    });

    it('prunes credited ids no longer in the squad', () => {
      // 'gone' was credited previously but is not in this squad snapshot.
      const r = computeAcademyProgress(2, 1, ['gone'], [grad('here', 82, 0)]);
      expect(r.credited).toContain('here');
      expect(r.credited).not.toContain('gone');
    });
  });

  describe('reveal helpers', () => {
    it('getPotentialStars returns 1-5 monotonically by potential', () => {
      expect(getPotentialStars(95)).toBe(5);
      expect(getPotentialStars(50)).toBe(1);
      expect(getPotentialStars(95)).toBeGreaterThanOrEqual(getPotentialStars(60));
      for (const v of [40, 65, 73, 81, 90]) {
        const s = getPotentialStars(v);
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(5);
      }
    });

    it('getScoutVerdict is deterministic per seed and non-empty', () => {
      const a = getScoutVerdict(90, 'player-abc');
      const b = getScoutVerdict(90, 'player-abc');
      expect(a).toBe(b);
      expect(a.length).toBeGreaterThan(0);
    });
  });

  describe('generateIntakePreview', () => {
    it('should generate at least 1 preview', () => {
      const previews = generateIntakePreview(5);
      expect(previews.length).toBeGreaterThanOrEqual(1);
    });

    it('should have valid positions and potential values', () => {
      const validPositions = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
      const previews = generateIntakePreview(5);
      for (const p of previews) {
        expect(validPositions).toContain(p.position);
        expect(p.estimatedPotential).toBeGreaterThan(0);
      }
    });
  });
});
