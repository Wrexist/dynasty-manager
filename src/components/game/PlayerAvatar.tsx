/**
 * SVG mini-avatar for players on the pitch and detail views.
 * Accepts optional PlayerAppearance for stored appearance data.
 * Falls back to deterministic generation from player ID when no appearance is provided.
 * Features: skin tone diversity, 8 hair styles, height/build variation, jersey with number.
 * Subtle idle bob animation via CSS class.
 */

import { memo } from 'react';
import type { PlayerAppearance } from '@/types/game';
import {
  PLAYER_SKIN_TONES,
  PLAYER_HAIR_STYLES,
  PLAYER_HAIR_COLORS,
  generateAppearanceFromId,
} from '@/config/playerAppearance';

interface PlayerAvatarProps {
  playerId: string;
  jerseyColor: string;
  jerseyNumber?: number;
  size?: number;
  isAway?: boolean;
  appearance?: PlayerAppearance;
}

const ci = (val: number, arr: readonly unknown[]) => Math.max(0, Math.min(val, arr.length - 1));

export const PlayerAvatar = memo(function PlayerAvatar({
  playerId,
  jerseyColor,
  jerseyNumber,
  size = 6,
  isAway = false,
  appearance,
}: PlayerAvatarProps) {
  const app = appearance || generateAppearanceFromId(playerId);

  const skinTone = PLAYER_SKIN_TONES[ci(app.skinTone, PLAYER_SKIN_TONES)];
  const hairColor = PLAYER_HAIR_COLORS[ci(app.hairColor, PLAYER_HAIR_COLORS)];
  const hairStyle = PLAYER_HAIR_STYLES[ci(app.hairStyle, PLAYER_HAIR_STYLES)];

  // Height/build affect proportions subtly
  const heightMod = app.height === 0 ? 0.92 : app.height === 2 ? 1.08 : 1;
  const buildMod = app.build === 0 ? 0.88 : app.build === 2 ? 1.12 : 1;

  const s = size;
  const cx = s / 2;
  const headR = s * 0.20 * heightMod;
  const bodyW = s * 0.34 * buildMod;
  const bodyH = s * 0.28 * heightMod;
  const bodyY = s * 0.44;
  const headCY = s * 0.28;

  // Skin shadow (slightly darker)
  const skinShadow = darken(skinTone, 0.12);

  return (
    <g className={isAway ? undefined : 'player-avatar-idle'}>
      {/* Legs */}
      <line
        x1={cx - s * 0.07} y1={bodyY + bodyH}
        x2={cx - s * 0.09} y2={bodyY + bodyH + s * 0.14}
        stroke={skinTone} strokeWidth={s * 0.045} strokeLinecap="round"
      />
      <line
        x1={cx + s * 0.07} y1={bodyY + bodyH}
        x2={cx + s * 0.09} y2={bodyY + bodyH + s * 0.14}
        stroke={skinTone} strokeWidth={s * 0.045} strokeLinecap="round"
      />

      {/* Boots */}
      <ellipse cx={cx - s * 0.09} cy={bodyY + bodyH + s * 0.16} rx={s * 0.04} ry={s * 0.025} fill="#1a1a1a" />
      <ellipse cx={cx + s * 0.09} cy={bodyY + bodyH + s * 0.16} rx={s * 0.04} ry={s * 0.025} fill="#1a1a1a" />

      {/* Body / Jersey */}
      <rect
        x={cx - bodyW / 2}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={s * 0.06}
        fill={jerseyColor}
        opacity={isAway ? 0.85 : 1}
        stroke={isAway ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)'}
        strokeWidth={s * 0.02}
      />

      {/* Collar detail */}
      <path
        d={`M ${cx - s * 0.06} ${bodyY} Q ${cx} ${bodyY + s * 0.04} ${cx + s * 0.06} ${bodyY}`}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={s * 0.015}
      />

      {/* Jersey number */}
      {jerseyNumber !== undefined && (
        <text
          x={cx}
          y={bodyY + bodyH * 0.62}
          textAnchor="middle"
          fill="white"
          fontSize={s * 0.15}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {jerseyNumber}
        </text>
      )}

      {/* Head */}
      <ellipse
        cx={cx}
        cy={headCY}
        rx={headR * 0.95}
        ry={headR}
        fill={skinTone}
        stroke={skinShadow}
        strokeWidth={s * 0.012}
      />

      {/* Eyes */}
      <circle cx={cx - headR * 0.35} cy={headCY + headR * 0.08} r={headR * 0.12} fill="#1a1a1a" />
      <circle cx={cx + headR * 0.35} cy={headCY + headR * 0.08} r={headR * 0.12} fill="#1a1a1a" />

      {/* Hair */}
      <PlayerHair cx={cx} headCY={headCY} headR={headR} style={hairStyle} color={hairColor} />
    </g>
  );
});

