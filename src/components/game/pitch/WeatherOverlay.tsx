import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { WeatherCondition, PitchCondition } from '@/types/game';

// Subtle weather ambience + pitch-condition wash over the pitch. Rain = drifting
// diagonal streaks; snow = slow falling flecks; a poor/waterlogged surface adds a
// muddy / wet sheen (shown even in clear weather). Purely decorative +
// pointer-events-none; particles are skipped under reduced-motion.

interface WeatherOverlayProps {
  weather?: WeatherCondition;
  pitch?: PitchCondition;
  /** Particle density multiplier from the quality tier (0..1). */
  density?: number;
  reducedMotion?: boolean;
}

export function WeatherOverlay({ weather, pitch, density = 1, reducedMotion }: WeatherOverlayProps) {
  const precip = weather === 'rain' || weather === 'snow';

  const drops = useMemo(() => {
    if (!precip) return [];
    const base = weather === 'snow' ? 26 : 38;
    const count = Math.round(base * Math.max(0, Math.min(1, density)));
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      dur: weather === 'snow' ? 3.2 + Math.random() * 1.8 : 0.7 + Math.random() * 0.5,
      size: weather === 'snow' ? 2 + Math.random() * 2 : 1,
    }));
  }, [precip, weather, density]);

  const weatherTint = weather === 'snow' ? 'rgba(220,235,255,0.05)' : weather === 'rain' ? 'rgba(120,150,190,0.07)' : null;
  const pitchTint = pitch === 'waterlogged' ? 'rgba(18,40,55,0.20)' : pitch === 'poor' ? 'rgba(35,28,12,0.12)' : null;

  if (!precip && !weatherTint && !pitchTint) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pitchTint && <div className="absolute inset-0" style={{ backgroundColor: pitchTint }} />}
      {weatherTint && <div className="absolute inset-0" style={{ backgroundColor: weatherTint }} />}
      {pitch === 'waterlogged' && !reducedMotion && (
        <motion.div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(180,210,235,0.10) 50%, transparent 60%)' }}
          initial={{ x: '-30%' }}
          animate={{ x: '30%' }}
          transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
      )}
      {!reducedMotion && drops.map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.left}%`,
            top: '-8%',
            width: weather === 'snow' ? d.size : 1.2,
            height: weather === 'snow' ? d.size : 12,
            backgroundColor: weather === 'snow' ? 'rgba(255,255,255,0.7)' : 'rgba(200,215,235,0.5)',
          }}
          initial={{ y: '-10%', x: 0, opacity: 0 }}
          animate={{ y: '120%', x: weather === 'snow' ? 12 : 6, opacity: [0, 1, 1, 0] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}
