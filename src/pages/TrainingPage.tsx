import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { Dumbbell, Flame, Shield, Brain, Target, Zap, ChevronDown, ChevronUp, Trophy, AlertTriangle, TrendingUp, Heart, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrainingModule } from '@/types/game';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS, HELP_TEXTS } from '@/config/ui';
import { InfoTip } from '@/components/game/InfoTip';
import { hapticLight } from '@/utils/haptics';
import { successToast } from '@/utils/gameToast';
import { TRAINING_PRESETS, DRILLS_BY_MODULE, STREAK_THRESHOLDS, STREAK_MULTIPLIERS } from '@/config/training';
import { getTrainingRecommendation, getTrainingEffectivenessPreview, getSquadFitnessDistribution, getStreakTier, getDominantTrainingFocus } from '@/utils/training';
import { getTrainingMultiplier } from '@/utils/personality';
import { getStaffBonus } from '@/utils/staff';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

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

const MODULE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'fitness': { bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  'attacking': { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', dot: 'bg-red-400' },
  'defending': { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', dot: 'bg-blue-400' },
  'mentality': { bg: 'bg-purple-500/15', border: 'border-purple-500/40', text: 'text-purple-400', dot: 'bg-purple-400' },
  'set-pieces': { bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400', dot: 'bg-amber-400' },
  'tactical': { bg: 'bg-primary/15', border: 'border-primary/40', text: 'text-primary', dot: 'bg-primary' },
};

const TrainingPage = () => {
  const { training, updateTraining, updateDrillSchedule, setIndividualTraining, players, clubs, playerClubId, selectPlayer, setScreen, staff } = useGameStore();
  const { schedule, intensity, tacticalFamiliarity } = training;
  const club = clubs[playerClubId];
  const [showAllDev, setShowAllDev] = useState(false);
  const [activeDay, setActiveDay] = useState<typeof DAYS[number]>('mon');
  const [showIndividualTraining, setShowIndividualTraining] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const squadPlayers = useMemo(() => {
    if (!club) return [];
    return club.playerIds.map(id => players[id]).filter(Boolean);
  }, [club, players]);

  const staffBonus = useMemo(() => {
    const ftc = getStaffBonus(staff.members, 'first-team-coach');
    const fc = getStaffBonus(staff.members, 'fitness-coach');
    return ftc + fc * 0.5;
  }, [staff.members]);

  const handleDayChange = (day: typeof DAYS[number], mod: TrainingModule) => {
    hapticLight();
    updateTraining({ [day]: mod });
  };

  const handleDrillChange = (day: typeof DAYS[number], drillId: string) => {
    hapticLight();
    const isAlreadySelected = training.drillSchedule?.[day] === drillId;
    updateDrillSchedule({ [day]: isAlreadySelected ? undefined : drillId });
  };

  const handleIntensity = (val: 'light' | 'medium' | 'heavy') => {
    hapticLight();
    updateTraining({}, val);
    const desc = val === 'light' ? 'Lower injury risk, slower development' : val === 'heavy' ? 'Faster development, higher injury risk' : 'Balanced development and injury risk';
    successToast(`Intensity set to ${val.charAt(0).toUpperCase() + val.slice(1)}`, desc);
  };

  const handlePreset = (preset: typeof TRAINING_PRESETS[number]) => {
    hapticLight();
    updateTraining(preset.schedule);
    setActiveDay('mon');
    successToast(`${preset.label} preset applied`, 'Training schedule updated for the week.');
  };

  const handleSetIndividualFocus = (playerId: string, focus: TrainingModule | null) => {
    hapticLight();
    setIndividualTraining(playerId, focus);
    setExpandedPlayerId(null);
  };

  // Computed data
  const report = training.lastReport;
  const dominantModule = getDominantTrainingFocus(schedule);
  const dominantInfo = MODULE_INFO.find(m => m.module === dominantModule);
  const streakCount = training.streaks?.[dominantModule] || 0;
  const streakTier = getStreakTier(streakCount);
  const preview = getTrainingEffectivenessPreview(training, staffBonus, squadPlayers);
  const fitnessDistribution = getSquadFitnessDistribution(squadPlayers);

  // Radar chart data
  const radarData = useMemo(() => {
    if (squadPlayers.length === 0) return [];
    const attrs = ['pace', 'shooting', 'passing', 'defending', 'physical', 'mental'] as const;
    return attrs.map(attr => ({
      attr: ATTR_LABELS[attr],
      value: Math.round(squadPlayers.reduce((s, p) => s + (p.attributes[attr] || 0), 0) / squadPlayers.length),
    }));
  }, [squadPlayers]);

  return (
    <div className="max-w-lg mx-auto">
      <SubNav items={SQUAD_SUB_NAV} />
      <div className="px-4 pb-4 space-y-3">
        <PageHint screen="training" title={PAGE_HINTS.training.title} body={PAGE_HINTS.training.body} />
        <h2 className="text-lg font-display font-bold text-foreground">Training</h2>

        {/* Training Report Card */}
        <AnimatePresence>
          {report && report.totalGains > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <GlassPanel className="p-3 border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-semibold text-foreground">Last Week's Training Report</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-emerald-400 tabular-nums">{report.totalGains}</div>
                    <div className="text-[9px] text-muted-foreground">Attr Gains</div>
                  </div>
                  <div>
                    <div className={cn('text-lg font-bold tabular-nums', report.injuries.length > 0 ? 'text-destructive' : 'text-emerald-400')}>
                      {report.injuries.length}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Injuries</div>
                  </div>
                  <div>
                    <div className={cn('text-lg font-bold tabular-nums', report.fitnessChange >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                      {report.fitnessChange >= 0 ? '+' : ''}{report.fitnessChange}
                    </div>
                    <div className="text-[9px] text-muted-foreground">Avg Fitness</div>
                  </div>
                </div>
                {report.starPerformers.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="text-[9px] text-muted-foreground mb-1">Star Performers</div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.starPerformers.map((sp, i) => {
                        const p = players[sp.playerId];
                        if (!p) return null;
                        return (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {p.lastName} +{ATTR_LABELS[sp.attrGained] || sp.attrGained}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Squad Attribute Radar Chart */}
        {radarData.length > 0 && (
          <GlassPanel className="p-3">
            <h3 className="text-xs font-semibold text-foreground mb-1">Squad Attributes</h3>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="attr" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar dataKey="value" stroke="hsl(43 96% 46%)" fill="hsl(43 96% 46%)" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </GlassPanel>
        )}

        {/* Training Recommendation */}
        {(() => {
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

        {/* Weekly Schedule with Drills */}
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Weekly Schedule</h3>

          {/* Day Tab Bar */}
          <div className="flex relative">
            {DAYS.map((day, i) => {
              const isActive = activeDay === day;
              const dayModule = schedule[day];
              const dayInfo = MODULE_INFO.find(m => m.module === dayModule);
              const DayIcon = dayInfo?.icon || Dumbbell;
              const colors = MODULE_COLORS[dayModule] || MODULE_COLORS['fitness'];
              return (
                <button
                  key={day}
                  onClick={() => { hapticLight(); setActiveDay(day); }}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg transition-all relative',
                    isActive ? 'bg-muted/40' : 'hover:bg-muted/20'
                  )}
                >
                  <span className={cn(
                    'text-[11px] font-semibold transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {DAY_LABELS[i]}
                  </span>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                    colors.bg, 'border', colors.border
                  )}>
                    <DayIcon className={cn('w-3.5 h-3.5', colors.text)} />
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="dayIndicator"
                      className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Module Picker Grid — 3 columns × 2 rows */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {MODULE_INFO.map(({ module, label, icon: Icon }) => {
              const isSelected = schedule[activeDay] === module;
              const colors = MODULE_COLORS[module] || MODULE_COLORS['fitness'];
              return (
                <motion.button
                  key={module}
                  onClick={() => handleDayChange(activeDay, module)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                    isSelected
                      ? cn(colors.bg, colors.border)
                      : 'bg-muted/20 border-transparent hover:bg-muted/40'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isSelected ? colors.text : 'text-muted-foreground')} />
                  <span className={cn(
                    'text-[11px] font-semibold',
                    isSelected ? colors.text : 'text-muted-foreground'
                  )}>
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Drill Picker — vertical stack */}
          {DRILLS_BY_MODULE[schedule[activeDay]]?.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeDay}-${schedule[activeDay]}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-1.5 mt-3"
              >
                <p className="text-[10px] text-muted-foreground mb-1">Optional: pick a specific drill focus</p>
                {DRILLS_BY_MODULE[schedule[activeDay]].map(drill => {
                  const isSelected = training.drillSchedule?.[activeDay] === drill.id;
                  const weights = Object.entries(drill.attrWeights)
                    .map(([a, w]) => `${ATTR_LABELS[a] || a} ${Math.round((w || 0) * 100)}%`)
                    .join(' · ');
                  return (
                    <motion.button
                      key={drill.id}
                      onClick={() => handleDrillChange(activeDay, drill.id)}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2.5 rounded-lg border transition-all text-left',
                        isSelected
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-muted/15 border-transparent hover:bg-muted/30'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn('text-xs font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                          {drill.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{weights}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Week Summary Strip */}
          <div className="border-t border-border/30 pt-3 mt-3">
            <div className="flex">
              {DAYS.map((day, i) => {
                const dayModule = schedule[day];
                const dayInfo = MODULE_INFO.find(m => m.module === dayModule);
                const colors = MODULE_COLORS[dayModule] || MODULE_COLORS['fitness'];
                const isActive = activeDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => { hapticLight(); setActiveDay(day); }}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-0.5 py-1 rounded transition-colors',
                      isActive ? 'bg-muted/30' : 'hover:bg-muted/20'
                    )}
                  >
                    <span className="text-[9px] text-muted-foreground">{DAY_LABELS[i]}</span>
                    <div className="flex items-center gap-1">
                      <div className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
                      <span className={cn('text-[9px] font-medium', colors.text)}>
                        {dayInfo?.label.slice(0, 3) || '???'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </GlassPanel>

        {/* Intensity + Effectiveness Preview */}
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
          {/* Effectiveness Preview */}
          <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-medium text-foreground">Effectiveness Preview</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {preview.moduleGainRates.map(m => {
                const info = MODULE_INFO.find(mi => mi.module === m.module);
                return (
                  <div key={m.module} className="flex items-center justify-between">
                    <span className={cn('text-[10px]', info?.color || 'text-muted-foreground')}>
                      {info?.label || m.module} ({m.daysScheduled}d)
                    </span>
                    <span className="text-[10px] text-foreground font-medium tabular-nums">{m.expectedGainPct}%</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <AlertTriangle className={cn('w-3 h-3', preview.injuryRiskPct > 2 ? 'text-destructive' : 'text-muted-foreground')} />
                <span className="text-muted-foreground">Injury:</span>
                <span className={cn('font-medium', preview.injuryRiskPct > 2 ? 'text-destructive' : preview.injuryRiskPct > 1 ? 'text-amber-400' : 'text-emerald-400')}>
                  {preview.injuryRiskPct}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Fitness:</span>
                <span className={cn('font-medium', preview.fitnessImpact >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                  {preview.fitnessImpact >= 0 ? '+' : ''}{preview.fitnessImpact}
                </span>
              </div>
              {preview.streakBonus > 0 && (
                <div className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-primary" />
                  <span className="text-primary font-medium">+{preview.streakBonus}%</span>
                </div>
              )}
            </div>
          </div>
        </GlassPanel>

        {/* Squad Fitness Overview */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Squad Fitness</h3>
            <span className="text-[10px] text-muted-foreground">Avg: <span className="text-foreground font-medium">{fitnessDistribution.avgFitness}</span></span>
          </div>
          <div className="w-full h-4 bg-muted/30 rounded-full overflow-hidden flex">
            {fitnessDistribution.green > 0 && (
              <div
                className="h-full bg-emerald-500/70 transition-all duration-500"
                style={{ width: `${(fitnessDistribution.green / fitnessDistribution.total) * 100}%` }}
              />
            )}
            {fitnessDistribution.yellow > 0 && (
              <div
                className="h-full bg-amber-500/70 transition-all duration-500"
                style={{ width: `${(fitnessDistribution.yellow / fitnessDistribution.total) * 100}%` }}
              />
            )}
            {fitnessDistribution.red > 0 && (
              <div
                className="h-full bg-destructive/70 transition-all duration-500"
                style={{ width: `${(fitnessDistribution.red / fitnessDistribution.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1.5 text-[9px]">
            <span className="text-emerald-400">{fitnessDistribution.green} fit</span>
            <span className="text-amber-400">{fitnessDistribution.yellow} tired</span>
            <span className="text-destructive">{fitnessDistribution.red} exhausted</span>
          </div>
        </GlassPanel>

        {/* Training Streak */}
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className={cn('w-4 h-4', streakCount >= 2 ? 'text-primary' : 'text-muted-foreground')} />
              <h3 className="text-sm font-semibold text-foreground">Training Streak</h3>
            </div>
            {dominantInfo && (
              <div className="flex items-center gap-1.5">
                {(() => { const DIcon = dominantInfo.icon; return <DIcon className={cn('w-3 h-3', dominantInfo.color)} />; })()}
                <span className={cn('text-[10px] font-medium', dominantInfo.color)}>{dominantInfo.label}</span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex gap-0.5">
                {Array.from({ length: Math.max(streakCount, STREAK_THRESHOLDS[STREAK_THRESHOLDS.length - 1]) }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-2 flex-1 rounded-full transition-all',
                      i < streakCount ? 'bg-primary' : 'bg-muted/30',
                      i < STREAK_THRESHOLDS[0] ? '' : i < STREAK_THRESHOLDS[1] ? 'bg-primary/80' : 'bg-primary/60'
                    )}
                    style={i < streakCount ? { backgroundColor: undefined } : undefined}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">{streakCount} week{streakCount !== 1 ? 's' : ''}</span>
                {streakTier.nextThreshold && (
                  <span className="text-[9px] text-muted-foreground">
                    Next bonus at {streakTier.nextThreshold}w (+{Math.round((STREAK_MULTIPLIERS[streakTier.tier + 1] - 1) * 100)}%)
                  </span>
                )}
                {!streakTier.nextThreshold && streakCount >= STREAK_THRESHOLDS[STREAK_THRESHOLDS.length - 1] && (
                  <span className="text-[9px] text-primary font-medium">Max bonus active!</span>
                )}
              </div>
            </div>
            {streakTier.tier > 0 && (
              <div className="text-center shrink-0">
                <div className="text-lg font-bold text-primary">+{Math.round((STREAK_MULTIPLIERS[streakTier.tier] - 1) * 100)}%</div>
                <div className="text-[8px] text-muted-foreground">bonus</div>
              </div>
            )}
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

        {/* Individual Training Plans — Inline */}
        <GlassPanel className="p-4">
          <button
            onClick={() => { hapticLight(); setShowIndividualTraining(!showIndividualTraining); }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Dumbbell className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Individual Plans</h3>
              <span className="text-[10px] text-muted-foreground">
                {(training.individualPlans || []).length}/{squadPlayers.length}
              </span>
            </div>
            {showIndividualTraining ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showIndividualTraining && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-[10px] text-muted-foreground mt-2 mb-2">
                  Assign a focus for +50% targeted gains. Tap a player to set or change.
                </p>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {squadPlayers
                    .sort((a, b) => b.overall - a.overall)
                    .map(p => {
                      const plan = (training.individualPlans || []).find(ip => ip.playerId === p.id);
                      const planInfo = plan ? MODULE_INFO.find(m => m.module === plan.focus) : null;
                      const isExpanded = expandedPlayerId === p.id;
                      const personalityMult = getTrainingMultiplier(p.personality);
                      const multLabel = personalityMult >= 1.15 ? 'text-emerald-400' : personalityMult <= 0.85 ? 'text-destructive' : 'text-muted-foreground';
                      return (
                        <div key={p.id}>
                          <button
                            onClick={() => { hapticLight(); setExpandedPlayerId(isExpanded ? null : p.id); }}
                            className="flex items-center gap-2 w-full text-left hover:bg-muted/30 rounded-md px-1.5 py-1.5 transition-colors"
                          >
                            <span className="text-[10px] text-muted-foreground w-6 text-center tabular-nums">{p.overall}</span>
                            <span className="text-xs text-foreground font-medium truncate flex-1">
                              {p.firstName[0]}. {p.lastName}
                            </span>
                            <span className="text-[10px] text-muted-foreground w-8">{p.position}</span>
                            <span className={cn('text-[9px] w-8 text-right tabular-nums', multLabel)}>
                              {personalityMult.toFixed(1)}x
                            </span>
                            {planInfo ? (
                              <span className={cn('text-[10px] font-medium w-16 text-right', planInfo.color)}>
                                {planInfo.label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50 w-16 text-right">None</span>
                            )}
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="flex gap-1 ml-8 mb-1 flex-wrap">
                                  {MODULE_INFO.map(({ module, label, icon: Icon, color: _color }) => (
                                    <button
                                      key={module}
                                      onClick={() => handleSetIndividualFocus(p.id, plan?.focus === module ? null : module)}
                                      className={cn(
                                        'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                                        plan?.focus === module
                                          ? 'bg-primary/20 text-primary border border-primary/30'
                                          : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                                      )}
                                    >
                                      <Icon className="w-3 h-3" />
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassPanel>

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
                    <button
                      key={p.id}
                      onClick={() => { selectPlayer(p.id); setScreen('player-detail'); }}
                      className="flex items-center justify-between w-full hover:bg-muted/30 rounded-md px-1 py-0.5 transition-colors"
                    >
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
                    </button>
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
