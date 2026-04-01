/**
 * Jersey Badge — professional football shirt representation.
 *
 * Renders a stylized football shirt SVG with proper sleeves, collar,
 * club color, and rating-tier border. Scales from tiny pitch markers
 * (6 SVG units) to medium detail views (52px).
 */

import { memo, useId } from 'react';
import { darken, lighten } from '@/utils/colorUtils';

interface PlayerAvatarProps {
  playerId?: string;
  jerseyColor: string;
  jerseyNumber?: number;
  size?: number;
  isAway?: boolean;
  overall?: number;
  position?: string;
}

/** Rating tier hex colors matching the design system */
function getRatingHex(ovr: number | undefined): string {
  if (ovr == null) return '#6b7280'; // muted gray
  if (ovr >= 80) return '#34d399';   // emerald
  if (ovr >= 70) return '#D4A843';   // gold/primary
  if (ovr >= 60) return '#fbbf24';   // amber
  return '#6b7280';                   // muted
}

export const PlayerAvatar = memo(function PlayerAvatar({
  jerseyColor,
  jerseyNumber,
  size = 6,
  isAway = false,
  overall,
  position,
}: PlayerAvatarProps) {
  const uid = useId().replace(/:/g, '');
  const ratingColor = getRatingHex(overall);
  const opacity = isAway ? 0.75 : 1;

  // Determine detail level based on size
  const isLarge = size >= 40;
  const isMedium = size >= 20;

  // Football shirt in a 24x28 viewBox
  const vw = 24;
  const vh = 28;

  const colorLight = lighten(jerseyColor, 0.15);
  const colorDark = darken(jerseyColor, 0.25);
  const colorDarker = darken(jerseyColor, 0.4);

  // Number to display
  const num = jerseyNumber != null ? jerseyNumber : '';
  const numFontSize = String(num).length >= 2 ? 9 : 10.5;

  const gradientId = `jb-bg-${uid}`;
  const shineId = `jb-sh-${uid}`;

  // Football shirt path with proper sleeves
  // Starts at left neck, goes right along neckline, right shoulder out to sleeve,
  // sleeve hem, armpit, right side body, hem, left side body, left armpit,
  // left sleeve hem, left shoulder back to neck
  const shirtPath = [
    'M8.5 1',              // left side of neck
    'Q12 2.5 15.5 1',     // curved neckline to right side
    'L19 0',               // right shoulder
    'L23 5.5',             // right sleeve outer edge
    'L21.5 7',             // right sleeve cuff
    'L19 5',               // right armpit
    'L20 26',              // right body
    'Q20 28 18 28',        // right hem curve
    'L6 28',               // bottom hem
    'Q4 28 4 26',          // left hem curve
    'L5 5',                // left body
    'L2.5 7',              // left armpit
    'L1 5.5',              // left sleeve cuff
    'L5 0',                // left shoulder
    'Z'
  ].join(' ');

  // Shine overlay path (left side of shirt for lighting effect)
  const shinePath = [
    'M8.5 1',
    'L5 0',
    'L1 5.5',
    'L2.5 7',
    'L5 5',
    'L4 26',
    'Q4 28 6 28',
    'L12 28',
    'L12 1',
    'Z'
  ].join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vw} ${vh}`}
      opacity={opacity}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={colorDark} />
        </linearGradient>
        {isLarge && (
          <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {/* Football shirt body with sleeves */}
      <path
        d={shirtPath}
        fill={`url(#${gradientId})`}
        stroke={ratingColor}
        strokeWidth={isLarge ? 1.0 : isMedium ? 0.8 : 0.6}
        strokeLinejoin="round"
      />

      {/* Collar detail (medium+) — crew neck arc */}
      {isMedium && (
        <>
          <path
            d="M8.5 1 Q12 3.5 15.5 1"
            fill="none"
            stroke={colorDarker}
            strokeWidth="0.7"
            strokeLinecap="round"
          />
          {/* Collar fill */}
          <path
            d="M8.5 1 Q12 3.2 15.5 1"
            fill={colorDarker}
            opacity="0.4"
          />
        </>
      )}

      {/* Sleeve cuff lines (medium+) */}
      {isMedium && (
        <>
          <line x1="22.8" y1="5.8" x2="21.2" y2="7.2" stroke={colorDarker} strokeWidth="0.5" strokeLinecap="round" />
          <line x1="1.2" y1="5.8" x2="2.8" y2="7.2" stroke={colorDarker} strokeWidth="0.5" strokeLinecap="round" />
        </>
      )}

      {/* Side seam lines (large only) */}
      {isLarge && (
        <>
          <line x1="5.2" y1="6" x2="4.3" y2="26" stroke={colorDarker} strokeWidth="0.3" opacity="0.3" />
          <line x1="18.8" y1="6" x2="19.7" y2="26" stroke={colorDarker} strokeWidth="0.3" opacity="0.3" />
        </>
      )}

      {/* Jersey number */}
      <text
        x={vw / 2}
        y={vh / 2 + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={numFontSize}
        fontWeight="bold"
        fontFamily="monospace"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="0.3"
      >
        {num}
      </text>

      {/* Position pill at top (medium+ sizes) */}
      {isMedium && position && (
        <g>
          <rect
            x={vw / 2 - 6}
            y={-1}
            width={12}
            height={5}
            rx={2.5}
            fill="rgba(0,0,0,0.6)"
          />
          <text
            x={vw / 2}
            y={2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="3.2"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {position}
          </text>
        </g>
      )}

      {/* Subtle shine overlay (large sizes) */}
      {isLarge && (
        <path
          d={shinePath}
          fill={`url(#${shineId})`}
        />
      )}
    </svg>
  );
});

/* ------------------------------------------------------------------ */
/*  Professional Referee Card Icons                                    */
/* ------------------------------------------------------------------ */

interface CardIconProps {
  size?: number;
  className?: string;
}

/** Professional yellow card SVG — referee-style portrait card */
export function YellowCardIcon({ size = 14, className }: CardIconProps) {
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 10 13.5"
      className={className}
      aria-label="Yellow card"
    >
      <defs>
        <linearGradient id="yc-grad" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFCC00" />
          <stop offset="100%" stopColor="#E6A800" />
        </linearGradient>
      </defs>
      {/* Card shadow */}
      <rect x="0.8" y="0.8" width="8.5" height="12" rx="0.8" fill="rgba(0,0,0,0.25)" />
      {/* Card body */}
      <rect x="0.3" y="0.3" width="8.5" height="12" rx="0.8" fill="url(#yc-grad)" stroke="#CC9900" strokeWidth="0.3" />
      {/* Shine highlight */}
      <rect x="1" y="0.8" width="3" height="5" rx="0.5" fill="white" opacity="0.15" />
    </svg>
  );
}

/** Professional red card SVG — referee-style portrait card */
export function RedCardIcon({ size = 14, className }: CardIconProps) {
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 10 13.5"
      className={className}
      aria-label="Red card"
    >
      <defs>
        <linearGradient id="rc-grad" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#FF3333" />
          <stop offset="50%" stopColor="#EE0000" />
          <stop offset="100%" stopColor="#CC0000" />
        </linearGradient>
      </defs>
      {/* Card shadow */}
      <rect x="0.8" y="0.8" width="8.5" height="12" rx="0.8" fill="rgba(0,0,0,0.25)" />
      {/* Card body */}
      <rect x="0.3" y="0.3" width="8.5" height="12" rx="0.8" fill="url(#rc-grad)" stroke="#990000" strokeWidth="0.3" />
      {/* Shine highlight */}
      <rect x="1" y="0.8" width="3" height="5" rx="0.5" fill="white" opacity="0.12" />
    </svg>
  );
}
