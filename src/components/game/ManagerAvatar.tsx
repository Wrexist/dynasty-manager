/**
 * SVG manager avatar with premium portrait style.
 * Gender-aware body proportions, face shapes, eye styles, facial hair,
 * glasses, outfit types, and accessories.
 * Enhanced with subtle gradients, shading, and depth effects.
 */

import { useId } from 'react';
import type { ManagerAppearance } from '@/types/game';
import { cn } from '@/lib/utils';
import {
  SKIN_TONES,
  HAIR_COLORS,
  MALE_HAIR_STYLES,
  FEMALE_HAIR_STYLES,
  FACE_SHAPES,
  EYE_STYLES,
  FACIAL_HAIR_STYLES,
  GLASSES_STYLES,
  OUTFIT_TYPES,
  ACCESSORIES,
} from '@/config/managerAppearance';

interface ManagerAvatarProps {
  appearance: ManagerAppearance;
  size?: number;
  className?: string;
}

// Clamp helper
const ci = (val: number, arr: readonly unknown[]) => Math.max(0, Math.min(val, arr.length - 1));

// Darken a hex color by a fraction
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - amount)) | 0;
  const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - amount)) | 0;
  const b = Math.max(0, (num & 0xFF) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Lighten a hex color by a fraction
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xFF) + (255 - ((num >> 16) & 0xFF)) * amount) | 0;
  const g = Math.min(255, ((num >> 8) & 0xFF) + (255 - ((num >> 8) & 0xFF)) * amount) | 0;
  const b = Math.min(255, (num & 0xFF) + (255 - (num & 0xFF)) * amount) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function ManagerAvatar({ appearance, size = 120, className }: ManagerAvatarProps) {
  const reactUid = useId().replace(/:/g, '');
  const gender = appearance.gender || 'male';
  const skinTone = SKIN_TONES[ci(appearance.skinTone, SKIN_TONES)];
  const hairColor = HAIR_COLORS[ci(appearance.hairColor, HAIR_COLORS)];
  const hairStyles = gender === 'female' ? FEMALE_HAIR_STYLES : MALE_HAIR_STYLES;
  const hairStyle = hairStyles[ci(appearance.hairStyle, hairStyles)];
  const faceShape = FACE_SHAPES[ci(appearance.faceShape ?? 1, FACE_SHAPES)];
  const eyeStyle = EYE_STYLES[ci(appearance.eyeStyle ?? 0, EYE_STYLES)];
  const facialHair = gender === 'male' ? FACIAL_HAIR_STYLES[ci(appearance.facialHair ?? 0, FACIAL_HAIR_STYLES)] : 'none';
  const glasses = GLASSES_STYLES[ci(appearance.glasses ?? 0, GLASSES_STYLES)];
  const outfit = OUTFIT_TYPES[ci(appearance.outfit ?? 0, OUTFIT_TYPES)];
  const outfitColor = appearance.outfitColor || appearance['suitColor' as keyof ManagerAppearance] as string || '#1a1a2e';
  const tieColor = appearance.tieColor || '#D4A017';
  const accessory = ACCESSORIES[ci(appearance.accessory ?? 0, ACCESSORIES)];

  // Derived colors
  const skinHighlight = lighten(skinTone, 0.12);
  const skinShadow = darken(skinTone, 0.15);
  const hairHighlight = lighten(hairColor, 0.15);
  const hairShadow = darken(hairColor, 0.2);
  const outfitLight = lighten(outfitColor, 0.1);
  const outfitDark = darken(outfitColor, 0.15);

  // Unique gradient IDs to avoid SVG conflicts when multiple avatars render
  const uid = `ma-${reactUid}-${appearance.skinTone}${appearance.hairStyle}${appearance.outfit}${appearance.faceShape}${appearance.eyeStyle}`;

  // All coordinates in a 100x100 viewBox
  const cx = 50;
  const headY = 30;
  const headR = 14;
  const isMale = gender === 'male';
  const bodyY = 48;
  const bodyW = isMale ? 38 : 32;
  const bodyH = 30;
  const neckW = isMale ? 8 : 6;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('select-none', className)}
    >
      {/* ── Gradient Definitions ── */}
      <defs>
        <radialGradient id={`${uid}-skin`} cx="45%" cy="38%" r="55%">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="100%" stopColor={skinTone} />
        </radialGradient>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hairHighlight} />
          <stop offset="100%" stopColor={hairShadow} />
        </linearGradient>
        <linearGradient id={`${uid}-outfit`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={outfitLight} />
          <stop offset="100%" stopColor={outfitDark} />
        </linearGradient>
        <radialGradient id={`${uid}-backdrop`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={lighten(outfitColor, 0.35)} stopOpacity="0.35" />
          <stop offset="100%" stopColor={darken(outfitColor, 0.35)} stopOpacity="0.08" />
        </radialGradient>
      </defs>

      {/* Portrait backdrop */}
      <circle cx={cx} cy={46} r={38} fill={`url(#${uid}-backdrop)`} />

      {/* ── Ground Shadow ── */}
      <ellipse cx={cx} cy={94} rx={16} ry={3} fill="rgba(0,0,0,0.12)" />

      {/* Legs */}
      <line x1={cx - 6} y1={bodyY + bodyH} x2={cx - 8} y2={bodyY + bodyH + 12} stroke={skinTone} strokeWidth={isMale ? 4 : 3.5} strokeLinecap="round" />
      <line x1={cx + 6} y1={bodyY + bodyH} x2={cx + 8} y2={bodyY + bodyH + 12} stroke={skinTone} strokeWidth={isMale ? 4 : 3.5} strokeLinecap="round" />

      {/* Shoes */}
      <ellipse cx={cx - 8} cy={bodyY + bodyH + 14} rx={4} ry={2.5} fill="#111" />
      <ellipse cx={cx + 8} cy={bodyY + bodyH + 14} rx={4} ry={2.5} fill="#111" />
      {/* Shoe highlight */}
      <ellipse cx={cx - 8} cy={bodyY + bodyH + 13} rx={2.5} ry={1} fill="rgba(255,255,255,0.06)" />
      <ellipse cx={cx + 8} cy={bodyY + bodyH + 13} rx={2.5} ry={1} fill="rgba(255,255,255,0.06)" />

      {/* ── Outfit ── */}
      {outfit === 'suit' && <SuitBody cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH} tieColor={tieColor} gradId={`${uid}-outfit`} />}
      {outfit === 'tracksuit' && <TracksuitBody cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH} gradId={`${uid}-outfit`} />}
      {outfit === 'polo' && <PoloBody cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH} color={outfitColor} skinTone={skinTone} gradId={`${uid}-outfit`} />}

      {/* Accessory: Lanyard (behind neck) */}
      {accessory === 'lanyard' && (
        <>
          <line x1={cx - 3} y1={bodyY - 2} x2={cx - 8} y2={bodyY + 18} stroke="#e8e8e8" strokeWidth="0.8" />
          <line x1={cx + 3} y1={bodyY - 2} x2={cx - 8} y2={bodyY + 18} stroke="#e8e8e8" strokeWidth="0.8" />
          <circle cx={cx - 8} cy={bodyY + 19} r={1.5} fill="#ccc" stroke="#999" strokeWidth="0.3" />
        </>
      )}

      {/* Neck */}
      <rect x={cx - neckW / 2} y={bodyY - 5} width={neckW} height={7} rx={3} fill={`url(#${uid}-skin)`} />

      {/* ── Head (face shape) ── */}
      <HeadShape cx={cx} cy={headY} r={headR} faceShape={faceShape} skinGrad={`url(#${uid}-skin)`} skinShadow={skinShadow} />

      {/* ── Nose ── */}
      <path
        d={`M ${cx - 0.5} ${headY + 1.5} Q ${cx} ${headY + 4} ${cx + 0.5} ${headY + 1.5}`}
        fill="none"
        stroke={skinShadow}
        strokeWidth="0.5"
        strokeLinecap="round"
        opacity={0.4}
      />

      {/* ── Eyes ── */}
      <Eyes cx={cx} cy={headY} eyeStyle={eyeStyle} />

      {/* ── Eyebrows ── */}
      <line x1={cx - 6.5} y1={headY - 1.5} x2={cx - 2.5} y2={headY - 2} stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" strokeLinecap="round" />
      <line x1={cx + 2.5} y1={headY - 2} x2={cx + 6.5} y2={headY - 1.5} stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" strokeLinecap="round" />

      {/* ── Mouth ── */}
      <path
        d={`M ${cx - 3.5} ${headY + 5.5} Q ${cx} ${headY + 7.8} ${cx + 3.5} ${headY + 5.5}`}
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />

      {/* ── Facial Hair (male only) ── */}
      {facialHair !== 'none' && (
        <FacialHair
          cx={cx}
          headY={headY}
          headR={headR}
          style={facialHair}
          color={hairColor}
          seed={`${appearance.hairStyle}-${appearance.facialHair}-${appearance.skinTone}-${appearance.faceShape}`}
        />
      )}

      {/* ── Glasses ── */}
      {glasses !== 'none' && <Glasses cx={cx} cy={headY} style={glasses} />}

      {/* ── Hair ── */}
      <Hair cx={cx} headY={headY} headR={headR} style={hairStyle} color={hairColor} gender={gender} gradId={`${uid}-hair`} />

      {/* Accessory: Watch */}
      {accessory === 'watch' && (
        <g>
          <rect x={cx - bodyW / 2 - 1.5} y={bodyY + bodyH - 4} width={3.5} height={2.5} rx={0.6} fill="#777" stroke="#555" strokeWidth="0.4" />
          <rect x={cx - bodyW / 2 - 0.5} y={bodyY + bodyH - 3.5} width={1.5} height={1.5} rx={0.3} fill="#aac" stroke="#889" strokeWidth="0.2" />
        </g>
      )}

      {/* Accessory: Earring */}
      {accessory === 'earring' && (
        <>
          <circle cx={cx + headR + 0.5} cy={headY + 3} r={1.2} fill="#D4A017" stroke="#B8860B" strokeWidth="0.3" />
          <circle cx={cx + headR + 0.5} cy={headY + 3} r={0.5} fill="#FFF" opacity={0.3} />
        </>
      )}
    </svg>
  );
}

