import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { TalentTree } from '@/components/game/TalentTree';
import { cn } from '@/lib/utils';
import { xpForLevel, getTotalXP, XP_REWARDS, TALENT_BRANCHES, getBranchPerks, getSpecializationTitle } from '@/utils/managerPerks';
import { toast } from 'sonner';
import { hapticMedium } from '@/utils/haptics';
import type { PerkId } from '@/types/game';
import { PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';

const PerksPage = () => {
  const { managerProgression, unlockPerk } = useGameStore();

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

      {/* Talent Tree */}
      <TalentTree
        progression={managerProgression}
        onUnlock={handleUnlock}
      />
    </div>
  );
};

export default PerksPage;
