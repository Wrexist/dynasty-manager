import { describe, it, expect } from 'vitest';
import { resolvePitchQuality } from '@/utils/pitchQuality';

describe('resolvePitchQuality', () => {
  it('returns the minimal battery tier under reduced motion, regardless of hardware', () => {
    const q = resolvePitchQuality({ reducedMotion: true, deviceMemory: 16, hardwareConcurrency: 16 });
    expect(q.tier).toBe('battery');
    expect(q.dprCap).toBe(1);
    expect(q.trailLen).toBe(0);
    expect(q.confetti).toBe(0);
    expect(q.weatherScale).toBe(0);
  });

  it('drops to balanced on low memory', () => {
    expect(resolvePitchQuality({ deviceMemory: 4 }).tier).toBe('balanced');
  });

  it('drops to balanced on low core count', () => {
    expect(resolvePitchQuality({ hardwareConcurrency: 4 }).tier).toBe('balanced');
  });

  it('uses the high tier on capable hardware', () => {
    expect(resolvePitchQuality({ deviceMemory: 8, hardwareConcurrency: 8 }).tier).toBe('high');
  });

  it('defaults to high when capabilities are unknown', () => {
    const q = resolvePitchQuality({});
    expect(q.tier).toBe('high');
    expect(q.dprCap).toBe(2);
  });
});