// ── Head Shape ──
function HeadShape({ cx, cy, r, faceShape, skinGrad, skinShadow }: { cx: number; cy: number; r: number; faceShape: string; skinGrad: string; skinShadow: string }) {
  const stroke = skinShadow;
  const sw = 0.6;

  switch (faceShape) {
    case 'oval':
      return <ellipse cx={cx} cy={cy} rx={r * 0.92} ry={r * 1.08} fill={skinGrad} stroke={stroke} strokeWidth={sw} opacity={1} />;
    case 'square':
      return <rect x={cx - r * 0.9} y={cy - r * 0.95} width={r * 1.8} height={r * 1.9} rx={r * 0.35} fill={skinGrad} stroke={stroke} strokeWidth={sw} />;
    case 'angular':
      return (
        <path
          d={`M ${cx} ${cy - r * 1.05}
              L ${cx + r * 0.95} ${cy - r * 0.3}
              L ${cx + r * 0.8} ${cy + r * 0.85}
              Q ${cx} ${cy + r * 1.15} ${cx - r * 0.8} ${cy + r * 0.85}
              L ${cx - r * 0.95} ${cy - r * 0.3} Z`}
          fill={skinGrad}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    default: // round
      return <circle cx={cx} cy={cy} r={r} fill={skinGrad} stroke={stroke} strokeWidth={sw} />;
  }
}

// ── Eyes ──
function Eyes({ cx, cy, eyeStyle }: { cx: number; cy: number; eyeStyle: string }) {
  const ey = cy + 1;

  // Eye highlight dot helper
  const highlight = (x: number, y: number) => (
    <circle cx={x + 0.4} cy={y - 0.3} r={0.35} fill="white" opacity={0.7} />
  );

  switch (eyeStyle) {
    case 'narrow':
      return (
        <>
          <ellipse cx={cx - 4.5} cy={ey} rx={1.8} ry={0.7} fill="#1a1a1a" />
          <ellipse cx={cx + 4.5} cy={ey} rx={1.8} ry={0.7} fill="#1a1a1a" />
          {highlight(cx - 4.5, ey)}
          {highlight(cx + 4.5, ey)}
        </>
      );
    case 'wide':
      return (
        <>
          <ellipse cx={cx - 5} cy={ey} rx={2} ry={1.3} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx - 5} cy={ey} r={0.9} fill="#1a1a1a" />
          {highlight(cx - 5, ey)}
          <ellipse cx={cx + 5} cy={ey} rx={2} ry={1.3} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx + 5} cy={ey} r={0.9} fill="#1a1a1a" />
          {highlight(cx + 5, ey)}
        </>
      );
    case 'round':
      return (
        <>
          <circle cx={cx - 4.5} cy={ey} r={1.5} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx - 4.5} cy={ey} r={0.8} fill="#1a1a1a" />
          {highlight(cx - 4.5, ey)}
          <circle cx={cx + 4.5} cy={ey} r={1.5} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx + 4.5} cy={ey} r={0.8} fill="#1a1a1a" />
          {highlight(cx + 4.5, ey)}
        </>
      );
    default: // default dots
      return (
        <>
          <circle cx={cx - 4.5} cy={ey} r={1.2} fill="#1a1a1a" />
          {highlight(cx - 4.5, ey)}
          <circle cx={cx + 4.5} cy={ey} r={1.2} fill="#1a1a1a" />
          {highlight(cx + 4.5, ey)}
        </>
      );
  }
}

