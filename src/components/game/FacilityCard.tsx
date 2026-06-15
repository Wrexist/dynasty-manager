import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/helpers';
import { ArrowUp, Clock, Check } from 'lucide-react';
import { FACILITY_MAX_LEVEL, FACILITY_MILESTONES } from '@/config/gameBalance';
import { GlassPanel } from '@/components/game/GlassPanel';

interface FacilityCardProps {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  level: number;
  benefit: string;
  canUpgrade: boolean;
  upgradeInProgress: boolean;
  upgradeCost: number;
  upgradeWeeks: number;
  upgradeProgress: number | null; // 0-1 fraction, null if not upgrading this facility
  onUpgrade: () => void;
}

const RADIUS = 32;
const STROKE = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FacilityCard({
  type, label, icon: Icon, color, level, benefit,
  canUpgrade, upgradeInProgress, upgradeCost, upgradeWeeks,
  upgradeProgress, onUpgrade,
}: FacilityCardProps) {
  const fraction = level / FACILITY_MAX_LEVEL;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);
  const milestones = FACILITY_MILESTONES[type] || [];
  const nextMilestone = milestones.find(m => m.level > level);
  const reachedMilestones = milestones.filter(m => m.level <= level);
  const isMax = level >= FACILITY_MAX_LEVEL;

  return (
    <GlassPanel className="p-4">
      <div className="flex items-start gap-4">
        {/* Arc Gauge */}
        <div className="relative shrink-0 w-[76px] h-[76px]">
          <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              cx="38" cy="38" r={RADIUS}
              fill="none"
              stroke="hsl(var(--muted) / 0.3)"
              strokeWidth={STROKE}
            />
            {/* Progress ring */}
            <circle
              cx="38" cy="38" r={RADIUS}
              fill="none"
              stroke={isMax ? 'hsl(43 96% 46%)' : `hsl(var(--primary))`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
            {/* Upgrade progress overlay */}
            {upgradeProgress !== null && (
              <circle
                cx="38" cy="38" r={RADIUS - STROKE}
                fill="none"
                stroke="hsl(43 96% 46%)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * (RADIUS - STROKE)}
                strokeDashoffset={2 * Math.PI * (RADIUS - STROKE) * (1 - upgradeProgress)}
                className="animate-pulse"
                opacity={0.6}
              />
            )}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-lg font-bold tabular-nums', isMax ? 'text-amber-400' : 'text-foreground')}>
              {level}
            </span>
            <span className="text-[9px] text-muted-foreground leading-none">/ {FACILITY_MAX_LEVEL}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('w-6 h-6 rounded-md flex items-center justify-center bg-muted/50', color)}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate">{label}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">{benefit}</p>

          {/* Milestones */}
          <div className="space-y-1 mb-2">
            {reachedMilestones.slice(-2).map(m => (
              <div key={m.level} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-[10px] text-emerald-400/80 truncate">{m.label}</span>
              </div>
            ))}
            {nextMilestone && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-muted-foreground/40 shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">Lv.{nextMilestone.level}: {nextMilestone.label}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade button or status */}
      {upgradeProgress !== null && (
        <div className="flex items-center gap-2 mt-3 px-1">
          <Clock className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
          <div className="flex-1">
            <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.round(upgradeProgress * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{upgradeWeeks}w left</span>
        </div>
      )}
      {upgradeProgress === null && !isMax && (
        <button
          disabled={!canUpgrade}
          onClick={canUpgrade ? onUpgrade : undefined}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 mt-3 rounded-lg text-xs font-semibold transition-all',
            canUpgrade
              ? 'bg-primary/20 text-primary hover:bg-primary/30 active:scale-[0.98]'
              : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
          )}
        >
          <ArrowUp className="w-3.5 h-3.5" />
          Level {level + 1} — {formatMoney(upgradeCost)}
          <span className="text-muted-foreground font-normal">({upgradeWeeks}w)</span>
        </button>
      )}
      {isMax && (
        <p className="text-center text-xs text-amber-400 font-semibold mt-3">Max Level</p>
      )}
      {!canUpgrade && upgradeProgress === null && !isMax && upgradeInProgress && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">Another upgrade in progress</p>
      )}
    </GlassPanel>
  );
}
