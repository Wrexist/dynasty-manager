import { memo, useId } from 'react';

/**
 * WorldCupTrophyIcon — the tournament trophy drawn after the real thing:
 * a golden globe held aloft by two spiralling figures over a flared base
 * with twin malachite-green bands. Pure SVG, scales with the given class.
 *
 * Deliberately impressionistic (lines, not a photo trace) so it reads at
 * icon sizes while staying unmistakably "the" trophy at hero size.
 */
export const WorldCupTrophyIcon = memo(function WorldCupTrophyIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const gold = `wct-gold-${uid}`;
  const goldDeep = `wct-golddeep-${uid}`;
  const globe = `wct-globe-${uid}`;
  const green = `wct-green-${uid}`;
  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8a6508" />
          <stop offset="28%" stopColor="#e9c25c" />
          <stop offset="50%" stopColor="#fdeaa8" />
          <stop offset="72%" stopColor="#dfae3f" />
          <stop offset="100%" stopColor="#8a6508" />
        </linearGradient>
        <linearGradient id={goldDeep} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6e4f06" />
          <stop offset="50%" stopColor="#c99a2e" />
          <stop offset="100%" stopColor="#6e4f06" />
        </linearGradient>
        <radialGradient id={globe} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="45%" stopColor="#eec75e" />
          <stop offset="80%" stopColor="#b98a1e" />
          <stop offset="100%" stopColor="#8a6508" />
        </radialGradient>
        <linearGradient id={green} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0c3f2a" />
          <stop offset="50%" stopColor="#1d7a50" />
          <stop offset="100%" stopColor="#0c3f2a" />
        </linearGradient>
      </defs>

      {/* Base — flared cone with malachite bands */}
      <path d="M18 92 Q18 84 22 79 L42 79 Q46 84 46 92 Z" fill={`url(#${gold})`} />
      <path d="M17 92.5 L47 92.5 L47 95 L17 95 Z" fill={`url(#${goldDeep})`} />
      <path d="M20.5 82.5 L43.5 82.5 L44.5 86 L19.5 86 Z" fill={`url(#${green})`} />
      <path d="M18.5 88.5 L45.5 88.5 L46 91.5 L18 91.5 Z" fill={`url(#${green})`} />

      {/* Body — twisting column into two figures with raised arms */}
      <path
        d="M24 79
           Q28 68 25 58 Q22 48 27 40 Q30 35 28 30
           Q27 26 30 24 L34 24 Q37 26 36 30
           Q34 35 37 40 Q42 48 39 58 Q36 68 40 79 Z"
        fill={`url(#${gold})`}
      />
      {/* figure arms reaching up to the globe */}
      <path d="M28 30 Q20 24 18 15 Q22 13 26 16 Q30 19 30 24 Z" fill={`url(#${gold})`} />
      <path d="M36 30 Q44 24 46 15 Q42 13 38 16 Q34 19 34 24 Z" fill={`url(#${gold})`} />
      {/* sheen + fold shadows on the body */}
      <path d="M27 40 Q30 35 28 30 Q27 26 30 24 L31.5 24 Q29 28 30 32 Q31 37 28.5 42 Q25 50 27.5 58 Q29.5 68 26.5 79 L24 79 Q28 68 25 58 Q22 48 27 40 Z" fill="#fff6cf" opacity="0.5" />
      <path d="M37 40 Q34 35 36 30 L34.6 33.5 Q33.8 38 36 42 Q39.4 50 37 58 Q35 68 38 79 L40 79 Q36 68 39 58 Q42 48 37 40 Z" fill="#6e4f06" opacity="0.55" />

      {/* Globe with faint continents */}
      <circle cx="32" cy="13.5" r="12" fill={`url(#${globe})`} stroke="#8a6508" strokeWidth="0.6" />
      <path d="M25 9 Q28 6.5 31 8 Q34 9.5 33 12 Q31 14.5 28 13.5 Q25 12.5 25 9 Z" fill="#9a7412" opacity="0.75" />
      <path d="M35 14 Q38.5 13 40 16 Q39.5 19.5 36.5 20.5 Q34 20 34.5 17 Z" fill="#9a7412" opacity="0.7" />
      <path d="M29 17.5 Q31.5 16.5 33 18.5 Q32 21.5 29.5 21 Q28 19.5 29 17.5 Z" fill="#9a7412" opacity="0.6" />
      {/* specular highlight */}
      <ellipse cx="27.5" cy="8.5" rx="4.6" ry="3.2" fill="#fffbe6" opacity="0.55" transform="rotate(-24 27.5 8.5)" />
    </svg>
  );
});