// ── Facial Hair ──
function FacialHair({ cx, headY, headR, style, color, seed }: { cx: number; headY: number; headR: number; style: string; color: string; seed: string }) {
  const jawY = headY + headR * 0.5;
  const chinY = headY + headR * 0.85;
  const dots = getDeterministicDots(seed, 20);

  switch (style) {
    case 'stubble':
      return (
        <g opacity={0.35}>
          {dots.map((dot, i) => {
            const angle = (i / dots.length) * Math.PI;
            const r = headR * (0.55 + dot * 0.3);
            const dx = cx + Math.cos(angle - Math.PI / 2) * r * 0.7;
            const dy = jawY + Math.sin(angle) * r * 0.5;
            return <circle key={i} cx={dx} cy={dy} r={0.3} fill={color} />;
          })}
        </g>
      );
    case 'goatee':
      return (
        <path
          d={`M ${cx - 3} ${headY + 5} Q ${cx} ${chinY + 4} ${cx + 3} ${headY + 5}`}
          fill={color}
          opacity={0.7}
        />
      );
    case 'short-beard':
      return (
        <path
          d={`M ${cx - headR * 0.6} ${jawY}
              Q ${cx - headR * 0.7} ${chinY + 2} ${cx} ${chinY + 4}
              Q ${cx + headR * 0.7} ${chinY + 2} ${cx + headR * 0.6} ${jawY}`}
          fill={color}
          opacity={0.6}
        />
      );
    case 'full-beard':
      return (
        <path
          d={`M ${cx - headR * 0.8} ${jawY - 2}
              Q ${cx - headR * 0.9} ${chinY + 3} ${cx} ${chinY + 6}
              Q ${cx + headR * 0.9} ${chinY + 3} ${cx + headR * 0.8} ${jawY - 2}`}
          fill={color}
          opacity={0.65}
        />
      );
    case 'mustache':
      return (
        <path
          d={`M ${cx - 4.5} ${headY + 4} Q ${cx - 2} ${headY + 6.5} ${cx} ${headY + 5}
              Q ${cx + 2} ${headY + 6.5} ${cx + 4.5} ${headY + 4}`}
          fill={color}
          opacity={0.7}
          strokeLinecap="round"
        />
      );
    default:
      return null;
  }
}

