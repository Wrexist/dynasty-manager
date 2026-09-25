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

type LoadState = 'pending' | 'loaded' | 'failed';

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** What shows when the image cannot: the emoji flag where the platform can
 *  draw one, otherwise the nation's code. Sized to the flag's own box — it is
 *  a graphic standing in for a flag, not copy. */
function FlagFallback({ nationality, height, fill }: { nationality: string; height: number; fill?: boolean }) {
  if (supportsFlagEmoji()) {
    return (
      <span
        aria-hidden
        data-flag-fallback="emoji"
        className={cn('absolute inset-0 flex items-center justify-center leading-none', fill && 'text-4xl')}
        style={fill ? undefined : { fontSize: height }}
      >
        {getFlag(nationality)}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-flag-fallback="code"
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-muted/60 text-foreground/80 font-bold leading-none tracking-tight',
        fill && 'text-sm tracking-wide',
      )}
      style={fill ? undefined : { fontSize: Math.max(6, Math.round(height * 0.62)) }}
    >
      {getFlagFallbackCode(nationality)}
    </span>
  );
}

/**
 * Renders a real flag image from flagcdn.com, and never a blank square.
 *
 * The flag's box always shows something: the fallback (the emoji flag where
 * the platform can draw one — iOS, Android — otherwise the nation's code)
 * until the image has actually loaded, and for good if it fails. Offline in
 * the 2026-09 playthrough (R12), every nation but England showed an empty box:
 * a request that is slow to fail left a transparent <img>, and on a platform
 * without flag glyphs the emoji fallback drew nothing either. Offline, no
 * request is made at all; a URL that failed once is not requested again this
 * session. Aspect ratio is 3:2 (standard flag proportions) unless `fill` is set.
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
  const initialState = (): LoadState => (!url || hasFlagUrlFailed(url) || isOffline() ? 'failed' : 'pending');

  const [state, setState] = useState<LoadState>(initialState);
  // Reset if the component is reused for a different nationality (list rows
  // recycle by index).
  useEffect(() => {
    setState(!url || hasFlagUrlFailed(url) || isOffline() ? 'failed' : 'pending');
  }, [url]);
  const onError = () => {
    if (url) markFlagUrlFailed(url);
    setState('failed');
  };

  const height = Math.round(size * 0.667); // 3:2 aspect ratio
  const image = state !== 'failed' && (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      width={fill ? undefined : size}
      height={fill ? undefined : height}
      className={cn('absolute inset-0 w-full h-full object-cover', state !== 'loaded' && 'opacity-0')}
      onLoad={() => setState('loaded')}
      onError={onError}
    />
  );
  const fallback = state !== 'loaded' && <FlagFallback nationality={nationality} height={height} fill={fill} />;

  if (fill) {
    return (
      <div role="img" aria-label={`Flag of ${nationality}`} title={nationality} className={cn('relative w-full h-full overflow-hidden', className)}>
        {fallback}
        {image}
      </div>
    );
  }
  return (
    <span
      role="img"
      aria-label={nationality}
      title={nationality}
      className={cn('relative inline-block overflow-hidden rounded-[2px] shrink-0 align-middle', className)}
      style={{ width: size, height }}
    >
      {fallback}
      {image}
    </span>
  );
}
