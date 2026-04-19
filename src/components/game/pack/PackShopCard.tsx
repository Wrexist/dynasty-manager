import { memo } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles, ShieldCheck } from 'lucide-react';
import type { PackTierDefinition } from '@/config/packs';
import { formatMoney } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { PackArt } from './PackArt';

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
        'group relative w-full rounded-2xl overflow-hidden border text-left isolate',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        disabled ? 'opacity-50 grayscale cursor-not-allowed border-border/50' : 'border-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.45)]',
        featured ? 'aspect-[16/9]' : 'aspect-[3/4]',
      )}
      style={{
        background: `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientTo} 100%)`,
      }}
      aria-label={`Open ${tier.label}, ${formatMoney(tier.price)}${disabled ? ' (unavailable)' : ''}`}
    >
      {/* Full-bleed cover art. The PNG IS the card — tier gradient above shows
          through only if the image fails to load or while it streams in. */}
      <PackArt
        src={tier.artSrc}
        className="absolute inset-0 w-full h-full object-cover object-center"
        fallback={<div className="absolute inset-0" />}
      />

      {/* Legibility scrim — subtle at the top (badges), stronger at the bottom
          (title + price rail). Keeps the artwork readable without dulling it. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 28%, rgba(0,0,0,0.10) 55%, rgba(0,0,0,0.78) 100%)',
        }}
      />

      {/* Concentric inner border — classic trading-card frame detail */}
      <div
        className={cn(
          'absolute pointer-events-none border border-white/20',
          featured ? 'inset-[6px] rounded-[10px]' : 'inset-[5px] rounded-[11px]',
        )}
      />

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

      {/* Badge stack — top-right, floats over the cover */}
      <div className={cn('absolute flex flex-col items-end gap-1 z-10', featured ? 'top-3 right-3' : 'top-2.5 right-2.5')}>
        {featured && (
          <span className="flex items-center gap-1 h-6 px-2 text-[10px] uppercase tracking-widest rounded-full bg-black/55 backdrop-blur border border-white/20 text-white">
            <Sparkles className="w-3 h-3" /> Featured
          </span>
        )}
        <span className="flex items-center gap-1 h-6 px-2 text-[10px] font-bold tabular-nums rounded-full bg-black/55 backdrop-blur border border-white/20 text-white">
          <ShieldCheck className="w-3 h-3" />
          {tier.guaranteedMinOvr}+
        </span>
      </div>

      {/* Header — Dynasty Pack kicker sits top-left over the scrim */}
      <div className={cn('absolute left-0 right-0 z-10', featured ? 'top-3 px-4 pr-28' : 'top-2.5 px-3 pr-14')}>
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-90 font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          Dynasty Pack
        </p>
      </div>

      {/* Footer — title, tagline, price rail pinned to the bottom scrim */}
      <div className={cn('absolute inset-x-0 bottom-0 z-10 text-white', featured ? 'p-4' : 'p-3')}>
        <h3
          className={cn(
            'font-display font-black leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)] truncate',
            featured ? 'text-2xl' : 'text-base',
          )}
        >
          {tier.label}
        </h3>
        <p className={cn('opacity-95 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] mt-1', featured ? 'text-xs' : 'text-[11px]')}>
          {tier.tagline}
        </p>
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/20">
          <span className={cn('font-display font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] tabular-nums', featured ? 'text-lg' : 'text-base')}>
            {formatMoney(tier.price)}
          </span>
          {disabled ? (
            <span className="flex items-center gap-1 h-7 px-3 text-[10px] uppercase tracking-widest bg-black/55 rounded-md border border-white/20 backdrop-blur">
              <Lock className="w-3 h-3" /> {!affordable ? 'Budget' : 'Squad Full'}
            </span>
          ) : (
            <span className="flex items-center h-7 px-3 text-[10px] uppercase tracking-widest bg-white/20 rounded-md border border-white/30 backdrop-blur font-semibold">
              Open
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});
