/**
 * Jersey Badge — professional football shirt representation.
 *
 * Renders a stylized football shirt SVG with rounded sleeves, crew collar,
 * club primary/secondary trim, rating-tier border, and per-size detail
 * tiers. Scales cleanly from 6 SVG units (pitch markers) to 80px hero card.
 */

import { memo, useId } from 'react';
import { darken, lighten } from '@/utils/colorUtils';

interface PlayerAvatarProps {
  jerseyColor: string;
  secondaryColor?: string;
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

/** Perceived luminance (0–1) from a hex color via the Rec. 601 formula. */
function luminance(hex: string): number {
  const num = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(num)) return 0.5;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

export const PlayerAvatar = memo(function PlayerAvatar({
  jerseyColor,
  secondaryColor,
  jerseyNumber,
  size = 6,
  isAway = false,
  overall,
  position,
}: PlayerAvatarProps) {
  const uid = useId().replace(/:/g, '');
  const ratingColor = getRatingHex(overall);

  // Detail tiers keyed to rendered size
  const isLarge = size >= 40;
  const isMedium = size >= 20;

  // ── Kit colors ──
  // Away kit swaps primary/secondary when a secondary is provided, so the
  // away shirt reads as a distinct style rather than just a dimmed version.
  const fallbackSecondary = darken(jerseyColor, 0.55);
  const safeSecondary = secondaryColor ?? fallbackSecondary;
  const primary = isAway && secondaryColor ? safeSecondary : jerseyColor;
  const trim = isAway && secondaryColor ? jerseyColor : safeSecondary;

  const colorLight = lighten(primary, 0.15);
  const colorDark = darken(primary, 0.25);
  const colorDarker = darken(primary, 0.4);

  // Dark text on light kits keeps the jersey number readable.
  const bodyMidLuma = luminance(primary);
  const numberFill = bodyMidLuma > 0.62 ? '#111827' : '#ffffff';
  const numberStroke = bodyMidLuma > 0.62 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)';

  // Number to display
  const num = jerseyNumber != null ? String(jerseyNumber) : '';
  const numFontSize = num.length >= 2 ? 9 : 10.5;

  // Position pill: width scales with label so "CAM"/"CDM" fit comfortably.
  const posText = position ?? '';
  const pillWidth = Math.max(12, posText.length * 2.4 + 5);
  const pillX = 12 - pillWidth / 2;

  const gradientId = `jb-bg-${uid}`;
  const shineId = `jb-sh-${uid}`;

  const ariaLabelParts = [
    num ? `Jersey ${num}` : 'Jersey',
    position,
    isAway ? 'away kit' : null,
  ].filter(Boolean);
  const ariaLabel = ariaLabelParts.join(', ');

  // ── Shirt silhouette ──
  // Sleeves stay strictly inside the 24×28 viewBox so the rating-tier stroke
  // does not clip at the outer edges.
  const shirtPath = [
    'M8 1.5',
    'Q12 3.5 16 1.5',
    'Q18 1 19 1.2',
    'Q21.6 1.6 22.6 4.6',
    'Q23.1 6.7 21.6 8',
    'Q20.2 8 19.5 7',
    'Q19 6 19 5.5',
    'L20.5 26',
    'Q20.5 28 18.5 28',
    'L5.5 28',
    'Q3.5 28 3.5 26',
    'L5 5.5',
    'Q5 6 4.5 7',
    'Q3.8 8 2.4 8',
    'Q0.9 6.7 1.4 4.6',
    'Q2.4 1.6 5 1.2',
    'Q6 1 8 1.5',
    'Z',
  ].join(' ');

  // Shine overlay — mirrors the left half of the new silhouette.
  const shinePath = [
    'M8 1.5',
    'Q6 1 5 1.2',
    'Q2.4 1.6 1.4 4.6',
    'Q0.9 6.7 2.4 8',
    'Q3.8 8 4.5 7',
    'Q5 6 5 5.5',
    'L3.5 26',
    'Q3.5 28 5.5 28',
    'L12 28',
    'L12 1.5',
    'Z',
  ].join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 28"
      role="img"
      aria-label={ariaLabel || undefined}
      style={isLarge ? { filter: `drop-shadow(0 1.5px 3px rgba(0,0,0,0.45))`, opacity: isAway ? 0.9 : 1 } : { opacity: isAway ? 0.85 : 1 }}
    >
      {ariaLabel && <title>{ariaLabel}</title>}

      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={colorDark} />
        </linearGradient>
        {isLarge && (
          <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.14" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {/* Shirt body */}
      <path
        d={shirtPath}
        fill={`url(#${gradientId})`}
        stroke={ratingColor}
        strokeWidth={isLarge ? 0.9 : isMedium ? 0.7 : 0.5}
        strokeLinejoin="round"
      />

      {/* Cuff trim bands (medium+) — thick stroke along the cuff underside
          so the trim is guaranteed to sit on the sleeve, not outside it. */}
      {isMedium && (
        <>
          <path
            d="M19.5 7 Q20.2 8 21.6 8"
            stroke={trim}
            strokeWidth={isLarge ? 1.1 : 0.9}
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          <path
            d="M4.5 7 Q3.8 8 2.4 8"
            stroke={trim}
            strokeWidth={isLarge ? 1.1 : 0.9}
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
        </>
      )}

      {/* Collar — crew neck arc with subtle seam underneath */}
      {isMedium && (
        <>
          <path
            d="M8 1.5 Q12 3.9 16 1.5"
            fill={trim}
            opacity="0.85"
          />
          <path
            d="M8 1.5 Q12 3.9 16 1.5"
            fill="none"
            stroke={colorDarker}
            strokeWidth="0.45"
            strokeLinecap="round"
          />
          {isLarge && (
            <path
              d="M8.6 2.6 Q12 4.3 15.4 2.6"
              fill="none"
              stroke={colorDarker}
              strokeWidth="0.25"
              opacity="0.4"
            />
          )}
        </>
      )}

      {/* Side seam lines (large only) */}
      {isLarge && (
        <>
          <line x1="5" y1="6.5" x2="3.8" y2="26" stroke={colorDarker} strokeWidth="0.25" opacity="0.35" />
          <line x1="19" y1="6.5" x2="20.2" y2="26" stroke={colorDarker} strokeWidth="0.25" opacity="0.35" />
        </>
      )}

      {/* Shine overlay (large sizes) — painted under the number so text stays crisp */}
      {isLarge && (
        <path
          d={shinePath}
          fill={`url(#${shineId})`}
        />
      )}

      {/* Jersey number */}
      {num && (
        <text
          x={12}
          y={16}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={numberFill}
          fontSize={numFontSize}
          fontWeight="bold"
          fontFamily="'Oswald', ui-sans-serif, system-ui, sans-serif"
          stroke={numberStroke}
          strokeWidth="0.3"
          paintOrder="stroke"
        >
          {num}
        </text>
      )}

      {/* Position pill — kept inside the viewBox so it is not clipped */}
      {isMedium && posText && (
        <g>
          <rect
            x={pillX}
            y={0}
            width={pillWidth}
            height={4.4}
            rx={2.2}
            fill="rgba(0,0,0,0.72)"
          />
          <text
            x={12}
            y={2.3}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="3"
            fontWeight="bold"
            fontFamily="'Oswald', ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.2"
          >
            {posText}
          </text>
        </g>
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
