/**
 * SVG manager avatar with advanced customizable appearance.
 * Gender-aware body proportions, face shapes, eye styles, facial hair,
 * glasses, outfit types, and accessories.
 */

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

export function ManagerAvatar({ appearance, size = 120, className }: ManagerAvatarProps) {
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
      {/* Legs */}
      <line x1={cx - 6} y1={bodyY + bodyH} x2={cx - 8} y2={bodyY + bodyH + 12} stroke={skinTone} strokeWidth={isMale ? 4 : 3.5} strokeLinecap="round" />
      <line x1={cx + 6} y1={bodyY + bodyH} x2={cx + 8} y2={bodyY + bodyH + 12} stroke={skinTone} strokeWidth={isMale ? 4 : 3.5} strokeLinecap="round" />

      {/* Shoes */}
      <ellipse cx={cx - 8} cy={bodyY + bodyH + 14} rx={4} ry={2.5} fill="#111" />
      <ellipse cx={cx + 8} cy={bodyY + bodyH + 14} rx={4} ry={2.5} fill="#111" />

      {/* ── Outfit ── */}
      {outfit === 'suit' && <SuitBody cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH} color={outfitColor} tieColor={tieColor} />}
      {outfit === 'tracksuit' && <TracksuitBody cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH} color={outfitColor} />}
      {outfit === 'polo' && <PoloBody cx={cx} bodyY={bodyY} bodyW={bodyW} bodyH={bodyH} color={outfitColor} skinTone={skinTone} />}

      {/* Accessory: Lanyard (behind neck) */}
      {accessory === 'lanyard' && (
        <>
          <line x1={cx - 3} y1={bodyY - 2} x2={cx - 8} y2={bodyY + 18} stroke="#e8e8e8" strokeWidth="0.8" />
          <line x1={cx + 3} y1={bodyY - 2} x2={cx - 8} y2={bodyY + 18} stroke="#e8e8e8" strokeWidth="0.8" />
          <circle cx={cx - 8} cy={bodyY + 19} r={1.5} fill="#ccc" stroke="#999" strokeWidth="0.3" />
        </>
      )}

      {/* Neck */}
      <rect x={cx - neckW / 2} y={bodyY - 5} width={neckW} height={7} rx={3} fill={skinTone} />

      {/* ── Head (face shape) ── */}
      <HeadShape cx={cx} cy={headY} r={headR} faceShape={faceShape} skinTone={skinTone} />

      {/* ── Eyes ── */}
      <Eyes cx={cx} cy={headY} eyeStyle={eyeStyle} />

      {/* ── Mouth ── */}
      <path
        d={`M ${cx - 3} ${headY + 5.5} Q ${cx} ${headY + 7.5} ${cx + 3} ${headY + 5.5}`}
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* ── Facial Hair (male only) ── */}
      {facialHair !== 'none' && <FacialHair cx={cx} headY={headY} headR={headR} style={facialHair} color={hairColor} />}

      {/* ── Glasses ── */}
      {glasses !== 'none' && <Glasses cx={cx} cy={headY} style={glasses} />}

      {/* ── Hair ── */}
      <Hair cx={cx} headY={headY} headR={headR} style={hairStyle} color={hairColor} gender={gender} />

      {/* Accessory: Watch */}
      {accessory === 'watch' && (
        <g>
          <rect x={cx - bodyW / 2 - 1} y={bodyY + bodyH - 4} width={3} height={2} rx={0.5} fill="#888" stroke="#666" strokeWidth="0.3" />
        </g>
      )}

      {/* Accessory: Earring */}
      {accessory === 'earring' && (
        <circle cx={cx + headR + 0.5} cy={headY + 3} r={1} fill="#D4A017" stroke="#B8860B" strokeWidth="0.3" />
      )}
    </svg>
  );
}

