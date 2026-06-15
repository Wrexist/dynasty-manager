import { motion, useReducedMotion } from 'framer-motion';

/**
 * Rarity aura rendered behind a revealed pack card.
 *
 * The pull's tier drives the treatment, escalating with rarity:
 *   - common / bronze : a soft static halo
 *   - silver          : a pulsing blue glow
 *   - gold            : a stronger gold glow with twinkling sparkles
 *   - legendary       : a dramatic pulsing aura with a full ring of particles
 *
 * Pure decoration — `pointer-events-none`, sits as a sibling *behind* the
 * flipping card (outside its 3D context) so the glow stays put while the
 * card turns. All motion self-disables under the OS reduced-motion setting.
 */
interface AuraSpec {
  /** Halo + edge-glow colour. */
  glow: string;
  haloOpacity: number;
  /** Breathe the halo + ring (rarer pulls feel "alive"). */
  pulse: boolean;
  /** Edge-glow spread in px. */
  ringGlow: number;
  /** Twinkling sparkle count around the card. */
  particles: number;
}

const AURA: Record<string, AuraSpec> = {
  common:    { glow: 'rgba(203,213,225,0.55)', haloOpacity: 0.42, pulse: false, ringGlow: 10, particles: 0 },
  bronze:    { glow: 'rgba(232,162,112,0.60)', haloOpacity: 0.48, pulse: false, ringGlow: 12, particles: 0 },
  silver:    { glow: 'rgba(96,165,250,0.78)',  haloOpacity: 0.62, pulse: true,  ringGlow: 16, particles: 0 },
  gold:      { glow: 'rgba(251,191,36,0.88)',  haloOpacity: 0.74, pulse: true,  ringGlow: 22, particles: 7 },
  legendary: { glow: 'rgba(248,113,113,0.92)', haloOpacity: 0.9,  pulse: true,  ringGlow: 30, particles: 14 },
};

export function PackCardAura({ tierKey }: { tierKey: string }) {
  const reduce = useReducedMotion();
  const spec = AURA[tierKey] ?? AURA.common;
  const breathe = spec.pulse && !reduce;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Radial halo behind the card. The soft gradient falloff stands in for
          a blur, so we can breathe the scale/opacity freely without forcing the
          browser to re-rasterize a `filter: blur()` on every animation frame
          (that was the single biggest pack-opening GPU cost on iOS WebKit). */}
      <motion.div
        className="absolute"
        style={{
          inset: '-24%',
          background: `radial-gradient(closest-side, ${spec.glow} 0%, transparent 68%)`,
        }}
        initial={{ opacity: 0, scale: 0.82 }}
        animate={breathe
          ? { opacity: [spec.haloOpacity * 0.7, spec.haloOpacity, spec.haloOpacity * 0.8], scale: [0.94, 1.06, 0.98] }
          : { opacity: spec.haloOpacity, scale: 1 }}
        transition={breathe
          ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.5, ease: 'easeOut' }}
      />

      {/* Edge glow ring hugging the card silhouette. */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          boxShadow: `0 0 ${spec.ringGlow}px ${spec.glow}, inset 0 0 ${Math.round(spec.ringGlow / 2)}px ${spec.glow}`,
        }}
        initial={{ opacity: 0 }}
        animate={breathe ? { opacity: [0.6, 1, 0.7] } : { opacity: 0.85 }}
        transition={breathe
          ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.4 }}
      />

      {/* Twinkling sparkles ringing the card — gold + legendary only. */}
      {!reduce && spec.particles > 0 && Array.from({ length: spec.particles }).map((_, i) => {
        const angle = (i / spec.particles) * Math.PI * 2;
        const radius = 54 + Math.random() * 16;
        const size = 2 + Math.random() * 2.5;
        const dur = 2 + Math.random() * 2;
        const delay = Math.random() * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: size,
              height: size,
              background: '#fff',
              boxShadow: `0 0 6px ${spec.glow}`,
              x: Math.cos(angle) * radius - size / 2,
              y: Math.sin(angle) * radius * 1.25 - size / 2,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
            transition={{ duration: dur, delay, repeat: Infinity, repeatDelay: 0.4, ease: 'easeInOut' }}
          />
        );
      })}
    </div>
  );
}
