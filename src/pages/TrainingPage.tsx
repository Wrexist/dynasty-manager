import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Dumbbell, Flame, Shield, Brain, Target, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrainingModule } from '@/types/game';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS, HELP_TEXTS } from '@/config/ui';
import { InfoTip } from '@/components/game/InfoTip';
import { hapticLight } from '@/utils/haptics';
import { TRAINING_PRESETS } from '@/config/training';
import { getTrainingRecommendation } from '@/utils/training';

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

const ATTR_LABELS: Record<string, string> = {
  pace: 'PAC', shooting: 'SHO', passing: 'PAS', defending: 'DEF', physical: 'PHY', mental: 'MEN',
};

const TrainingPage = () => {
  const { training, updateTraining, players, clubs, playerClubId, selectPlayer, setScreen } = useGameStore();
  const { schedule, intensity, tacticalFamiliarity } = training;
  const club = clubs[playerClubId];
  const [showAllDev, setShowAllDev] = useState(false);

  const handleDayChange = (day: typeof DAYS[number], mod: TrainingModule) => {
    hapticLight();
    updateTraining({ [day]: mod });
  };

  const handleIntensity = (val: 'light' | 'medium' | 'heavy') => {
    hapticLight();
    updateTraining({}, val);
  };

  const handlePreset = (preset: typeof TRAINING_PRESETS[number]) => {
    hapticLight();
    updateTraining(preset.schedule);
  };

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <div className="px-4 pb-4 space-y-3">
        <PageHint screen="training" title={PAGE_HINTS.training.title} body={PAGE_HINTS.training.body} />
        <h2 className="text-lg font-display font-bold text-foreground">Training</h2>

        {/* Training Recommendation */}
        {(() => {
          if (!club) return null;
          const squadPlayers = club.playerIds.map(id => players[id]).filter(Boolean);
          const rec = getTrainingRecommendation(squadPlayers);
          if (!rec) return null;
          const recInfo = MODULE_INFO.find(m => m.module === rec.module);
          const RecIcon = recInfo?.icon || Dumbbell;
          return (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <RecIcon className={cn('w-3.5 h-3.5 shrink-0', recInfo?.color || 'text-primary')} />
              <span className="text-[11px] text-muted-foreground">
                <span className="text-foreground font-medium">Suggested: </span>
                {rec.reason}
              </span>
            </div>
          );
        })()}

        {/* Training Presets */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TRAINING_PRESETS.map(preset => {
            const isActive = DAYS.every(d => schedule[d] === preset.schedule[d]);
            return (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Weekly Schedule */}
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Weekly Schedule</h3>
          <div className="space-y-2">
            {DAYS.map((day, i) => {
              const current = schedule[day];
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{DAY_LABELS[i]}</span>
                  <div className="flex gap-1.5 flex-1 overflow-x-auto">
                    {MODULE_INFO.map(({ module, label, icon: Icon, color: _color }) => (
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
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground">Training Intensity</h3>
            <InfoTip text={HELP_TEXTS.trainingIntensity} />
          </div>
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Tactical Familiarity</h3>
              <InfoTip text={HELP_TEXTS.tacticalFamiliarity} />
            </div>
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

        {/* Individual Training Plans */}
        {(() => {
          if (!club) return null;
          const plans = (training.individualPlans || [])
            .map(plan => {
              const p = players[plan.playerId];
              if (!p) return null;
              const info = MODULE_INFO.find(m => m.module === plan.focus);
              return { player: p, focus: plan.focus, info };
            })
            .filter(Boolean);
          const totalPlayers = club.playerIds.length;
          return (
            <GlassPanel className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Individual Plans</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">{plans.length}/{totalPlayers} players</span>
              </div>
              {plans.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Set individual training focuses from player detail pages for +50% targeted gains.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {plans.map(item => {
                    const Icon = item.info?.icon || Dumbbell;
                    return (
                      <button
                        key={item.player.id}
                        onClick={() => { selectPlayer(item.player.id); setScreen('player-detail'); }}
                        className="flex items-center gap-2 w-full text-left hover:bg-muted/30 rounded-md px-1.5 py-1 transition-colors"
                      >
                        <span className="text-xs text-foreground font-medium truncate flex-1">
                          {item.player.firstName[0]}. {item.player.lastName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{item.player.position}</span>
                        <div className={cn('flex items-center gap-1 text-[10px] font-medium', item.info?.color || 'text-primary')}>
                          <Icon className="w-3 h-3" />
                          {item.info?.label || item.focus}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </GlassPanel>
          );
        })()}

        {/* Recent Development */}
        {(() => {
          if (!club) return null;
          const devChanges = club.playerIds
            .map(id => players[id])
            .filter(Boolean)
            .filter(p => p.growthDelta != null && p.growthDelta !== 0)
            .sort((a, b) => Math.abs(b.growthDelta || 0) - Math.abs(a.growthDelta || 0));
          if (devChanges.length === 0) return null;
          const shown = showAllDev ? devChanges : devChanges.slice(0, 5);
          return (
            <GlassPanel className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Development</h3>
              <div className={cn('space-y-2', showAllDev && 'max-h-64 overflow-y-auto')}>
                {shown.map(p => {
                  const gains = p.lastTrainingGains || {};
                  const gainLabels = Object.keys(gains).map(a => ATTR_LABELS[a] || a);
                  return (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-foreground font-medium truncate">{p.firstName[0]}. {p.lastName}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">({p.position})</span>
                        {gainLabels.length > 0 && (
                          <span className="text-[9px] text-emerald-400/70 truncate">+{gainLabels.join(', ')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">{p.overall - (p.growthDelta || 0)}</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className={cn(
                          'text-xs font-bold tabular-nums',
                          (p.growthDelta || 0) > 0 ? 'text-emerald-400' : 'text-destructive'
                        )}>
                          {p.overall}
                        </span>
                        <span className={cn(
                          'text-[10px] font-bold',
                          (p.growthDelta || 0) > 0 ? 'text-emerald-400' : 'text-destructive'
                        )}>
                          {(p.growthDelta || 0) > 0 ? '↑' : '↓'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {devChanges.length > 5 && (
                <button
                  onClick={() => setShowAllDev(!showAllDev)}
                  className="flex items-center gap-1 text-[10px] text-primary mt-2 mx-auto"
                >
                  {showAllDev ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllDev ? 'Show less' : `Show all (${devChanges.length})`}
                </button>
              )}
            </GlassPanel>
          );
        })()}
      </div>
    </div>
  );
};

export default TrainingPage;
