import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPro, canClaimAdReward } from '@/utils/monetization';
import { AD_REWARDS } from '@/config/monetization';
import type { AdRewardType } from '@/types/game';
import { hapticLight } from '@/utils/haptics';
import { showRewardedAd } from '@/utils/ads';

interface AdRewardButtonProps {
  rewardType: AdRewardType;
  onRewardClaimed: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Reusable opt-in ad reward button.
 * Pro users see a "Claim" button (no ad). Free users see "Watch Ad" button.
 * Never interrupts gameplay — only appears where the player opts in.
 */
export function AdRewardButton({ rewardType, onRewardClaimed, className, compact }: AdRewardButtonProps) {
  const { monetization, claimAdReward, season } = useGameStore();
  const [claiming, setClaiming] = useState(false);
  const userIsPro = isPro(monetization);
  const canClaim = canClaimAdReward(monetization, rewardType, season);

  const reward = AD_REWARDS[rewardType];

  if (!canClaim) {
    if (compact) return null;
    return (
      <div className={cn('bg-card/40 border border-border/30 rounded-xl p-3 opacity-50', className)}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{reward.label}</p>
            <p className="text-[10px] text-muted-foreground/60">Limit reached this season</p>
          </div>
          <span className="text-[10px] text-muted-foreground/60 px-3 py-1.5 rounded-lg bg-muted/30 shrink-0 ml-3">
            Claimed
          </span>
        </div>
      </div>
    );
  }

  const handleClaim = () => {
    hapticLight();
    setClaiming(true);

    if (userIsPro) {
      // Pro users get reward instantly
      const success = claimAdReward(rewardType);
      if (success) onRewardClaimed();
      setClaiming(false);
    } else {
      // Free users watch a rewarded ad via AdMob
      showRewardedAd().then(watched => {
        if (watched) {
          const success = claimAdReward(rewardType);
          if (success) onRewardClaimed();
        }
        setClaiming(false);
      }).catch(() => {
        setClaiming(false);
      });
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleClaim}
        disabled={claiming}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98]',
          userIsPro
            ? 'bg-primary/10 text-primary hover:bg-primary/20'
            : 'bg-muted/50 text-foreground hover:bg-muted',
          claiming && 'opacity-50',
          className
        )}
      >
        {userIsPro ? null : <Play className="w-3 h-3" />}
        {claiming ? '...' : userIsPro ? 'Claim' : 'Watch Ad'}
      </button>
    );
  }

  return (
    <div className={cn('bg-card/40 border border-border/30 rounded-xl p-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{reward.label}</p>
          <p className="text-[10px] text-muted-foreground">{reward.description}</p>
        </div>
        <button
          onClick={handleClaim}
          disabled={claiming}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] shrink-0 ml-3',
            userIsPro
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-muted/50 text-foreground hover:bg-muted',
            claiming && 'opacity-50'
          )}
        >
          {userIsPro ? null : <Play className="w-3 h-3" />}
          {claiming ? '...' : userIsPro ? 'Claim' : 'Watch Ad'}
        </button>
      </div>
    </div>
  );
}