function getDeterministicDots(seed: string, count: number): number[] {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    values.push(((state >>> 0) % 1000) / 1000);
  }
  return values;
}

// ── Glasses ──
function Glasses({ cx, cy, style }: { cx: number; cy: number; style: string }) {
  const ey = cy + 1;
  const lensColor = 'rgba(180,210,240,0.18)';
  const frameColor = 'rgba(50,50,50,0.9)';

  switch (style) {
    case 'rectangular':
      return (
        <g>
          <rect x={cx - 7.5} y={ey - 2} width={5.5} height={3.5} rx={0.5} fill={lensColor} stroke={frameColor} strokeWidth="0.6" />
          <rect x={cx + 2} y={ey - 2} width={5.5} height={3.5} rx={0.5} fill={lensColor} stroke={frameColor} strokeWidth="0.6" />
          <line x1={cx - 2} y1={ey - 0.5} x2={cx + 2} y2={ey - 0.5} stroke={frameColor} strokeWidth="0.5" />
          <line x1={cx - 7.5} y1={ey - 0.5} x2={cx - 10} y2={ey - 1.5} stroke={frameColor} strokeWidth="0.4" />
          <line x1={cx + 7.5} y1={ey - 0.5} x2={cx + 10} y2={ey - 1.5} stroke={frameColor} strokeWidth="0.4" />
          {/* Lens reflection */}
          <line x1={cx - 6.5} y1={ey - 1.2} x2={cx - 5} y2={ey - 1.2} stroke="rgba(255,255,255,0.2)" strokeWidth="0.4" strokeLinecap="round" />
          <line x1={cx + 3} y1={ey - 1.2} x2={cx + 4.5} y2={ey - 1.2} stroke="rgba(255,255,255,0.2)" strokeWidth="0.4" strokeLinecap="round" />
        </g>
      );
    case 'round':
      return (
        <g>
          <circle cx={cx - 4.8} cy={ey} r={2.8} fill={lensColor} stroke={frameColor} strokeWidth="0.6" />
          <circle cx={cx + 4.8} cy={ey} r={2.8} fill={lensColor} stroke={frameColor} strokeWidth="0.6" />
          <line x1={cx - 2} y1={ey - 0.3} x2={cx + 2} y2={ey - 0.3} stroke={frameColor} strokeWidth="0.5" />
          <line x1={cx - 7.5} y1={ey - 0.5} x2={cx - 10} y2={ey - 1.5} stroke={frameColor} strokeWidth="0.4" />
          <line x1={cx + 7.5} y1={ey - 0.5} x2={cx + 10} y2={ey - 1.5} stroke={frameColor} strokeWidth="0.4" />
          {/* Lens reflection */}
          <circle cx={cx - 5.5} cy={ey - 0.8} r={0.5} fill="rgba(255,255,255,0.15)" />
          <circle cx={cx + 4} cy={ey - 0.8} r={0.5} fill="rgba(255,255,255,0.15)" />
        </g>
      );
    case 'aviator':
      return (
        <g>
          <path
            d={`M ${cx - 7} ${ey - 2} Q ${cx - 8} ${ey + 2.5} ${cx - 4} ${ey + 2.5} Q ${cx - 1.5} ${ey + 2} ${cx - 2} ${ey - 1.5}`}
            fill={lensColor}
            stroke={frameColor}
            strokeWidth="0.5"
          />
          <path
            d={`M ${cx + 7} ${ey - 2} Q ${cx + 8} ${ey + 2.5} ${cx + 4} ${ey + 2.5} Q ${cx + 1.5} ${ey + 2} ${cx + 2} ${ey - 1.5}`}
            fill={lensColor}
            stroke={frameColor}
            strokeWidth="0.5"
          />
          <line x1={cx - 2} y1={ey - 0.8} x2={cx + 2} y2={ey - 0.8} stroke={frameColor} strokeWidth="0.5" />
          <line x1={cx - 7} y1={ey - 1.5} x2={cx - 10} y2={ey - 2} stroke={frameColor} strokeWidth="0.4" />
          <line x1={cx + 7} y1={ey - 1.5} x2={cx + 10} y2={ey - 2} stroke={frameColor} strokeWidth="0.4" />
        </g>
      );
    default:
      return null;
  }
}

