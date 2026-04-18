/**
 * Lightweight Web Audio API sound system.
 * Zero bundle cost — uses only the browser's built-in AudioContext.
 * All sounds are procedurally synthesized (no audio file downloads).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const W = window as Window & { webkitAudioContext?: typeof AudioContext };
    ctx = new (window.AudioContext || W.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume on user gesture (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

// Cached audio settings — populated lazily from localStorage on first call
// then kept in sync via `setAudioSettings` (called from the Settings UI when
// the user toggles sound or adjusts volume). Previously each sfx call parsed
// the entire save JSON twice, which added 3–15 ms per sfx on a moderately
// sized save. This module-level cache is effectively free per call.
type AudioCache = { enabled: boolean; volume: number; loaded: boolean };
const audioCache: AudioCache = { enabled: true, volume: 0.5, loaded: false };

function loadFromLocalStorage(): void {
  if (typeof localStorage === 'undefined') { audioCache.loaded = true; return; }
  try {
    const raw = localStorage.getItem('dynasty-save-1') || localStorage.getItem('dynasty-save');
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.settings?.soundEnabled === false) audioCache.enabled = false;
      const v = data?.settings?.volume;
      if (typeof v === 'number') audioCache.volume = Math.max(0, Math.min(1, v));
    }
  } catch { /* defaults already seeded */ }
  audioCache.loaded = true;
}

/** Push updated audio settings from the Settings UI into the audio cache. */
export function setAudioSettings(enabled: boolean, volume: number): void {
  audioCache.enabled = enabled;
  audioCache.volume = Math.max(0, Math.min(1, volume));
  audioCache.loaded = true;
}

function isEnabled(): boolean {
  if (!audioCache.loaded) loadFromLocalStorage();
  return audioCache.enabled;
}

function getVolume(): number {
  if (!audioCache.loaded) loadFromLocalStorage();
  return audioCache.volume;
}

/** Create an envelope gain node for sound shaping */
function makeGain(ac: AudioContext, peak: number, attackS: number, decayS: number): GainNode {
  const gain = ac.createGain();
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attackS);
  gain.gain.linearRampToValueAtTime(0, now + attackS + decayS);
  return gain;
}

/** Short click / UI tap feedback */
export function playSfxTap(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.15;
  const osc = ac.createOscillator();
  const gain = makeGain(ac, vol, 0.002, 0.05);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.06);
}

/** Goal scored — triumphant rising tone */
export function playSfxGoal(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.35;
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.03);
    gain.gain.linearRampToValueAtTime(0, t + 0.25);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

/** Final whistle — two short blasts */
export function playSfxWhistle(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.3;
  [0, 0.35].forEach(offset => {
    const osc = ac.createOscillator();
    const gain = makeGain(ac, vol, 0.01, 0.2);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2800, ac.currentTime + offset);
    osc.frequency.linearRampToValueAtTime(2600, ac.currentTime + offset + 0.22);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + offset);
    osc.stop(ac.currentTime + offset + 0.25);
  });
}

/** Transfer accepted — positive confirmation chime */
export function playSfxTransferAccepted(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.25;
  const notes = [523, 784]; // C5 G5
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = makeGain(ac, vol, 0.01, 0.18);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime + i * 0.15);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + i * 0.15);
    osc.stop(ac.currentTime + i * 0.15 + 0.2);
  });
}

/** Game saved — soft confirmation tone */
export function playSfxSave(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.2;
  const osc = ac.createOscillator();
  const gain = makeGain(ac, vol, 0.01, 0.3);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(1046, ac.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.35);
}

/** Achievement unlocked — fanfare */
export function playSfxAchievement(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.3;
  const notes = [523, 659, 784, 659, 1047]; // C E G E C (pentatonic flourish)
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = makeGain(ac, vol, 0.01, 0.15);
    const t = ac.currentTime + i * 0.1;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}

/** Board warning / low confidence — tense low tone */
export function playSfxWarning(): void {
  if (!isEnabled()) return;
  const ac = getCtx();
  if (!ac) return;
  const vol = getVolume() * 0.25;
  const osc = ac.createOscillator();
  const gain = makeGain(ac, vol, 0.02, 0.4);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(180, ac.currentTime + 0.42);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.45);
}
