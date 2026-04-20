import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { CelebrationModal } from '@/components/game/CelebrationModal';
import { StadiumView } from '@/components/game/StadiumView';
import { FacilityCard } from '@/components/game/FacilityCard';
import { Dumbbell, GraduationCap, Stethoscope, RefreshCw, ArrowUp, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FACILITY_COST_PER_LEVEL, FACILITY_BASE_UPGRADE_WEEKS, FACILITY_MAX_LEVEL, STAND_COST_PER_LEVEL, STAND_BASE_UPGRADE_WEEKS, STADIUM_INCOME_PER_LEVEL } from '@/config/gameBalance';
import { PageHint } from '@/components/game/PageHint';
import { STAND_INFO, getEffectiveStadiumLevel, getStadiumCapacity } from '@/utils/facilities';
import { motion, AnimatePresence } from 'framer-motion';
import type { StandKey, FacilityTab } from '@/types/game';

const FACILITY_INFO = [
  { type: 'training' as const, label: 'Training Ground', icon: Dumbbell, color: 'text-emerald-400', key: 'trainingLevel' as const, benefit: 'Better training gains for all players' },
  { type: 'youth' as const, label: 'Youth Academy', icon: GraduationCap, color: 'text-primary', key: 'youthLevel' as const, benefit: 'Higher quality youth intake' },
  { type: 'medical' as const, label: 'Medical Center', icon: Stethoscope, color: 'text-red-400', key: 'medicalLevel' as const, benefit: 'Faster injury recovery' },
  { type: 'recovery' as const, label: 'Recovery Center', icon: RefreshCw, color: 'text-cyan-400', key: 'recoveryLevel' as const, benefit: 'Faster weekly fitness recovery' },
] as const;

const getStandCost = (level: number) => (level + 1) * STAND_COST_PER_LEVEL;
const getFacilityCost = (level: number) => (level + 1) * FACILITY_COST_PER_LEVEL;

