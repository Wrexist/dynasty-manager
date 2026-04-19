import { memo } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles, ShieldCheck } from 'lucide-react';
import type { PackTierDefinition } from '@/config/packs';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface PackShopCardProps {
  tier: PackTierDefinition;
  affordable: boolean;
  squadOk: boolean;
  onSelect: () => void;
  featured?: boolean;
}

export const PackShopCard = memo(function PackShopCard({ tier, affordable, squadOk, onSelect, featured }: PackShopCardProps) {
  const disabled = !affordable || !squadOk;
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -4 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={() => { if (disabled) return; hapticLight(); onSelect(); }}
      disabled={disabled}
      className={cn(
        'group relative w-full rounded-2xl overflow-hidden border text-left',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        disabled ? 'opacity-50 grayscale cursor-not-allowed border-border/50' : 'border-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.45)]',
        featured ? 'aspect-[16/9]' : 'aspect-[3/4]',
      )}
      style={{
        background: `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientTo} 100%)`,
      }}
      aria-label={`Open ${tier.label}, ${formatMoney(tier.price)}${disabled ? ' (unavailable)' : ''}`}
    >
      {/* Gloss + inner border */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/55 pointer-events-none" />
      <div className="absolute inset-2 rounded-xl border border-white/20 pointer-events-none" />

      {/* Shimmer sweep — featured only */}
      {featured && !disabled && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)' }}
          initial={{ x: '-100%' }}
          animate={{ x: '120%' }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
        />
      )}

      {/* Content */}
      <div className={cn('relative h-full flex flex-col text-white', featured ? 'p-4' : 'p-3')}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-80 font-semibold">Dynasty Pack</p>
            <h3 className={cn('font-display font-black leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]', featured ? 'text-2xl mt-1' : 'text-lg mt-1')}>{tier.label}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            {featured && (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/15 backdrop-blur border border-white/20">
                <Sparkles className="w-3 h-3" /> Featured
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-black/35 backdrop-blur border border-white/25">
              <ShieldCheck className="w-3 h-3" />
              {tier.guaranteedMinOvr}+
            </span>
          </div>
        </div>

        {/* Art slot — placeholder */}
        <div className="flex-1 flex items-center justify-center my-2">
          <div
            className={cn(
              'rounded-full bg-black/30 border border-white/20 flex items-center justify-center',
              featured ? 'w-16 h-16' : 'w-12 h-12',
            )}
          >
            <span className={cn('font-display font-black text-white/70', featured ? 'text-2xl' : 'text-lg')}>
              {tier.label[0]}
            </span>
          </div>
        </div>

        <div className="mt-auto space-y-1.5">
          <p className="text-[11px] opacity-90 leading-snug">{tier.tagline}</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/20">
            <span className={cn('font-display font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]', featured ? 'text-xl' : 'text-base')}>
              {formatMoney(tier.price)}
            </span>
            {disabled ? (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest bg-black/40 px-2 py-1 rounded">
                <Lock className="w-3 h-3" /> {!affordable ? 'Budget' : 'Squad Full'}
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest bg-white/15 px-2 py-1 rounded">Open</span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
});
