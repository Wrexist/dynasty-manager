import { memo } from 'react';
import { motion } from 'framer-motion';

interface PackConfettiProps {
  count: number;
  /** HSL hue center (e.g. 43 = gold). */
  hueBase: number;
  /** HSL hue spread either side of hueBase. */
  hueRange: number;
  /** Saturation % (0–100). */
  saturation?: number;
  /** Lightness % (0–100). */
  lightness?: number;
}

/**
 * Full-viewport confetti burst. Designed to be dropped into a fixed overlay
 * and unmounted when done. Particles fly upward from 50% height with random
 * horizontal drift, fading out over ~1.5–3s.
 *
 * Rendering is kept lean: transforms + opacity only (GPU-friendly), no
 * layout, no shadows.
 */
export const PackConfetti = memo(function PackConfetti({
  count,
  hueBase,
  hueRange,
  saturation = 92,
  lightness = 55,
}: PackConfettiProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const x = Math.random() * 100;
        const delay = Math.random() * 0.35;
        const duration = 1.5 + Math.random() * 1.4;
        const size = 4 + Math.random() * 7;
        const hue = hueBase + (Math.random() - 0.5) * hueRange;
        const drift = (Math.random() - 0.5) * 280;
        const rise = 260 + Math.random() * 260;
        const rot = (Math.random() - 0.5) * 720;
        return (
          <motion.span
            key={i}
            className="absolute rounded-[2px] pointer-events-none"
            style={{
              width: size,
              height: size * (Math.random() < 0.4 ? 1 : 0.35),
              left: `${x}%`,
              top: '55%',
              backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness + Math.random() * 18}%)`,
              willChange: 'transform, opacity',
            }}
            initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 0.7 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [0, -rise],
              x: [0, drift],
              rotate: [0, rot],
              scale: [0.7, 1, 0.8],
            }}
            transition={{ duration, delay, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
          />
        );
      })}
    </div>
  );
});
