import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AssetEntry } from '@/assets/manifest';
import { useGameStore } from '@/store/gameStore';

interface AssetImageProps {
  entry: AssetEntry;
  /** CSS size class for both img and fallback icon. Pass a tailwind size like
   *  "w-10 h-10" so the caller controls sizing centrally. */
  className?: string;
  /** Eager-load + high priority (use for LCP content only). */
  priority?: boolean;
  /** When the fallback icon renders, this className is applied to it. Defaults
   *  to the container className so icon and image share dimensions. */
  fallbackClassName?: string;
}

/**
 * Responsive image wrapper that gracefully falls back to a Lucide icon when
 * the asset URL is missing OR errors at load. Safe to place anywhere in the
 * tree BEFORE the corresponding art asset has been produced — the UI keeps
 * rendering with the fallback icon and flips to real art the moment the
 * manifest's `url` is flipped on.
 */
export const AssetImage = memo(function AssetImage({ entry, className, priority, fallbackClassName }: AssetImageProps) {
  const [errored, setErrored] = useState(false);
  const reducedMotion = useGameStore(s => s.settings.reducedMotion);

  const iconClass = fallbackClassName ?? className;
  const showFallback = !entry.url || errored;

  if (showFallback) {
    const Icon = entry.fallback;
    return <Icon className={iconClass} aria-label={entry.alt} />;
  }

  return (
    <img
      src={entry.url}
      alt={entry.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setErrored(true)}
      className={cn(
        className,
        !reducedMotion && 'animate-in fade-in duration-200',
      )}
    />
  );
});
