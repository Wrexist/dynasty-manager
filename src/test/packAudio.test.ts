/**
 * Pack SFX wiring (G4). The walkout fires cues via `playPackSfx`; before this
 * goal `setPackSfxHandler` was never called, so every cue was a no-op. These
 * tests assert the handler contract main.tsx relies on, without touching real
 * audio (we register a spy handler, not the sfx primitives).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { setPackSfxHandler, playPackSfx, type PackSfxCue } from '@/utils/packAudio';

afterEach(() => setPackSfxHandler(null));

describe('packAudio handler wiring', () => {
  it('no-ops (and never throws) until a handler is registered', () => {
    setPackSfxHandler(null);
    expect(() => playPackSfx('rare-pull')).not.toThrow();
  });

  it('dispatches each cue to the registered handler', () => {
    const seen: PackSfxCue[] = [];
    setPackSfxHandler(cue => seen.push(cue));
    const cues: PackSfxCue[] = ['charge', 'explode', 'walkout-rise', 'rare-pull', 'standard-pull'];
    for (const c of cues) playPackSfx(c);
    expect(seen).toEqual(cues);
  });

  it('swallows handler errors so audio never crashes a pull', () => {
    setPackSfxHandler(() => { throw new Error('audio blew up'); });
    expect(() => playPackSfx('explode')).not.toThrow();
  });

  it('unregistering restores the no-op behaviour', () => {
    const fn = vi.fn();
    setPackSfxHandler(fn);
    playPackSfx('charge');
    setPackSfxHandler(null);
    playPackSfx('charge');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