// ── Suit Outfit ──
function SuitBody({ cx, bodyY, bodyW, bodyH, tieColor, gradId }: { cx: number; bodyY: number; bodyW: number; bodyH: number; tieColor: string; gradId: string }) {
  return (
    <>
      <rect x={cx - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={4} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Lapels */}
      <path d={`M ${cx - 3} ${bodyY} L ${cx - 10} ${bodyY + 14} L ${cx - 3} ${bodyY + 14} Z`} fill="rgba(255,255,255,0.05)" />
      <path d={`M ${cx + 3} ${bodyY} L ${cx + 10} ${bodyY + 14} L ${cx + 3} ${bodyY + 14} Z`} fill="rgba(255,255,255,0.05)" />
      {/* Lapel edges */}
      <line x1={cx - 3} y1={bodyY} x2={cx - 10} y2={bodyY + 14} stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
      <line x1={cx + 3} y1={bodyY} x2={cx + 10} y2={bodyY + 14} stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
      {/* Collar */}
      <path d={`M ${cx - 6} ${bodyY} L ${cx} ${bodyY + 6} L ${cx + 6} ${bodyY}`} fill="none" stroke="#e8e8e8" strokeWidth="1.2" />
      {/* Tie */}
      <path
        d={`M ${cx} ${bodyY + 5} L ${cx - 2.5} ${bodyY + 10} L ${cx} ${bodyY + 22} L ${cx + 2.5} ${bodyY + 10} Z`}
        fill={tieColor}
        opacity={0.85}
      />
      {/* Tie highlight */}
      <path
        d={`M ${cx - 0.5} ${bodyY + 6} L ${cx - 0.5} ${bodyY + 11}`}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.5"
      />
      {/* Breast pocket */}
      <rect x={cx + 5} y={bodyY + 8} width={4} height={0.5} rx={0.2} fill="rgba(255,255,255,0.06)" />
    </>
  );
}

