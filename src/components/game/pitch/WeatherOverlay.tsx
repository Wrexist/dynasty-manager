import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { WeatherCondition } from '@/types/game';

// Subtle weather ambience drawn over the pitch. Rain = drifting diagonal
// streaks; snow = slow falling flecks. Purely decorative + pointer-events-none;
// rendered statically (no animation) under reduced-motion / performance mode.

interface WeatherOverlayProps {
  weather?: WeatherCondition;
  /** Particle density multiplier from the quality tier (0..1). */
  density?: number;
  reducedMotion?: boolean;
}

export function WeatherOverlay({ weather, density = 1, reducedMotion }: WeatherOverlayProps) {
  const drops = useMemo(() => {
    if (weather !== 'rain' && weather !== 'snow') return [];
    const base = weather === 'snow' ? 26 : 38;
    const count = Math.round(base * Math.max(0, Math.min(1, density)));
    return Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      dur: weather === 'snow' ? 3.2 + Math.random() * 1.8 : 0.7 + Math.random() * 0.5,
      size: weather === 'snow' ? 2 + Math.random() * 2 : 1,
    }));
  }, [weather, density]);

  if (weather !== 'rain' && weather !== 'snow') return null;

  const tint = weather === 'snow' ? 'rgba(220,235,255,0.05)' : 'rgba(120,150,190,0.07)';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: tint }} />
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
