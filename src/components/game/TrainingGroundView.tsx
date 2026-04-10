/**
 * Training Facility Header — interactive module overview with facility level indicator.
 * Includes day selector pills, module tiles, and streak indicator.
 */
import { cn } from '@/lib/utils';
import { FACILITY_MAX_LEVEL } from '@/config/gameBalance';
import { MODULE_ATTR_MAP } from '@/config/training';
import { Dumbbell, Flame, Shield, Brain, Target, Zap } from 'lucide-react';
import type { TrainingModule, TrainingSchedule } from '@/types/game';

interface TrainingGroundViewProps {
  trainingLevel: number;
  activeModule: TrainingModule | null;
  schedule: TrainingSchedule;
  activeDay: string;
  onDayChange: (day: string) => void;
  onModuleSelect?: (module: TrainingModule) => void;
  dominantModule?: TrainingModule;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const MODULES: { module: TrainingModule; label: string; icon: React.ElementType }[] = [
  { module: 'fitness', label: 'Fitness', icon: Dumbbell },
  { module: 'attacking', label: 'Attack', icon: Flame },
  { module: 'defending', label: 'Defence', icon: Shield },
  { module: 'mentality', label: 'Mental', icon: Brain },
  { module: 'set-pieces', label: 'Set Pieces', icon: Target },
  { module: 'tactical', label: 'Tactical', icon: Zap },
];

const MODULE_STYLES: Record<TrainingModule, { bg: string; border: string; text: string; bar: string; dot: string }> = {
  fitness: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-400' },
  attacking: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', bar: 'bg-red-500', dot: 'bg-red-400' },
  defending: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500', dot: 'bg-blue-400' },
  mentality: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', bar: 'bg-purple-500', dot: 'bg-purple-400' },
  'set-pieces': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500', dot: 'bg-amber-400' },
  tactical: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', bar: 'bg-primary', dot: 'bg-primary' },
};

const ATTR_LABELS: Record<string, string> = {
  pace: 'PAC', shooting: 'SHO', passing: 'PAS', defending: 'DEF', physical: 'PHY', mental: 'MEN',
};

function getTierLabel(level: number): string {
  if (level >= 10) return 'Elite';
  if (level >= 7) return 'Advanced';
  if (level >= 4) return 'Standard';
  if (level >= 1) return 'Basic';
  return 'None';
}

function getTierColor(level: number): string {
  if (level >= 10) return 'text-yellow-400';
  if (level >= 7) return 'text-primary';
  if (level >= 4) return 'text-foreground';
  return 'text-muted-foreground';
}

function getBarColor(level: number): string {
  if (level >= 10) return 'bg-yellow-400';
  if (level >= 7) return 'bg-primary';
  if (level >= 4) return 'bg-foreground/60';
  return 'bg-muted-foreground/50';
}

export function TrainingGroundView({
  trainingLevel, activeModule, schedule, activeDay, onDayChange, onModuleSelect, dominantModule,
}: TrainingGroundViewProps) {
  const dayCount = (mod: TrainingModule) => Object.values(schedule).filter(m => m === mod).length;

  return (
    <div className="space-y-3">
      {/* Facility Level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground">Training Ground</h3>
          <span className={cn('text-[10px] font-bold', getTierColor(trainingLevel))}>
            Lv.{trainingLevel} {getTierLabel(trainingLevel)}
          </span>
        </div>
      </div>

      {/* Level Progress Bar */}
      <div className="flex gap-0.5">
        {Array.from({ length: FACILITY_MAX_LEVEL }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all',
              i < trainingLevel ? getBarColor(trainingLevel) : 'bg-muted/30'
            )}
          />
        ))}
      </div>

      {/* Day Selector Pills */}
      <div className="flex gap-1">
        {DAYS.map((day, i) => {
          const isActive = activeDay === day;
          const dayModule = schedule[day];
          const styles = dayModule ? MODULE_STYLES[dayModule] : null;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayChange(day)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                isActive
                  ? 'bg-muted/50 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/20'
              )}
            >
              {styles && <div className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} />}
              {DAY_LABELS[i]}
            </button>
          );
        })}
      </div>

      {/* Module Tiles — 3x2 grid */}
      <div className="grid grid-cols-3 gap-2">
        {MODULES.map(({ module, label, icon: Icon }) => {
          const isActive = activeModule === module;
          const days = dayCount(module);
          const styles = MODULE_STYLES[module];
          const attrs = MODULE_ATTR_MAP[module] || [];
          const isDominant = dominantModule === module;

          return (
            <button
              key={module}
              type="button"
              onClick={() => onModuleSelect?.(module)}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all',
                isActive
                  ? cn(styles.bg, styles.border)
                  : 'bg-muted/15 border-transparent hover:bg-muted/30'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? styles.text : 'text-muted-foreground')} />
              <div className="flex items-center gap-0.5">
                <span className={cn('text-[11px] font-semibold leading-tight', isActive ? styles.text : 'text-muted-foreground')}>
                  {label}
                </span>
                {isDominant && <Flame className="w-2.5 h-2.5 text-primary shrink-0" />}
              </div>
              {/* Days scheduled dots */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1 h-1 rounded-full transition-all',
                      i < days ? styles.bar : 'bg-muted/30'
                    )}
                  />
                ))}
              </div>
              {/* Attribute tags */}
              <span className="text-[8px] text-muted-foreground/70 leading-tight">
                {attrs.map(a => ATTR_LABELS[a] || a).join(' / ')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
