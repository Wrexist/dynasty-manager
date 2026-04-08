import { cn } from '@/lib/utils';
import type { StadiumStands, StandKey } from '@/types/game';
import { STAND_INFO } from '@/utils/facilities';
import { FACILITY_MAX_LEVEL } from '@/config/gameBalance';

interface StadiumViewProps {
  stands: StadiumStands;
  selectedStand: StandKey | null;
  onSelectStand: (stand: StandKey) => void;
  upgradeInProgressType: string | null;
  clubColor: string;
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

export function StadiumView({ stands, selectedStand, onSelectStand, upgradeInProgressType, clubColor }: StadiumViewProps) {
  const isUpgrading = (stand: StandKey) => upgradeInProgressType === `stadium-${stand}`;

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/11' }}>
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
        </defs>

        {/* Pitch */}
        <rect x="60" y="50" width="200" height="120" rx="4" fill="hsl(142 40% 18%)" stroke="hsl(142 40% 30%)" strokeWidth="1" />
        {/* Center circle */}
        <circle cx="160" cy="110" r="20" fill="none" stroke="hsl(142 40% 30%)" strokeWidth="0.5" />
        {/* Center line */}
        <line x1="160" y1="50" x2="160" y2="170" stroke="hsl(142 40% 30%)" strokeWidth="0.5" />
        {/* Center dot */}
        <circle cx="160" cy="110" r="2" fill="hsl(142 40% 30%)" />
        {/* Penalty boxes */}
        <rect x="60" y="80" width="30" height="60" fill="none" stroke="hsl(142 40% 30%)" strokeWidth="0.5" />
        <rect x="230" y="80" width="30" height="60" fill="none" stroke="hsl(142 40% 30%)" strokeWidth="0.5" />
        {/* Goal boxes */}
        <rect x="60" y="95" width="12" height="30" fill="none" stroke="hsl(142 40% 30%)" strokeWidth="0.5" />
        <rect x="248" y="95" width="12" height="30" fill="none" stroke="hsl(142 40% 30%)" strokeWidth="0.5" />

        {/* North Stand — top, full width */}
        <StandRect
          x={50} y={6} width={220} height={36}
          standKey="north"
          level={stands.north}
          selected={selectedStand === 'north'}
          upgrading={isUpgrading('north')}
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
          clubColor={clubColor}
          onClick={() => onSelectStand('east')}
        />

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
  clubColor: string;
  onClick: () => void;
}

function StandRect({ x, y, width, height, level, selected, upgrading, clubColor, onClick }: StandRectProps) {
  const opacity = getStandOpacity(level);
  const isElite = level >= FACILITY_MAX_LEVEL;

  return (
    <g onClick={onClick} className="cursor-pointer" role="button" tabIndex={0}>
      {/* Stand base */}
      <rect
        x={x} y={y} width={width} height={height} rx={6}
        fill={clubColor}
        opacity={opacity}
        stroke={selected ? 'hsl(43 96% 46%)' : isElite ? 'hsl(43 96% 46%)' : 'hsl(222 15% 25%)'}
        strokeWidth={selected ? 2 : 1}
        filter={selected ? 'url(#glow)' : undefined}
      />
      {/* Roof indicator for level 4+ */}
      {level >= 4 && (
        <line
          x1={x + 4} y1={y + 2} x2={x + width - 4} y2={y + 2}
          stroke={clubColor}
          strokeWidth="2"
          opacity={Math.min(1, opacity + 0.2)}
        />
      )}
      {/* Luxury boxes indicator for level 7+ */}
      {level >= 7 && (
        <rect
          x={x + width * 0.3} y={y + height * 0.15}
          width={width * 0.4} height={height * 0.15}
          rx={2}
          fill="hsl(43 96% 46%)"
          opacity={0.25}
        />
      )}
      {/* Construction overlay */}
      {upgrading && (
        <rect
          x={x} y={y} width={width} height={height} rx={6}
          fill="url(#construction)"
          className="animate-pulse"
        />
      )}
      {/* Seat rows — visual detail */}
      {level >= 1 && Array.from({ length: Math.min(level, 5) }, (_, i) => (
        <line
          key={i}
          x1={x + 6}
          y1={y + 8 + i * (height - 12) / 5}
          x2={x + width - 6}
          y2={y + 8 + i * (height - 12) / 5}
          stroke={clubColor}
          strokeWidth="0.5"
          opacity={0.3}
        />
      ))}
    </g>
  );
}
