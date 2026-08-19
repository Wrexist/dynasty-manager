/**
 * Crests, kits and faces — the derived-visuals layer.
 *
 * The property that matters is DETERMINISM. A club's badge is drawn on every
 * screen the mode has; if it changed shape between two renders, or between a
 * session and a reload, it would read as a bug in the save rather than as a
 * bug in a hash. These assertions pin that, plus the two rules that stop the
 * output being noise: colours that cannot be told apart never produce a
 * pattern, and a player with no persisted appearance still gets a face.
 */
import { describe, it, expect } from 'vitest';
import {
  sundayCrestSpec, sundayFaceSpec, sundayHash, sundayKitSpec,
} from '@/utils/sunday/visuals';
import {
  PLAYER_HAIR_COLORS, PLAYER_HAIR_STYLES, PLAYER_SKIN_TONES,
} from '@/config/playerAppearance';
import { useGameStore } from '@/store/gameStore';
import type { PlayerAppearance } from '@/types/game';

const RED = '#D92B2B';
const WHITE = '#FFFFFF';
const NEAR_RED = '#D82C2D';

describe('sundayHash', () => {
  it('is stable and spreads different ids apart', () => {
    expect(sundayHash('sun-club')).toBe(sundayHash('sun-club'));
    expect(sundayHash('sun-club')).not.toBe(sundayHash('sun-clubb'));
  });
});

describe('sundayCrestSpec', () => {
  it('gives the same club the same badge every time', () => {
    const a = sundayCrestSpec('sun-opp-sun-1-3', RED, WHITE);
    const b = sundayCrestSpec('sun-opp-sun-1-3', RED, WHITE);
    expect(a).toEqual(b);
  });

  it('does not give every club the same badge', () => {
    const shapes = new Set<string>();
    const dividers = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const spec = sundayCrestSpec(`sun-opp-sun-1-${i}`, RED, WHITE);
      shapes.add(spec.shape);
      dividers.add(spec.divider);
    }
    expect(shapes.size).toBeGreaterThan(1);
    expect(dividers.size).toBeGreaterThan(1);
  });

  it('drops the divider when the two colours cannot be told apart', () => {
    // A seam nobody can see is worse than no seam: it reads as a rendering
    // fault rather than as a design.
    for (let i = 0; i < 24; i++) {
      expect(sundayCrestSpec(`sun-opp-sun-1-${i}`, RED, NEAR_RED).divider).toBe('none');
    }
  });
});

describe('sundayKitSpec', () => {
  it('is stable, and shares its seed with the crest', () => {
    const kit = sundayKitSpec(RED, WHITE, 'sun-club');
    expect(kit).toEqual(sundayKitSpec(RED, WHITE, 'sun-club'));
    // One identity, not two — the badge and the shirt come off the same hash.
    expect(kit.seedHash).toBe(sundayCrestSpec('sun-club', RED, WHITE).seedHash);
  });

  it('carries the club colours through untouched', () => {
    const kit = sundayKitSpec(RED, WHITE, 'sun-club');
    expect(kit.body).toBe(RED);
    expect(kit.trim).toBe(WHITE);
  });

  it('falls back to a plain shirt when the pattern would be invisible', () => {
    for (let i = 0; i < 24; i++) {
      expect(sundayKitSpec(RED, NEAR_RED, `sun-opp-sun-1-${i}`).pattern).toBe('solid');
    }
  });

  it('varies the pattern across clubs when the colours allow it', () => {
    const patterns = new Set<string>();
    for (let i = 0; i < 24; i++) patterns.add(sundayKitSpec(RED, WHITE, `sun-opp-sun-1-${i}`).pattern);
    expect(patterns.size).toBeGreaterThan(1);
  });
});

describe('sundayFaceSpec', () => {
  const inRange = (a: PlayerAppearance) => {
    expect(a.skinTone).toBeGreaterThanOrEqual(0);
    expect(a.skinTone).toBeLessThan(PLAYER_SKIN_TONES.length);
    expect(a.hairStyle).toBeGreaterThanOrEqual(0);
    expect(a.hairStyle).toBeLessThan(PLAYER_HAIR_STYLES.length);
    expect(a.hairColor).toBeGreaterThanOrEqual(0);
    expect(a.hairColor).toBeLessThan(PLAYER_HAIR_COLORS.length);
    expect(a.height).toBeGreaterThanOrEqual(0);
    expect(a.height).toBeLessThan(3);
    expect(a.build).toBeGreaterThanOrEqual(0);
    expect(a.build).toBeLessThan(3);
    expect(a.facialHair!).toBeGreaterThanOrEqual(0);
    expect(a.facialHair!).toBeLessThan(5);
    expect(a.accessory!).toBeGreaterThanOrEqual(0);
    expect(a.accessory!).toBeLessThan(5);
    expect(a.bootColor!).toBeGreaterThanOrEqual(0);
    expect(a.bootColor!).toBeLessThan(4);
  };

  it('returns the persisted appearance when there is one', () => {
    const appearance: PlayerAppearance = {
      skinTone: 3, hairStyle: 7, hairColor: 1, height: 2, build: 0,
      facialHair: 4, accessory: 0, bootColor: 2,
    };
    expect(sundayFaceSpec({ id: 'p1', appearance })).toBe(appearance);
  });

  it('derives one from the id when there is not, and never crashes', () => {
    const a = sundayFaceSpec({ id: 'p1' });
    const b = sundayFaceSpec({ id: 'p1' });
    expect(a).toEqual(b);
    inRange(a);
    // An empty id is the pathological case a dangling reference produces.
    inRange(sundayFaceSpec({ id: '' }));
  });

  it('gives different men different faces', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add(JSON.stringify(sundayFaceSpec({ id: `sun-p-c-${i}` })));
    expect(seen.size).toBeGreaterThan(20);
  });

  it('keeps most of a derived squad free of accessories', () => {
    // Mirrors the generator's own 15% weighting. A fallback squad in thirty
    // headbands would look like a different game.
    let wearing = 0;
    for (let i = 0; i < 100; i++) if (sundayFaceSpec({ id: `sun-p-c-${i}` }).accessory) wearing++;
    expect(wearing).toBeLessThan(35);
  });
});

describe('a real Sunday squad', () => {
  it('every generated player already carries an appearance to draw', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: 7788 });
    const s = useGameStore.getState();
    for (const m of s.sunday!.squad) {
      const p = s.players[m.playerId];
      expect(p.appearance, m.playerId).toBeTruthy();
      // …and the spec hands it back rather than inventing a second face.
      expect(sundayFaceSpec(p)).toBe(p.appearance);
    }
  });
});
