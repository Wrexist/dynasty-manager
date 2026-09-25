import { useEffect, useState } from 'react';
import {
  getFlagUrl, getFlag, getFlagFallbackCode, supportsFlagEmoji, hasFlagUrlFailed, markFlagUrlFailed,
} from '@/utils/nationality';
import { cn } from '@/lib/utils';

interface FlagIconProps {
  nationality: string;
  /** Size in pixels. Determines both display size and CDN resolution. Default: 20 */
  size?: number;
  /** When true, fills parent container via w-full h-full object-cover (ignores size). */
  fill?: boolean;
  className?: string;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Renders a real flag image from flagcdn.com, with a fallback that is never a
 * blank square.
 *
 * The fallback is the emoji flag where the platform can draw one (iOS,
 * Android), and the nation's three-letter code otherwise: offline on a
 * platform without flag glyphs the emoji rendered as an empty box on every
 * nation but England (playthrough 2026-09, R12). Offline, no request is made
 * at all; an image that failed once is not requested again this session.
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
  // Request 2x resolution for retina displays
  const cdnWidth = fill ? 160 : size <= 20 ? 40 : size <= 40 ? 80 : 160;
  const url = getFlagUrl(nationality, cdnWidth);

  const [errored, setErrored] = useState(() => !url || hasFlagUrlFailed(url) || isOffline());
  // Reset the error state if the component is reused for a different
  // nationality (list rows recycle by index).
  useEffect(() => { setErrored(!url || hasFlagUrlFailed(url) || isOffline()); }, [url]);
  const onError = () => {
    if (url) markFlagUrlFailed(url);
    setErrored(true);
  };

  if (errored) {
    if (supportsFlagEmoji()) {
      if (fill) {
        return (
          <div role="img" aria-label={nationality} title={nationality} className={cn('w-full h-full flex items-center justify-center text-4xl', className)}>
            {getFlag(nationality)}
          </div>
        );
      }
      return <span role="img" aria-label={nationality} title={nationality} className={className}>{getFlag(nationality)}</span>;
    }
    // No flag glyphs on this platform: the code, on a flag-shaped chip.
    if (fill) {
      return (
        <div
          role="img"
          aria-label={nationality}
          title={nationality}
          data-flag-fallback="code"
          className={cn('w-full h-full flex items-center justify-center bg-muted/60 text-foreground/80 text-sm font-bold tracking-wide', className)}
        >
          {getFlagFallbackCode(nationality)}
        </div>
      );
    }
    return (
      <span
        role="img"
        aria-label={nationality}
        title={nationality}
        data-flag-fallback="code"
        className={cn(
          'inline-flex items-center justify-center rounded-[2px] shrink-0 px-0.5 align-middle',
          'bg-muted/60 text-foreground/80 text-[11px] leading-none font-bold tracking-tight',
          className,
        )}
        style={{ minWidth: size, height: Math.max(Math.round(size * 0.667), 14) }}
      >
        {getFlagFallbackCode(nationality)}
      </span>
    );
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
        onError={onError}
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
      onError={onError}
    />
  );
}
