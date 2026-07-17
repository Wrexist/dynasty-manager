import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { TalentTree } from '@/components/game/TalentTree';
import { cn } from '@/lib/utils';
import { xpForLevel, getTotalXP, XP_REWARDS, TALENT_BRANCHES, getBranchPerks, getSpecializationTitle, branchFullyUnlocked, getMasteryRank, canUnlockMastery, masteryMult } from '@/utils/managerPerks';
import { MASTERY_MAX_RANKS } from '@/config/gameBalance';
import { toast } from 'sonner';
import { hapticMedium } from '@/utils/haptics';
import type { PerkId, TalentBranch } from '@/types/game';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';

const PerksPage = () => {
  const managerProgression = useGameStore(s => s.managerProgression);
  const unlockPerk = useGameStore(s => s.unlockPerk);
  const unlockMastery = useGameStore(s => s.unlockMastery);

  const availableXP = getTotalXP(managerProgression);
  const xpNeeded = xpForLevel(managerProgression.level);
  const xpProgress = Math.round((managerProgression.xp / xpNeeded) * 100);
  const specTitle = getSpecializationTitle(managerProgression);

  const handleUnlock = (perkId: PerkId) => {
    const result = unlockPerk(perkId);
    if (result.success) {
      hapticMedium();
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleMastery = (branch: TalentBranch) => {
    const result = unlockMastery(branch);
    if (result.success) {
      hapticMedium();
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const masteredBranches = TALENT_BRANCHES.filter(b => branchFullyUnlocked(managerProgression, b.id));

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <PageHint screen="perks" title={PAGE_HINTS.perks.title} body={PAGE_HINTS.perks.body} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Talent Tree</h2>
        {specTitle && (
          <span className="text-xs font-bold text-primary italic">{specTitle}</span>
        )}
      </div>

      {/* Level & XP */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Level {managerProgression.level}</p>
            <p className="text-[10px] text-muted-foreground">{availableXP} XP available to spend</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{managerProgression.xp}/{xpNeeded} XP to next level</p>
          </div>
        </div>
        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1">Earn XP from wins (+{XP_REWARDS.win}), draws (+{XP_REWARDS.draw}), season end (+{XP_REWARDS.seasonEnd}), titles (+{XP_REWARDS.titleWin}), cup wins (+{XP_REWARDS.cupWin})</p>
        {(managerProgression.prestigeLevel || 0) > 0 && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400">Prestige {managerProgression.prestigeLevel}</span>
            <span className="text-[9px] text-amber-400/60">({managerProgression.prestigeLevel * 50}% XP bonus)</span>
          </div>
        )}
      </GlassPanel>

      {/* Branch Summary */}
      <div className="grid grid-cols-4 gap-1.5">
        {TALENT_BRANCHES.map(branch => {
          const perks = getBranchPerks(branch.id);
          const unlocked = perks.filter(p => managerProgression.unlockedPerks.includes(p.id)).length;
          const spent = perks
            .filter(p => managerProgression.unlockedPerks.includes(p.id))
            .reduce((sum, p) => sum + p.cost, 0);
          return (
            <GlassPanel key={branch.id} className="p-2 text-center">
              <p className={cn('text-[10px] font-bold', branch.color)}>{unlocked}/{perks.length}</p>
              <p className="text-[8px] text-muted-foreground">{spent} XP</p>
            </GlassPanel>
          );
        })}
      </div>

      {/* Mastery Ranks — endless progression once a branch is fully unlocked */}
      {masteredBranches.length > 0 && (
        <GlassPanel className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-foreground">Branch Mastery</h3>
            <span className="text-[9px] text-muted-foreground">+2% branch effects per rank</span>
          </div>
          {masteredBranches.map(branch => {
            const rank = getMasteryRank(managerProgression, branch.id);
            const check = canUnlockMastery(managerProgression, branch.id);
            const maxed = rank >= MASTERY_MAX_RANKS;
            const bonusPct = Math.round((masteryMult(managerProgression, branch.id) - 1) * 100);
            return (
              <div key={branch.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', branch.color)}>{branch.name}</span>
                    {bonusPct > 0 && (
                      <span className="text-[9px] text-emerald-400 font-semibold">+{bonusPct}%</span>
                    )}
                  </div>
                  {/* Rank pips */}
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: MASTERY_MAX_RANKS }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'w-4 h-1.5 rounded-full transition-colors',
                          i < rank ? 'bg-primary' : 'bg-muted/30',
                        )}
                      />
                    ))}
                  </div>
                </div>
                {maxed ? (
                  <span className="text-[10px] font-bold text-primary shrink-0">MAX</span>
                ) : (
                  <button
                    onClick={() => handleMastery(branch.id)}
                    disabled={!check.canUnlock}
                    className={cn(
                      'shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors',
                      check.canUnlock
                        ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                        : 'bg-muted/20 border border-border/40 text-muted-foreground/60',
                    )}
                  >
                    Rank {rank + 1} · {check.cost} XP
                  </button>
                )}
              </div>
            );
          })}
        </GlassPanel>
      )}

      {/* Talent Tree */}
      <TalentTree
        progression={managerProgression}
        onUnlock={handleUnlock}
      />
    </div>
  );
};

export default PerksPage;
