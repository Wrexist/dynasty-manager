import { Sparkles } from 'lucide-react';
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
          'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
          autoFilling
            ? 'bg-primary/50 text-primary-foreground/70 cursor-not-allowed'
            : 'bg-primary/90 hover:bg-primary text-primary-foreground'
        )}
      >
        <Sparkles className={cn('w-4 h-4', autoFilling && 'animate-spin')} />
        {autoFilling ? 'Optimizing...' : 'Optimize Lineup'}
      </button>
    </div>
  );
}
