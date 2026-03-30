/**
 * Enhanced SVG mini-avatar for players on the pitch and detail views.
 *
 * Features:
 * - Natural body silhouette with bezier curves (trapezoidal torso, shaped limbs)
 * - Full kit: jersey with collar variants, shorts, socks, shaped boots
 * - Rich facial features: eyebrows, ears, nose, facial hair (5 types)
 * - 12 hair styles with gradient depth
 * - Accessories: headband, wristband, captain armband, GK gloves
 * - Multi-stop gradients for premium lighting/shading
 * - Level-of-detail (LOD) system based on render size
 * - Position-specific poses (standing, GK, running)
 * - Soft ground shadow via shared filter
 */

import { memo } from 'react';
import type { PlayerAppearance } from '@/types/game';
import {
  PLAYER_SKIN_TONES,
  PLAYER_HAIR_STYLES,
  PLAYER_HAIR_COLORS,
  PLAYER_FACIAL_HAIR,
  PLAYER_ACCESSORIES,
  PLAYER_BOOT_COLORS,
  generateAppearanceFromId,
} from '@/config/playerAppearance';

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
}

const ci = (val: number, arr: readonly unknown[]) => Math.max(0, Math.min(val, arr.length - 1));

export const PlayerAvatar = memo(function PlayerAvatar({
  playerId,
  jerseyColor,
  jerseyNumber,
  size = 6,
  isAway = false,
  appearance,
  pose = 'standing',
  animationDelay,
}: PlayerAvatarProps) {
  const app = appearance || generateAppearanceFromId(playerId);
  const seed = hashString(playerId);

  const skinTone = PLAYER_SKIN_TONES[ci(app.skinTone, PLAYER_SKIN_TONES)];
  const hairColor = PLAYER_HAIR_COLORS[ci(app.hairColor, PLAYER_HAIR_COLORS)];
  const hairStyle = PLAYER_HAIR_STYLES[ci(app.hairStyle, PLAYER_HAIR_STYLES)];
  const facialHairStyle = PLAYER_FACIAL_HAIR[ci(app.facialHair ?? 0, PLAYER_FACIAL_HAIR)];
  const accessory = PLAYER_ACCESSORIES[ci(app.accessory ?? 0, PLAYER_ACCESSORIES)];
  const bootColor = PLAYER_BOOT_COLORS[ci(app.bootColor ?? 0, PLAYER_BOOT_COLORS)];

  const jerseyDark = darken(jerseyColor, 0.22);
  const jerseyMid = darken(jerseyColor, 0.08);
  const jerseyLight = lighten(jerseyColor, 0.18);
  const sleeveTrim = lighten(jerseyColor, 0.28);
  const skinHighlight = lighten(skinTone, 0.12);
  const skinShadow = darken(skinTone, 0.15);

  // Collar type derived from seed
  const collarType = seed % 3; // 0=v-neck, 1=crew, 2=collar

  // Height/build proportions
  const heightMod = app.height === 0 ? 0.92 : app.height === 2 ? 1.08 : 1;
  const buildMod = app.build === 0 ? 0.88 : app.build === 2 ? 1.12 : 1;

  const s = size;
  const cx = s / 2;
  const headR = s * 0.19 * heightMod;
  const bodyW = s * 0.32 * buildMod;
  const bodyH = s * 0.24 * heightMod;
  const bodyY = s * 0.42;
  const headCY = s * 0.27;
  const shortsH = s * 0.08;
  const legLen = s * 0.14 * heightMod;
  const gradId = `pa-${playerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16)}`;

  // LOD threshold — skip fine details at small sizes
  const medDetail = size >= 8;

  // Pose adjustments
  const isGK = pose === 'gk';
  const isRunning = pose === 'running';
  const legSpread = isGK ? s * 0.13 : isRunning ? s * 0.10 : s * 0.07;
  const armRaise = isGK ? -0.2 : 0;

  // Leg positions for different poses
  const leftLegX = cx - legSpread;
  const rightLegX = cx + legSpread;
  const leftLegEndX = isRunning ? cx - legSpread - s * 0.03 : cx - legSpread - s * 0.02;
  const rightLegEndX = isRunning ? cx + legSpread + s * 0.03 : cx + legSpread + s * 0.02;
  const leftLegEndY = bodyY + bodyH + shortsH + legLen;
  const rightLegEndY = bodyY + bodyH + shortsH + legLen;

  // Arm endpoints
  const armStartY = bodyY + s * 0.03;
  const leftArmEndX = cx - bodyW * 0.58;
  const rightArmEndX = cx + bodyW * 0.58;
  const leftArmEndY = isRunning
    ? bodyY + bodyH * 0.3
    : bodyY + bodyH * (0.75 + armRaise);
  const rightArmEndY = isRunning
    ? bodyY + bodyH * 0.9
    : bodyY + bodyH * (0.75 + armRaise);

  const animStyle = animationDelay !== undefined
    ? { animationDelay: `${animationDelay}ms` }
    : undefined;

  return (
    <g
      className={isAway ? undefined : 'player-avatar-idle'}
      style={animStyle}
    >
      <defs>
        {/* Jersey gradient - 3-stop */}
        <linearGradient id={`${gradId}-j`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={jerseyLight} />
          <stop offset="45%" stopColor={jerseyMid} />
          <stop offset="100%" stopColor={jerseyDark} />
        </linearGradient>
        {/* Skin radial - highlight/midtone/shadow */}
        <radialGradient id={`${gradId}-s`} cx="38%" cy="28%" r="68%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="60%" stopColor={skinTone} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        {/* Shorts gradient */}
        <linearGradient id={`${gradId}-sh`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={darken(jerseyColor, 0.35)} />
          <stop offset="100%" stopColor={darken(jerseyColor, 0.5)} />
        </linearGradient>
      </defs>

      {/* Ground shadow (uses shared filter from AvatarDefs) */}
      <ellipse
        cx={cx}
        cy={leftLegEndY + s * 0.03}
        rx={s * 0.20}
        ry={s * 0.04}
        fill="rgba(0,0,0,0.22)"
        filter="url(#avatar-shadow)"
      />

      {/* === LEGS (thigh + calf with taper) === */}
      {/* Left leg */}
      <line
        x1={leftLegX} y1={bodyY + bodyH + shortsH * 0.3}
        x2={leftLegEndX} y2={leftLegEndY}
        stroke={skinTone} strokeWidth={s * 0.05} strokeLinecap="round"
      />
      {/* Right leg */}
      <line
        x1={rightLegX} y1={bodyY + bodyH + shortsH * 0.3}
        x2={rightLegEndX} y2={rightLegEndY}
        stroke={skinTone} strokeWidth={s * 0.05} strokeLinecap="round"
      />

      {/* === SOCKS === */}
      {medDetail && (
        <>
          <line
            x1={leftLegEndX} y1={leftLegEndY - s * 0.04}
            x2={leftLegEndX} y2={leftLegEndY}
            stroke="white" strokeWidth={s * 0.055} strokeLinecap="round"
            opacity={0.7}
          />
          <line
            x1={rightLegEndX} y1={rightLegEndY - s * 0.04}
            x2={rightLegEndX} y2={rightLegEndY}
            stroke="white" strokeWidth={s * 0.055} strokeLinecap="round"
            opacity={0.7}
          />
        </>
      )}

      {/* === BOOTS (shoe shapes) === */}
      <ellipse
        cx={leftLegEndX + s * 0.01}
        cy={leftLegEndY + s * 0.015}
        rx={s * 0.045}
        ry={s * 0.022}
        fill={bootColor}
      />
      <ellipse
        cx={rightLegEndX + s * 0.01}
        cy={rightLegEndY + s * 0.015}
        rx={s * 0.045}
        ry={s * 0.022}
        fill={bootColor}
      />

      {/* === ARMS (curved with hands) === */}
      {/* Left arm */}
      <path
        d={`M ${cx - bodyW * 0.45} ${armStartY}
            Q ${cx - bodyW * 0.55} ${(armStartY + leftArmEndY) / 2 + s * 0.02}
              ${leftArmEndX} ${leftArmEndY}`}
        fill="none"
        stroke={skinTone}
        strokeWidth={s * 0.04}
        strokeLinecap="round"
      />
      {/* Right arm */}
      <path
        d={`M ${cx + bodyW * 0.45} ${armStartY}
            Q ${cx + bodyW * 0.55} ${(armStartY + rightArmEndY) / 2 + s * 0.02}
              ${rightArmEndX} ${rightArmEndY}`}
        fill="none"
        stroke={skinTone}
        strokeWidth={s * 0.04}
        strokeLinecap="round"
      />

      {/* Hands */}
      <circle
        cx={leftArmEndX} cy={leftArmEndY}
        r={s * 0.022}
        fill={isGK ? '#66BB6A' : skinTone}
      />
      <circle
        cx={rightArmEndX} cy={rightArmEndY}
        r={s * 0.022}
        fill={isGK ? '#66BB6A' : skinTone}
      />

      {/* === BODY / JERSEY (shaped torso) === */}
      <path
        d={`M ${cx - bodyW * 0.48} ${bodyY}
            Q ${cx - bodyW * 0.52} ${bodyY + bodyH * 0.5} ${cx - bodyW * 0.38} ${bodyY + bodyH}
            L ${cx + bodyW * 0.38} ${bodyY + bodyH}
            Q ${cx + bodyW * 0.52} ${bodyY + bodyH * 0.5} ${cx + bodyW * 0.48} ${bodyY}
            Z`}
        fill={`url(#${gradId}-j)`}
        stroke={isAway ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)'}
        strokeWidth={s * 0.015}
        opacity={isAway ? 0.88 : 1}
      />

      {/* Jersey center seam */}
      {medDetail && (
        <line
          x1={cx} y1={bodyY + s * 0.03}
          x2={cx} y2={bodyY + bodyH - s * 0.01}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={s * 0.008}
        />
      )}

      {/* Sleeve trim accents */}
      {medDetail && (
        <>
          <line
            x1={cx - bodyW * 0.48} y1={bodyY + s * 0.02}
            x2={cx - bodyW * 0.50} y2={bodyY + bodyH * 0.55}
            stroke={sleeveTrim} strokeWidth={s * 0.018} opacity={0.7}
          />
          <line
            x1={cx + bodyW * 0.48} y1={bodyY + s * 0.02}
            x2={cx + bodyW * 0.50} y2={bodyY + bodyH * 0.55}
            stroke={sleeveTrim} strokeWidth={s * 0.018} opacity={0.7}
          />
        </>
      )}

      {/* Collar */}
      {medDetail && (
        <PlayerCollar cx={cx} bodyY={bodyY} s={s} type={collarType} jerseyColor={jerseyColor} />
      )}

      {/* Jersey number */}
      {jerseyNumber !== undefined && medDetail && (
        <text
          x={cx}
          y={bodyY + bodyH * 0.65}
          textAnchor="middle"
          fill="white"
          fontSize={s * 0.14}
          fontWeight="bold"
          fontFamily="monospace"
          opacity={0.9}
        >
          {jerseyNumber}
        </text>
      )}

      {/* === SHORTS === */}
      <path
        d={`M ${cx - bodyW * 0.38} ${bodyY + bodyH}
            L ${cx - bodyW * 0.40} ${bodyY + bodyH + shortsH}
            L ${cx} ${bodyY + bodyH + shortsH * 0.9}
            L ${cx + bodyW * 0.40} ${bodyY + bodyH + shortsH}
            L ${cx + bodyW * 0.38} ${bodyY + bodyH}
            Z`}
        fill={`url(#${gradId}-sh)`}
      />

      {/* === HEAD === */}
      <ellipse
        cx={cx}
        cy={headCY}
        rx={headR * 0.95}
        ry={headR}
        fill={`url(#${gradId}-s)`}
        stroke={skinShadow}
        strokeWidth={s * 0.01}
      />

      {/* Rim light on head */}
      {medDetail && (
        <path
          d={`M ${cx + headR * 0.5} ${headCY - headR * 0.75}
              A ${headR * 0.95} ${headR} 0 0 1 ${cx + headR * 0.5} ${headCY + headR * 0.75}`}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={s * 0.015}
        />
      )}

      {/* === EARS === */}
      {medDetail && (
        <>
          <ellipse
            cx={cx - headR * 0.92} cy={headCY + headR * 0.05}
            rx={headR * 0.12} ry={headR * 0.18}
            fill={skinTone} stroke={skinShadow} strokeWidth={s * 0.006}
          />
          <ellipse
            cx={cx + headR * 0.92} cy={headCY + headR * 0.05}
            rx={headR * 0.12} ry={headR * 0.18}
            fill={skinTone} stroke={skinShadow} strokeWidth={s * 0.006}
          />
        </>
      )}

      {/* === FACIAL FEATURES === */}
      {medDetail && (
        <>
          {/* Eyebrows */}
          <line
            x1={cx - headR * 0.5} y1={headCY - headR * 0.12}
            x2={cx - headR * 0.2} y2={headCY - headR * 0.18}
            stroke="rgba(0,0,0,0.35)" strokeWidth={s * 0.015} strokeLinecap="round"
          />
          <line
            x1={cx + headR * 0.2} y1={headCY - headR * 0.18}
            x2={cx + headR * 0.5} y2={headCY - headR * 0.12}
            stroke="rgba(0,0,0,0.35)" strokeWidth={s * 0.015} strokeLinecap="round"
          />

          {/* Eyes */}
          <ellipse
            cx={cx - headR * 0.33} cy={headCY + headR * 0.05}
            rx={headR * 0.12} ry={headR * 0.10}
            fill="#1a1a1a"
          />
          <ellipse
            cx={cx + headR * 0.33} cy={headCY + headR * 0.05}
            rx={headR * 0.12} ry={headR * 0.10}
            fill="#1a1a1a"
          />
          {/* Eye highlights */}
          <circle cx={cx - headR * 0.28} cy={headCY - headR * 0.01} r={headR * 0.04} fill="rgba(255,255,255,0.7)" />
          <circle cx={cx + headR * 0.38} cy={headCY - headR * 0.01} r={headR * 0.04} fill="rgba(255,255,255,0.7)" />

          {/* Nose */}
          <path
            d={`M ${cx} ${headCY + headR * 0.15}
                L ${cx - headR * 0.08} ${headCY + headR * 0.30}
                Q ${cx} ${headCY + headR * 0.34} ${cx + headR * 0.08} ${headCY + headR * 0.30}`}
            fill="none"
            stroke={skinShadow}
            strokeWidth={s * 0.008}
            opacity={0.4}
          />

          {/* Mouth */}
          <path
            d={`M ${cx - headR * 0.22} ${headCY + headR * 0.48}
                Q ${cx} ${headCY + headR * 0.56} ${cx + headR * 0.22} ${headCY + headR * 0.48}`}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={s * 0.01}
            strokeLinecap="round"
          />
        </>
      )}

      {/* Minimal face for small sizes */}
      {!medDetail && (
        <>
          <circle cx={cx - headR * 0.32} cy={headCY + headR * 0.06} r={headR * 0.10} fill="#1a1a1a" />
          <circle cx={cx + headR * 0.32} cy={headCY + headR * 0.06} r={headR * 0.10} fill="#1a1a1a" />
        </>
      )}

      {/* === FACIAL HAIR === */}
      {medDetail && facialHairStyle !== 'none' && (
        <PlayerFacialHair
          cx={cx} headCY={headCY} headR={headR}
          style={facialHairStyle} color={darken(hairColor, 0.2)}
          s={s}
        />
      )}

      {/* === HAIR === */}
      <PlayerHair cx={cx} headCY={headCY} headR={headR} style={hairStyle} color={hairColor} s={s} />

      {/* === ACCESSORIES === */}
      {medDetail && accessory !== 'none' && (
        <PlayerAccessory
          cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH}
          headCY={headCY} headR={headR}
          style={accessory}
          s={s}
          leftArmEndX={leftArmEndX}
          leftArmEndY={leftArmEndY}
          armStartY={armStartY}
        />
      )}
    </g>
  );
});

// ── Collar Variants ──
function PlayerCollar({ cx, bodyY, s, type, jerseyColor }: {
  cx: number; bodyY: number; s: number; type: number; jerseyColor: string;
}) {
  const collarColor = lighten(jerseyColor, 0.35);

  switch (type) {
    case 0: // V-neck
      return (
        <path
          d={`M ${cx - s * 0.06} ${bodyY - s * 0.005}
              L ${cx} ${bodyY + s * 0.04}
              L ${cx + s * 0.06} ${bodyY - s * 0.005}`}
          fill="none" stroke={collarColor}
          strokeWidth={s * 0.015} strokeLinejoin="round"
        />
      );
    case 1: // Crew neck
      return (
        <path
          d={`M ${cx - s * 0.06} ${bodyY}
              Q ${cx} ${bodyY + s * 0.025} ${cx + s * 0.06} ${bodyY}`}
          fill="none" stroke={collarColor}
          strokeWidth={s * 0.018}
        />
      );
    case 2: // Collar
      return (
        <>
          <path
            d={`M ${cx - s * 0.07} ${bodyY - s * 0.005}
                Q ${cx} ${bodyY + s * 0.015} ${cx + s * 0.07} ${bodyY - s * 0.005}`}
            fill="none" stroke={collarColor}
            strokeWidth={s * 0.02}
          />
          <line
            x1={cx} y1={bodyY - s * 0.005}
            x2={cx} y2={bodyY + s * 0.03}
            stroke={collarColor} strokeWidth={s * 0.008}
          />
        </>
      );
    default:
      return null;
  }
}

// ── Facial Hair Styles ──
function PlayerFacialHair({ cx, headCY, headR, style, color, s }: {
  cx: number; headCY: number; headR: number; style: string; color: string; s: number;
}) {
  switch (style) {
    case 'stubble':
      return (
        <g opacity={0.3}>
          {[[-0.15, 0.45], [0.15, 0.45], [0, 0.52], [-0.1, 0.55], [0.1, 0.55], [-0.2, 0.50], [0.2, 0.50]].map(([ox, oy], i) => (
            <circle key={i} cx={cx + headR * ox} cy={headCY + headR * oy} r={s * 0.006} fill={color} />
          ))}
        </g>
      );
    case 'goatee':
      return (
        <path
          d={`M ${cx - headR * 0.12} ${headCY + headR * 0.48}
              Q ${cx} ${headCY + headR * 0.72} ${cx + headR * 0.12} ${headCY + headR * 0.48}`}
          fill={color} opacity={0.55}
        />
      );
    case 'short_beard':
      return (
        <path
          d={`M ${cx - headR * 0.4} ${headCY + headR * 0.35}
              Q ${cx - headR * 0.45} ${headCY + headR * 0.65} ${cx} ${headCY + headR * 0.75}
              Q ${cx + headR * 0.45} ${headCY + headR * 0.65} ${cx + headR * 0.4} ${headCY + headR * 0.35}`}
          fill={color} opacity={0.45}
        />
      );
    case 'full_beard':
      return (
        <path
          d={`M ${cx - headR * 0.55} ${headCY + headR * 0.2}
              Q ${cx - headR * 0.6} ${headCY + headR * 0.7} ${cx} ${headCY + headR * 0.85}
              Q ${cx + headR * 0.6} ${headCY + headR * 0.7} ${cx + headR * 0.55} ${headCY + headR * 0.2}`}
          fill={color} opacity={0.5}
        />
      );
    default:
      return null;
  }
}

// ── Hair Styles (12 variants with gradient depth) ──
function PlayerHair({ cx, headCY, headR, style, color, s }: {
  cx: number; headCY: number; headR: number; style: string; color: string; s: number;
}) {
  if (style === 'none') return null;

  const shadow = darken(color, 0.25);

  switch (style) {
    case 'buzz':
      return (
        <path
          d={`M ${cx - headR * 0.8} ${headCY - headR * 0.45}
              Q ${cx} ${headCY - headR * 1.2} ${cx + headR * 0.8} ${headCY - headR * 0.45}`}
          fill={color} opacity={0.55}
        />
      );

    case 'short':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.88} ${headCY - headR * 0.3}
                Q ${cx} ${headCY - headR * 1.5} ${cx + headR * 0.88} ${headCY - headR * 0.3}`}
            fill={shadow} opacity={0.4}
          />
          <path
            d={`M ${cx - headR * 0.85} ${headCY - headR * 0.32}
                Q ${cx} ${headCY - headR * 1.45} ${cx + headR * 0.85} ${headCY - headR * 0.32}`}
            fill={color}
          />
        </g>
      );

    case 'medium':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.98} ${headCY - headR * 0.15}
                Q ${cx} ${headCY - headR * 1.65} ${cx + headR * 0.98} ${headCY - headR * 0.15}`}
            fill={shadow} opacity={0.35}
          />
          <path
            d={`M ${cx - headR * 0.95} ${headCY - headR * 0.2}
                Q ${cx} ${headCY - headR * 1.6} ${cx + headR * 0.95} ${headCY - headR * 0.2}`}
            fill={color}
          />
          <rect x={cx - headR * 1.02} y={headCY - headR * 0.4} width={headR * 0.22} height={headR * 0.7} rx={headR * 0.08} fill={color} />
          <rect x={cx + headR * 0.8} y={headCY - headR * 0.4} width={headR * 0.22} height={headR * 0.7} rx={headR * 0.08} fill={color} />
        </g>
      );

    case 'curly':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.85} ${headCY - headR * 0.3}
                Q ${cx} ${headCY - headR * 1.5} ${cx + headR * 0.85} ${headCY - headR * 0.3}`}
            fill={color}
          />
          {[-0.55, -0.18, 0.18, 0.55].map((offset) => (
            <circle key={offset} cx={cx + headR * offset} cy={headCY - headR * 1.05} r={headR * 0.18} fill={color} opacity={0.8} />
          ))}
          {[-0.35, 0, 0.35].map((offset) => (
            <circle key={`s${offset}`} cx={cx + headR * offset} cy={headCY - headR * 1.15} r={headR * 0.12} fill={shadow} opacity={0.3} />
          ))}
        </g>
      );

    case 'mohawk':
      return (
        <g>
          <rect
            x={cx - headR * 0.15} y={headCY - headR * 1.5}
            width={headR * 0.30} height={headR * 1.05}
            rx={headR * 0.1} fill={shadow} opacity={0.3}
          />
          <rect
            x={cx - headR * 0.13} y={headCY - headR * 1.45}
            width={headR * 0.26} height={headR * 0.98}
            rx={headR * 0.08} fill={color}
          />
        </g>
      );

    case 'long':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.95} ${headCY}
                Q ${cx} ${headCY - headR * 1.7} ${cx + headR * 0.95} ${headCY}`}
            fill={color}
          />
          <rect x={cx - headR * 1.05} y={headCY - headR * 0.25} width={headR * 0.22} height={headR * 1.25} rx={headR * 0.08} fill={color} />
          <rect x={cx + headR * 0.83} y={headCY - headR * 0.25} width={headR * 0.22} height={headR * 1.25} rx={headR * 0.08} fill={color} />
          <rect x={cx - headR * 1.05} y={headCY + headR * 0.6} width={headR * 0.22} height={headR * 0.4} rx={headR * 0.06} fill={shadow} opacity={0.3} />
          <rect x={cx + headR * 0.83} y={headCY + headR * 0.6} width={headR * 0.22} height={headR * 0.4} rx={headR * 0.06} fill={shadow} opacity={0.3} />
        </g>
      );

    case 'afro':
      return (
        <g>
          <ellipse
            cx={cx} cy={headCY - headR * 0.3}
            rx={headR * 1.35} ry={headR * 1.2}
            fill={shadow} opacity={0.25}
          />
          <ellipse
            cx={cx} cy={headCY - headR * 0.25}
            rx={headR * 1.3} ry={headR * 1.15}
            fill={color}
          />
        </g>
      );

    case 'fade':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.82} ${headCY - headR * 0.35}
                Q ${cx} ${headCY - headR * 1.45} ${cx + headR * 0.82} ${headCY - headR * 0.35}`}
            fill={color}
          />
          {/* Fade gradient on sides */}
          <rect
            x={cx - headR * 0.9} y={headCY - headR * 0.35}
            width={headR * 0.25} height={headR * 0.55}
            rx={headR * 0.05} fill={color} opacity={0.35}
          />
          <rect
            x={cx + headR * 0.65} y={headCY - headR * 0.35}
            width={headR * 0.25} height={headR * 0.55}
            rx={headR * 0.05} fill={color} opacity={0.35}
          />
        </g>
      );

    case 'man_bun':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.8} ${headCY - headR * 0.3}
                Q ${cx} ${headCY - headR * 1.2} ${cx + headR * 0.8} ${headCY - headR * 0.3}`}
            fill={color} opacity={0.5}
          />
          <circle
            cx={cx} cy={headCY - headR * 1.15}
            r={headR * 0.28} fill={color}
          />
          <circle
            cx={cx} cy={headCY - headR * 1.15}
            r={headR * 0.20} fill={shadow} opacity={0.2}
          />
        </g>
      );

    case 'braids':
      return (
        <g>
          <path
            d={`M ${cx - headR * 0.85} ${headCY - headR * 0.3}
                Q ${cx} ${headCY - headR * 1.5} ${cx + headR * 0.85} ${headCY - headR * 0.3}`}
            fill={color}
          />
          {[-0.5, -0.2, 0.1, 0.4].map((offset) => (
            <line
              key={offset}
              x1={cx + headR * offset} y1={headCY - headR * 1.1}
              x2={cx + headR * (offset - 0.15)} y2={headCY + headR * 0.5}
              stroke={shadow} strokeWidth={s * 0.012} opacity={0.35}
            />
          ))}
          {/* Braid tips */}
          <rect x={cx - headR * 0.95} y={headCY + headR * 0.1} width={headR * 0.16} height={headR * 0.8} rx={headR * 0.06} fill={color} />
          <rect x={cx + headR * 0.79} y={headCY + headR * 0.1} width={headR * 0.16} height={headR * 0.8} rx={headR * 0.06} fill={color} />
        </g>
      );

    case 'undercut':
      return (
        <g>
          {/* Shaved sides */}
          <rect
            x={cx - headR * 0.92} y={headCY - headR * 0.35}
            width={headR * 0.2} height={headR * 0.55}
            rx={headR * 0.05} fill={color} opacity={0.25}
          />
          <rect
            x={cx + headR * 0.72} y={headCY - headR * 0.35}
            width={headR * 0.2} height={headR * 0.55}
            rx={headR * 0.05} fill={color} opacity={0.25}
          />
          {/* Volume on top, swept to one side */}
          <path
            d={`M ${cx - headR * 0.6} ${headCY - headR * 0.4}
                Q ${cx - headR * 0.2} ${headCY - headR * 1.6} ${cx + headR * 0.9} ${headCY - headR * 0.5}`}
            fill={color}
          />
        </g>
      );

    default:
      return null;
  }
}

