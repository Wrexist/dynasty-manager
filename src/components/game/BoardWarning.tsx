import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardWarningProps {
  confidence: number;
  onDismiss: () => void;
}

function getWarningLevel(confidence: number): { title: string; message: string; severity: 'caution' | 'danger' | 'critical' } | null {
  if (confidence <= 15) {
    return {
      title: 'SACKING IMMINENT',
      message: 'The board has lost all faith. One more bad result could be your last. Results must improve immediately or you will be dismissed.',
      severity: 'critical',
    };
  }
  if (confidence <= 25) {
    return {
      title: 'Final Warning',
      message: 'The board is seriously considering your position. Your job is on the line. Only a dramatic improvement in results can save you.',
      severity: 'danger',
    };
  }
  if (confidence <= 35) {
    return {
      title: 'Board Losing Patience',
      message: 'The board has expressed concern about recent results. Continued poor form will lead to further action.',
      severity: 'caution',
    };
  }
  return null;
}

const SEVERITY_STYLES = {
  caution: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    icon: 'text-amber-400',
    title: 'text-amber-400',
    glow: '',
  },
  danger: {
    border: 'border-orange-500/60',
    bg: 'bg-orange-500/5',
    icon: 'text-orange-400',
    title: 'text-orange-400',
    glow: 'shadow-[0_0_15px_rgba(249,115,22,0.1)]',
  },
  critical: {
    border: 'border-destructive/70',
    bg: 'bg-destructive/5',
    icon: 'text-destructive',
    title: 'text-destructive',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  },
};

export function BoardWarning({ confidence, onDismiss }: BoardWarningProps) {
  const warning = getWarningLevel(confidence);
  if (!warning) return null;

  const styles = SEVERITY_STYLES[warning.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5 }}
      className={cn(
        'rounded-xl border p-4 relative overflow-hidden',
        styles.border, styles.bg, styles.glow
      )}
    >
      {/* Animated pulse for critical */}
      {warning.severity === 'critical' && (
        <div className="absolute inset-0 bg-destructive/5 animate-pulse pointer-events-none" />
      )}

      <div className="relative flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', warning.severity === 'critical' && 'animate-bounce')}>
          <AlertTriangle className={cn('w-5 h-5', styles.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className={cn('text-xs font-black uppercase tracking-wider', styles.title)}>
              {warning.title}
            </p>
            <button onClick={onDismiss} className="p-1 hover:bg-muted/30 rounded transition-colors">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{warning.message}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  confidence <= 15 ? 'bg-destructive' : confidence <= 25 ? 'bg-orange-500' : 'bg-amber-500'
                )}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className={cn('text-[10px] font-bold tabular-nums', styles.title)}>
              {confidence}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