// ── Hair Styles ──
function PlayerHair({ cx, headCY, headR, style, color }: {
  cx: number; headCY: number; headR: number; style: string; color: string;
}) {
  if (style === 'none') return null;

  switch (style) {
    case 'buzz':
      return (
        <path
          d={`M ${cx - headR * 0.8} ${headCY - headR * 0.45}
              Q ${cx} ${headCY - headR * 1.2} ${cx + headR * 0.8} ${headCY - headR * 0.45}`}
          fill={color}
          opacity={0.6}
        />
      );

    case 'short':
      return (
        <path
          d={`M ${cx - headR * 0.85} ${headCY - headR * 0.3}
              Q ${cx} ${headCY - headR * 1.45} ${cx + headR * 0.85} ${headCY - headR * 0.3}`}
          fill={color}
        />
      );

    case 'medium':
      return (
        <>
          <path
            d={`M ${cx - headR * 0.95} ${headCY - headR * 0.2}
                Q ${cx} ${headCY - headR * 1.6} ${cx + headR * 0.95} ${headCY - headR * 0.2}`}
            fill={color}
          />
          {/* Side hair */}
          <rect x={cx - headR * 1.02} y={headCY - headR * 0.4} width={headR * 0.22} height={headR * 0.7} rx={headR * 0.08} fill={color} />
          <rect x={cx + headR * 0.8} y={headCY - headR * 0.4} width={headR * 0.22} height={headR * 0.7} rx={headR * 0.08} fill={color} />
        </>
      );

    case 'curly':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.85} ${headCY - headR * 0.3}
                Q ${cx} ${headCY - headR * 1.5} ${cx + headR * 0.85} ${headCY - headR * 0.3}`}
            fill={color}
          />
          {/* Curl texture */}
          {[-0.55, -0.18, 0.18, 0.55].map((offset) => (
            <circle key={offset} cx={cx + headR * offset} cy={headCY - headR * 1.05} r={headR * 0.18} fill={color} opacity={0.8} />
          ))}
        </g>
      );

    case 'mohawk':
      return (
        <rect
          x={cx - headR * 0.13}
          y={headCY - headR * 1.4}
          width={headR * 0.26}
          height={headR * 0.95}
          rx={headR * 0.08}
          fill={color}
        />
      );

    case 'long':
      return (
        <>
          <path
            d={`M ${cx - headR * 0.95} ${headCY}
                Q ${cx} ${headCY - headR * 1.7} ${cx + headR * 0.95} ${headCY}`}
            fill={color}
          />
          {/* Long sides */}
          <rect x={cx - headR * 1.05} y={headCY - headR * 0.25} width={headR * 0.2} height={headR * 1.2} rx={headR * 0.08} fill={color} />
          <rect x={cx + headR * 0.85} y={headCY - headR * 0.25} width={headR * 0.2} height={headR * 1.2} rx={headR * 0.08} fill={color} />
        </>
      );

    case 'afro':
      return (
        <ellipse
          cx={cx}
          cy={headCY - headR * 0.25}
          rx={headR * 1.3}
          ry={headR * 1.15}
          fill={color}
        />
      );

    default:
      return null;
  }
}

// ── Utility: darken a hex color ──
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - amount)) | 0;
  const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - amount)) | 0;
  const b = Math.max(0, (num & 0xFF) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
