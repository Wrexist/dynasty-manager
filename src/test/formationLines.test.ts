import { describe, it, expect } from 'vitest';
import { FORMATION_POSITIONS } from '@/types/game';
import { getFormationStructureLines } from '@/utils/formationLines';

describe('getFormationStructureLines', () => {
  it('connects adjacent positions across the pitch for every formation', () => {
    for (const formation of Object.keys(FORMATION_POSITIONS) as Array<keyof typeof FORMATION_POSITIONS>) {
      const slots = FORMATION_POSITIONS[formation];
      const lines = getFormationStructureLines(slots);
      // Every formation should produce at least one structural connection.
      expect(lines.length).toBeGreaterThan(0);
      // Indices must be valid and ordered (i < j), with no self-links.
      for (const [a, b] of lines) {
        expect(a).toBeLessThan(b);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(slots.length);
      }
    }
  });

  it('links the goalkeeper to the centre-backs in a 4-3-3', () => {
    const slots = FORMATION_POSITIONS['4-3-3'];
    const gkIdx = slots.findIndex(s => s.pos === 'GK');
    const cbIdxs = slots.map((s, i) => (s.pos === 'CB' ? i : -1)).filter(i => i >= 0);
    const lines = getFormationStructureLines(slots);
    for (const cb of cbIdxs) {
      const pair: [number, number] = gkIdx < cb ? [gkIdx, cb] : [cb, gkIdx];
      expect(lines).toContainEqual(pair);
    }
  });

  it('connects midfield to attack (CM ↔ ST/winger chain exists)', () => {
    const slots = FORMATION_POSITIONS['4-3-3'];
    const lines = getFormationStructureLines(slots);
    // There should be at least one link bridging a midfield slot to an
    // attacking slot, i.e. lines genuinely cross from midfield to attack.
    const ATT = new Set(['ST', 'LW', 'RW']);
    const MID = new Set(['CM', 'CAM', 'CDM', 'LM', 'RM']);
    const hasMidToAttack = lines.some(([a, b]) => {
      const pa = slots[a].pos, pb = slots[b].pos;
      return (MID.has(pa) && ATT.has(pb)) || (MID.has(pb) && ATT.has(pa));
    });
    expect(hasMidToAttack).toBe(true);
  });
});
