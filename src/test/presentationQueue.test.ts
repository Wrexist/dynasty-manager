import { describe, it, expect } from 'vitest';
import {
  resolveActiveOverlay,
  nextOverlay,
  buildQueue,
  PRESENTATION_ORDER,
  type OverlayId,
} from '@/utils/presentationQueue';

describe('presentationQueue — resolveActiveOverlay', () => {
  it('returns null when nothing is registered', () => {
    expect(resolveActiveOverlay([])).toBeNull();
  });

  it('returns the single registrant', () => {
    expect(resolveActiveOverlay(['pressConference'])).toBe('pressConference');
  });

  it('picks the highest-priority (earliest in order) registrant', () => {
    // weeklyDigest outranks pressConference outranks dailyReward.
    expect(resolveActiveOverlay(['dailyReward', 'pressConference', 'weeklyDigest'])).toBe('weeklyDigest');
    expect(resolveActiveOverlay(['dailyReward', 'pressConference'])).toBe('pressConference');
  });

  it('is order-independent for the input iterable', () => {
    const a = resolveActiveOverlay(['achievement', 'celebration', 'weeklyDigest']);
    const b = resolveActiveOverlay(['weeklyDigest', 'achievement', 'celebration']);
    expect(a).toBe('weeklyDigest');
    expect(b).toBe('weeklyDigest');
  });

  it('ignores unknown ids but still resolves a known one', () => {
    expect(resolveActiveOverlay(['not-a-real-overlay', 'farewell'])).toBe('farewell');
  });

  it('returns null when only unknown ids are registered', () => {
    expect(resolveActiveOverlay(['nope', 'also-nope'])).toBeNull();
  });

  it('presents strictly one at a time — the active id is always a single value', () => {
    // As overlays are dismissed (removed from the set) the next one surfaces.
    let registered = ['weeklyDigest', 'celebration', 'pressConference'];
    expect(resolveActiveOverlay(registered)).toBe('weeklyDigest');
    registered = registered.filter(x => x !== 'weeklyDigest');
    expect(resolveActiveOverlay(registered)).toBe('celebration');
    registered = registered.filter(x => x !== 'celebration');
    expect(resolveActiveOverlay(registered)).toBe('pressConference');
    registered = registered.filter(x => x !== 'pressConference');
    expect(resolveActiveOverlay(registered)).toBeNull();
  });
});

describe('presentationQueue — buildQueue / nextOverlay', () => {
  it('buildQueue returns eligible overlays in priority order', () => {
    const queue = buildQueue({ dailyReward: true, weeklyDigest: true, celebration: true });
    expect(queue).toEqual(['weeklyDigest', 'celebration', 'dailyReward']);
  });

  it('buildQueue is empty when nothing is eligible', () => {
    expect(buildQueue({})).toEqual([]);
    expect(buildQueue({ weeklyDigest: false })).toEqual([]);
  });

  it('nextOverlay is the head of the queue', () => {
    expect(nextOverlay({ dailyReward: true, celebration: true })).toBe('celebration');
    expect(nextOverlay({})).toBeNull();
  });

  it('every OverlayId appears exactly once in PRESENTATION_ORDER', () => {
    const seen = new Set<OverlayId>();
    for (const id of PRESENTATION_ORDER) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(seen.size).toBe(PRESENTATION_ORDER.length);
  });
});
