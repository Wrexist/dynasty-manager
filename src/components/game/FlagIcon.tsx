import { memo } from 'react';
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
 * Memoized — rendered once per player in every squad/league/transfer list, all
 * props are primitives, so identity comparison is trivially correct.
 */
export const FlagIcon = memo(function FlagIcon({ nationality, size = 20, fill, className }: FlagIconProps) {
  // Request 2x resolution for retina displays
  const cdnWidth = fill ? 160 : size <= 20 ? 40 : size <= 40 ? 80 : 160;
  const url = getFlagUrl(nationality, cdnWidth);

  if (!url) {
    // No ISO code found — fall back to emoji
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
        onError={(e) => {
          const div = document.createElement('div');
          div.textContent = getFlag(nationality);
          div.className = 'w-full h-full flex items-center justify-center text-4xl';
          div.title = nationality;
          (e.target as HTMLElement).replaceWith(div);
        }}
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
      onError={(e) => {
        // On load failure, replace with emoji flag
        const span = document.createElement('span');
        span.textContent = getFlag(nationality);
        span.className = className || '';
        span.title = nationality;
        (e.target as HTMLElement).replaceWith(span);
      }}
    />
  );
});
