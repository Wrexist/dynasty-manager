import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Dumbbell, Flame, Shield, Brain, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrainingModule } from '@/types/game';

const SQUAD_SUB_NAV = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

const MODULE_INFO: { module: TrainingModule; label: string; icon: React.ElementType; color: string }[] = [
  { module: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'text-emerald-400' },
  { module: 'attacking', label: 'Attacking', icon: Flame, color: 'text-red-400' },
  { module: 'defending', label: 'Defending', icon: Shield, color: 'text-blue-400' },
  { module: 'mentality', label: 'Mentality', icon: Brain, color: 'text-purple-400' },
  { module: 'set-pieces', label: 'Set Pieces', icon: Target, color: 'text-amber-400' },
  { module: 'tactical', label: 'Tactical', icon: Zap, color: 'text-primary' },
];

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const TrainingPage = () => {
  const { training, updateTraining } = useGameStore();
  const { schedule, intensity, tacticalFamiliarity } = training;

  const handleDayChange = (day: typeof DAYS[number], mod: TrainingModule) => {
    updateTraining({ [day]: mod });
  };

  const handleIntensity = (val: 'light' | 'medium' | 'heavy') => {
    updateTraining({}, val);
  };

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <div className="px-4 pb-4 space-y-3">
        <h2 className="text-lg font-display font-bold text-foreground">Training</h2>

        {/* Weekly Schedule */}
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Weekly Schedule</h3>
          <div className="space-y-2">
            {DAYS.map((day, i) => {
              const current = schedule[day];
              const info = MODULE_INFO.find(m => m.module === current);
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{DAY_LABELS[i]}</span>
                  <div className="flex gap-1.5 flex-1 overflow-x-auto">
                    {MODULE_INFO.map(({ module, label, icon: Icon, color }) => (
                      <button
                        key={module}
                        onClick={() => handleDayChange(day, module)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all shrink-0',
                          current === module
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        {/* Intensity */}
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Training Intensity</h3>
          <div className="flex gap-2">
            {(['light', 'medium', 'heavy'] as const).map(level => (
              <button
                key={level}
                onClick={() => handleIntensity(level)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-xs font-semibold capitalize transition-all',
                  intensity === level
                    ? level === 'heavy' ? 'bg-destructive/20 text-destructive border border-destructive/30'
                    : level === 'light' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Injury Risk:</span>
            <span className={cn('text-[10px] font-semibold',
              intensity === 'heavy' ? 'text-destructive' : intensity === 'light' ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {intensity === 'heavy' ? 'High' : intensity === 'light' ? 'Low' : 'Medium'}
            </span>
          </div>
        </GlassPanel>

        {/* Tactical Familiarity */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Tactical Familiarity</h3>
            <span className="text-sm font-bold text-primary tabular-nums">{tacticalFamiliarity}%</span>
          </div>
          <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${tacticalFamiliarity}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Train 'Tactical' to improve familiarity with your formation and instructions.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
};

export default TrainingPage;