const FacilitiesPage = () => {
  const facilities = useGameStore(s => s.facilities);
  const clubs = useGameStore(s => s.clubs);
  const playerClubId = useGameStore(s => s.playerClubId);
  const startUpgrade = useGameStore(s => s.startUpgrade);
  const [tab, setTab] = useState<FacilityTab>('stadium');
  const [selectedStand, setSelectedStand] = useState<StandKey | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; description: string } | null>(null);
  const prevUpgradeRef = useRef(facilities.upgradeInProgress);
  const club = clubs[playerClubId];

  // Detect when a max-level upgrade completes
  useEffect(() => {
    const prev = prevUpgradeRef.current;
    prevUpgradeRef.current = facilities.upgradeInProgress;
    if (prev && !facilities.upgradeInProgress) {
      // An upgrade just completed — check if it reached max level
      if (prev.type.startsWith('stadium-')) {
        const stand = prev.type.replace('stadium-', '') as StandKey;
        if (facilities.stadiumStands[stand] >= FACILITY_MAX_LEVEL) {
          setCelebration({ title: `${STAND_INFO[stand].label} — Max Level!`, description: `Your ${STAND_INFO[stand].label} has reached world-class status! The fans are delighted.` });
        }
      } else {
        const key = `${prev.type}Level` as keyof typeof facilities;
        if ((facilities[key] as number) >= FACILITY_MAX_LEVEL) {
          const label = prev.type.charAt(0).toUpperCase() + prev.type.slice(1);
          setCelebration({ title: `${label} — Max Level!`, description: `Your ${label} facility is now world-class!` });
        }
      }
    }
  }, [facilities.upgradeInProgress, facilities.stadiumStands, facilities.trainingLevel, facilities.youthLevel, facilities.medicalLevel, facilities.recoveryLevel]);

  const effectiveLevel = getEffectiveStadiumLevel(facilities);
  const weeklyRevenue = effectiveLevel * STADIUM_INCOME_PER_LEVEL;
  const upgradeType = facilities.upgradeInProgress?.type || null;

  const getUpgradeProgress = (type: string): number | null => {
    if (!facilities.upgradeInProgress || facilities.upgradeInProgress.type !== type) return null;
    const { weeksRemaining, totalWeeks } = facilities.upgradeInProgress;
    return totalWeeks > 0 ? (totalWeeks - weeksRemaining) / totalWeeks : 0;
  };

  const handleConfirm = () => {
    if (confirmUpgrade) {
      startUpgrade(confirmUpgrade as Parameters<typeof startUpgrade>[0]);
      setConfirmUpgrade(null);
    }
  };

  // Build confirm dialog info
  const confirmInfo = (() => {
    if (!confirmUpgrade) return { title: '', desc: '', label: '' };
    if (confirmUpgrade.startsWith('stadium-')) {
      const stand = confirmUpgrade.replace('stadium-', '') as StandKey;
      const level = facilities.stadiumStands[stand];
      const cost = getStandCost(level);
      const weeks = STAND_BASE_UPGRADE_WEEKS + level;
      return {
        title: `Upgrade ${STAND_INFO[stand].label}?`,
        desc: `Level ${level} \u2192 ${level + 1}. Cost: \u00A3${(cost / 1e6).toFixed(1)}M${club ? ` (budget: \u00A3${(club.budget / 1e6).toFixed(1)}M)` : ''}. Duration: ${weeks} weeks.`,
        label: `Upgrade \u2014 \u00A3${(cost / 1e6).toFixed(1)}M`,
      };
    }
    const info = FACILITY_INFO.find(f => f.type === confirmUpgrade);
    const level = info ? (facilities[info.key] as number) : 0;
    const cost = getFacilityCost(level);
    const weeks = FACILITY_BASE_UPGRADE_WEEKS + level;
    return {
      title: `Upgrade ${info?.label || ''}?`,
      desc: `Level ${level} \u2192 ${level + 1}. Cost: \u00A3${(cost / 1e6).toFixed(1)}M${club ? ` (budget: \u00A3${(club.budget / 1e6).toFixed(1)}M)` : ''}. Duration: ${weeks} weeks.`,
      label: `Upgrade \u2014 \u00A3${(cost / 1e6).toFixed(1)}M`,
    };
  })();

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <PageHint
        screen="facilities"
        title="Facility Upgrades"
        body="Expand your stadium stand by stand for more matchday revenue, and upgrade training, medical, youth, and recovery facilities for lasting competitive advantages."
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Facilities</h2>
        {club && <span className="text-xs text-muted-foreground">Budget: £{(club.budget / 1e6).toFixed(1)}M</span>}
      </div>

      {/* Tab pills */}
      <div className="flex gap-1.5">
        {(['stadium', 'facilities'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
              tab === t
                ? 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t === 'stadium' ? 'Stadium' : 'Facilities'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'stadium' ? (
          <motion.div
            key="stadium"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Stadium name */}
            {club?.stadiumName && (
              <p className="text-xs text-muted-foreground text-center">{club.stadiumName}</p>
            )}

            {/* Stadium SVG */}
            <GlassPanel className="p-3">
              <StadiumView
                stands={facilities.stadiumStands}
                selectedStand={selectedStand}
                onSelectStand={setSelectedStand}
                upgradeInProgressType={upgradeType}
                clubColor={club?.color || '#3b82f6'}
              />
            </GlassPanel>

            {/* Stadium Stats */}
            <div className="grid grid-cols-3 gap-2">
              <GlassPanel className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Overall</p>
                <p className="text-sm font-bold tabular-nums">{effectiveLevel}<span className="text-muted-foreground font-normal text-xs">/{FACILITY_MAX_LEVEL}</span></p>
              </GlassPanel>
              <GlassPanel className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Revenue</p>
                <p className="text-sm font-bold tabular-nums text-emerald-400">£{(weeklyRevenue / 1000).toFixed(0)}K<span className="text-muted-foreground font-normal text-[10px]">/wk</span></p>
              </GlassPanel>
              <GlassPanel className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Capacity</p>
                <p className="text-sm font-bold tabular-nums">{club?.stadiumCapacity ? (getStadiumCapacity(club.stadiumCapacity, facilities.stadiumStands) / 1000).toFixed(1) + 'K' : '—'}</p>
              </GlassPanel>
            </div>

            {/* Selected Stand Panel */}
            <AnimatePresence>
              {selectedStand && (
                <motion.div
                  key={selectedStand}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <StandUpgradePanel
                    standKey={selectedStand}
                    level={facilities.stadiumStands[selectedStand]}
                    budget={club?.budget || 0}
                    upgradeInProgress={!!facilities.upgradeInProgress}
                    upgradeProgress={getUpgradeProgress(`stadium-${selectedStand}`)}
                    weeksRemaining={facilities.upgradeInProgress?.type === `stadium-${selectedStand}` ? facilities.upgradeInProgress.weeksRemaining : 0}
                    onUpgrade={() => setConfirmUpgrade(`stadium-${selectedStand}`)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick upgrade hint if no stand selected */}
            {!selectedStand && (
              <p className="text-[10px] text-muted-foreground text-center">Tap a stand to view details and upgrade</p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="facilities"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {FACILITY_INFO.map(({ type, label, icon, color, key, benefit }) => {
              const level = facilities[key] as number;
              const cost = getFacilityCost(level);
              const isThisUpgrading = facilities.upgradeInProgress?.type === type;
              const canUpgrade = level < FACILITY_MAX_LEVEL && !facilities.upgradeInProgress && !!club && club.budget >= cost;

              return (
                <FacilityCard
                  key={type}
                  type={type}
                  label={label}
                  icon={icon}
                  color={color}
                  level={level}
                  benefit={benefit}
                  canUpgrade={canUpgrade}
                  upgradeInProgress={!!facilities.upgradeInProgress}
                  upgradeCost={cost}
                  upgradeWeeks={isThisUpgrading ? (facilities.upgradeInProgress?.weeksRemaining || 0) : (FACILITY_BASE_UPGRADE_WEEKS + level)}
                  upgradeProgress={getUpgradeProgress(type)}
                  onUpgrade={() => setConfirmUpgrade(type)}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmUpgrade}
        onOpenChange={(open) => { if (!open) setConfirmUpgrade(null); }}
        title={confirmInfo.title}
        description={confirmInfo.desc}
        confirmLabel={confirmInfo.label}
        variant="default"
        onConfirm={handleConfirm}
      />

      {/* Max Level Celebration */}
      <CelebrationModal
        open={!!celebration}
        onClose={() => setCelebration(null)}
        title={celebration?.title || ''}
        description={celebration?.description || ''}
        icon="trophy"
      />
    </div>
  );
};

/* Stand upgrade panel shown when a stand is selected */
function StandUpgradePanel({
  standKey, level, budget, upgradeInProgress, upgradeProgress, weeksRemaining, onUpgrade,
}: {
  standKey: StandKey;
  level: number;
  budget: number;
  upgradeInProgress: boolean;
  upgradeProgress: number | null;
  weeksRemaining: number;
  onUpgrade: () => void;
}) {
  const cost = getStandCost(level);
  const weeks = STAND_BASE_UPGRADE_WEEKS + level;
  const canUpgrade = level < FACILITY_MAX_LEVEL && !upgradeInProgress && budget >= cost;
  const isMax = level >= FACILITY_MAX_LEVEL;
  const info = STAND_INFO[standKey];
  const incomePerLevel = STADIUM_INCOME_PER_LEVEL / 4; // Each stand contributes ~1/4

  return (
    <GlassPanel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{info.label}</h3>
          <p className="text-[10px] text-muted-foreground">{info.subtitle}</p>
        </div>
        <span className="text-lg font-bold tabular-nums">{level}<span className="text-sm text-muted-foreground font-normal">/{FACILITY_MAX_LEVEL}</span></span>
      </div>

      {/* Benefits */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] text-muted-foreground">£{((level * incomePerLevel) / 1000).toFixed(0)}K/wk from this stand</span>
        </div>
      </div>

      {/* Level bar */}
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: FACILITY_MAX_LEVEL }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-1.5 rounded-sm transition-all duration-300',
              i < level ? 'bg-primary' : 'bg-muted/30'
            )}
          />
        ))}
      </div>

      {/* Upgrade progress */}
      {upgradeProgress !== null && (
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
          <div className="flex-1">
            <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.round(upgradeProgress * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">{weeksRemaining}w left</span>
        </div>
      )}

      {/* Upgrade button */}
      {upgradeProgress === null && !isMax && (
        <button
          disabled={!canUpgrade}
          onClick={canUpgrade ? onUpgrade : undefined}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
            canUpgrade
              ? 'bg-primary/20 text-primary hover:bg-primary/30 active:scale-[0.98]'
              : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
          )}
        >
          <ArrowUp className="w-3.5 h-3.5" />
          Level {level + 1} — £{(cost / 1e6).toFixed(1)}M
          <span className="text-muted-foreground font-normal">({weeks}w)</span>
        </button>
      )}
      {upgradeProgress === null && !isMax && !canUpgrade && upgradeInProgress && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">Another upgrade in progress</p>
      )}
      {upgradeProgress === null && !isMax && !canUpgrade && !upgradeInProgress && budget < cost && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">Insufficient funds</p>
      )}
      {isMax && (
        <p className="text-center text-xs text-amber-400 font-semibold">Max Level</p>
      )}
    </GlassPanel>
  );
}

export default FacilitiesPage;
