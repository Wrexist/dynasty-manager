import { Crown } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

interface ProUpsellProps {
  feature: string;
  className?: string;
}

/** Compact banner prompting the user to upgrade to Dynasty Pro for a specific feature. */
export function ProUpsell({ feature, className }: ProUpsellProps) {
  const setScreen = useGameStore(s => s.setScreen);

  return (
    <button
      onClick={() => setScreen('shop')}
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
