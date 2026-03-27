/**
 * SVG manager avatar with customizable appearance.
 * Uses the same visual system as PlayerAvatar (skin tones, hair styles/colors)
 * but renders a suit/blazer instead of a jersey.
 */

import type { ManagerAppearance } from '@/types/game';
import { cn } from '@/lib/utils';
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLES } from '@/config/managerAppearance';

interface ManagerAvatarProps {
  appearance: ManagerAppearance;
  size?: number;
  className?: string;
}

export function ManagerAvatar({ appearance, size = 120, className }: ManagerAvatarProps) {
  const skinTone = SKIN_TONES[Math.max(0, Math.min(appearance.skinTone, SKIN_TONES.length - 1))];
  const hairColor = HAIR_COLORS[Math.max(0, Math.min(appearance.hairColor, HAIR_COLORS.length - 1))];
  const hairStyle = HAIR_STYLES[Math.max(0, Math.min(appearance.hairStyle, HAIR_STYLES.length - 1))];
  const suitColor = appearance.suitColor || '#1a1a2e';

  // All coordinates in a 100x100 viewBox
  const cx = 50;
  const headY = 30;
  const headR = 14;
  const bodyY = 48;
  const bodyW = 36;
  const bodyH = 30;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('select-none', className)}
    >
      {/* Legs */}
      <line x1={cx - 6} y1={bodyY + bodyH} x2={cx - 8} y2={bodyY + bodyH + 12} stroke={skinTone} strokeWidth={4} strokeLinecap="round" />
      <line x1={cx + 6} y1={bodyY + bodyH} x2={cx + 8} y2={bodyY + bodyH + 12} stroke={skinTone} strokeWidth={4} strokeLinecap="round" />

      {/* Shoes */}
      <ellipse cx={cx - 8} cy={bodyY + bodyH + 14} rx={4} ry={2.5} fill="#111" />
      <ellipse cx={cx + 8} cy={bodyY + bodyH + 14} rx={4} ry={2.5} fill="#111" />

      {/* Suit body */}
      <rect
        x={cx - bodyW / 2}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={4}
        fill={suitColor}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />

      {/* Suit lapels */}
      <path
        d={`M ${cx - 3} ${bodyY} L ${cx - 10} ${bodyY + 14} L ${cx - 3} ${bodyY + 14} Z`}
        fill="rgba(255,255,255,0.06)"
      />
      <path
        d={`M ${cx + 3} ${bodyY} L ${cx + 10} ${bodyY + 14} L ${cx + 3} ${bodyY + 14} Z`}
        fill="rgba(255,255,255,0.06)"
      />

      {/* Shirt collar */}
      <path
        d={`M ${cx - 6} ${bodyY} L ${cx} ${bodyY + 6} L ${cx + 6} ${bodyY}`}
        fill="none"
        stroke="#e8e8e8"
        strokeWidth="1.2"
      />

      {/* Tie */}
      <path
        d={`M ${cx} ${bodyY + 5} L ${cx - 2.5} ${bodyY + 10} L ${cx} ${bodyY + 22} L ${cx + 2.5} ${bodyY + 10} Z`}
        fill="hsl(43, 96%, 46%)"
        opacity={0.85}
      />

      {/* Neck */}
      <rect x={cx - 4} y={bodyY - 5} width={8} height={7} rx={3} fill={skinTone} />

      {/* Head */}
      <circle cx={cx} cy={headY} r={headR} fill={skinTone} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />

      {/* Eyes */}
      <circle cx={cx - 4.5} cy={headY + 1} r={1.2} fill="#1a1a1a" />
      <circle cx={cx + 4.5} cy={headY + 1} r={1.2} fill="#1a1a1a" />

      {/* Subtle mouth */}
      <path
        d={`M ${cx - 3} ${headY + 5.5} Q ${cx} ${headY + 7.5} ${cx + 3} ${headY + 5.5}`}
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* Hair */}
      {hairStyle === 'short' && (
        <path
          d={`M ${cx - headR * 0.9} ${headY - headR * 0.3} Q ${cx} ${headY - headR * 1.5} ${cx + headR * 0.9} ${headY - headR * 0.3}`}
          fill={hairColor}
        />
      )}
      {hairStyle === 'medium' && (
        <>
          <path
            d={`M ${cx - headR} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.7} ${cx + headR} ${headY - headR * 0.2}`}
            fill={hairColor}
          />
          <rect x={cx - headR * 1.05} y={headY - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={hairColor} />
          <rect x={cx + headR * 0.75} y={headY - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={hairColor} />
        </>
      )}
      {hairStyle === 'mohawk' && (
        <rect
          x={cx - headR * 0.15}
          y={headY - headR * 1.4}
          width={headR * 0.3}
          height={headR * 1.0}
          rx={headR * 0.1}
          fill={hairColor}
        />
      )}
      {hairStyle === 'buzz' && (
        <path
          d={`M ${cx - headR * 0.8} ${headY - headR * 0.5} Q ${cx} ${headY - headR * 1.2} ${cx + headR * 0.8} ${headY - headR * 0.5}`}
          fill={hairColor}
          opacity={0.6}
        />
      )}
      {hairStyle === 'long' && (
        <>
          <path
            d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.8} ${cx + headR} ${headY}`}
            fill={hairColor}
          />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.3} width={headR * 0.25} height={headR * 1.3} rx={headR * 0.1} fill={hairColor} />
          <rect x={cx + headR * 0.85} y={headY - headR * 0.3} width={headR * 0.25} height={headR * 1.3} rx={headR * 0.1} fill={hairColor} />
        </>
      )}
    </svg>
  );
}
