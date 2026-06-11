import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Cinematic stadium environment behind the pack-opening sequence.
 *
 * Replaces the cosmic starfield with a dark luxury stadium: distant
 * floodlight banks with light beams, a central breathing spotlight, low
 * drifting fog, and ambient floodlit motes. Pure decoration —
 * `pointer-events-none`, sits as the first layer of the overlay.
 *
 * All motion self-disables under the OS reduced-motion setting; the static
 * lighting still reads as a stadium so the scene never looks broken.
 *
 * Memoized: the overlay re-renders on every reveal tap / phase change, and
 * re-rolling the mote randoms each pass teleported the infinite drift
 * animations mid-flight.
 */
export const PackStadium = memo(function PackStadium() {
  const reduce = useReducedMotion();

  // Ambient mote specs — rolled once per mount, not per render.
  const motes = useMemo(() =>
    Array.from({ length: 14 }).map((_, i) => ({
      i,
      left: 8 + Math.random() * 84,
      size: 1.5 + Math.random() * 2.5,
      dur: 9 + Math.random() * 9,
      delay: Math.random() * 10,
      rise: 50 + Math.random() * 40,
    })),
  []);

  // Distant floodlight banks — mirrored top-left / top-right.
  const banks = [
    { side: 'left' as const, x: '15%', tilt: 9 },
    { side: 'right' as const, x: '85%', tilt: -9 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Deep stadium base — cool dark gradient, faintly lit toward centre. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(28,34,52,0.92) 0%, rgba(8,10,16,0.97) 48%, #050505 100%)',
        }}
      />

      {/* Pitch glow at the foot of the frame — a hint of floodlit turf. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: 'radial-gradient(80% 100% at 50% 100%, rgba(34,80,52,0.26) 0%, transparent 70%)' }}
      />

      {/* Floodlight banks + their light beams. */}
      {banks.map(bank => (
        <div key={bank.side} className="absolute top-0" style={{ left: bank.x, transform: 'translateX(-50%)' }}>
          {/* Light beam — a soft cone fanning down toward the pitch. */}
          <motion.div
            className="absolute top-3 left-1/2"
            style={{
              width: 10,
              height: '80vh',
              background:
                'linear-gradient(180deg, rgba(255,247,224,0.22) 0%, rgba(255,247,224,0.07) 38%, transparent 82%)',
              clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
              filter: 'blur(8px)',
              transform: `translateX(-50%) rotate(${bank.tilt}deg)`,
              transformOrigin: 'top center',
            }}
            animate={reduce ? undefined : { opacity: [0.6, 0.9, 0.65, 0.85, 0.6] }}
            transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* The fixture — a small bank of bright cells with a warm glow. */}
          <motion.div
            className="relative grid grid-cols-3 gap-[3px] p-[3px] rounded-sm"
            style={{ background: 'rgba(0,0,0,0.6)', boxShadow: '0 0 22px rgba(255,247,224,0.5)' }}
            animate={reduce ? undefined : { filter: ['brightness(1)', 'brightness(1.18)', 'brightness(0.95)', 'brightness(1.12)', 'brightness(1)'] }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="block w-2.5 h-2 rounded-[1px]"
                style={{ background: '#fff7e0', boxShadow: '0 0 6px #fff7e0' }}
              />
            ))}
          </motion.div>
        </div>
      ))}

      {/* Central spotlight — a broad soft pool of light on the pack area,
          gently breathing so the scene feels alive. */}
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{
          width: '120vw',
          height: '120vw',
          maxWidth: 780,
          maxHeight: 780,
          translateX: '-50%',
          translateY: '-50%',
          background:
            'radial-gradient(circle at 50% 42%, rgba(255,240,210,0.17) 0%, rgba(255,240,210,0.06) 30%, transparent 62%)',
          mixBlendMode: 'screen',
        }}
        animate={reduce ? undefined : { opacity: [0.7, 1, 0.7], scale: [0.97, 1.03, 0.97] }}
        transition={reduce ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Low drifting fog — soft blurred banks near the foot of the frame. */}
      {!reduce && [0, 1, 2].map(i => (
        <motion.div
          key={`fog-${i}`}
          className="absolute rounded-full"
          style={{
            bottom: `${4 + i * 7}%`,
            left: '-25%',
            width: 380,
            height: 150,
            background: 'radial-gradient(closest-side, rgba(150,165,195,0.16), transparent)',
            filter: 'blur(28px)',
          }}
          animate={{ x: ['-25%', '125vw'] }}
          transition={{ duration: 28 + i * 9, repeat: Infinity, ease: 'linear', delay: i * 8 }}
        />
      ))}

      {/* Ambient floodlit motes drifting up through the light. */}
      {!reduce && motes.map(m => (
        <motion.span
          key={`mote-${m.i}`}
          className="absolute rounded-full"
          style={{ left: `${m.left}%`, bottom: '8%', width: m.size, height: m.size, background: 'rgba(255,247,224,0.7)' }}
          animate={{ y: ['0vh', `-${m.rise}vh`], opacity: [0, 0.8, 0] }}
          transition={{ duration: m.dur, repeat: Infinity, ease: 'easeOut', delay: m.delay }}
        />
      ))}

      {/* Edge vignette — keeps the eye on the centre of the frame. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 75% 60% at 50% 46%, transparent 40%, rgba(0,0,0,0.72) 100%)' }}
      />
    </div>
  );
});
