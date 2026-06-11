import { useEffect, useState } from 'react';
import { getFlagUrl, getFlag } from '@/utils/nationality';
import { cn } from '@/lib/utils';

interface FlagIconProps {
  nationality: string;
  /** Size in pixels. Determines both display size and CDN resolution. Default: 20 */
  size?: number;
  /** When true, fills parent container via w-full h-full object-cover (ignores size). */
  fill?: boolean;
  className?: string;
}

/**
 * Renders a real flag image from flagcdn.com.
 * Falls back to emoji flag if the image fails to load.
 * Aspect ratio is 3:2 (standard flag proportions) unless `fill` is set.
 *
 * The fallback is DECLARATIVE state, never imperative DOM. The previous
 * onError handler did `e.target.replaceWith(<hand-made node>)` — React's
 * fiber still owned the <img>, so the next unmount called removeChild on a
 * node that was no longer a child and threw NotFoundError. FlagIcon renders
 * on every PlayerCard and loads from a CDN: one offline session armed
 * hundreds of these, and the next navigation tripped an error boundary.
 */
export function FlagIcon({ nationality, size = 20, fill, className }: FlagIconProps) {
  const [errored, setErrored] = useState(false);
  // Reset the error state if the component is reused for a different
  // nationality (list rows recycle by index).
  useEffect(() => { setErrored(false); }, [nationality]);

  // Request 2x resolution for retina displays
  const cdnWidth = fill ? 160 : size <= 20 ? 40 : size <= 40 ? 80 : 160;
  const url = getFlagUrl(nationality, cdnWidth);

  if (!url || errored) {
    // No ISO code found, or the CDN image failed to load — emoji fallback
    if (fill) {
      return (
        <div title={nationality} className={cn('w-full h-full flex items-center justify-center text-4xl', className)}>
          {getFlag(nationality)}
        </div>
      );
    }
    return <span title={nationality} className={className}>{getFlag(nationality)}</span>;
  }

  if (fill) {
    return (
      <img
        src={url}
        alt={`Flag of ${nationality}`}
        title={nationality}
        loading="lazy"
        decoding="async"
        className={cn('w-full h-full object-cover', className)}
        onError={() => setErrored(true)}
      />
    );
  }

  const height = Math.round(size * 0.667); // 3:2 aspect ratio
  return (
    <img
      src={url}
      alt={nationality}
      title={nationality}
      width={size}
      height={height}
      loading="lazy"
      decoding="async"
      className={cn('inline-block object-cover rounded-[2px] shrink-0', className)}
      style={{ width: size, height }}
      onError={() => setErrored(true)}
    />
  );
}
