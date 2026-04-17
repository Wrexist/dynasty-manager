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
  if (ovr >= 70) return '#38bdf8';   // sky/good
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

  // Football shirt path — rounded shoulders and fuller short sleeves via bezier curves.
  // Traversed clockwise from left neck: neckline, right shoulder cap, right sleeve,
  // armpit, right torso, rounded hem, left torso, left sleeve (mirror), close.
  const shirtPath = [
    'M8 1.5',              // left side of neck
    'Q12 3.5 16 1.5',      // curved crew-neck
    'Q18 1 19 1.2',        // right shoulder ridge
    'Q22 1.6 23 4.5',      // rounded shoulder out to sleeve
    'Q23.6 6.8 22 8',      // outer sleeve bulge
    'Q20.4 8 19.5 7',      // sleeve cuff underside
    'Q19 6 19 5.5',        // armpit curve
    'L20.5 26',            // right body side
    'Q20.5 28 18.5 28',    // rounded right hip
    'L5.5 28',             // bottom hem
    'Q3.5 28 3.5 26',      // rounded left hip
    'L5 5.5',              // left body side
    'Q5 6 4.5 7',          // left armpit
    'Q3.6 8 2 8',          // left sleeve cuff underside
    'Q0.4 6.8 1 4.5',      // outer sleeve bulge (left)
    'Q2 1.6 5 1.2',        // rounded shoulder in (left)
    'Q6 1 8 1.5',          // left shoulder ridge to neck
    'Z'
  ].join(' ');

  // Shine overlay path — follows the left half of the new silhouette.
  const shinePath = [
    'M8 1.5',
    'Q6 1 5 1.2',
    'Q2 1.6 1 4.5',
    'Q0.4 6.8 2 8',
    'Q3.6 8 4.5 7',
    'Q5 6 5 5.5',
    'L3.5 26',
    'Q3.5 28 5.5 28',
    'L12 28',
    'L12 1.5',
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
            d="M8 1.5 Q12 4 16 1.5"
            fill="none"
            stroke={colorDarker}
            strokeWidth="0.7"
            strokeLinecap="round"
          />
          {/* Collar fill */}
          <path
            d="M8 1.5 Q12 3.7 16 1.5"
            fill={colorDarker}
            opacity="0.4"
          />
        </>
      )}

      {/* Sleeve cuff lines (medium+) */}
      {isMedium && (
        <>
          <line x1="22" y1="7.5" x2="20" y2="8" stroke={colorDarker} strokeWidth="0.5" strokeLinecap="round" />
          <line x1="2" y1="7.5" x2="4" y2="8" stroke={colorDarker} strokeWidth="0.5" strokeLinecap="round" />
        </>
      )}

      {/* Side seam lines (large only) */}
      {isLarge && (
        <>
          <line x1="5" y1="6.5" x2="3.8" y2="26" stroke={colorDarker} strokeWidth="0.3" opacity="0.3" />
          <line x1="19" y1="6.5" x2="20.2" y2="26" stroke={colorDarker} strokeWidth="0.3" opacity="0.3" />
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
