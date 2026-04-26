import { Sparkles, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptimizeLineupButtonProps {
  potentialGain: number;
  autoFilling: boolean;
  onOptimize: () => void;
}

export function OptimizeLineupButton({ potentialGain, autoFilling, onOptimize }: OptimizeLineupButtonProps) {
  return (
    <div className="space-y-1">
      {potentialGain > 0 && (
        <p className="text-[10px] text-center text-primary">
          ~+{potentialGain} overall rating potential
        </p>
      )}
      <button
        onClick={onOptimize}
        disabled={autoFilling}
        className={cn(
          // Liquid-glass CTA — tinted primary, specular crescent, rim + inset
          // highlight/shadow, soft outer glow. Matches GlassPanel effect stack
          // but colored for primary action.
          'relative overflow-hidden w-full py-2.5 rounded-2xl font-semibold text-sm',
          'flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
          'backdrop-blur-xl backdrop-saturate-150',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_10px_28px_-10px_hsl(var(--primary)/0.5)]',
          autoFilling
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
        <Sparkles className={cn('relative w-4 h-4', autoFilling && 'animate-spin')} />
        <span className="relative">{autoFilling ? 'Optimizing...' : 'Smart Optimize Lineup'}</span>
        {/* PRO badge — signals that this is a paid Dynasty Pro feature */}
        <span
          className="relative ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          aria-label="Dynasty Pro feature"
        >
          <Crown className="w-2.5 h-2.5" />
          Pro
        </span>
      </button>
    </div>
  );
}
