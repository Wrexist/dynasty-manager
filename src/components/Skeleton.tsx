import { cn } from '@/lib/utils';

/**
 * Placeholder block that pulses to indicate content is loading.
 * Matches the app's dark glass aesthetic — subtle card-tinted fill with a
 * breathing animation. Honors prefers-reduced-motion via Tailwind.
 *
 * Default is decorative (aria-hidden) so screen readers don't announce
 * every individual bar when a row composes several of them. The outer
 * container that wraps the loading region should carry the live-region
 * semantics — see SkeletonRow / SkeletonList below.
 *
 * Use for structural placeholders (list rows, cards, avatars). For a
 * full-screen blocking indicator during async work, use LoadingOverlay.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-muted/40 motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Pre-composed skeleton for a typical player/club list row:
 *  avatar circle + two stacked text bars on the left, a trailing chip.
 *
 * When rendered standalone, the row itself is the live region. When
 * rendered inside a SkeletonList, the list container owns the live
 * region and each row is silenced (aria-hidden propagates down).
 */
export function SkeletonRow({ className, standalone = true }: { className?: string; standalone?: boolean }) {
  return (
    <div
      role={standalone ? 'status' : undefined}
      aria-busy={standalone || undefined}
      aria-live={standalone ? 'polite' : undefined}
      aria-label={standalone ? 'Loading' : undefined}
      className={cn(
        'flex items-center gap-3 p-3 bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl',
        className,
      )}
    >
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
      <Skeleton className="h-6 w-12 rounded-md" />
    </div>
  );
}

/**
 * A small stack of SkeletonRows. Owns a single live region for the
 * whole list so screen readers announce "Loading" once rather than
 * per-row.
 */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading"
      className={cn('space-y-2', className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} standalone={false} />
      ))}
    </div>
  );
}