// ── Head Shape ──
function HeadShape({ cx, cy, r, faceShape, skinTone }: { cx: number; cy: number; r: number; faceShape: string; skinTone: string }) {
  switch (faceShape) {
    case 'oval':
      return <ellipse cx={cx} cy={cy} rx={r * 0.92} ry={r * 1.08} fill={skinTone} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />;
    case 'square':
      return <rect x={cx - r * 0.9} y={cy - r * 0.95} width={r * 1.8} height={r * 1.9} rx={r * 0.35} fill={skinTone} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />;
    case 'angular':
      return (
        <path
          d={`M ${cx} ${cy - r * 1.05}
              L ${cx + r * 0.95} ${cy - r * 0.3}
              L ${cx + r * 0.8} ${cy + r * 0.85}
              Q ${cx} ${cy + r * 1.15} ${cx - r * 0.8} ${cy + r * 0.85}
              L ${cx - r * 0.95} ${cy - r * 0.3} Z`}
          fill={skinTone}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="0.5"
        />
      );
    default: // round
      return <circle cx={cx} cy={cy} r={r} fill={skinTone} stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />;
  }
}

// ── Eyes ──
function Eyes({ cx, cy, eyeStyle }: { cx: number; cy: number; eyeStyle: string }) {
  const ey = cy + 1;
  switch (eyeStyle) {
    case 'narrow':
      return (
        <>
          <ellipse cx={cx - 4.5} cy={ey} rx={1.8} ry={0.7} fill="#1a1a1a" />
          <ellipse cx={cx + 4.5} cy={ey} rx={1.8} ry={0.7} fill="#1a1a1a" />
        </>
      );
    case 'wide':
      return (
        <>
          <ellipse cx={cx - 5} cy={ey} rx={2} ry={1.3} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx - 5} cy={ey} r={0.9} fill="#1a1a1a" />
          <ellipse cx={cx + 5} cy={ey} rx={2} ry={1.3} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx + 5} cy={ey} r={0.9} fill="#1a1a1a" />
        </>
      );
    case 'round':
      return (
        <>
          <circle cx={cx - 4.5} cy={ey} r={1.5} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx - 4.5} cy={ey} r={0.8} fill="#1a1a1a" />
          <circle cx={cx + 4.5} cy={ey} r={1.5} fill="white" stroke="#1a1a1a" strokeWidth="0.5" />
          <circle cx={cx + 4.5} cy={ey} r={0.8} fill="#1a1a1a" />
        </>
      );
    default: // default dots
      return (
        <>
          <circle cx={cx - 4.5} cy={ey} r={1.2} fill="#1a1a1a" />
          <circle cx={cx + 4.5} cy={ey} r={1.2} fill="#1a1a1a" />
        </>
      );
  }
}

