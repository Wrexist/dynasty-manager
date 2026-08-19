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
  sundayCrestSpec, sundayFaceSpec, sundayHash, sundayKitSpec, sundayRatingTier,
} from '@/utils/sunday/visuals';
import {
  PLAYER_HAIR_COLORS, PLAYER_HAIR_STYLES, PLAYER_SKIN_TONES,
} from '@/config/playerAppearance';
import {
  SUNDAY_DIVISIONS, SUNDAY_OVERALL_CEILING, SUNDAY_OVERALL_FLOOR,
} from '@/config/sundayLeague';
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

/**
 * The rating scale, which is the one place this mode deliberately departs from
 * a house convention. The house thresholds (80 / 70 / 60) sit entirely above
 * this world's ceiling of 78, so the tiers are anchored on the pyramid's own
 * `oppQuality` ladder instead. These cases pin that anchoring — not the
 * numbers, which are allowed to move with the ladder.
 */
describe('sundayRatingTier', () => {
  it('never leaves a rating in the band uncoloured', () => {
    for (let ovr = SUNDAY_OVERALL_FLOOR; ovr <= SUNDAY_OVERALL_CEILING; ovr++) {
      expect(sundayRatingTier(ovr), String(ovr)).toMatch(/standout|good|steady|limited/);
    }
  });

  it('reads the divisions rather than a magic number', () => {
    const [div4, , div2, div1] = SUNDAY_DIVISIONS;
    expect(sundayRatingTier(div1.oppQuality)).toBe('standout');
    expect(sundayRatingTier(div1.oppQuality - 1)).toBe('good');
    expect(sundayRatingTier(div2.oppQuality)).toBe('good');
    expect(sundayRatingTier(div2.oppQuality - 1)).toBe('steady');
    expect(sundayRatingTier(div4.oppQuality)).toBe('steady');
    expect(sundayRatingTier(div4.oppQuality - 1)).toBe('limited');
  });

  it('rises monotonically — a better player is never painted worse', () => {
    const rank = { limited: 0, steady: 1, good: 2, standout: 3 } as const;
    let last = -1;
    for (let ovr = 0; ovr <= 100; ovr++) {
      const r = rank[sundayRatingTier(ovr)];
      expect(r, String(ovr)).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  /**
   * The measurement the bands were chosen against: 3,218 generated players
   * across every club personality. If a generation change ever makes a whole
   * starting division `standout`, the scale has stopped meaning anything and
   * this is where it shows up.
   */
  it('leaves a starting division mostly steady, with a handful above it', async () => {
    const counts = { standout: 0, good: 0, steady: 0, limited: 0 };
    for (const seed of [1, 777, 90210]) {
      useGameStore.getState().resetGame();
      await useGameStore.getState().startSundayLeague({ personality: 'pub', seed });
      const s = useGameStore.getState();
      for (const m of s.sunday!.squad) counts[sundayRatingTier(s.players[m.playerId].overall)]++;
    }
    const total = counts.standout + counts.good + counts.steady + counts.limited;
    expect(total).toBeGreaterThan(20);
    expect(counts.steady / total).toBeGreaterThan(0.5);
    expect(counts.standout / total).toBeLessThan(0.2);
  });
});
