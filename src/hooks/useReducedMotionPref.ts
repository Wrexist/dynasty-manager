import { useReducedMotion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';

/**
 * The single source of truth for "should this component animate?".
 *
 * framer-motion's `useReducedMotion()` reads ONLY the OS
 * `prefers-reduced-motion` media query (see
 * `node_modules/framer-motion/.../use-reduced-motion.mjs` — it captures
 * `prefersReducedMotion.current` in a `useState` initialiser, so it is neither
 * store-aware nor reactive). A player who enables Reduced Motion in our
 * Settings but not in iOS Settings still got every particle.
 *
 * `MotionConfig reducedMotion="always"` (App.tsx) is not a substitute: it
 * disables *transform* animations but leaves opacity alone, so decorative
 * particle layers still mount and paint — they just never move. Frozen
 * confetti is worse than no confetti. Components must skip rendering the
 * layer, which means asking this hook rather than trusting MotionConfig.
 *
 * Performance mode implies reduced motion (documented behaviour of the
 * setting), so it is OR-ed in here rather than at every call site.
 */
export function useReducedMotionPref(): boolean {
  const osPreference = useReducedMotion();
  const reducedMotion = useGameStore(s => s.settings?.reducedMotion);
  const performanceMode = useGameStore(s => s.settings?.performanceMode);
  return !!osPreference || !!reducedMotion || !!performanceMode;
}
