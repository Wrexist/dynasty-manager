/**
 * Pack-opening audio cues — no-op stub.
 *
 * Plumbing for future asset wiring. The Packs feature calls into here on
 * key animation beats (charge, explode, walkout, standard pull) but the
 * stub returns immediately until you register an actual playback handler.
 *
 * To enable audio later: register a handler via `setPackSfxHandler(fn)`
 * during app init. The handler receives the cue name and any options;
 * it's responsible for the playback (Web Audio, HTMLAudioElement, native
 * Capacitor plugin — your choice).
 *
 * Designed to be a true no-op so it can ship before assets exist without
 * adding any cost to the bundle or runtime.
 */

export type PackSfxCue =
  | 'standard-pull'   // Common card flip
  | 'rare-pull'       // 84+ walkout pull
  | 'charge'          // Pack charge-up build
  | 'explode'         // Pack burst
  | 'walkout-rise';   // Silhouette rises during walkout

interface PackSfxHandler {
  (cue: PackSfxCue): void;
}

let handler: PackSfxHandler | null = null;

/** Wire a real playback function. Call once during app init. */
export function setPackSfxHandler(fn: PackSfxHandler | null): void {
  handler = fn;
}

/** Fire-and-forget audio cue. No-op until a handler is registered. */
export function playPackSfx(cue: PackSfxCue): void {
  if (!handler) return;
  try { handler(cue); } catch { /* audio failures must never crash gameplay */ }
}
