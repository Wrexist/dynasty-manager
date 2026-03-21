import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
import { DollarSign, Heart, AlertTriangle, Activity, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WeeklyDigest() {
  const digest = useGameStore(s => s.weeklyDigest);
  const week = useGameStore(s => s.week);

  const dismiss = () => {
    useGameStore.setState({ weeklyDigest: null });
  };

  if (!digest) return null;

  const netIncome = digest.incomeEarned - digest.expensesPaid;
  const hasEvents = digest.injuriesThisWeek.length > 0 || digest.recoveriesThisWeek.length > 0 || digest.offersReceived > 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 px-4 pb-8 safe-area-bottom"
        onClick={dismiss}
        onKeyDown={e => { if (e.key === 'Escape') dismiss(); }}
        role="dialog"
        aria-label="Weekly Summary"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-sm bg-card border border-border/50 rounded-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground font-display">Week {week} Summary</h3>
              <span className="text-[10px] text-muted-foreground">Weekly Digest</span>
            </div>

            {/* Finance Row */}
            <div className="flex gap-2">
              <div className="flex-1 bg-muted/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <DollarSign className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Net Income</span>
                </div>
                <p className={cn('text-sm font-bold tabular-nums', netIncome >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                  {netIncome >= 0 ? '+' : ''}£{(Math.abs(netIncome) / 1e3).toFixed(0)}K
                </p>
              </div>
              <div className="flex-1 bg-muted/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Heart className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-muted-foreground">Morale</span>
                </div>
                <p className={cn('text-sm font-bold tabular-nums', digest.moraleChange > 0 ? 'text-emerald-400' : digest.moraleChange < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {digest.moraleChange > 0 ? '+' : ''}{digest.moraleChange}%
                </p>
              </div>
            </div>

            {/* Events */}
            {hasEvents && (
              <div className="space-y-1.5">
                {digest.injuriesThisWeek.map(name => (
                  <div key={`inj-${name}`} className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                    <span className="text-destructive">{name} injured in training</span>
                  </div>
                ))}
                {digest.recoveriesThisWeek.map(name => (
                  <div key={`rec-${name}`} className="flex items-center gap-2 text-xs">
                    <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400">{name} recovered from injury</span>
                  </div>
                ))}
                {digest.offersReceived > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-foreground">{digest.offersReceived} new transfer offer{digest.offersReceived > 1 ? 's' : ''} received</span>
                  </div>
                )}
              </div>
            )}

          </div>

          <div className="px-5 pb-4">
            <Button className="w-full" onClick={dismiss}>
              Continue
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
