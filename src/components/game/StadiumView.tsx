import { cn } from '@/lib/utils';
import type { StadiumStands, StandKey } from '@/types/game';
import { STAND_INFO, getEffectiveStadiumLevel } from '@/utils/facilities';
import { FACILITY_MAX_LEVEL } from '@/config/gameBalance';
import { hapticLight } from '@/utils/haptics';

interface StadiumViewProps {
  stands: StadiumStands;
  selectedStand: StandKey | null;
  onSelectStand: (stand: StandKey) => void;
  upgradeInProgressType: string | null;
  clubColor: string;
  recommendedStand?: StandKey | null;
  /** When set, the matching stand briefly plays a gold ripple/flash celebration. */
  justUpgradedStand?: StandKey | null;
  /** Bumped each time a new upgrade completes — forces React to remount the
   *  ripple <g> so the CSS animation re-runs even when the same stand finishes twice. */
  justUpgradedNonce?: number;
}

const STAND_KEYS: StandKey[] = ['north', 'south', 'east', 'west'];

function getStandOpacity(level: number): number {
  if (level <= 0) return 0.15;
  return 0.2 + (level / FACILITY_MAX_LEVEL) * 0.8;
}

function getStandTier(level: number): string {
  if (level >= 10) return 'Elite';
  if (level >= 7) return 'Modern';
  if (level >= 4) return 'Covered';
  if (level >= 1) return 'Basic';
  return 'Empty';
}

