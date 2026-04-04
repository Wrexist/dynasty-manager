/**
 * Manager Emblem Badge — customizable shield/circle emblem.
 *
 * Renders a stylized badge with the manager's initials, chosen shape,
 * pattern, accent ring, and icon. Used in creation wizard and profile.
 */

import { useId } from 'react';
import type { ManagerAppearance } from '@/types/game';
import { cn } from '@/lib/utils';
import {
  BADGE_SHAPES,
  BADGE_PATTERNS,
  BADGE_ICONS,
} from '@/config/managerAppearance';
import { darken, lighten } from '@/utils/colorUtils';

interface ManagerAvatarProps {
  appearance: ManagerAppearance;
  size?: number;
  className?: string;
  initials?: string;
}

/** Check if appearance uses legacy format (pre-emblem) */
function isLegacy(a: ManagerAppearance): boolean {
  return a.badgeShape == null && a.skinTone != null;
}

/** Convert legacy appearance to new defaults */
function normalize(a: ManagerAppearance): ManagerAppearance {
  if (!isLegacy(a)) return a;
  return {
    ...a,
    badgeShape: 1,  // shield
    backgroundColor: a.outfitColor || '#1a1a2e',
    accentColor: a.tieColor || '#10b981',
    pattern: 0,     // solid
    icon: 0,        // suit
  };
}

/** Shape paths for a 100x100 viewBox */
function getShapePath(shapeIndex: number): string {
  const shape = BADGE_SHAPES[Math.max(0, Math.min(shapeIndex, BADGE_SHAPES.length - 1))];
  switch (shape.id) {
    case 'circle':
      return 'M50 5 A45 45 0 1 1 50 95 A45 45 0 1 1 50 5 Z';
    case 'shield':
      return 'M50 5 L90 20 L90 55 Q90 80 50 95 Q10 80 10 55 L10 20 Z';
    case 'hexagon':
      return 'M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z';
    case 'diamond':
      return 'M50 5 L90 50 L50 95 L10 50 Z';
    default:
      return 'M50 5 L90 20 L90 55 Q90 80 50 95 Q10 80 10 55 L10 20 Z';
  }
}

/** Pattern overlay paths */
function renderPattern(patternIndex: number, color: string) {
  const pat = BADGE_PATTERNS[Math.max(0, Math.min(patternIndex, BADGE_PATTERNS.length - 1))];
  const c = lighten(color, 0.15);
  switch (pat.id) {
    case 'striped':
      return (
        <g opacity="0.15">
          <line x1="30" y1="0" x2="30" y2="100" stroke={c} strokeWidth="6" />
          <line x1="50" y1="0" x2="50" y2="100" stroke={c} strokeWidth="6" />
          <line x1="70" y1="0" x2="70" y2="100" stroke={c} strokeWidth="6" />
        </g>
      );
    case 'split':
      return (
        <rect x="50" y="0" width="50" height="100" fill={c} opacity="0.12" />
      );
    case 'chevron':
      return (
        <g opacity="0.15">
          <path d="M10 60 L50 40 L90 60" fill="none" stroke={c} strokeWidth="6" />
          <path d="M10 75 L50 55 L90 75" fill="none" stroke={c} strokeWidth="6" />
        </g>
      );
    default: // solid
      return null;
  }
}

/** Small icon at bottom of badge */
function renderIcon(iconIndex: number, color: string, isSmall: boolean) {
  if (isSmall) return null;
  const ico = BADGE_ICONS[Math.max(0, Math.min(iconIndex, BADGE_ICONS.length - 1))];
  const y = 72;
  const x = 50;
  const c = lighten(color, 0.3);
  switch (ico.id) {
    case 'suit':
      return <path d={`M${x - 4} ${y} L${x} ${y + 6} L${x + 4} ${y} M${x} ${y} L${x} ${y + 8}`} fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" />;
    case 'tracksuit':
      return <path d={`M${x - 5} ${y} L${x - 2} ${y + 8} M${x + 5} ${y} L${x + 2} ${y + 8} M${x - 4} ${y + 2} L${x + 4} ${y + 2}`} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" />;
    case 'whistle':
      return <circle cx={x} cy={y + 4} r="3.5" fill="none" stroke={c} strokeWidth="1.8" />;
    case 'clipboard':
      return (
        <g>
          <rect x={x - 4} y={y} width="8" height="10" rx="1" fill="none" stroke={c} strokeWidth="1.5" />
          <line x1={x - 2} y1={y + 3} x2={x + 2} y2={y + 3} stroke={c} strokeWidth="1" />
          <line x1={x - 2} y1={y + 6} x2={x + 2} y2={y + 6} stroke={c} strokeWidth="1" />
        </g>
      );
    case 'trophy':
      return (
        <g>
          <path d={`M${x - 3} ${y} L${x - 2} ${y + 5} L${x + 2} ${y + 5} L${x + 3} ${y}`} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
          <line x1={x} y1={y + 5} x2={x} y2={y + 8} stroke={c} strokeWidth="1.5" />
          <line x1={x - 3} y1={y + 8} x2={x + 3} y2={y + 8} stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

export function ManagerAvatar({ appearance, size = 120, className, initials }: ManagerAvatarProps) {
  const reactUid = useId().replace(/:/g, '');
  const app = normalize(appearance);

  const bgColor = app.backgroundColor || '#1a1a2e';
  const accentColor = app.accentColor || '#10b981';
  const bgLight = lighten(bgColor, 0.12);
  const bgDark = darken(bgColor, 0.2);

  const uid = `me-${reactUid}`;
  const shapePath = getShapePath(app.badgeShape ?? 1);
  const isSmall = size < 40;
  const isTiny = size < 28;

  // Display initials — fallback to "M" if not provided
  const display = initials || 'M';
  const fontSize = display.length > 2 ? 22 : display.length === 2 ? 26 : 32;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('select-none', className)}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bgLight} />
          <stop offset="100%" stopColor={bgDark} />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={shapePath} />
        </clipPath>
      </defs>

      {/* Outer glow */}
      {!isTiny && (
        <path
          d={shapePath}
          fill="none"
          stroke={accentColor}
          strokeWidth="1.5"
          opacity="0.3"
          transform="scale(1.03) translate(-1.5, -1.5)"
        />
      )}

      {/* Badge background */}
      <path
        d={shapePath}
        fill={`url(#${uid}-bg)`}
        stroke={accentColor}
        strokeWidth={isSmall ? 3 : 4}
      />

      {/* Pattern overlay (clipped to shape) */}
      <g clipPath={`url(#${uid}-clip)`}>
        {renderPattern(app.pattern ?? 0, bgColor)}
      </g>

      {/* Initials */}
      <text
        x="50"
        y={isSmall ? 52 : 48}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={accentColor}
        fontSize={isTiny ? 34 : fontSize}
        fontWeight="bold"
        fontFamily="'Oswald', sans-serif"
        letterSpacing="2"
      >
        {display}
      </text>

      {/* Icon below initials */}
      {renderIcon(app.icon ?? 0, accentColor, isSmall)}

      {/* Subtle top shine */}
      {!isSmall && (
        <g clipPath={`url(#${uid}-clip)`}>
          <ellipse cx="50" cy="15" rx="35" ry="20" fill="white" opacity="0.06" />
        </g>
      )}
    </svg>
  );
}
