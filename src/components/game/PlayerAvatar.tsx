/**
 * Jersey Number Badge — clean, iconic player representation.
 *
 * Renders a stylized jersey-shaped badge with the player's number,
 * club color, and rating-tier border. Scales from tiny pitch markers
 * (6 SVG units) to medium detail views (52px).
 */

import { memo, useId } from 'react';
import type { PlayerAppearance } from '@/types/game';

export type AvatarPose = 'standing' | 'gk' | 'running';

interface PlayerAvatarProps {
  playerId: string;
  jerseyColor: string;
  jerseyNumber?: number;
  size?: number;
  isAway?: boolean;
  appearance?: PlayerAppearance;
  pose?: AvatarPose;
  animationDelay?: number;
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

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - amount)) | 0;
  const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - amount)) | 0;
  const b = Math.max(0, (num & 0xFF) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + (255 - ((num >> 16) & 0xFF)) * amount) | 0;
  const g = Math.min(255, ((num >> 8) & 0xFF) + (255 - ((num >> 8) & 0xFF)) * amount) | 0;
  const b = Math.min(255, (num & 0xFF) + (255 - (num & 0xFF)) * amount) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
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

  // Jersey shape in a 24x28 viewBox
  const vw = 24;
  const vh = 28;

  const colorLight = lighten(jerseyColor, 0.15);
  const colorDark = darken(jerseyColor, 0.25);

  // Number to display
  const num = jerseyNumber != null ? jerseyNumber : '';
  const numFontSize = String(num).length >= 2 ? 9.5 : 11;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vw} ${vh}`}
      opacity={opacity}
    >
      <defs>
        <linearGradient id={`jb-bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={colorDark} />
        </linearGradient>
      </defs>

      {/* Jersey body shape — slight taper at bottom with rounded shoulders */}
      <path
        d={`M4 2 Q4 0 6 0 L18 0 Q20 0 20 2 L21 10 L20 10 L20 26 Q20 28 18 28 L6 28 Q4 28 4 26 L4 10 L3 10 Z`}
        fill={`url(#jb-bg-${uid})`}
        stroke={ratingColor}
        strokeWidth={isLarge ? 1.2 : 0.8}
      />

      {/* Collar detail (medium+) */}
      {isMedium && (
        <path
          d="M9 0 L12 3 L15 0"
          fill="none"
          stroke={darken(jerseyColor, 0.4)}
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      )}

      {/* Jersey number */}
      <text
        x={vw / 2}
        y={vh / 2 + (isMedium ? 1.5 : 1)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={numFontSize}
        fontWeight="bold"
        fontFamily="monospace"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
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
          d="M4 2 Q4 0 6 0 L12 0 L10 14 L4 10 L3 10 Z"
          fill="white"
          opacity="0.08"
        />
      )}
    </svg>
  );
});
