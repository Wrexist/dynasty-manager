import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { Dumbbell, GraduationCap, Home, Stethoscope, ArrowUp, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FACILITY_COST_PER_LEVEL, FACILITY_MAX_LEVEL } from '@/config/gameBalance';

const FACILITY_INFO = [
  { type: 'training', label: 'Training Ground', icon: Dumbbell, color: 'text-emerald-400', key: 'trainingLevel' as const, benefit: 'Better training gains for all players' },
  { type: 'youth', label: 'Youth Academy', icon: GraduationCap, color: 'text-primary', key: 'youthLevel' as const, benefit: 'Higher quality youth intake' },
  { type: 'stadium', label: 'Stadium', icon: Home, color: 'text-blue-400', key: 'stadiumLevel' as const, benefit: 'Increased matchday revenue' },
  { type: 'medical', label: 'Medical Center', icon: Stethoscope, color: 'text-red-400', key: 'medicalLevel' as const, benefit: 'Faster injury recovery' },
  { type: 'recovery', label: 'Recovery Center', icon: RefreshCw, color: 'text-cyan-400', key: 'recoveryLevel' as const, benefit: 'Faster weekly fitness recovery' },
] as const;

const getUpgradeCost = (level: number) => (level + 1) * FACILITY_COST_PER_LEVEL;

const FacilitiesPage = () => {
  const { facilities, clubs, playerClubId, startUpgrade } = useGameStore();
  const [confirmUpgrade, setConfirmUpgrade] = useState<string | null>(null);
  const club = clubs[playerClubId];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Facilities</h2>
        {club && <span className="text-xs text-muted-foreground">Budget: £{(club.budget / 1e6).toFixed(1)}M</span>}
      </div>

      {/* Upgrade in Progress */}
      {facilities.upgradeInProgress && (
        <GlassPanel className="p-4 border-primary/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary">Upgrade in Progress</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {facilities.upgradeInProgress.type.charAt(0).toUpperCase() + facilities.upgradeInProgress.type.slice(1)} upgrade — {facilities.upgradeInProgress.weeksRemaining} week(s) remaining
          </p>
          <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${facilities.upgradeInProgress.totalWeeks ? Math.round(((facilities.upgradeInProgress.totalWeeks - facilities.upgradeInProgress.weeksRemaining) / facilities.upgradeInProgress.totalWeeks) * 100) : 50}%` }} />
          </div>
        </GlassPanel>
      )}

      {/* Facility Cards */}
      {FACILITY_INFO.map(({ type, label, icon: Icon, color, key, benefit }) => {
        const level = facilities[key];
        const maxLevel = FACILITY_MAX_LEVEL;
        const cost = getUpgradeCost(level);
        const canUpgrade = level < maxLevel && !facilities.upgradeInProgress && club && club.budget >= cost;

        return (
          <GlassPanel key={type} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50', color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{benefit}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-foreground tabular-nums">{level}/{maxLevel}</span>
            </div>

            {/* Level Bar */}
            <div className="flex gap-1 mb-3">
              {Array.from({ length: maxLevel }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-2 rounded-sm transition-colors',
                    i < level ? 'bg-primary' : 'bg-muted/30'
                  )}
                />
              ))}
            </div>

            {/* Upgrade Button */}
            {level < maxLevel && (
              <div>
                <button
                  disabled={!canUpgrade}
                  onClick={() => canUpgrade && setConfirmUpgrade(type)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
                    canUpgrade
                      ? 'bg-primary/20 text-primary hover:bg-primary/30'
                      : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  Upgrade to Level {level + 1} — £{(cost / 1e6).toFixed(1)}M
                </button>
                {!canUpgrade && level < maxLevel && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    {facilities.upgradeInProgress ? 'Another upgrade is in progress' : club && club.budget < cost ? 'Insufficient funds' : ''}
                  </p>
                )}
              </div>
            )}
            {level >= maxLevel && (
              <p className="text-center text-xs text-emerald-400 font-semibold">Max Level</p>
            )}
          </GlassPanel>
        );
      })}

      {/* Confirm Upgrade Dialog */}
      {(() => {
        const info = FACILITY_INFO.find(f => f.type === confirmUpgrade);
        const level = info ? facilities[info.key] : 0;
        const cost = getUpgradeCost(level);
        return (
          <ConfirmDialog
            open={!!confirmUpgrade}
            onOpenChange={(open) => { if (!open) setConfirmUpgrade(null); }}
            title={`Upgrade ${info?.label || ''}?`}
            description={`This will cost £${(cost / 1e6).toFixed(1)}M from your budget${club ? ` (£${(club.budget / 1e6).toFixed(1)}M available)` : ''}. The upgrade will take a few weeks to complete.`}
            confirmLabel={`Upgrade — £${(cost / 1e6).toFixed(1)}M`}
            variant="default"
            onConfirm={() => { if (confirmUpgrade) { startUpgrade(confirmUpgrade); setConfirmUpgrade(null); } }}
          />
        );
      })()}
    </div>
  );
};

export default FacilitiesPage;
