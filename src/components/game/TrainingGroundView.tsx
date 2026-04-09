/**
 * Training Ground SVG visualization that evolves with facility level.
 * Shows 6 drill stations arranged around a central pitch area.
 */
import { cn } from '@/lib/utils';
import { FACILITY_MAX_LEVEL } from '@/config/gameBalance';
import type { TrainingModule } from '@/types/game';

interface TrainingGroundViewProps {
  trainingLevel: number;
  activeModule: TrainingModule | null;
  schedule: Record<string, TrainingModule>;
  clubColor: string;
}

const MODULE_POSITIONS: Record<TrainingModule, { x: number; y: number; label: string }> = {
  fitness: { x: 50, y: 30, label: 'Fitness' },
  attacking: { x: 250, y: 30, label: 'Attack' },
  defending: { x: 50, y: 170, label: 'Defence' },
  mentality: { x: 250, y: 170, label: 'Mental' },
  'set-pieces': { x: 50, y: 100, label: 'Set Pieces' },
  tactical: { x: 250, y: 100, label: 'Tactical' },
};

const MODULE_COLORS: Record<TrainingModule, string> = {
  fitness: '#22c55e',
  attacking: '#ef4444',
  defending: '#3b82f6',
  mentality: '#a855f7',
  'set-pieces': '#f59e0b',
  tactical: '#06b6d4',
};

function getStationOpacity(level: number): number {
  if (level <= 0) return 0.15;
  return 0.25 + (level / FACILITY_MAX_LEVEL) * 0.75;
}

function getTierLabel(level: number): string {
  if (level >= 10) return 'Elite';
  if (level >= 7) return 'Advanced';
  if (level >= 4) return 'Standard';
  if (level >= 1) return 'Basic';
  return 'None';
}

export function TrainingGroundView({ trainingLevel, activeModule, schedule, clubColor }: TrainingGroundViewProps) {
  const opacity = getStationOpacity(trainingLevel);
  const showAdvanced = trainingLevel >= 4;
  const showElite = trainingLevel >= 7;
  const todayModules = new Set(Object.values(schedule));

  return (
    <div className="relative w-full aspect-[16/9]">
      <svg viewBox="0 0 320 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Ground base */}
        <rect x="0" y="0" width="320" height="200" rx="8" fill="hsl(222 30% 10%)" />

        {/* Central pitch area */}
        <rect x="110" y="40" width="100" height="120" rx="4" fill="hsl(142 40% 14%)" stroke="hsl(142 40% 25%)" strokeWidth="0.8" />
        {/* Center circle */}
        <circle cx="160" cy="100" r="16" fill="none" stroke="hsl(142 40% 25%)" strokeWidth="0.5" />
        {/* Center dot */}
        <circle cx="160" cy="100" r="2" fill="hsl(142 40% 25%)" />

        {/* Training stations */}
        {(Object.entries(MODULE_POSITIONS) as [TrainingModule, typeof MODULE_POSITIONS[TrainingModule]][]).map(([module, pos]) => {
          const isActive = activeModule === module;
          const isScheduled = todayModules.has(module);
          const color = MODULE_COLORS[module];

          return (
            <g key={module}>
              {/* Station base */}
              <rect
                x={pos.x} y={pos.y} width={60} height={28} rx={4}
                fill={color}
                opacity={isActive ? 0.9 : isScheduled ? 0.5 : opacity * 0.5}
                stroke={isActive ? 'hsl(43, 96%, 46%)' : 'hsl(222, 15%, 25%)'}
                strokeWidth={isActive ? 1.5 : 0.5}
              />
              {/* Station label */}
              <text
                x={pos.x + 30} y={pos.y + 12}
                textAnchor="middle"
                dominantBaseline="central"
                className={cn(
                  'text-[7px] font-semibold fill-current pointer-events-none select-none',
                  isActive ? 'text-white' : 'text-foreground/80'
                )}
              >
                {pos.label}
              </text>
              {/* Equipment indicators (visible at higher levels) */}
              {showAdvanced && (
                <rect
                  x={pos.x + 4} y={pos.y + 18}
                  width={52} height={6} rx={2}
                  fill={color} opacity={0.3}
                />
              )}
              {showElite && (
                <>
                  <circle cx={pos.x + 10} cy={pos.y + 21} r={2} fill="white" opacity={0.4} />
                  <circle cx={pos.x + 50} cy={pos.y + 21} r={2} fill="white" opacity={0.4} />
                </>
              )}
              {/* Active pulse indicator */}
              {isScheduled && (
                <circle
                  cx={pos.x + 55} cy={pos.y + 5}
                  r={3}
                  fill={color}
                  className="animate-pulse"
                />
              )}
            </g>
          );
        })}

        {/* Facility level indicator */}
        <text x="160" y="15" textAnchor="middle" className="text-[8px] font-semibold fill-current text-muted-foreground select-none">
          Training Ground — Lv.{trainingLevel} {getTierLabel(trainingLevel)}
        </text>

        {/* Connectors from stations to pitch (visible at level 7+) */}
        {showElite && (
          <>
            <line x1="110" y1="44" x2="110" y2="44" stroke={clubColor} strokeWidth="0.5" opacity={0.3} />
          </>
        )}

        {/* Track/running path around pitch (visible at level 4+) */}
        {showAdvanced && (
          <rect x="105" y="35" width="110" height="130" rx="6"
            fill="none" stroke="hsl(43, 96%, 46%)" strokeWidth="0.3" strokeDasharray="3 2" opacity={0.25} />
        )}
      </svg>
    </div>
  );
}
