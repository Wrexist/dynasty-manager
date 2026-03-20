import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { MANAGER_PERKS, xpForLevel, getTotalXP, canUnlockPerk } from '@/utils/managerPerks';
import { toast } from 'sonner';
import { hapticMedium } from '@/utils/haptics';

const PerksPage = () => {
  const { managerProgression, unlockPerk } = useGameStore();
  const availableXP = getTotalXP(managerProgression);
  const xpNeeded = xpForLevel(managerProgression.level);
  const xpProgress = Math.round((managerProgression.xp / xpNeeded) * 100);

  const handleUnlock = (perkId: string) => {
    const result = unlockPerk(perkId as any);
    if (result.success) {
      hapticMedium();
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const tiers = [1, 2, 3] as const;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground">Manager Perks</h2>

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
        <p className="text-[9px] text-muted-foreground mt-1">Earn XP from wins (+15), draws (+5), season end (+30), titles (+100), cup wins (+50)</p>
      </GlassPanel>

      {/* Perk Tree */}
      {tiers.map(tier => {
        const tierPerks = MANAGER_PERKS.filter(p => p.tier === tier);
        return (
          <div key={tier}>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Tier {tier} {tier === 1 ? '(100 XP)' : tier === 2 ? '(250 XP)' : '(500 XP)'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {tierPerks.map(perk => {
                const isUnlocked = managerProgression.unlockedPerks.includes(perk.id);
                const check = canUnlockPerk(perk, managerProgression);
                const canBuy = check.canUnlock;

                return (
                  <GlassPanel
                    key={perk.id}
                    className={cn(
                      'p-3 cursor-pointer transition-all',
                      isUnlocked
                        ? 'border-primary/50 bg-primary/10'
                        : canBuy
                          ? 'border-primary/30 hover:border-primary/60'
                          : 'opacity-50'
                    )}
                    onClick={() => !isUnlocked && canBuy && handleUnlock(perk.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{perk.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-xs font-semibold',
                          isUnlocked ? 'text-primary' : 'text-foreground'
                        )}>
                          {perk.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{perk.description}</p>
                        {!isUnlocked && (
                          <p className={cn(
                            'text-[9px] mt-1',
                            canBuy ? 'text-primary' : 'text-muted-foreground'
                          )}>
                            {isUnlocked ? 'Unlocked' : check.reason || `${perk.cost} XP`}
                          </p>
                        )}
                        {isUnlocked && (
                          <p className="text-[9px] text-emerald-400 mt-1">Active</p>
                        )}
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PerksPage;
