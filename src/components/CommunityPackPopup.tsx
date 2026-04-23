import { Sparkles, Users, ShieldAlert } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface CommunityPackPopupProps {
  open: boolean;
  onChoice: (enabled: boolean) => void;
  onClose: () => void;
}

/**
 * Community Pack intro popup.
 *
 * Design intent:
 *  - Apple-style liquid glass surface (multi-layer backdrop blur, inset
 *    specular highlights, refraction streaks) to match PackShopCard.
 *  - Explicit, unmissable attribution that this dataset is community-
 *    sourced — we didn't author it and we aren't affiliated with any
 *    football rights holder.
 */
function CommunityPackPopupInner({ open, onChoice, onClose }: CommunityPackPopupProps) {
  const prefersReducedMotion = useReducedMotion();

  const choose = (enabled: boolean) => {
    hapticLight();
    onChoice(enabled);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className={cn(
          'max-w-sm mx-auto overflow-hidden border-0 p-0',
          'bg-gradient-to-br from-[hsl(222_35%_14%/0.85)] via-[hsl(222_30%_9%/0.85)] to-[hsl(222_40%_7%/0.9)]',
          'backdrop-blur-2xl backdrop-saturate-150 rounded-3xl',
          // Hairline outer stroke + bright top inset + dark bottom inset
          // (reads as thick glass with light refracting through the rim).
          'shadow-[0_0_0_0.5px_rgba(255,255,255,0.22)_inset,inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.45),0_30px_80px_-20px_rgba(0,0,0,0.75)]',
          // Boost the shadcn-injected Close button (DialogPrimitive.Close)
          // so the X stays legible against the bright specular crescent that
          // overlaps its top-right position. Targets the last direct button
          // child — that's the DialogPrimitive.Close node shadcn appends to
          // DialogContent. Adds a subtle dark backdrop + rounded pill + higher
          // contrast icon color, independent of the glass overlay layers.
          '[&>button[type="button"]]:z-20',
          '[&>button[type="button"]]:rounded-full',
          '[&>button[type="button"]]:bg-black/30',
          '[&>button[type="button"]]:backdrop-blur-md',
          '[&>button[type="button"]]:p-1',
          '[&>button[type="button"]]:opacity-100',
          '[&>button[type="button"]]:text-white/80',
          '[&>button[type="button"]]:hover:text-white',
          '[&>button[type="button"]]:hover:bg-black/45',
          '[&>button[type="button"]]:ring-1',
          '[&>button[type="button"]]:ring-inset',
          '[&>button[type="button"]]:ring-white/15',
        )}
      >
        {/* Top specular crescent — bright sky reflection on polished glass */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 28%, rgba(255,255,255,0) 60%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* Edge refraction streaks at the left/right rim */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 6%, rgba(255,255,255,0) 94%, rgba(255,255,255,0.10) 100%)',
          }}
        />

        {/* Warm gold accent halo floating behind the headline, subtle */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl opacity-40"
          style={{ background: 'radial-gradient(closest-side, hsl(43 96% 46% / 0.35), transparent 70%)' }}
        />

        {/* Slow shimmer sweep — disabled under reduced motion */}
        {!prefersReducedMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)' }}
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
          />
        )}

        <div className="relative px-5 pt-6 pb-5">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 border border-primary/30 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <DialogTitle className="font-display text-xl tracking-tight text-foreground">
                Community Pack
              </DialogTitle>
            </div>
            <DialogDescription className="pt-3 text-sm leading-relaxed text-foreground/80">
              Play with real-world squads, recognisable names, and ratings
              inspired by real-world football data — plus a rotating
              transfer market and seven extra leagues.
            </DialogDescription>
          </DialogHeader>

          {/* Attribution — the headline asset of this popup. Must be
              impossible to miss. Distinct "caution" treatment: amber rim,
              alert icon, 'Not affiliated' phrasing, verbatim. */}
          <div
            className={cn(
              'relative mt-4 rounded-2xl p-3.5',
              'bg-amber-500/[0.08] border border-amber-400/30 backdrop-blur-xl',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.3)]',
            )}
          >
            <div className="flex gap-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-300 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200">
                  Community-sourced — not our data
                </p>
                <p className="text-[11px] leading-snug text-amber-100/85">
                  Player data is community-sourced. Dynasty Manager didn't
                  create the real-player pool — it's a community-compiled
                  dataset loaded entirely offline on your device.
                </p>
                <p className="text-[11px] leading-snug text-amber-100/85">
                  This app is <strong>not affiliated with or endorsed by</strong>
                  {' '}any football league, club, player, or governing body.
                  All names, ratings, and likenesses belong to their respective
                  rights holders.
                </p>
              </div>
            </div>
          </div>

          {/* Choice rail */}
          <div className="flex flex-col gap-2 pt-4">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => choose(true)}
              className={cn(
                'relative w-full h-11 rounded-full font-semibold text-sm',
                'bg-gradient-to-b from-primary/95 to-primary/80 text-primary-foreground',
                'border border-primary/40',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.35),0_10px_24px_-8px_hsl(43_96%_46%/0.55)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                'overflow-hidden',
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Enable Real Players
              </span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => choose(false)}
              className={cn(
                'relative w-full h-11 rounded-full font-semibold text-sm',
                'bg-white/[0.08] text-foreground/90',
                'border border-white/20 backdrop-blur-xl backdrop-saturate-150',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.3),0_8px_20px_-10px_rgba(0,0,0,0.5)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              )}
            >
              Use Generated Players
            </motion.button>
          </div>

          <p className="text-[10px] text-muted-foreground/70 text-center pt-3 leading-snug">
            You can change this later in Settings — applies to new games in this save slot.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Scoped boundary so a CP-data render failure (lazy chunk import promise
// rejecting during Suspense, or a malformed pool entry crashing a child
// component) falls back to a friendly card without taking down the new-game
// flow it's mounted in.
export function CommunityPackPopup(props: CommunityPackPopupProps) {
  return (
    <ErrorBoundary scope="community-pack">
      <CommunityPackPopupInner {...props} />
    </ErrorBoundary>
  );
}