export function StadiumView({ stands, selectedStand, onSelectStand, upgradeInProgressType, clubColor, recommendedStand, justUpgradedStand, justUpgradedNonce = 0 }: StadiumViewProps) {
  const isUpgrading = (stand: StandKey) => upgradeInProgressType === `stadium-${stand}`;
  const effectiveLevel = getEffectiveStadiumLevel({ stadiumStands: stands, trainingLevel: 0, youthLevel: 0, medicalLevel: 0, recoveryLevel: 0, upgradeInProgress: null });
  const showCorners = effectiveLevel >= 8;
  const allMax = stands.north >= FACILITY_MAX_LEVEL && stands.south >= FACILITY_MAX_LEVEL && stands.east >= FACILITY_MAX_LEVEL && stands.west >= FACILITY_MAX_LEVEL;
  const showFloodlights = effectiveLevel >= 6;

  return (
    <div className="relative w-full aspect-[16/11]">
      <svg viewBox="0 0 320 220" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Construction pattern for upgrading stands */}
          <pattern id="construction" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(43 96% 46%)" strokeWidth="2" opacity="0.4" />
          </pattern>
          {/* Soft glow for the selected stand — keep stdDev modest so the
              outline doesn't bleed into neighbouring stands. */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Floodlight cone — warm sodium-vapour tone fading to transparent. */}
          <radialGradient id="floodlight">
            <stop offset="0%" stopColor="hsl(48 100% 92%)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="hsl(46 100% 72%)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(46 100% 72%)" stopOpacity="0" />
          </radialGradient>
          {/* Pitch mow stripes — alternating shades of green. Slightly wider
              than before so the field reads as professional turf, not a
              flat block. */}
          <pattern id="mow" patternUnits="userSpaceOnUse" width="20" height="120">
            <rect width="20" height="120" fill="hsl(132 45% 19%)" />
            <rect x="10" width="10" height="120" fill="hsl(132 42% 23%)" />
          </pattern>
          {/* Pitch vignette — darkens the corners of the field so the stands
              feel like they're casting shade onto the turf at ground level. */}
          <radialGradient id="pitchVignette" cx="50%" cy="50%" r="65%">
            <stop offset="55%" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(0 0% 0%)" stopOpacity="0.45" />
          </radialGradient>
          {/* Goal net — fine crosshatch suggesting the back of the goal. */}
          <pattern id="goalNet" patternUnits="userSpaceOnUse" width="2" height="2">
            <path d="M 0 0 L 2 2 M 2 0 L 0 2" stroke="hsl(0 0% 92%)" strokeWidth="0.25" opacity="0.7" />
          </pattern>
          {/* Roof gradient — bright leading edge facing the pitch, fading to
              dark at the back. Sells the "viewed from above" perspective. */}
          <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(220 18% 22%)" />
            <stop offset="55%" stopColor="hsl(220 16% 16%)" />
            <stop offset="100%" stopColor="hsl(220 22% 9%)" />
          </linearGradient>
          {/* Dugout gradient — recessed bench look. */}
          <linearGradient id="dugoutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(220 20% 18%)" />
            <stop offset="100%" stopColor="hsl(220 25% 9%)" />
          </linearGradient>
          {/* Concourse gradient — darker walkway band at the inside edge of
              every stand, where the seating bowl meets the pitch barrier. */}
          <linearGradient id="concourseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(220 18% 8%)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(220 18% 6%)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Floodlight glow under the pitch — appears at higher tiers */}
        {showFloodlights && (
          <>
            <circle cx="60" cy="50" r="55" fill="url(#floodlight)" />
            <circle cx="260" cy="50" r="55" fill="url(#floodlight)" />
            <circle cx="60" cy="170" r="55" fill="url(#floodlight)" />
            <circle cx="260" cy="170" r="55" fill="url(#floodlight)" />
          </>
        )}

        {/* Pitch with mow stripes */}
        <rect x="60" y="50" width="200" height="120" rx="4" fill="url(#mow)" stroke="hsl(142 40% 30%)" strokeWidth="1" />
        {/* Subtle vignette inside the pitch — adds depth without obscuring lines */}
        <rect x="60" y="50" width="200" height="120" rx="4" fill="url(#pitchVignette)" pointerEvents="none" />

        {/* ── Pitch markings (white-ish, ~0.6 line) ────────────────── */}
        {/* Center circle + center spot */}
        <circle cx="160" cy="110" r="20" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <line x1="160" y1="50" x2="160" y2="170" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <circle cx="160" cy="110" r="1.6" fill="hsl(142 30% 92%)" opacity="0.95" />

        {/* Penalty boxes */}
        <rect x="60" y="80" width="30" height="60" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <rect x="230" y="80" width="30" height="60" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        {/* Goal (six-yard) boxes */}
        <rect x="60" y="95" width="12" height="30" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <rect x="248" y="95" width="12" height="30" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        {/* Penalty spots */}
        <circle cx="80" cy="110" r="0.9" fill="hsl(142 30% 92%)" opacity="0.95" />
        <circle cx="240" cy="110" r="0.9" fill="hsl(142 30% 92%)" opacity="0.95" />
        {/* Penalty arcs (D shapes) — drawn from the penalty box edge */}
        <path d="M 90 100 A 10 10 0 0 1 90 120" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <path d="M 230 100 A 10 10 0 0 0 230 120" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        {/* Corner arcs */}
        <path d="M 60 52 A 2 2 0 0 1 62 50" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <path d="M 258 50 A 2 2 0 0 1 260 52" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <path d="M 60 168 A 2 2 0 0 0 62 170" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />
        <path d="M 258 170 A 2 2 0 0 0 260 168" fill="none" stroke="hsl(142 30% 88%)" strokeWidth="0.6" opacity="0.85" />

        {/* ── Goals + nets (top-down silhouette outside the touchline) ── */}
        {/* Left goal */}
        <rect x="55" y="103" width="5" height="14" fill="url(#goalNet)" stroke="hsl(0 0% 95%)" strokeWidth="0.5" opacity="0.95" />
        {/* Right goal */}
        <rect x="260" y="103" width="5" height="14" fill="url(#goalNet)" stroke="hsl(0 0% 95%)" strokeWidth="0.5" opacity="0.95" />

        {/* ── Corner flags (tiny triangles) ─────────────────────────── */}
        <CornerFlag x={60} y={50} dir="tl" />
        <CornerFlag x={260} y={50} dir="tr" />
        <CornerFlag x={60} y={170} dir="bl" />
        <CornerFlag x={260} y={170} dir="br" />

        {/* ── Dugouts / technical areas on the south touchline ──────── */}
        <Dugout x={120} y={171} home />
        <Dugout x={170} y={171} />

        {/* North Stand — top, full width */}
        <StandRect
          x={50} y={6} width={220} height={36}
          standKey="north"
          level={stands.north}
          selected={selectedStand === 'north'}
          upgrading={isUpgrading('north')}
          recommended={recommendedStand === 'north'}
          justUpgraded={justUpgradedStand === 'north'}
          justUpgradedNonce={justUpgradedNonce}
          clubColor={clubColor}
          onClick={() => onSelectStand('north')}
        />

        {/* South Stand — bottom, full width */}
        <StandRect
          x={50} y={178} width={220} height={36}
          standKey="south"
          level={stands.south}
          selected={selectedStand === 'south'}
          upgrading={isUpgrading('south')}
          recommended={recommendedStand === 'south'}
          justUpgraded={justUpgradedStand === 'south'}
          justUpgradedNonce={justUpgradedNonce}
          clubColor={clubColor}
          onClick={() => onSelectStand('south')}
        />

        {/* West Stand — left side */}
        <StandRect
          x={6} y={46} width={40} height={128}
          standKey="west"
          level={stands.west}
          selected={selectedStand === 'west'}
          upgrading={isUpgrading('west')}
          recommended={recommendedStand === 'west'}
          justUpgraded={justUpgradedStand === 'west'}
          justUpgradedNonce={justUpgradedNonce}
          clubColor={clubColor}
          onClick={() => onSelectStand('west')}
        />

        {/* East Stand — right side */}
        <StandRect
          x={274} y={46} width={40} height={128}
          standKey="east"
          level={stands.east}
          selected={selectedStand === 'east'}
          upgrading={isUpgrading('east')}
          recommended={recommendedStand === 'east'}
          justUpgraded={justUpgradedStand === 'east'}
          justUpgradedNonce={justUpgradedNonce}
          clubColor={clubColor}
          onClick={() => onSelectStand('east')}
        />

        {/* Corner connectors — visible when effective stadium level >= 8 */}
        {showCorners && (
          <>
            {/* NW corner */}
            <rect x={46} y={38} width={18} height={12} rx={3}
              fill={clubColor} opacity={0.4}
              stroke={allMax ? GOLD : BORDER_DIM} strokeWidth={0.5} />
            {/* NE corner */}
            <rect x={256} y={38} width={18} height={12} rx={3}
              fill={clubColor} opacity={0.4}
              stroke={allMax ? GOLD : BORDER_DIM} strokeWidth={0.5} />
            {/* SW corner */}
            <rect x={46} y={170} width={18} height={12} rx={3}
              fill={clubColor} opacity={0.4}
              stroke={allMax ? GOLD : BORDER_DIM} strokeWidth={0.5} />
            {/* SE corner */}
            <rect x={256} y={170} width={18} height={12} rx={3}
              fill={clubColor} opacity={0.4}
              stroke={allMax ? GOLD : BORDER_DIM} strokeWidth={0.5} />
          </>
        )}

        {/* Floodlight pylons in the corners — switch on at effective level >= 6 */}
        {showFloodlights && (
          <>
            <FloodlightPylon cx={36} cy={36} on />
            <FloodlightPylon cx={284} cy={36} on />
            <FloodlightPylon cx={36} cy={184} on />
            <FloodlightPylon cx={284} cy={184} on />
          </>
        )}

        {/* Stand Labels */}
        {STAND_KEYS.map(key => {
          const pos = LABEL_POSITIONS[key];
          return (
            <g key={key}>
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                className={cn(
                  'text-[9px] font-semibold fill-current pointer-events-none select-none',
                  selectedStand === key ? 'text-primary' : 'text-foreground/80'
                )}
              >
                {STAND_INFO[key].label.replace(' Stand', '')}
              </text>
              <text
                x={pos.x}
                y={pos.y + 11}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[8px] fill-current text-muted-foreground pointer-events-none select-none"
              >
                Lv.{stands[key]} {getStandTier(stands[key])}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const LABEL_POSITIONS: Record<StandKey, { x: number; y: number }> = {
  north: { x: 160, y: 18 },
  south: { x: 160, y: 192 },
  west: { x: 26, y: 105 },
  east: { x: 294, y: 105 },
};

interface StandRectProps {
  x: number;
  y: number;
  width: number;
  height: number;
  standKey: StandKey;
  level: number;
  selected: boolean;
  upgrading: boolean;
  recommended: boolean;
  justUpgraded: boolean;
  justUpgradedNonce: number;
  clubColor: string;
  onClick: () => void;
}

const GOLD = 'hsl(43, 96%, 46%)';
const BORDER_DIM = 'hsl(222, 15%, 25%)';

/**
 * Deterministic pseudo-random in [0,1) seeded by integers — used to scatter
 * crowd dots so a stand looks the same every render but stands differ.
 */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function StandRect({ x, y, width, height, standKey, level, selected, upgrading, recommended, justUpgraded, justUpgradedNonce, clubColor, onClick }: StandRectProps) {
  const opacity = getStandOpacity(level);
  const isElite = level >= FACILITY_MAX_LEVEL;
  const handleClick = () => { hapticLight(); onClick(); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } };

  const horizontal = width > height;
  // "Inside edge" = the side of the stand that faces the pitch. We grow
  // depth FROM that edge OUTWARD, which mirrors how real bowls cantilever
  // back and up from the touchline.
  // For north stand, inside edge is the bottom (largest y). For south,
  // it's the top. For west, the right side. For east, the left side.
  const insideEdge: 'top' | 'bottom' | 'left' | 'right' =
    standKey === 'north' ? 'bottom' :
    standKey === 'south' ? 'top' :
    standKey === 'west' ? 'right' : 'left';

  // Tier rows scale with level. Higher levels add more rows = visibly
  // deeper bowl. We cap at 6 so everything stays readable at this size.
  const seatRows = Math.max(1, Math.min(6, Math.ceil(level / 2) + 1));
  const seatPerRow = horizontal ? 32 : 8;
  const fillPct = Math.min(1, level / FACILITY_MAX_LEVEL);
  // Random seed per-stand so each looks different but stable across renders.
  const seedBase = standKey.charCodeAt(0) * 31;

  // Stroke priority: selected > recommended > elite > dim
  const stroke = selected
    ? GOLD
    : recommended
      ? 'hsl(142 70% 50%)'
      : isElite
        ? GOLD
        : BORDER_DIM;
  const strokeWidth = selected || recommended ? 2 : 1;

  // Geometry helpers — the seating area sits inside the rounded rect with
  // a small inset, leaving room for roof + concourse strips.
  const inset = 2.5;
  const concourseSize = 3.5; // band along the inside edge (pitch-side)
  const roofSize = level >= 4 ? 3.5 : 0; // back-edge roof when level >= 4

  // The "seating bowl" rectangle (inside the roof + concourse strips).
  let bowlX = x + inset;
  let bowlY = y + inset;
  let bowlW = width - inset * 2;
  let bowlH = height - inset * 2;
  if (insideEdge === 'top') { bowlY += concourseSize; bowlH -= concourseSize + roofSize; }
  if (insideEdge === 'bottom') { bowlH -= concourseSize + roofSize; bowlY += roofSize; }
  if (insideEdge === 'left') { bowlX += concourseSize; bowlW -= concourseSize + roofSize; }
  if (insideEdge === 'right') { bowlW -= concourseSize + roofSize; bowlX += roofSize; }

  // Concourse band (next to pitch)
  const concourse = (() => {
    if (insideEdge === 'top') return { x: x + inset, y: y + inset, width: width - inset * 2, height: concourseSize };
    if (insideEdge === 'bottom') return { x: x + inset, y: y + height - inset - concourseSize, width: width - inset * 2, height: concourseSize };
    if (insideEdge === 'left') return { x: x + inset, y: y + inset, width: concourseSize, height: height - inset * 2 };
    return { x: x + width - inset - concourseSize, y: y + inset, width: concourseSize, height: height - inset * 2 };
  })();

  // Roof band (back edge — opposite the pitch). Only shown when level >= 4.
  const roof = (() => {
    if (insideEdge === 'top') return { x: x + inset, y: y + height - inset - roofSize, width: width - inset * 2, height: roofSize };
    if (insideEdge === 'bottom') return { x: x + inset, y: y + inset, width: width - inset * 2, height: roofSize };
    if (insideEdge === 'left') return { x: x + width - inset - roofSize, y: y + inset, width: roofSize, height: height - inset * 2 };
    return { x: x + inset, y: y + inset, width: roofSize, height: height - inset * 2 };
  })();

  // Helper: row index 0 is the front row (closest to pitch), seatRows-1 is back.
  // Returns the centre line of a row in the long axis of the stand.
  const rowGeometry = (row: number) => {
    const t = (row + 0.5) / seatRows; // 0..1 from front to back
    if (horizontal) {
      const cy = insideEdge === 'top'
        ? bowlY + t * bowlH
        : bowlY + (1 - t) * bowlH;
      return { axisStart: bowlX, axisEnd: bowlX + bowlW, cross: cy };
    }
    const cx = insideEdge === 'left'
      ? bowlX + t * bowlW
      : bowlX + (1 - t) * bowlW;
    return { axisStart: bowlY, axisEnd: bowlY + bowlH, cross: cx };
  };

  // Slightly brighter shade as rows climb — sells the "back row catches
  // more light from the roof" perception.
  const rowShade = (row: number) => 0.55 + 0.45 * (row / Math.max(1, seatRows - 1));

  return (
    <g
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={`${STAND_INFO[standKey].label}, level ${level}.${recommended ? ' Recommended next upgrade.' : ''} ${selected ? 'Selected.' : 'Tap to select.'}`}
    >
      {/* Recommended halo — soft pulse behind the stand */}
      {recommended && !selected && (
        <rect
          x={x - 2} y={y - 2} width={width + 4} height={height + 4} rx={8}
          fill="none"
          stroke="hsl(142 70% 50%)"
          strokeWidth={1}
          opacity={0.6}
          className="animate-pulse"
        />
      )}
      {/* Stand outer shell — tinted in club colour, depth gradient handled
          by the seat rows on top so the base just provides the silhouette. */}
      <rect
        x={x} y={y} width={width} height={height} rx={6}
        fill={clubColor}
        opacity={Math.max(0.18, opacity * 0.6)}
        stroke={stroke}
        strokeWidth={strokeWidth}
        filter={selected ? 'url(#glow)' : undefined}
      />
      {/* Concourse band — the dark walkway strip facing the pitch */}
      <rect
        x={concourse.x} y={concourse.y} width={concourse.width} height={concourse.height}
        rx={1}
        fill="url(#concourseGrad)"
        pointerEvents="none"
      />
      {/* LED perimeter board on the concourse — from level 5 up. Bright
          gold edge; cycles with the upgrade flash so it doesn't double up. */}
      {level >= 5 && !upgrading && (
        <rect
          x={horizontal ? concourse.x + 4 : concourse.x + concourse.width / 2 - 0.7}
          y={horizontal ? concourse.y + concourse.height / 2 - 0.6 : concourse.y + 4}
          width={horizontal ? concourse.width - 8 : 1.4}
          height={horizontal ? 1.2 : concourse.height - 8}
          rx={0.6}
          fill={GOLD}
          opacity={0.55}
          pointerEvents="none"
        />
      )}
      {/* Roof at the back edge — only at level 4+. Gradient sells depth. */}
      {level >= 4 && (
        <>
          <rect
            x={roof.x} y={roof.y} width={roof.width} height={roof.height}
            rx={1.2}
            fill="url(#roofGrad)"
            stroke="hsl(220 18% 28%)" strokeWidth={0.3}
            pointerEvents="none"
          />
          {/* Truss ribs — small ticks across the roof give it 3D-ness */}
          {Array.from({ length: horizontal ? 9 : 5 }).map((_, i) => {
            const t = (i + 0.5) / (horizontal ? 9 : 5);
            const x1 = horizontal ? roof.x + t * roof.width : roof.x + 0.6;
            const x2 = horizontal ? roof.x + t * roof.width : roof.x + roof.width - 0.6;
            const y1 = horizontal ? roof.y + 0.4 : roof.y + t * roof.height;
            const y2 = horizontal ? roof.y + roof.height - 0.4 : roof.y + t * roof.height;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(0 0% 100%)" strokeWidth={0.25} opacity={0.18} pointerEvents="none" />;
          })}
        </>
      )}
      {/* Tiered seating — rows of small seat ticks, fading from front (dim,
          shaded by roof) to back (bright). Seats only render once any
          construction is done, never during upgrades. */}
      {level >= 1 && !upgrading && (
        <g pointerEvents="none">
          {Array.from({ length: seatRows }, (_, row) => {
            const { axisStart, axisEnd, cross } = rowGeometry(row);
            const span = axisEnd - axisStart;
            const seatLen = horizontal ? span / seatPerRow * 0.8 : 1.2;
            const seatThk = horizontal ? 1.2 : span / seatPerRow * 0.8;
            const stepX = horizontal ? span / seatPerRow : 0;
            const stepY = horizontal ? 0 : span / seatPerRow;
            const shade = rowShade(row);
            return (
              <g key={row}>
                {Array.from({ length: seatPerRow }, (_, col) => {
                  // Random crowd presence per seat — increasingly likely with level
                  const r = rand(seedBase + row * 97 + col);
                  if (r > Math.max(0.15, fillPct)) return null;
                  const baseX = axisStart + (col + 0.1) * (horizontal ? stepX : 0);
                  const baseY = axisStart + (col + 0.1) * (horizontal ? 0 : stepY);
                  const sx = horizontal ? baseX : cross - seatThk / 2;
                  const sy = horizontal ? cross - seatThk / 2 : baseY;
                  // Most seats wear the club colour, sprinkled gold for the
                  // VIP/scarf vibe — and a few neutral whites to read as crowd.
                  const tone = rand(seedBase + row * 97 + col + 1000);
                  const fill = tone < 0.18
                    ? 'hsl(43 90% 70%)'
                    : tone < 0.32
                      ? 'hsl(0 0% 92%)'
                      : clubColor;
                  return (
                    <rect
                      key={col}
                      x={sx} y={sy}
                      width={horizontal ? seatLen : seatThk}
                      height={horizontal ? seatThk : seatLen}
                      rx={0.3}
                      fill={fill}
                      opacity={shade * Math.min(1, opacity + 0.45)}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      )}
      {/* Jumbotron — at level 7+. Mounted under the roof, facing the pitch. */}
      {level >= 7 && (
        <>
          {(() => {
            // Position the jumbotron centred along the long axis, just
            // inside the roof edge.
            const jw = horizontal ? width * 0.34 : 4.5;
            const jh = horizontal ? 4.5 : height * 0.34;
            const jx = horizontal
              ? x + width / 2 - jw / 2
              : insideEdge === 'left' ? roof.x + 0.5 : roof.x + roof.width - jw - 0.5;
            const jy = horizontal
              ? insideEdge === 'top' ? roof.y + 0.5 : roof.y + roof.height - jh - 0.5
              : y + height / 2 - jh / 2;
            return (
              <g pointerEvents="none">
                <rect x={jx - 0.5} y={jy - 0.5} width={jw + 1} height={jh + 1} rx={0.8}
                  fill="hsl(220 30% 5%)" opacity={0.95} />
                <rect x={jx} y={jy} width={jw} height={jh} rx={0.6}
                  fill={GOLD} opacity={0.55} />
                {/* Subtle scanline so the screen reads as "active" */}
                <line
                  x1={horizontal ? jx + 1 : jx + jw / 2}
                  y1={horizontal ? jy + jh / 2 : jy + 1}
                  x2={horizontal ? jx + jw - 1 : jx + jw / 2}
                  y2={horizontal ? jy + jh / 2 : jy + jh - 1}
                  stroke="hsl(0 0% 100%)" strokeWidth={0.25} opacity={0.4}
                />
              </g>
            );
          })()}
        </>
      )}
      {/* Construction overlay + crane silhouette */}
      {upgrading && (
        <>
          <rect
            x={x} y={y} width={width} height={height} rx={6}
            fill="url(#construction)"
            className="animate-pulse"
          />
          <ConstructionCrane x={x + width / 2} y={y + height / 2} scale={Math.min(width, height) / 50} />
        </>
      )}
      {/* Just-upgraded celebration — gold inner flash + two expanding rings.
          The {nonce} key forces a fresh mount so the CSS animation re-fires. */}
      {justUpgraded && (
        <g key={justUpgradedNonce} pointerEvents="none">
          <rect
            x={x} y={y} width={width} height={height} rx={6}
            fill={GOLD}
            className="stadium-upgrade-fill"
          />
          <rect
            x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx={8}
            fill="none"
            stroke={GOLD}
            strokeWidth={2}
            className="stadium-upgrade-ring"
          />
          <rect
            x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx={8}
            fill="none"
            stroke={GOLD}
            strokeWidth={1.5}
            className="stadium-upgrade-ring"
            style={{ animationDelay: '0.18s' }}
          />
        </g>
      )}
    </g>
  );
}

interface FloodlightPylonProps {
  cx: number;
  cy: number;
  on: boolean;
}

function FloodlightPylon({ cx, cy, on }: FloodlightPylonProps) {
  return (
    <g pointerEvents="none">
      <line x1={cx} y1={cy + 4} x2={cx} y2={cy - 6} stroke={BORDER_DIM} strokeWidth={1} />
      <circle cx={cx} cy={cy - 7} r={2.2} fill={on ? 'hsl(48 100% 78%)' : BORDER_DIM} opacity={on ? 1 : 0.6} />
      {on && <circle cx={cx} cy={cy - 7} r={4} fill="hsl(48 100% 78%)" opacity={0.25} className="animate-pulse" />}
    </g>
  );
}

interface CornerFlagProps {
  x: number;
  y: number;
  /** Which corner — controls the direction the flag triangle points. */
  dir: 'tl' | 'tr' | 'bl' | 'br';
}

/** Tiny corner flag — a 1.5px pole with a red pennant pointing inward. */
function CornerFlag({ x, y, dir }: CornerFlagProps) {
  const xSign = dir === 'tl' || dir === 'bl' ? 1 : -1;
  const ySign = dir === 'tl' || dir === 'tr' ? 1 : -1;
  const poleX = x;
  const poleTopY = y + ySign * 0.4;
  const poleBotY = y - ySign * 3.2;
  // Triangle pennant — pointing inward toward the pitch
  const tip = `${poleX + xSign * 3} ${poleBotY + ySign * 0.8}`;
  const top = `${poleX} ${poleBotY}`;
  const bot = `${poleX} ${poleBotY + ySign * 1.6}`;
  return (
    <g pointerEvents="none">
      <line x1={poleX} y1={poleTopY} x2={poleX} y2={poleBotY} stroke="hsl(0 0% 80%)" strokeWidth={0.4} />
      <polygon points={`${tip}, ${top}, ${bot}`} fill="hsl(0 80% 55%)" opacity={0.95} />
    </g>
  );
}

interface DugoutProps {
  x: number;
  y: number;
  /** Home dugout gets a primary-tinted bench top, away gets the muted one. */
  home?: boolean;
}

/** A small recessed bench shelter drawn just outside the touchline. */
function Dugout({ x, y, home }: DugoutProps) {
  const accent = home ? 'hsl(43 96% 50%)' : 'hsl(220 25% 55%)';
  return (
    <g pointerEvents="none">
      {/* Roof / shell */}
      <rect x={x - 11} y={y} width={22} height={5.5} rx={1.2}
        fill="url(#dugoutGrad)"
        stroke="hsl(220 18% 28%)" strokeWidth={0.4} />
      {/* Bench seats — three little rectangles */}
      <rect x={x - 8} y={y + 1.4} width={5} height={1.2} rx={0.3} fill={accent} opacity={0.7} />
      <rect x={x - 2.5} y={y + 1.4} width={5} height={1.2} rx={0.3} fill={accent} opacity={0.7} />
      <rect x={x + 3} y={y + 1.4} width={5} height={1.2} rx={0.3} fill={accent} opacity={0.7} />
      {/* Front edge highlight */}
      <line x1={x - 11} y1={y + 5.4} x2={x + 11} y2={y + 5.4} stroke="hsl(0 0% 100%)" strokeWidth={0.2} opacity={0.18} />
    </g>
  );
}

interface ConstructionCraneProps {
  x: number;
  y: number;
  scale: number;
}

/** Tiny tower-crane silhouette in the gold construction color. */
function ConstructionCrane({ x, y, scale }: ConstructionCraneProps) {
  const s = Math.max(0.5, Math.min(scale, 1.4));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      {/* Vertical mast */}
      <line x1={0} y1={6} x2={0} y2={-10} stroke={GOLD} strokeWidth={1.2} opacity={0.85} />
      {/* Horizontal jib */}
      <line x1={-9} y1={-10} x2={9} y2={-10} stroke={GOLD} strokeWidth={1.2} opacity={0.85} />
      {/* Counter-jib weight */}
      <rect x={-10} y={-11.5} width={3} height={3} fill={GOLD} opacity={0.85} />
      {/* Cable + hook */}
      <line x1={6} y1={-10} x2={6} y2={-3} stroke={GOLD} strokeWidth={0.6} opacity={0.7} />
      <circle cx={6} cy={-2} r={0.9} fill={GOLD} opacity={0.85} />
    </g>
  );
}
