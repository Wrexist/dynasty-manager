/**
 * Procedural SFX — the contract is "never throws, anywhere". jsdom has no
 * AudioContext, so every cue must silently no-op here (the same guard that
 * protects ancient WebViews in production).
 */
import { describe, it, expect } from 'vitest';
import {
  setSfxEnabled, resumeSfx, startCrowdBed, stopCrowdBed,
  sfxWhistle, sfxKick, sfxRoar, sfxGroan, sfxNet,
} from '@/utils/sfx';

describe('sfx — safe in audio-less environments', () => {
  it('every cue no-ops without an AudioContext', () => {
    expect(() => {
      setSfxEnabled(true);
      resumeSfx();
      startCrowdBed();
      sfxWhistle();
      sfxKick();
      sfxRoar();
      sfxRoar(true);
      sfxGroan();
      sfxNet();
      stopCrowdBed();
      setSfxEnabled(false);
      sfxWhistle(); // disabled path
    }).not.toThrow();
  });
});
