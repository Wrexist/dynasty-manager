import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { Wand2, TrendingUp, TrendingDown, Minus, Users, Sparkles, Check } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

export interface OptimizeResult {
  changes: number;
  ovrDiff: number;
  chemistryLabel: string;
  chemistryBonus: number;
}

interface OptimizeResultModalProps {
  result: OptimizeResult | null;
  onDismiss: () => void;
}

function chemistryTone(label: string): string {
  if (label === 'Excellent') return 'text-emerald-400';
  if (label === 'Good') return 'text-primary';
  if (label === 'Average') return 'text-amber-400';
  return 'text-muted-foreground';
}

function ovrTone(d: number): string {
  if (d > 0) return 'text-emerald-400';
  if (d < 0) return 'text-amber-400';
  return 'text-muted-foreground';
}

function OvrIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="w-3.5 h-3.5" />;
  if (d < 0) return <TrendingDown className="w-3.5 h-3.5" />;
  return <Minus className="w-3.5 h-3.5" />;
}

function captionFor(result: OptimizeResult): string {
  if (result.changes === 0) {
    return 'Your XI is already the strongest combination available.';
  }
  if (result.ovrDiff < 0) {
    return `Traded ${Math.abs(result.ovrDiff)} OVR for stronger team chemistry — net match strength is up.`;
  }
  if (result.ovrDiff > 0) {
    return `Quality up ${result.ovrDiff} OVR with ${result.chemistryLabel.toLowerCase()} chemistry preserved.`;
  }
  return 'Same OVR, sharper chemistry and tactical fit.';
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
  valueClassName?: string;
  delay: number;
}

function StatCard({ icon, label, value, tone, valueClassName, delay }: StatCardProps) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl px-2 py-3 bg-card/40 border border-border/40 backdrop-blur-md"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.28)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)',
          mixBlendMode: 'screen',
        }}
      />
      <div className={cn('flex items-center justify-center gap-1', tone)}>
        {icon}
      </div>
      <div className={cn('font-black font-display tabular-nums leading-tight mt-1', tone, valueClassName ?? 'text-lg')}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground mt-0.5 font-semibold">
        {label}
      </div>
    </motion.div>
  );
}

export function OptimizeResultModal({ result, onDismiss }: OptimizeResultModalProps) {
  const { t } = useTranslation();
  useScrollLock(!!result);

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-modal="true"
          role="dialog"
          aria-label={t('optimizeResultModal.lineupOptimizationResult')}
        >
          <motion.div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            style={{ touchAction: 'none' }}
            onClick={() => { hapticLight(); onDismiss(); }}
          />

          <motion.div
            className={cn(
              'relative w-full max-w-sm transform-gpu overflow-hidden rounded-3xl text-center',
              'bg-gradient-to-br from-[hsl(222_35%_14%/0.78)] via-[hsl(222_28%_10%/0.82)] to-[hsl(222_40%_7%/0.88)]',
              'backdrop-blur-2xl backdrop-saturate-150',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,inset_0_1px_0_rgba(255,255,255,0.20),inset_0_-1px_0_rgba(0,0,0,0.40),0_30px_80px_-30px_rgba(0,0,0,0.7),0_0_60px_-20px_hsl(var(--primary)/0.35)]',
            )}
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-2/3"
              style={{
                background:
                  'radial-gradient(120% 80% at 50% -20%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 36%, rgba(255,255,255,0) 64%)',
                mixBlendMode: 'screen',
              }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-44 rounded-full blur-2xl"
              style={{
                background:
                  'radial-gradient(closest-side, hsl(var(--primary) / 0.32) 0%, transparent 70%)',
              }}
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-3 left-0 w-px"
              style={{
                background:
                  'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)',
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-3 right-0 w-px"
              style={{
                background:
                  'linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)',
              }}
            />

            <div className="relative px-6 pt-7 pb-6 space-y-5">
              <div className="space-y-2.5">
                <motion.div
                  className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center relative"
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 0.05 }}
                  style={{
                    background:
                      'linear-gradient(160deg, hsl(var(--primary) / 0.45), hsl(var(--primary) / 0.15))',
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.30), 0 10px 30px -8px hsl(var(--primary) / 0.55)',
                  }}
                >
                  <Wand2 className="w-6 h-6 text-primary drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]" />
                  <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-primary/90" />
                </motion.div>

                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/80">
                  Smart Optimize
                </p>
                <h2 className="text-xl font-black font-display text-foreground leading-tight">
                  {result.changes === 0 ? 'Already Optimal' : 'Lineup Optimised'}
                </h2>
              </div>

              {result.changes > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <StatCard
                    icon={<Users className="w-3.5 h-3.5" />}
                    label={t('optimizeResultModal.changes')}
                    value={String(result.changes)}
                    tone="text-foreground"
                    delay={0.12}
                  />
                  <StatCard
                    icon={<OvrIcon d={result.ovrDiff} />}
                    label="OVR"
                    value={`${result.ovrDiff > 0 ? '+' : ''}${result.ovrDiff}`}
                    tone={ovrTone(result.ovrDiff)}
                    delay={0.18}
                  />
                  <StatCard
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                    label={`+${(result.chemistryBonus * 100).toFixed(0)}% Chem`}
                    value={result.chemistryLabel}
                    tone={chemistryTone(result.chemistryLabel)}
                    valueClassName="text-sm"
                    delay={0.24}
                  />
                </div>
              )}

              <motion.p
                className="text-xs text-muted-foreground leading-relaxed px-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {captionFor(result)}
              </motion.p>

              <motion.button
                onClick={() => { hapticLight(); onDismiss(); }}
                className={cn(
                  'relative overflow-hidden w-full py-2.5 rounded-2xl font-semibold text-sm',
                  'flex items-center justify-center gap-2 transition-all active:scale-[0.985]',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'bg-gradient-to-b from-primary to-[hsl(var(--primary)/0.85)] text-primary-foreground',
                  'shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.25),0_10px_28px_-10px_hsl(var(--primary)/0.55)]',
                )}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0) 60%)',
                    mixBlendMode: 'screen',
                  }}
                />
                <Check className="relative w-4 h-4" />
                <span className="relative">Done</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
