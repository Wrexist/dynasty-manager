import { Crown, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';

interface OptimizeLineupButtonProps {
  potentialGain: number;
  autoFilling: boolean;
  onOptimize: () => void;
  /** True for a player without Dynasty Pro. The button stays on screen —
   *  showing the feature and what it would be worth converts better than
   *  hiding it — but it opens the in-app paywall instead of running.
   *
   *  THE GATE IS REAL, NOT COSMETIC. `optimize_lineup` has been a listed Pro
   *  feature and this button has worn a Pro badge all along, while calling
   *  `onOptimize` for everybody: paid on the badge, free in the handler.
   *  `onOptimize` is now unreachable when locked. */
  locked?: boolean;
}

export function OptimizeLineupButton({ potentialGain, autoFilling, onOptimize, locked = false }: OptimizeLineupButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // The in-app SubscribeOnboarding page, never RevenueCat's hosted paywall —
  // that was removed after an App Store rejection (Guideline 3.1.2(c)) and
  // must not come back. Same destination and return path as `ProUpsell`.
  const handleClick = () => {
    if (locked) {
      navigate('/subscribe', { state: { returnTo: '/game' } });
      return;
    }
    onOptimize();
  };
  return (
    <div className="space-y-1">
      {potentialGain > 0 && (
        <p className="text-[10px] text-center text-primary">
          ~+{potentialGain} overall rating potential
        </p>
      )}
      <button
        onClick={handleClick}
        // Not `disabled` when locked: a disabled button cannot be tapped, and
        // the tap is the whole point — it is how the player reaches the offer.
        disabled={autoFilling && !locked}
        aria-label={locked ? t('optimizeLineupButton.lockedAria') : undefined}
        className={cn(
          // Liquid-glass CTA — tinted primary, specular crescent, rim + inset
          // highlight/shadow, soft outer glow. Matches GlassPanel effect stack
          // but colored for primary action.
          'relative overflow-hidden w-full py-2.5 rounded-2xl font-semibold text-sm',
          'flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
          'backdrop-blur-xl backdrop-saturate-150',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_10px_28px_-10px_hsl(var(--primary)/0.5)]',
          // Locked reads as "there is something behind this", not as broken:
          // the gold of the Pro badge rather than the primary green of a live
          // action, so it is visibly a different KIND of button.
          locked
            ? 'bg-gradient-to-b from-amber-400/25 to-amber-600/15 text-amber-50 ring-1 ring-inset ring-amber-300/40 hover:from-amber-400/35 hover:to-amber-600/20'
            : autoFilling
              ? 'bg-primary/50 text-primary-foreground/70 cursor-not-allowed'
              : 'bg-gradient-to-b from-primary to-[hsl(var(--primary)/0.85)] text-primary-foreground hover:from-primary hover:to-primary',
        )}
      >
        {/* Specular crescent — bright sky on polished glass */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0) 60%)',
            mixBlendMode: 'screen',
          }}
        />
        {locked ? (
          <Lock className="relative w-4 h-4 shrink-0" aria-hidden />
        ) : (
          <PremiumSparkle className={cn('relative w-4 h-4', autoFilling && 'animate-spin')} withSatellite={false} />
        )}
        <span className="relative">
          {locked ? t('optimizeLineupButton.locked') : autoFilling ? 'Optimizing...' : 'Smart Optimize Lineup'}
        </span>
        {/* PRO badge — signals that this is a paid Dynasty Pro feature */}
        <span
          className="relative ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#3a2a05]"
          style={{
            background: 'linear-gradient(180deg, #FFF1B8 0%, #FCD34D 50%, #B45309 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 8px rgba(252,211,77,0.55)',
          }}
          aria-label={t('optimizeLineupButton.dynastyProFeature')}
        >
          <Crown className="w-2.5 h-2.5 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]" />
          Pro
        </span>
      </button>
    </div>
  );
}
