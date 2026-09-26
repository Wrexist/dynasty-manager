import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { probeTrialOfferDays } from '@/utils/trialOffer';

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
 *  The banner names the free trial only when the store confirms this Apple ID
 *  can start it, using the paywall's own per-plan rule (`probeTrialOfferDays`),
 *  so it never promises a trial the paywall then withholds (3.1.2(c)). Before
 *  that check existed the banner could not mention the trial at all, which left
 *  the one-time cold-open paywall as the only place a player ever saw it. */
export function ProUpsell({ feature, className }: ProUpsellProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const hasSubscriptionRecord = useGameStore(s => s.monetization.subscription != null);
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    if (hasSubscriptionRecord) {
      setTrialDays(null);
      return;
    }
    let cancelled = false;
    probeTrialOfferDays().then(days => { if (!cancelled) setTrialDays(days); });
    return () => { cancelled = true; };
  }, [hasSubscriptionRecord]);

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
        <p className="text-micro text-muted-foreground">
          {trialDays ? t('proUpsell.trialLine', { days: trialDays }) : t('proUpsell.upgrade')}
        </p>
      </div>
      <span className="text-micro text-primary font-semibold shrink-0">
        {trialDays ? t('proUpsell.tryFree') : t('proUpsell.unlock')}
      </span>
    </button>
  );
}
