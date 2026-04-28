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
          {/* Glow filter for selected stand */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Floodlight cone */}
          <radialGradient id="floodlight">
            <stop offset="0%" stopColor="hsl(48 100% 88%)" stopOpacity="0.55" />
            <stop offset="60%" stopColor="hsl(48 100% 70%)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(48 100% 70%)" stopOpacity="0" />
          </radialGradient>
          {/* Pitch mow stripes */}
          <pattern id="mow" patternUnits="userSpaceOnUse" width="20" height="120">
            <rect width="20" height="120" fill="hsl(142 40% 18%)" />
            <rect x="10" width="10" height="120" fill="hsl(142 40% 21%)" />
          </pattern>
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
        {/* Center circle */}
        <circle cx="160" cy="110" r="20" fill="none" stroke="hsl(142 30% 75%)" strokeWidth="0.5" opacity="0.7" />
        {/* Center line */}
        <line x1="160" y1="50" x2="160" y2="170" stroke="hsl(142 30% 75%)" strokeWidth="0.5" opacity="0.7" />
        {/* Center dot */}
        <circle cx="160" cy="110" r="2" fill="hsl(142 30% 75%)" opacity="0.8" />
        {/* Penalty boxes */}
        <rect x="60" y="80" width="30" height="60" fill="none" stroke="hsl(142 30% 75%)" strokeWidth="0.5" opacity="0.7" />
        <rect x="230" y="80" width="30" height="60" fill="none" stroke="hsl(142 30% 75%)" strokeWidth="0.5" opacity="0.7" />
        {/* Goal boxes */}
        <rect x="60" y="95" width="12" height="30" fill="none" stroke="hsl(142 30% 75%)" strokeWidth="0.5" opacity="0.7" />
        <rect x="248" y="95" width="12" height="30" fill="none" stroke="hsl(142 30% 75%)" strokeWidth="0.5" opacity="0.7" />

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

  // Crowd density — packed at high levels, sparse at low. Each stand seeds
  // a different random grid so they don't look identical.
  const seedBase = standKey.charCodeAt(0) * 31;
  const cols = width > height ? 22 : 4;
  const rows = width > height ? 4 : 22;
  const fillPct = Math.min(1, level / FACILITY_MAX_LEVEL);
  const dotR = 0.7;

  // Stroke priority: selected > recommended > elite > dim
  const stroke = selected
    ? GOLD
    : recommended
      ? 'hsl(142 70% 50%)'
      : isElite
        ? GOLD
        : BORDER_DIM;
  const strokeWidth = selected || recommended ? 2 : 1;

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
      {/* Stand base */}
      <rect
        x={x} y={y} width={width} height={height} rx={6}
        fill={clubColor}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        filter={selected ? 'url(#glow)' : undefined}
      />
      {/* Crowd density — tiny dots that fill up as the stand levels up */}
      {level >= 1 && !upgrading && (
        <g pointerEvents="none">
          {Array.from({ length: cols * rows }, (_, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const r = rand(seedBase + i);
            if (r > fillPct) return null;
            const cx = x + 6 + (col + 0.5) * ((width - 12) / cols);
            const cy = y + 6 + (row + 0.5) * ((height - 12) / rows);
            // Mix between club color and a warm crowd tone for variety
            const useGold = rand(seedBase + i + 1000) < 0.25;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={dotR}
                fill={useGold ? 'hsl(43 90% 70%)' : clubColor}
                opacity={Math.min(1, opacity + 0.35)}
              />
            );
          })}
        </g>
      )}
      {/* Roof indicator for level 4+ */}
      {level >= 4 && (
        <line
          x1={x + 4} y1={y + 2} x2={x + width - 4} y2={y + 2}
          stroke={clubColor}
          strokeWidth="2"
          opacity={Math.min(1, opacity + 0.2)}
        />
      )}
      {/* Jumbotron / luxury boxes for level 7+ */}
      {level >= 7 && (
        <>
          <rect
            x={x + width * 0.3} y={y + height * 0.15}
            width={width * 0.4} height={height * 0.18}
            rx={1.5}
            fill="hsl(220 30% 8%)"
            opacity={0.85}
          />
          <rect
            x={x + width * 0.3 + 0.5} y={y + height * 0.15 + 0.5}
            width={width * 0.4 - 1} height={height * 0.18 - 1}
            rx={1}
            fill={GOLD}
            opacity={0.35}
          />
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
