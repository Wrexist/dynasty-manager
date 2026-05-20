import { useMemo } from 'react';

/**
 * Cosmic parallax starfield for the pack-opening overlay.
 *
 * Renders three depth layers of static star points. Each layer is a single
 * compositor element that drifts via a CSS `transform` keyframe (see
 * `.pack-starfield-*` in index.css) — the stars themselves are static
 * painted children, so the whole effect costs exactly three animated nodes
 * no matter how many stars are drawn.
 *
 * Layer speeds differ (far drifts least) to produce parallax depth. Star
 * positions are generated once via useMemo so a re-render of the overlay
 * during the opening sequence can't reshuffle the sky mid-drift.
 *
 * Purely decorative: pointer-events-none + aria-hidden. The CSS drift is
 * disabled under `prefers-reduced-motion`; the stars then sit still, which
 * is the correct degraded state (a static starfield, not a blank void).
 */

interface Star {
  /** Percent position within the (oversized) layer. */
  x: number;
  y: number;
  /** Pixel diameter. */
  size: number;
  /** Base opacity. */
  opacity: number;
}

interface LayerSpec {
  className: string;
  count: number;
  /** Size range [min, max] in px. */
  size: [number, number];
  /** Opacity range [min, max]. */
  opacity: [number, number];
}

const LAYERS: LayerSpec[] = [
  // Far — many tiny dim stars, drifts slowest.
  { className: 'pack-starfield-far', count: 26, size: [1, 1.6], opacity: [0.18, 0.4] },
  // Mid — fewer, slightly brighter.
  { className: 'pack-starfield-mid', count: 16, size: [1.4, 2.4], opacity: [0.3, 0.6] },
  // Near — sparse, brightest, drifts fastest → reads as closest.
  { className: 'pack-starfield-near', count: 9, size: [2, 3.2], opacity: [0.45, 0.85] },
];

function buildStars(spec: LayerSpec): Star[] {
  return Array.from({ length: spec.count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: spec.size[0] + Math.random() * (spec.size[1] - spec.size[0]),
    opacity: spec.opacity[0] + Math.random() * (spec.opacity[1] - spec.opacity[0]),
  }));
}

export function PackStarfield() {
  // Build all three layers once. The overlay re-renders on every phase
  // change; without the memo each drift layer would jump to a new sky.
  const layers = useMemo(() => LAYERS.map(spec => ({ spec, stars: buildStars(spec) })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {layers.map(({ spec, stars }) => (
        <div
          key={spec.className}
          // Oversized so the drift never exposes a layer edge.
          className={`absolute inset-[-20%] ${spec.className}`}
        >
          {stars.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                // Soft bloom on the brighter near-layer stars only — keeps
                // the far layer cheap (no shadow paint on 26 nodes).
                boxShadow: spec.className === 'pack-starfield-near'
                  ? `0 0 ${s.size * 2}px rgba(255,255,255,0.5)`
                  : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
