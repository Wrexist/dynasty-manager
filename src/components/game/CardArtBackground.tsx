import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerCardArt } from '@/utils/uiHelpers';

interface CardArtBackgroundProps {
  overall: number | null | undefined;
  /**
   * `full` fits the whole shield into the container. `top-strip` zooms into
   * the decorative fan-sweep head so a short horizontal tile (bench strip,
   * accent rail) shows just that band instead of a squashed shield.
   */
  variant?: 'full' | 'top-strip';
  /** Force eager load inside pack-reveal sequences; default lazy elsewhere. */
  eager?: boolean;
  /**
   * Dim factor (0–1) for the gradient overlay riding on top of the artwork.
   * 0 = artwork visible at full saturation (used for the hero card where
   * club-color tint sits on top). Default 0.6 keeps rating/name text crisp.
   */
  overlayStrength?: number;
  className?: string;
}

/**
 * Tier-themed shield artwork (bronze/silver/gold/premium/rare/icon) rendered
 * as an absolutely-positioned background layer. Pairs with the text/stat
 * overlays each card surface already owns — consumers just drop
 * `<CardArtBackground overall={p.overall} />` as the first child of a
 * `relative` container.
 */
export const CardArtBackground = memo(function CardArtBackground({
  overall,
  variant = 'full',
  eager = false,
  overlayStrength = 0.6,
  className,
}: CardArtBackgroundProps) {
  const { src, filter } = getPlayerCardArt(overall);

  const imgStyle =
    variant === 'top-strip'
      ? { filter, transform: 'scale(1.2)', transformOrigin: 'top center' }
      : { filter };

  const imgObjectPosition =
    variant === 'top-strip' ? 'object-[center_top]' : 'object-center';

  return (
    <div
      aria-hidden
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
    >
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={imgStyle}
        className={cn('absolute inset-0 w-full h-full object-cover select-none', imgObjectPosition)}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,${overlayStrength * 0.5}) 55%, rgba(0,0,0,${overlayStrength}) 100%)`,
        }}
      />
    </div>
  );
});
