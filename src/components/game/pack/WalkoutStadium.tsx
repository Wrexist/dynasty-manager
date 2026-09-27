import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

/** 3D-rendered stadium assets (scripts/3d/walkout/*.scene.js). */
export const WALKOUT_FLOODLIGHT_SRC = '/walkout/floodlight.webp';

/**
 * Stadium lighting for the walkout: ONE light rig, aimed at the card.
 *
 * Two floodlight banks (rendered in 3D, the right one mirrored) ignite in the
 * top corners and throw a shaft each toward the plinth, and a key beam falls
 * straight down onto it. Three sources, one focal point — the card.
 *
 * This replaced a stack of unrelated effects (a clip-path spotlight, radial
 * "floodlight" dots, drifting blurred fog, an SVG blob silhouette, rotating
 * conic sun rays) that each lit the scene from somewhere different, so the
 * frame had no direction and read as decoration rather than as a stadium.
 * Every layer here is a gradient's own falloff — no `filter: blur()`, which
 * iOS WebKit re-rasterises and which this overlay treats as its main cost.
 *
 * `legendary` adds the crowd's camera flashes. `revealed` flares the rig for
 * the flip. Pure decoration — pointer-events-none; under reduced motion the
 * lights are simply on, and the flashes (decorative loops) are not rendered.
 *
 * Memoized: the parent re-renders on every clue beat and during the rating
 * count, and re-rolling the flash randoms would restart their loops.
 */
export const WalkoutStadium = memo(function WalkoutStadium({ accent, revealed, legendary }: {
  accent: string;
  revealed: boolean;
  legendary: boolean;
}) {
  const reduce = useReducedMotionPref();

  const flashes = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      i,
      left: 4 + Math.random() * 92,
      bottom: 3 + Math.random() * 13,
      dur: 0.3 + Math.random() * 0.4,
      delay: 0.6 + Math.random() * 4,
      repeatDelay: 1.2 + Math.random() * 3,
    })),
  []);

  const flare = revealed && !reduce;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Key beam straight down onto the plinth. An elongated radial falls off
          on its own, so the cone needs neither a clip-path nor a blur. */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 34% 78% at 50% -4%, rgba(255,248,232,0.34) 0%, rgba(255,248,232,0.12) 45%, transparent 72%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: flare ? [0.8, 1, 0.8] : 0.8 }}
        transition={reduce ? { duration: 0 } : flare ? { duration: 0.9, ease: 'easeOut' } : { duration: 0.6, delay: 0.35 }}
      />

      {/* Floodlight banks — the 3D asset, ignited with a sodium-lamp stutter. */}
      {(['left', 'right'] as const).map((side, i) => (
        <div
          key={side}
          className="absolute top-0"
          style={{
            [side]: 0,
            width: 'min(30vw, 132px)',
            transform: side === 'right' ? 'scaleX(-1)' : undefined,
          }}
        >
          {/* The shaft each bank throws toward the card. */}
          <motion.div
            className="absolute"
            style={{
              left: '40%',
              top: '38%',
              width: 'min(46vw, 220px)',
              height: '72vh',
              transformOrigin: '0 0',
              transform: 'rotate(-31deg)',
              background:
                'radial-gradient(ellipse 50% 100% at 0% 0%, rgba(255,244,222,0.2) 0%, rgba(255,244,222,0.06) 50%, transparent 78%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: flare ? [0.9, 1, 0.9] : 0.9 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, delay: flare ? 0 : 0.25 + i * 0.16 }}
          />
          {/* Bloom behind the lamps. */}
          <motion.div
            className="absolute"
            style={{
              inset: '-30%',
              background: `radial-gradient(closest-side, rgba(255,246,226,0.5), color-mix(in srgb, ${accent} 18%, transparent) 55%, transparent)`,
            }}
            initial={{ opacity: 0 }}
            animate={reduce ? { opacity: 0.8 } : { opacity: [0, 1, 0.4, 0.95, 0.8] }}
            transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.1 + i * 0.16, times: [0, 0.2, 0.35, 0.6, 1] }}
          />
          <motion.img
            src={WALKOUT_FLOODLIGHT_SRC}
            alt=""
            draggable={false}
            className="relative w-full h-auto select-none"
            style={{ marginTop: 'max(env(safe-area-inset-top), 6px)' }}
            initial={{ opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 0.35, 1] }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, delay: 0.1 + i * 0.16, times: [0, 0.25, 0.45, 1] }}
          />
        </div>
      ))}

      {/* Crowd band — dark stands at the foot of the frame. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[22%]"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.9))' }}
      />
      {legendary && !reduce && flashes.map(f => (
        <motion.span
          key={`flash-${f.i}`}
          className="absolute rounded-full"
          style={{
            left: `${f.left}%`,
            bottom: `${f.bottom}%`,
            width: 3,
            height: 3,
            background: '#fff',
            boxShadow: '0 0 7px 2px rgba(255,255,255,0.9)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, repeatDelay: f.repeatDelay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
});