// ── Accessories ──
function PlayerAccessory({ cx, bodyY, bodyW, bodyH, headCY, headR, style, s, leftArmEndX, leftArmEndY, armStartY }: {
  cx: number; bodyY: number; bodyW: number; bodyH: number;
  headCY: number; headR: number;
  style: string; s: number;
  leftArmEndX: number; leftArmEndY: number; armStartY: number;
}) {
  switch (style) {
    case 'headband':
      return (
        <rect
          x={cx - headR * 0.88}
          y={headCY - headR * 0.35}
          width={headR * 1.76}
          height={headR * 0.2}
          rx={headR * 0.06}
          fill="white"
          opacity={0.7}
        />
      );
    case 'wristband': {
      const midX = (cx - bodyW * 0.45 + leftArmEndX) / 2;
      const midY = (armStartY + leftArmEndY) / 2;
      return (
        <circle
          cx={midX - s * 0.02} cy={midY + s * 0.03}
          r={s * 0.025}
          fill="white" opacity={0.7}
          stroke="rgba(0,0,0,0.15)" strokeWidth={s * 0.005}
        />
      );
    }
    case 'armband':
      return (
        <rect
          x={cx - bodyW * 0.55}
          y={bodyY + bodyH * 0.15}
          width={bodyW * 0.12}
          height={s * 0.04}
          rx={s * 0.005}
          fill="#FFD700"
          opacity={0.85}
        />
      );
    case 'sleeve_tape':
      return (
        <>
          <line
            x1={cx - bodyW * 0.47} y1={bodyY + bodyH * 0.4}
            x2={cx - bodyW * 0.52} y2={bodyY + bodyH * 0.45}
            stroke="rgba(0,0,0,0.4)" strokeWidth={s * 0.02}
          />
          <line
            x1={cx + bodyW * 0.47} y1={bodyY + bodyH * 0.4}
            x2={cx + bodyW * 0.52} y2={bodyY + bodyH * 0.45}
            stroke="rgba(0,0,0,0.4)" strokeWidth={s * 0.02}
          />
        </>
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

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + (255 - ((num >> 16) & 0xFF)) * amount) | 0;
  const g = Math.min(255, ((num >> 8) & 0xFF) + (255 - ((num >> 8) & 0xFF)) * amount) | 0;
  const b = Math.min(255, (num & 0xFF) + (255 - (num & 0xFF)) * amount) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
