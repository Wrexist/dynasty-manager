import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks/useScrollLock';

interface LoadingOverlayProps {
  /** When true, the overlay is rendered and a scrim blocks input. */
  open: boolean;
  /** Primary label, e.g. "Loading community pack…" or "Setting up career…". */
  message?: string;
  /** Optional secondary line for context / time estimate. */
  detail?: string;
  /**
   * When "page" the overlay fills the viewport (default, for route-level
   * work like new-game setup). When "panel" it fills its nearest positioned
   * ancestor — use for inline blocking regions.
   */
  variant?: 'page' | 'panel';
  /** Extra className applied to the outer scrim. */
  className?: string;
}

/**
 * Branded full-screen (or panel-level) loading indicator.
 * Matches the app's dark glass aesthetic: backdrop blur, gold ring spinner,
 * single-line label. Use when an async operation would otherwise leave the
 * user staring at a blank or stale screen for >300ms.
 *
 * For structural list/card placeholders while content streams in, prefer
 * Skeleton / SkeletonRow instead.
 */
export function LoadingOverlay({
  open,
  message = 'Loading…',
  detail,
  variant = 'page',
  className,
}: LoadingOverlayProps) {
  // Page-variant overlays sit over the whole viewport, so the user could
  // otherwise pull-to-refresh or scroll the background while a critical
  // op is in flight. Panel variant is scoped, no body lock needed.
  useScrollLock(open && variant === 'page');
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-busy="true"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            variant === 'page' ? 'fixed inset-0' : 'absolute inset-0',
            // touch-none tells the browser not to handle gestures here;
            // the stopPropagation handlers below keep React synthetic
            // pointer/touch events from bubbling to ancestor swipe
            // handlers (e.g. GameShell's tab-swipe useSwipeGesture) while
            // an async op is in flight.
            'z-[60] flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm touch-none',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Premium concentric ring — a slow outer arc + a faster inner
              arc counter-rotate over a soft gold ambient glow, echoing the
              pack-opening loader so loading reads as a deliberate, branded
              moment rather than a bare spinner. motion-reduce drops all
              rotation/pulse and leaves a solid primary ring so the indicator
              stays visually distinct without animation. */}
          <div className="relative w-14 h-14 flex items-center justify-center" aria-hidden="true">
            <div
              className="absolute inset-0 rounded-full motion-safe:animate-pulse motion-reduce:hidden"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary) / 0.28) 0%, transparent 66%)',
                filter: 'blur(10px)',
              }}
            />
            <div className="absolute inset-0 rounded-full border border-primary/15 border-t-primary/50 shadow-[0_0_18px_hsl(var(--primary)/0.20)] motion-safe:animate-[spin_4.5s_linear_infinite_reverse] motion-reduce:hidden" />
            <div className="w-10 h-10 rounded-full border-[3px] border-primary/15 border-t-primary shadow-[0_0_14px_hsl(var(--primary)/0.40)] motion-safe:animate-spin motion-reduce:animate-none motion-reduce:border-primary/40" />
          </div>
          <div className="text-center px-6 max-w-xs">
            <p className="text-sm font-semibold text-foreground">{message}</p>
            {detail && (
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
