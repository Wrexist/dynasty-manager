import { describe, it, expect, afterEach } from 'vitest';
import { generateYouthProspects, generateIntakePreview, youthPositionWeights, pickYouthPosition } from '@/utils/youth';
import { SEASON_YOUTH_INTAKE_MIN, SEASON_YOUTH_INTAKE_RANGE } from '@/config/gameBalance';
import { YOUTH_POSITION_BASE_WEIGHT, YOUTH_POSITION_NEED_WEIGHT, YOUTH_POSITION_TARGET_DEPTH } from '@/config/youth';
import { useGameStore } from '@/store/gameStore';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import type { Position } from '@/types/game';

/** mulberry32 — reproducible Math.random for distribution checks. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

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

  // ── content: the preview is the intake ──
  describe('preview drives the intake', () => {
    it('previews the same number of prospects the season intake rolls', () => {
      for (let i = 0; i < 50; i++) {
        const n = generateIntakePreview(5).length;
        expect(n).toBeGreaterThanOrEqual(SEASON_YOUTH_INTAKE_MIN);
        expect(n).toBeLessThan(SEASON_YOUTH_INTAKE_MIN + SEASON_YOUTH_INTAKE_RANGE);
      }
    });

    it('turns every previewed entry into exactly that prospect', () => {
      for (let run = 0; run < 40; run++) {
        const yr = 1 + (run % 10);
        const preview = generateIntakePreview(yr, { youthCoachQuality: run % 11, clubSquadQuality: 55 + run });
        const { prospects, players } = generateYouthProspects('club-1', yr, run % 11, 2, 99, 55 + run, { preview });
        expect(prospects).toHaveLength(preview.length);
        players.forEach((p, i) => {
          expect(p.position).toBe(preview[i].position);
          expect(p.potential).toBe(preview[i].estimatedPotential);
          expect(p.potential).toBeGreaterThanOrEqual(p.overall);
          expect(p.isFromYouthAcademy).toBe(true);
        });
      }
    });

    it('honours hand-made and legacy previews, including extreme potentials', () => {
      const preview = [
        { position: 'GK' as Position, estimatedPotential: 45 },
        { position: 'ST' as Position, estimatedPotential: 94 },
      ];
      for (let run = 0; run < 20; run++) {
        const { players } = generateYouthProspects('club-1', 8, 9, 2, 5, 80, { preview });
        expect(players.map(p => p.position)).toEqual(['GK', 'ST']);
        expect(players.map(p => p.potential)).toEqual([45, 94]);
      }
    });

    it('falls back to a normal roll when there is no preview', () => {
      const { players } = generateYouthProspects('club-1', 5, 5, 1, 4, undefined, { preview: [] });
      expect(players).toHaveLength(4);
    });
  });

  // ── content: need-weighted positions ──
  describe('youth positions follow squad needs', () => {
    const squadWithout = (missing: Position): { position: Position }[] =>
      (Object.keys(YOUTH_POSITION_TARGET_DEPTH) as Position[])
        .filter(pos => pos !== missing)
        .flatMap(pos => Array.from({ length: YOUTH_POSITION_TARGET_DEPTH[pos] }, () => ({ position: pos })));

    it('weights a missing position above a covered one; uniform without context', () => {
      const w = youthPositionWeights(squadWithout('GK'));
      expect(w.GK).toBe(YOUTH_POSITION_BASE_WEIGHT + YOUTH_POSITION_TARGET_DEPTH.GK * YOUTH_POSITION_NEED_WEIGHT);
      expect(w.ST).toBe(YOUTH_POSITION_BASE_WEIGHT);
      expect(new Set(Object.values(youthPositionWeights())).size).toBe(1);
    });

    it('draws the needed position far more often than chance', () => {
      Math.random = seeded(7);
      const squad = squadWithout('GK');
      let gk = 0;
      const N = 3000;
      for (let i = 0; i < N; i++) if (pickYouthPosition(squad) === 'GK') gk++;
      // Uniform would be 1/12 (~8%); weighted is 7/(7+11) (~39%).
      expect(gk / N).toBeGreaterThan(0.3);
    });

    it('spreads one intake across gaps instead of piling onto one', () => {
      Math.random = seeded(11);
      const squad = squadWithout('GK');
      const preview = generateIntakePreview(5, { squad, count: 4 });
      expect(preview.filter(p => p.position === 'GK').length).toBeLessThan(4);
    });
  });

  // ── content: season rollover honours the preview ──
  describe('season-end intake', () => {
    it('the prospects who arrive are the ones the preview showed', { timeout: 120_000 }, async () => {
      __resetAutosaveSchedulerForTests();
      __resetSaveStorageForTests();
      localStorage.clear();
      await useGameStore.getState().initGame('manchester-city');
      const shown = [
        { position: 'GK' as Position, estimatedPotential: 83 },
        { position: 'LB' as Position, estimatedPotential: 71 },
        { position: 'ST' as Position, estimatedPotential: 90 },
      ];
      const st = useGameStore.getState();
      useGameStore.setState({ youthAcademy: { ...st.youthAcademy, nextIntakePreview: shown } });
      useGameStore.getState().endSeason();
      const after = useGameStore.getState();
      const arrived = after.youthAcademy.prospects.map(pr => after.players[pr.playerId]);
      expect(arrived.map(p => p.position)).toEqual(shown.map(s => s.position));
      expect(arrived.map(p => p.potential)).toEqual(shown.map(s => s.estimatedPotential));
      const next = after.youthAcademy.nextIntakePreview;
      expect(next.length).toBeGreaterThanOrEqual(SEASON_YOUTH_INTAKE_MIN);
      expect(next.length).toBeLessThan(SEASON_YOUTH_INTAKE_MIN + SEASON_YOUTH_INTAKE_RANGE);
    });
  });
});
