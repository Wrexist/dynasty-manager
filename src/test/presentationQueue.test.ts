import { describe, it, expect } from 'vitest';
import { resolveActiveOverlay } from '@/utils/presentationQueue';

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
