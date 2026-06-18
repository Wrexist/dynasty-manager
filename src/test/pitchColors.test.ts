import { describe, it, expect } from 'vitest';
import { shade, keeperKit } from '@/components/game/pitch/pitchColors';

describe('shade', () => {
  it('returns the colour unchanged at amount 0', () => {
    expect(shade('#ff8000', 0)).toBe('rgb(255,128,0)');
  });
  it('lightens toward white', () => {
    expect(shade('#000000', 0.5)).toBe('rgb(128,128,128)');
    expect(shade('#000000', 1)).toBe('rgb(255,255,255)');
  });
  it('darkens toward black', () => {
    expect(shade('#ffffff', -0.5)).toBe('rgb(128,128,128)');
    expect(shade('#ffffff', -1)).toBe('rgb(0,0,0)');
  });
  it('expands 3-char hex', () => {
    expect(shade('#f00', 0)).toBe('rgb(255,0,0)');
  });
  it('falls back to grey on a bad colour', () => {
    expect(shade('not-a-color', 0)).toBe('rgb(136,136,136)');
  });
});

describe('keeperKit', () => {
  it('darkens the team colour into a distinct keeper kit', () => {
    expect(keeperKit('#ffffff')).toBe(shade('#ffffff', -0.55));
    expect(keeperKit('#ffffff')).not.toBe('rgb(255,255,255)');
  });
});
