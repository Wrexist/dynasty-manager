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
        'group relative w-full rounded-[22px] overflow-hidden text-left isolate',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        // Liquid-glass rim: hairline outer stroke + bright top inset + dark
        // bottom inset (faux refraction) + soft accent halo + drop shadow.
        disabled
          ? 'opacity-50 grayscale cursor-not-allowed shadow-[0_0_0_0.5px_rgba(255,255,255,0.08)_inset]'
          : 'shadow-[0_0_0_0.5px_rgba(255,255,255,0.22)_inset,inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.45),0_22px_55px_-18px_rgba(0,0,0,0.7)]',
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

      {/* Legibility scrim — feather-light at the top, stronger at the bottom
          where the frosted glass panel sits. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.00) 22%, rgba(0,0,0,0.00) 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Liquid-glass specular highlight — bright top crescent, like sky
          reflected on a polished glass surface. */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 28%, rgba(255,255,255,0) 60%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Edge refraction streaks — faint vertical lights catching the rim,
          sells the "thick glass" depth at the sides. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,0.12) 100%)',
        }}
      />

      {/* Concentric inner glass ring — gradient stroke (light at top, dim at
          bottom) reads as light bending through a glass bezel. */}
      <div
        aria-hidden
        className={cn('absolute pointer-events-none rounded-[14px]', featured ? 'inset-[6px]' : 'inset-[5px]')}
        style={{
          padding: '1px',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.04) 70%, rgba(255,255,255,0.18) 100%)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
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

      {/* Glass-capsule badge stack — top-right, floats over the cover. */}
      <div className={cn('absolute flex flex-col items-end gap-1 z-10', featured ? 'top-3 right-3' : 'top-2.5 right-2.5')}>
        {featured && (
          <span
            className="flex items-center gap-1 h-6 px-2.5 text-[10px] uppercase tracking-widest rounded-full text-white bg-white/15 border border-white/30 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_-2px_rgba(0,0,0,0.45)]"
          >
            <Sparkles className="w-3 h-3" /> Featured
          </span>
        )}
        <span
          className="flex items-center gap-1 h-6 px-2.5 text-[10px] font-bold tabular-nums rounded-full text-white bg-white/15 border border-white/30 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_-2px_rgba(0,0,0,0.45)]"
        >
          <ShieldCheck className="w-3 h-3" />
          {tier.guaranteedMinOvr}+
        </span>
      </div>

      {/* Header — Dynasty Pack kicker sits top-left over the scrim */}
      <div className={cn('absolute left-0 right-0 z-10', featured ? 'top-3 px-4 pr-28' : 'top-2.5 px-3 pr-14')}>
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-95 font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
          Dynasty Pack
        </p>
      </div>

      {/* Floating frosted-glass footer — Apple Liquid-Glass panel containing
          the title, tagline, and price rail. Sits inset from the rim so the
          cover art breathes around it. */}
      <div
        className={cn(
          'absolute z-10 text-white rounded-2xl border border-white/25 backdrop-blur-2xl backdrop-saturate-150 bg-white/10',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(0,0,0,0.30),0_10px_30px_-10px_rgba(0,0,0,0.55)]',
          featured ? 'left-3 right-3 bottom-3 px-4 py-3' : 'left-2 right-2 bottom-2 px-3 py-2.5',
        )}
      >
        <h3
          className={cn(
            'font-display font-black leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] truncate',
            featured ? 'text-2xl' : 'text-base',
          )}
        >
          {tier.label}
        </h3>
        <p className={cn('opacity-95 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] mt-0.5', featured ? 'text-xs' : 'text-[11px]')}>
          {tier.tagline}
        </p>
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/20">
          <span className={cn('font-display font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] tabular-nums', featured ? 'text-lg' : 'text-base')}>
            {formatMoney(tier.price)}
          </span>
          {disabled ? (
            <span className="flex items-center gap-1 h-7 px-3 text-[10px] uppercase tracking-widest rounded-full bg-white/10 border border-white/25 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] font-semibold">
              <Lock className="w-3 h-3" /> {!affordable ? 'Budget' : 'Squad Full'}
            </span>
          ) : (
            <span className="flex items-center h-7 px-3.5 text-[10px] uppercase tracking-widest rounded-full bg-white/25 border border-white/40 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_12px_-2px_rgba(0,0,0,0.45)] font-semibold">
              Open
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});
