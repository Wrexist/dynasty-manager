import { getFlagUrl, getFlag } from '@/utils/nationality';
import { cn } from '@/lib/utils';

interface FlagIconProps {
  nationality: string;
  /** Size in pixels. Determines both display size and CDN resolution. Default: 20 */
  size?: number;
  className?: string;
}

/**
 * Renders a real flag image from flagcdn.com.
 * Falls back to emoji flag if the image fails to load.
 * Aspect ratio is 3:2 (standard flag proportions).
 */
export function FlagIcon({ nationality, size = 20, className }: FlagIconProps) {
  // Request 2x resolution for retina displays
  const cdnWidth = size <= 20 ? 40 : size <= 40 ? 80 : 160;
  const url = getFlagUrl(nationality, cdnWidth);
  const height = Math.round(size * 0.667); // 3:2 aspect ratio

  if (!url) {
    // No ISO code found — fall back to emoji
    return <span className={className}>{getFlag(nationality)}</span>;
  }

  return (
    <img
      src={url}
      alt={nationality}
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
        (e.target as HTMLElement).replaceWith(span);
      }}
    />
  );
}
