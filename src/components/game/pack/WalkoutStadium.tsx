import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Stadium dressing for the legendary walkout.
 *
 * Layers, back to front: a massive spotlight beam, igniting corner
 * floodlights, drifting fog at the base, a hero silhouette rising behind
 * the card, and a crowd band flecked with camera-flash twinkles.
 *
 * Rendered behind the walkout's hero card. Pure decoration —
 * `pointer-events-none`; all motion self-disables under reduced motion.
 *
 * Memoized: the parent re-renders every ~45ms during the name typewriter,
 * and re-rolling the camera-flash randoms on each pass restarted all 16
 * infinite flash animations dozens of times per second mid-cinematic.
 */
export const WalkoutStadium = memo(function WalkoutStadium({ accent, revealed }: { accent: string; revealed: boolean }) {
  const reduce = useReducedMotion();

  // Camera-flash specs — rolled once per mount, not per render.
  const flashes = useMemo(() =>
    Array.from({ length: 16 }).map((_, i) => ({
      i,
      left: 4 + Math.random() * 92,
      bottom: 2 + Math.random() * 14,
      dur: 0.35 + Math.random() * 0.5,
      delay: Math.random() * 4,
      repeatDelay: 1.5 + Math.random() * 3,
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Massive spotlight beam pouring down onto the card. */}
      <motion.div
        className="absolute left-1/2 top-0"
        style={{
          width: '80vw',
          maxWidth: 460,
          height: '88vh',
          transform: 'translateX(-50%)',
          background:
            'linear-gradient(180deg, rgba(255,250,235,0.34) 0%, rgba(255,250,235,0.11) 42%, transparent 84%)',
          clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)',
          filter: 'blur(10px)',
          mixBlendMode: 'screen',
        }}
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 0.7 } : { opacity: [0, 0.85, 0.62, 0.85] }}
        transition={reduce ? { duration: 0.5 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Corner floodlights igniting as the walkout opens. */}
      {[{ x: '12%' }, { x: '88%' }].map((f, i) => (
        <motion.div
          key={`flood-${i}`}
          className="absolute top-[3%] rounded-full"
          style={{
            left: f.x,
            width: 72,
            height: 72,
            transform: 'translateX(-50%)',
            background:
              'radial-gradient(circle, rgba(255,247,224,0.95) 0%, rgba(255,247,224,0.22) 40%, transparent 70%)',
          }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={reduce ? { opacity: 0.8, scale: 1 } : { opacity: [0, 1, 0.72, 1], scale: [0.6, 1.18, 1] }}
          transition={reduce ? { duration: 0.5 } : { duration: 0.85, delay: 0.1 + i * 0.12, ease: 'easeOut' }}
        />
      ))}

      {/* Drifting fog banks at the foot of the frame. */}
      {!reduce && [0, 1, 2].map(i => (
        <motion.div
          key={`fog-${i}`}
          className="absolute rounded-full"
          style={{
            bottom: `${6 + i * 6}%`,
            left: '-30%',
            width: 420,
            height: 160,
            background: 'radial-gradient(closest-side, rgba(190,200,225,0.18), transparent)',
            filter: 'blur(30px)',
          }}
          animate={{ x: ['-30%', '130vw'] }}
          transition={{ duration: 24 + i * 8, repeat: Infinity, ease: 'linear', delay: i * 6 }}
        />
      ))}

      {/* Hero silhouette rising behind the card — a broad-shouldered figure
          that lifts into frame and steadies once the card is revealed. */}
      <motion.svg
        className="absolute left-1/2"
        style={{ bottom: '13%', transform: 'translateX(-50%)' }}
        width={360}
        height={440}
        viewBox="0 0 360 440"
        initial={{ opacity: 0, y: 70 }}
        animate={{ opacity: revealed ? 0.94 : 0.4, y: revealed ? 0 : 34 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <defs>
          <linearGradient id="walkout-figure" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a0c12" />
            <stop offset="1" stopColor="#000000" />
          </linearGradient>
        </defs>
        <g fill="url(#walkout-figure)" stroke={accent} strokeWidth="2.5" strokeOpacity="0.5">
          {/* head */}
          <ellipse cx="180" cy="84" rx="48" ry="54" />
          {/* shoulders + torso */}
          <path d="M70 440 C70 286 104 150 180 150 C256 150 290 286 290 440 Z" />
        </g>
      </motion.svg>

      {/* Crowd silhouette band + popping camera flashes. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[20%]"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.92))' }}
      />
      {!reduce && flashes.map(f => (
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