// ── Tracksuit Outfit ──
function TracksuitBody({ cx, bodyY, bodyW, bodyH, gradId }: { cx: number; bodyY: number; bodyW: number; bodyH: number; gradId: string }) {
  return (
    <>
      <rect x={cx - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={5} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      {/* Zip line */}
      <line x1={cx} y1={bodyY + 2} x2={cx} y2={bodyY + bodyH - 4} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
      {/* Zip pull */}
      <rect x={cx - 1} y={bodyY + bodyH / 3} width={2} height={2.5} rx={0.5} fill="rgba(255,255,255,0.3)" />
      {/* Collar (zip collar) */}
      <path d={`M ${cx - 5} ${bodyY} Q ${cx} ${bodyY + 3} ${cx + 5} ${bodyY}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* Side stripes */}
      <line x1={cx - bodyW / 2 + 2} y1={bodyY + 2} x2={cx - bodyW / 2 + 2} y2={bodyY + bodyH - 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      <line x1={cx + bodyW / 2 - 2} y1={bodyY + 2} x2={cx + bodyW / 2 - 2} y2={bodyY + bodyH - 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      {/* Brand logo placeholder */}
      <circle cx={cx - 6} cy={bodyY + 6} r={1.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
    </>
  );
}

// ── Polo Outfit ──
function PoloBody({ cx, bodyY, bodyW, bodyH, color, skinTone, gradId }: { cx: number; bodyY: number; bodyW: number; bodyH: number; color: string; skinTone: string; gradId: string }) {
  return (
    <>
      <rect x={cx - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={4} fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      {/* Collar */}
      <path d={`M ${cx - 7} ${bodyY - 1} Q ${cx} ${bodyY + 4} ${cx + 7} ${bodyY - 1}`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
      {/* Buttons */}
      <circle cx={cx} cy={bodyY + 5} r={0.6} fill="rgba(255,255,255,0.3)" />
      <circle cx={cx} cy={bodyY + 8} r={0.6} fill="rgba(255,255,255,0.3)" />
      {/* Short sleeves - show skin */}
      <rect x={cx - bodyW / 2 - 3} y={bodyY + 1} width={5} height={7} rx={2} fill={color} />
      <rect x={cx + bodyW / 2 - 2} y={bodyY + 1} width={5} height={7} rx={2} fill={color} />
      {/* Arms */}
      <line x1={cx - bodyW / 2 - 1} y1={bodyY + 8} x2={cx - bodyW / 2 - 2} y2={bodyY + 16} stroke={skinTone} strokeWidth={3} strokeLinecap="round" />
      <line x1={cx + bodyW / 2 + 1} y1={bodyY + 8} x2={cx + bodyW / 2 + 2} y2={bodyY + 16} stroke={skinTone} strokeWidth={3} strokeLinecap="round" />
    </>
  );
}

// ── Hair ──
function Hair({ cx, headY, headR, style, color, gender, gradId }: { cx: number; headY: number; headR: number; style: string; color: string; gender: string; gradId: string }) {
  if (style === 'none') return null;

  const fill = `url(#${gradId})`;

  // Male hair styles
  if (gender === 'male') {
    switch (style) {
      case 'crew':
        return (
          <path
            d={`M ${cx - headR * 0.85} ${headY - headR * 0.35} Q ${cx} ${headY - headR * 1.35} ${cx + headR * 0.85} ${headY - headR * 0.35}`}
            fill={fill}
            opacity={0.75}
          />
        );
      case 'short':
        return (
          <path
            d={`M ${cx - headR * 0.9} ${headY - headR * 0.3} Q ${cx} ${headY - headR * 1.5} ${cx + headR * 0.9} ${headY - headR * 0.3}`}
            fill={fill}
          />
        );
      case 'side-part':
        return (
          <>
            <path
              d={`M ${cx - headR * 0.95} ${headY - headR * 0.25} Q ${cx - headR * 0.3} ${headY - headR * 1.55} ${cx + headR * 0.95} ${headY - headR * 0.3}`}
              fill={fill}
            />
            <line x1={cx - headR * 0.5} y1={headY - headR * 0.9} x2={cx - headR * 0.9} y2={headY - headR * 0.3} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
          </>
        );
      case 'slicked':
        return (
          <path
            d={`M ${cx - headR * 0.95} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.45} ${cx + headR * 0.95} ${headY - headR * 0.2}`}
            fill={fill}
            opacity={0.85}
          />
        );
      case 'medium':
        return (
          <>
            <path d={`M ${cx - headR} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.7} ${cx + headR} ${headY - headR * 0.2}`} fill={fill} />
            <rect x={cx - headR * 1.05} y={headY - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={fill} />
            <rect x={cx + headR * 0.75} y={headY - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={fill} />
          </>
        );
      case 'curly':
        return (
          <g>
            <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.3} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.3}`} fill={fill} />
            {[-0.6, -0.2, 0.2, 0.6].map((offset) => (
              <circle key={offset} cx={cx + headR * offset} cy={headY - headR * 1.1} r={headR * 0.2} fill={fill} opacity={0.8} />
            ))}
          </g>
        );
      case 'afro':
        return (
          <ellipse
            cx={cx}
            cy={headY - headR * 0.3}
            rx={headR * 1.35}
            ry={headR * 1.2}
            fill={fill}
          />
        );
      default:
        return null;
    }
  }

  // Female hair styles
  switch (style) {
    case 'pixie':
      return (
        <path
          d={`M ${cx - headR * 0.85} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.5} ${cx + headR * 0.85} ${headY - headR * 0.35}
              L ${cx + headR * 0.7} ${headY + headR * 0.1}`}
          fill={fill}
        />
      );
    case 'bob':
      return (
        <>
          <path d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.7} ${cx + headR} ${headY}`} fill={fill} />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.2} width={headR * 0.3} height={headR * 1.0} rx={headR * 0.1} fill={fill} />
          <rect x={cx + headR * 0.8} y={headY - headR * 0.2} width={headR * 0.3} height={headR * 1.0} rx={headR * 0.1} fill={fill} />
        </>
      );
    case 'shoulder':
      return (
        <>
          <path d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.8} ${cx + headR} ${headY}`} fill={fill} />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.3} width={headR * 0.28} height={headR * 1.6} rx={headR * 0.1} fill={fill} />
          <rect x={cx + headR * 0.82} y={headY - headR * 0.3} width={headR * 0.28} height={headR * 1.6} rx={headR * 0.1} fill={fill} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.2}`} fill={fill} />
          <circle cx={cx + headR * 0.5} cy={headY - headR * 0.9} r={headR * 0.18} fill={color} opacity={0.8} />
          <path
            d={`M ${cx + headR * 0.5} ${headY - headR * 0.75} Q ${cx + headR * 1.4} ${headY} ${cx + headR * 1.1} ${headY + headR * 0.8}`}
            fill="none"
            stroke={color}
            strokeWidth={headR * 0.3}
            strokeLinecap="round"
          />
        </>
      );
    case 'bun':
      return (
        <>
          <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.2}`} fill={fill} />
          <circle cx={cx} cy={headY - headR * 1.35} r={headR * 0.4} fill={fill} />
        </>
      );
    case 'long':
      return (
        <>
          <path d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.8} ${cx + headR} ${headY}`} fill={fill} />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.3} width={headR * 0.25} height={headR * 2.0} rx={headR * 0.1} fill={fill} />
          <rect x={cx + headR * 0.85} y={headY - headR * 0.3} width={headR * 0.25} height={headR * 2.0} rx={headR * 0.1} fill={fill} />
        </>
      );
    case 'braids':
      return (
        <>
          <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.2}`} fill={fill} />
          <line x1={cx - headR * 0.7} y1={headY + headR * 0.1} x2={cx - headR * 0.9} y2={headY + headR * 1.5} stroke={color} strokeWidth={headR * 0.22} strokeLinecap="round" />
          <line x1={cx + headR * 0.7} y1={headY + headR * 0.1} x2={cx + headR * 0.9} y2={headY + headR * 1.5} stroke={color} strokeWidth={headR * 0.22} strokeLinecap="round" />
          <circle cx={cx - headR * 0.9} cy={headY + headR * 1.55} r={headR * 0.12} fill="#D4A017" />
          <circle cx={cx + headR * 0.9} cy={headY + headR * 1.55} r={headR * 0.12} fill="#D4A017" />
        </>
      );
    default:
      return null;
  }
}
