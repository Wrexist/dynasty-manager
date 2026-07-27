import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

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
  const prefersReducedMotion = useReducedMotionPref();
  // Hard ceiling so a future config bump can't silently regress perf.
  const safeCount = Math.min(Math.max(0, count), 60);
  // Particle layouts are rolled once per mount so a parent re-render
  // during the explode beat can't reset every particle to its start.
  const particles = useMemo(
    () => Array.from({ length: safeCount }, () => ({
      x: Math.random() * 100,
      delay: Math.random() * 0.35,
      duration: 1.5 + Math.random() * 1.4,
      size: 4 + Math.random() * 7,
      thin: Math.random() < 0.4 ? 1 : 0.35,
      hue: hueBase + (Math.random() - 0.5) * hueRange,
      drift: (Math.random() - 0.5) * 280,
      rise: 260 + Math.random() * 260,
      rot: (Math.random() - 0.5) * 720,
      lightJitter: Math.random() * 18,
    })),
    [safeCount, hueBase, hueRange],
  );
  if (prefersReducedMotion || safeCount === 0) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-[2px] pointer-events-none"
          style={{
            width: p.size,
            height: p.size * p.thin,
            left: `${p.x}%`,
            top: '55%',
            backgroundColor: `hsl(${p.hue}, ${saturation}%, ${lightness + p.lightJitter}%)`,
            willChange: 'transform, opacity',
          }}
          initial={{ opacity: 0, y: 0, x: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, -p.rise],
            x: [0, p.drift],
            rotate: [0, p.rot],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
        />
      ))}
    </div>
  );
});