// ── Facial Hair ──
function FacialHair({ cx, headY, headR, style, color }: { cx: number; headY: number; headR: number; style: string; color: string }) {
  const jawY = headY + headR * 0.5;
  const chinY = headY + headR * 0.85;

  switch (style) {
    case 'stubble':
      return (
        <g opacity={0.35}>
          {Array.from({ length: 20 }).map((_, i) => {
            const angle = (i / 20) * Math.PI;
            const r = headR * (0.55 + Math.random() * 0.3);
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

// ── Glasses ──
function Glasses({ cx, cy, style }: { cx: number; cy: number; style: string }) {
  const ey = cy + 1;
  const lensColor = 'rgba(180,210,240,0.15)';
  const frameColor = 'rgba(60,60,60,0.9)';

  switch (style) {
    case 'rectangular':
      return (
        <g>
          <rect x={cx - 7.5} y={ey - 2} width={5.5} height={3.5} rx={0.5} fill={lensColor} stroke={frameColor} strokeWidth="0.6" />
          <rect x={cx + 2} y={ey - 2} width={5.5} height={3.5} rx={0.5} fill={lensColor} stroke={frameColor} strokeWidth="0.6" />
          <line x1={cx - 2} y1={ey - 0.5} x2={cx + 2} y2={ey - 0.5} stroke={frameColor} strokeWidth="0.5" />
          <line x1={cx - 7.5} y1={ey - 0.5} x2={cx - 10} y2={ey - 1.5} stroke={frameColor} strokeWidth="0.4" />
          <line x1={cx + 7.5} y1={ey - 0.5} x2={cx + 10} y2={ey - 1.5} stroke={frameColor} strokeWidth="0.4" />
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
function SuitBody({ cx, bodyY, bodyW, bodyH, color, tieColor }: { cx: number; bodyY: number; bodyW: number; bodyH: number; color: string; tieColor: string }) {
  return (
    <>
      <rect x={cx - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={4} fill={color} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      {/* Lapels */}
      <path d={`M ${cx - 3} ${bodyY} L ${cx - 10} ${bodyY + 14} L ${cx - 3} ${bodyY + 14} Z`} fill="rgba(255,255,255,0.06)" />
      <path d={`M ${cx + 3} ${bodyY} L ${cx + 10} ${bodyY + 14} L ${cx + 3} ${bodyY + 14} Z`} fill="rgba(255,255,255,0.06)" />
      {/* Collar */}
      <path d={`M ${cx - 6} ${bodyY} L ${cx} ${bodyY + 6} L ${cx + 6} ${bodyY}`} fill="none" stroke="#e8e8e8" strokeWidth="1.2" />
      {/* Tie */}
      <path
        d={`M ${cx} ${bodyY + 5} L ${cx - 2.5} ${bodyY + 10} L ${cx} ${bodyY + 22} L ${cx + 2.5} ${bodyY + 10} Z`}
        fill={tieColor}
        opacity={0.85}
      />
    </>
  );
}

// ── Tracksuit Outfit ──
function TracksuitBody({ cx, bodyY, bodyW, bodyH, color }: { cx: number; bodyY: number; bodyW: number; bodyH: number; color: string }) {
  return (
    <>
      <rect x={cx - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={5} fill={color} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      {/* Zip line */}
      <line x1={cx} y1={bodyY + 2} x2={cx} y2={bodyY + bodyH - 4} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
      {/* Zip pull */}
      <rect x={cx - 1} y={bodyY + bodyH / 3} width={2} height={2.5} rx={0.5} fill="rgba(255,255,255,0.25)" />
      {/* Collar (zip collar) */}
      <path d={`M ${cx - 5} ${bodyY} Q ${cx} ${bodyY + 3} ${cx + 5} ${bodyY}`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* Side stripes */}
      <line x1={cx - bodyW / 2 + 2} y1={bodyY + 2} x2={cx - bodyW / 2 + 2} y2={bodyY + bodyH - 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
      <line x1={cx + bodyW / 2 - 2} y1={bodyY + 2} x2={cx + bodyW / 2 - 2} y2={bodyY + bodyH - 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
    </>
  );
}

// ── Polo Outfit ──
function PoloBody({ cx, bodyY, bodyW, bodyH, color, skinTone }: { cx: number; bodyY: number; bodyW: number; bodyH: number; color: string; skinTone: string }) {
  return (
    <>
      <rect x={cx - bodyW / 2} y={bodyY} width={bodyW} height={bodyH} rx={4} fill={color} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
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
function Hair({ cx, headY, headR, style, color, gender }: { cx: number; headY: number; headR: number; style: string; color: string; gender: string }) {
  if (style === 'none') return null;

  // Male hair styles
  if (gender === 'male') {
    switch (style) {
      case 'crew':
        return (
          <path
            d={`M ${cx - headR * 0.85} ${headY - headR * 0.35} Q ${cx} ${headY - headR * 1.35} ${cx + headR * 0.85} ${headY - headR * 0.35}`}
            fill={color}
            opacity={0.75}
          />
        );
      case 'short':
        return (
          <path
            d={`M ${cx - headR * 0.9} ${headY - headR * 0.3} Q ${cx} ${headY - headR * 1.5} ${cx + headR * 0.9} ${headY - headR * 0.3}`}
            fill={color}
          />
        );
      case 'side-part':
        return (
          <>
            <path
              d={`M ${cx - headR * 0.95} ${headY - headR * 0.25} Q ${cx - headR * 0.3} ${headY - headR * 1.55} ${cx + headR * 0.95} ${headY - headR * 0.3}`}
              fill={color}
            />
            <line x1={cx - headR * 0.5} y1={headY - headR * 0.9} x2={cx - headR * 0.9} y2={headY - headR * 0.3} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
          </>
        );
      case 'slicked':
        return (
          <path
            d={`M ${cx - headR * 0.95} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.45} ${cx + headR * 0.95} ${headY - headR * 0.2}`}
            fill={color}
            opacity={0.85}
          />
        );
      case 'medium':
        return (
          <>
            <path d={`M ${cx - headR} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.7} ${cx + headR} ${headY - headR * 0.2}`} fill={color} />
            <rect x={cx - headR * 1.05} y={headY - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={color} />
            <rect x={cx + headR * 0.75} y={headY - headR * 0.5} width={headR * 0.3} height={headR * 0.8} rx={headR * 0.1} fill={color} />
          </>
        );
      case 'curly':
        return (
          <g>
            <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.3} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.3}`} fill={color} />
            {/* Curl texture */}
            {[-0.6, -0.2, 0.2, 0.6].map((offset) => (
              <circle key={offset} cx={cx + headR * offset} cy={headY - headR * 1.1} r={headR * 0.2} fill={color} opacity={0.8} />
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
            fill={color}
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
          fill={color}
        />
      );
    case 'bob':
      return (
        <>
          <path d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.7} ${cx + headR} ${headY}`} fill={color} />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.2} width={headR * 0.3} height={headR * 1.0} rx={headR * 0.1} fill={color} />
          <rect x={cx + headR * 0.8} y={headY - headR * 0.2} width={headR * 0.3} height={headR * 1.0} rx={headR * 0.1} fill={color} />
        </>
      );
    case 'shoulder':
      return (
        <>
          <path d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.8} ${cx + headR} ${headY}`} fill={color} />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.3} width={headR * 0.28} height={headR * 1.6} rx={headR * 0.1} fill={color} />
          <rect x={cx + headR * 0.82} y={headY - headR * 0.3} width={headR * 0.28} height={headR * 1.6} rx={headR * 0.1} fill={color} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.2}`} fill={color} />
          {/* Ponytail band */}
          <circle cx={cx + headR * 0.5} cy={headY - headR * 0.9} r={headR * 0.18} fill={color} opacity={0.8} />
          {/* Ponytail flow */}
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
          <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.2}`} fill={color} />
          <circle cx={cx} cy={headY - headR * 1.35} r={headR * 0.4} fill={color} />
        </>
      );
    case 'long':
      return (
        <>
          <path d={`M ${cx - headR} ${headY} Q ${cx} ${headY - headR * 1.8} ${cx + headR} ${headY}`} fill={color} />
          <rect x={cx - headR * 1.1} y={headY - headR * 0.3} width={headR * 0.25} height={headR * 2.0} rx={headR * 0.1} fill={color} />
          <rect x={cx + headR * 0.85} y={headY - headR * 0.3} width={headR * 0.25} height={headR * 2.0} rx={headR * 0.1} fill={color} />
        </>
      );
    case 'braids':
      return (
        <>
          <path d={`M ${cx - headR * 0.9} ${headY - headR * 0.2} Q ${cx} ${headY - headR * 1.6} ${cx + headR * 0.9} ${headY - headR * 0.2}`} fill={color} />
          {/* Two braids */}
          <line x1={cx - headR * 0.7} y1={headY + headR * 0.1} x2={cx - headR * 0.9} y2={headY + headR * 1.5} stroke={color} strokeWidth={headR * 0.22} strokeLinecap="round" />
          <line x1={cx + headR * 0.7} y1={headY + headR * 0.1} x2={cx + headR * 0.9} y2={headY + headR * 1.5} stroke={color} strokeWidth={headR * 0.22} strokeLinecap="round" />
          {/* Braid ties */}
          <circle cx={cx - headR * 0.9} cy={headY + headR * 1.55} r={headR * 0.12} fill="#D4A017" />
          <circle cx={cx + headR * 0.9} cy={headY + headR * 1.55} r={headR * 0.12} fill="#D4A017" />
        </>
      );
    default:
      return null;
  }
}
