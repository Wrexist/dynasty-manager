import { Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ProUpsellProps {
  feature: string;
  className?: string;
}

/** Compact banner prompting the user to upgrade to Dynasty Pro for a specific feature.
 *
 *  Routes to the in-app paywall, NOT to the Shop. The Shop never mentions the
 *  7-day free trial — the strongest offer in the ladder — so every in-game Pro
 *  upsell used to land on the one purchase surface that hides it.
 *
 *  Deliberately only the routing half of that fix: the trial copy is NOT
 *  replicated into the Shop, because SubscribeOnboarding gates it on a store
 *  eligibility check (isEligibleForIntroOffer) that the Shop has no equivalent
 *  of. Copying the claim without the check is the Guideline 3.1.2(c) exposure
 *  on a second surface. */
export function ProUpsell({ feature, className }: ProUpsellProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/subscribe', { state: { returnTo: '/game' } })}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 transition-colors hover:bg-primary/10 active:scale-[0.99]',
        className,
      )}
    >
      <Crown className="w-4 h-4 text-primary shrink-0" />
      <div className="text-left flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{feature}</p>
        <p className="text-[10px] text-muted-foreground">Upgrade to Dynasty Pro</p>
      </div>
      <span className="text-[10px] text-primary font-semibold shrink-0">Unlock</span>
    </button>
  );
}
