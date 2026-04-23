import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
            // touch-none blocks underlying taps + keeps iOS back gesture
            // from firing while the overlay is up.
            'z-[60] flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm touch-none',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            // motion-safe keeps the spin for regular users; motion-reduce
            // swaps it to no animation + a solid primary ring so the
            // indicator is still visually distinct without rotation.
            className="w-12 h-12 rounded-full border-[3px] border-primary/20 border-t-primary motion-safe:animate-spin motion-reduce:animate-none motion-reduce:border-primary/40"
            aria-hidden="true"
          />
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
