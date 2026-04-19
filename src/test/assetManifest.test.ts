import { describe, it, expect } from 'vitest';
import {
  TROPHIES,
  DIVISIONS,
  AVATARS,
  EMPTY_STATES,
  POSITIONS,
  HERO,
  getCupAssetId,
  getDivisionAssetId,
  type AssetEntry,
} from '@/assets/manifest';

/** Every entry in the manifest must have a Lucide fallback + non-empty alt,
 *  so consumers can render a sensible icon when the art hasn't landed yet. */
function assertEntryShape(entry: AssetEntry, id: string) {
  expect(entry.id, `${id}: id`).toBeTruthy();
  expect(entry.fallback, `${id}: fallback`).toBeTruthy();
  expect(entry.alt, `${id}: alt`).toBeTruthy();
  expect(entry.alt.length).toBeGreaterThan(3);
  // Optional: url is either undefined (asset not produced yet) or a string
  if (entry.url !== undefined) expect(typeof entry.url).toBe('string');
}

describe('asset manifest', () => {
  describe('schema', () => {
    it('every TROPHIES entry is well-formed', () => {
      for (const [id, entry] of Object.entries(TROPHIES)) {
        assertEntryShape(entry, `trophy:${id}`);
      }
    });

    it('every DIVISIONS entry is well-formed', () => {
      for (const [id, entry] of Object.entries(DIVISIONS)) {
        assertEntryShape(entry, `division:${id}`);
      }
    });

    it('every AVATARS entry is well-formed', () => {
      for (const [id, entry] of Object.entries(AVATARS)) {
        assertEntryShape(entry, `avatar:${id}`);
      }
    });

    it('every EMPTY_STATES entry is well-formed', () => {
      for (const [id, entry] of Object.entries(EMPTY_STATES)) {
        assertEntryShape(entry, `empty:${id}`);
      }
    });

    it('every POSITIONS entry is well-formed', () => {
      for (const [id, entry] of Object.entries(POSITIONS)) {
        assertEntryShape(entry, `position:${id}`);
      }
    });

    it('HERO entry is well-formed', () => {
      assertEntryShape(HERO, 'hero');
    });
  });

  describe('getCupAssetId', () => {
    it('maps the known human-readable competition names', () => {
      expect(getCupAssetId('Champions Cup')).toBe('champions-cup');
      expect(getCupAssetId('Shield Cup')).toBe('shield-cup');
      expect(getCupAssetId('Dynasty Cup')).toBe('dynasty-cup');
      expect(getCupAssetId('League Cup')).toBe('league-cup');
      expect(getCupAssetId('Super Cup')).toBe('domestic-super-cup');
    });

    it('strips round suffixes before matching', () => {
      expect(getCupAssetId('Champions Cup — QF')).toBe('champions-cup');
      expect(getCupAssetId('Dynasty Cup — Final')).toBe('dynasty-cup');
    });

    it('returns null for unknown competitions', () => {
      expect(getCupAssetId('Unknown Cup')).toBeNull();
      expect(getCupAssetId(undefined)).toBeNull();
    });
  });

  describe('getDivisionAssetId', () => {
    it('maps tiers 1–4 to their respective ids', () => {
      expect(getDivisionAssetId(1)).toBe('div-1');
      expect(getDivisionAssetId(2)).toBe('div-2');
      expect(getDivisionAssetId(3)).toBe('div-3');
      expect(getDivisionAssetId(4)).toBe('div-4');
    });

    it('falls back to the placeholder id for unknown tiers', () => {
      expect(getDivisionAssetId(undefined)).toBe('placeholder');
      expect(getDivisionAssetId(0)).toBe('placeholder');
      expect(getDivisionAssetId(99)).toBe('placeholder');
    });
  });

  describe('fallback safety — the scaffold ships BEFORE the art', () => {
    it('no trophy has a url yet (they land one at a time later)', () => {
      // This test doubles as a reminder: as assets land, update the
      // corresponding `url` in manifest.ts and delete the matching
      // expectation below. Once all trophies have urls, remove this test.
      for (const entry of Object.values(TROPHIES)) {
        expect(entry.url).toBeUndefined();
      }
    });

    it('manifest lookups are type-safe for every declared id', () => {
      // Compile-time test — if any entry is missing, typecheck fails.
      // Runtime check: the entries exist and share the expected shape.
      expect(TROPHIES['champions-cup']).toBeDefined();
      expect(DIVISIONS['div-1']).toBeDefined();
      expect(AVATARS['avatar-veteran']).toBeDefined();
      expect(EMPTY_STATES.transfers).toBeDefined();
      expect(POSITIONS.gk).toBeDefined();
    });
  });
});
