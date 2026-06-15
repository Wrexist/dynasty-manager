// Adaptive quality selection for the 2.5D pitch. Keeps the view smooth on
// low-end devices by scaling DPR, trail length and particle density. The core
// resolver is pure (takes explicit capability inputs) so it is unit-tested;
// detectPitchQuality is the thin runtime wrapper that reads from navigator.

import type { PitchQuality } from '@/types/game';

export interface PitchQualityInputs {
  /** Reduced-motion or performance mode → minimal "battery" tier. */
  reducedMotion?: boolean;
  /** navigator.deviceMemory (GB), when available. */
  deviceMemory?: number;
  /** navigator.hardwareConcurrency (logical cores), when available. */
  hardwareConcurrency?: number;
}

const BATTERY: PitchQuality = { tier: 'battery', dprCap: 1, trailLen: 0, confetti: 0, weatherScale: 0, vignette: false, gradient: false };
const BALANCED: PitchQuality = { tier: 'balanced', dprCap: 1.5, trailLen: 8, confetti: 8, weatherScale: 0.6, vignette: true, gradient: true };
const HIGH: PitchQuality = { tier: 'high', dprCap: 2, trailLen: 14, confetti: 16, weatherScale: 1, vignette: true, gradient: true };

/** Pure resolver: capability inputs → render budget. */
export function resolvePitchQuality(inp: PitchQualityInputs): PitchQuality {
  if (inp.reducedMotion) return BATTERY;
  const lowMem = typeof inp.deviceMemory === 'number' && inp.deviceMemory <= 4;
  const lowCpu = typeof inp.hardwareConcurrency === 'number' && inp.hardwareConcurrency <= 4;
  return lowMem || lowCpu ? BALANCED : HIGH;
}

/** Whether a WebGL context is obtainable (gates the Pixi "Stunning" tier). */
export function webglSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Runtime wrapper: probes navigator (guarded for SSR/jsdom) and resolves. */
export function detectPitchQuality(reducedMotion: boolean): PitchQuality {
  const nav = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { deviceMemory?: number })
    : undefined;
  return resolvePitchQuality({
    reducedMotion,
    deviceMemory: nav?.deviceMemory,
    hardwareConcurrency: nav?.hardwareConcurrency,
  });
}
