/**
 * Procedural sound effects — the game's first audio.
 *
 * Everything is synthesized with Web Audio (filtered noise + oscillators):
 * zero assets, zero bundle weight, no licensing. Stylized rather than
 * sampled — a crowd "bed", whistle, ball thump, goal roar and a miss groan —
 * tuned for the penalty shootout but written as a general cue library.
 *
 * Design constraints:
 *  - Never throws: every call is guarded; environments without AudioContext
 *    (jsdom, ancient WebViews) silently no-op.
 *  - iOS/WKWebView autoplay policy: the context starts suspended until a
 *    user gesture. `resumeSfx()` is cheap and safe to call from any tap
 *    handler; cue functions also attempt a resume themselves.
 *  - Respects the user: gated on `setSfxEnabled` (Settings → Sound effects)
 *    and hard-capped at a modest master volume. The iOS mute switch is
 *    honored by the OS for WebAudio in ambient mode.
 */

let enabled = true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let crowdBed: { gain: GainNode; stop: () => void } | null = null;

const MASTER_VOLUME = 0.5;

export function setSfxEnabled(on: boolean): void {
  enabled = on;
  if (!on) stopCrowdBed();
}

function getCtx(): AudioContext | null {
  if (!enabled) return null;
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

/** Safe to call from any tap handler — unlocks audio on iOS. */
export function resumeSfx(): void {
  try {
    const c = getCtx();
    if (c && c.state === 'suspended') void c.resume();
  } catch { /* no-op */ }
}

function getNoise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // Pink-ish noise (running average of white) reads as "crowd", not "static".
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.94 + white * 0.06;
    data[i] = last * 6;
  }
  noiseBuf = buf;
  return buf;
}

function noiseSource(c: AudioContext, loop = false): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  src.loop = loop;
  return src;
}

/** Low murmuring stadium ambience. Idempotent; call stop on unmount. */
export function startCrowdBed(): void {
  try {
    const c = getCtx();
    if (!c || !master || crowdBed) return;
    resumeSfx();
    const src = noiseSource(c, true);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.6);
    // Slow swell LFO so the crowd "breathes".
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.016;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(lp).connect(gain).connect(master);
    src.start();
    lfo.start();
    crowdBed = {
      gain,
      stop: () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } },
    };
  } catch { /* no-op */ }
}

export function stopCrowdBed(): void {
  try {
    if (!crowdBed || !ctx) { crowdBed = null; return; }
    const bed = crowdBed;
    crowdBed = null;
    bed.gain.gain.cancelScheduledValues(ctx.currentTime);
    bed.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    const stop = bed.stop;
    setTimeout(stop, 900);
  } catch { /* no-op */ }
}

/** Referee whistle — two short peeps. */
export function sfxWhistle(): void {
  try {
    const c = getCtx();
    if (!c || !master) return;
    resumeSfx();
    for (const [at, dur] of [[0, 0.14], [0.2, 0.22]] as const) {
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 2350;
      const vib = c.createOscillator();
      vib.frequency.value = 38;
      const vibGain = c.createGain();
      vibGain.gain.value = 55;
      vib.connect(vibGain).connect(osc.frequency);
      const g = c.createGain();
      const t = c.currentTime + at;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.setValueAtTime(0.11, t + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(g).connect(master);
      osc.start(t); osc.stop(t + dur + 0.02);
      vib.start(t); vib.stop(t + dur + 0.02);
    }
  } catch { /* no-op */ }
}

/** The strike — low thump plus a click of leather. */
export function sfxKick(): void {
  try {
    const c = getCtx();
    if (!c || !master) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.16);

    const click = noiseSource(c);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const cg = c.createGain();
    cg.gain.setValueAtTime(0.12, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    click.connect(hp).connect(cg).connect(master);
    click.start(t); click.stop(t + 0.06);
  } catch { /* no-op */ }
}

/** Crowd eruption — bandpass noise swelling up. `big` for the winning kick. */
export function sfxRoar(big = false): void {
  try {
    const c = getCtx();
    if (!c || !master) return;
    const t = c.currentTime;
    const dur = big ? 2.6 : 1.5;
    const src = noiseSource(c, true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(big ? 950 : 750, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(big ? 0.5 : 0.34, t + 0.18);
    g.gain.setTargetAtTime(0, t + dur * 0.45, dur * 0.28);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.4);
  } catch { /* no-op */ }
}

/** The deflating "ooooh" — swell that pitches down and dies. */
export function sfxGroan(): void {
  try {
    const c = getCtx();
    if (!c || !master) return;
    const t = c.currentTime;
    const src = noiseSource(c, true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(640, t);
    bp.frequency.exponentialRampToValueAtTime(210, t + 0.9);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.14);
    g.gain.setTargetAtTime(0, t + 0.55, 0.35);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + 1.8);
  } catch { /* no-op */ }
}

/** Soft net swish for a goal, layered under the roar. */
export function sfxNet(): void {
  try {
    const c = getCtx();
    if (!c || !master) return;
    const t = c.currentTime;
    const src = noiseSource(c);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(hp).connect(g).connect(master);
    src.start(t); src.stop(t + 0.25);
  } catch { /* no-op */ }
}
