import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// The Gold cover includes an opaque matte outside its foil silhouette.
// Mask the source before the opening animation cuts it into strips, so the
// same clean edge is used by the store, guide, popup, and flying foil pieces.
const GOLD_FOIL_MASK = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536"><path fill="white" d="M78 16H948V82C930 125 919 172 919 230L923 995C923 1200 930 1340 954 1432V1490H67V1432C92 1340 106 1220 106 1000L103 240C103 172 88 125 78 82Z"/></svg>')}")`;

interface PackArtProps {
  /** Public asset path. When undefined or the image 404s, render `fallback`. */
  src?: string;
  /** Alt text — typically empty since the tier label is announced separately. */
  alt?: string;
  /** Element to render in place of the image while loading and on failure. */
  fallback: React.ReactNode;
  /** Tailwind classes for the img/fallback box. */
  className?: string;
  /** Pass through to the img element. */
  loading?: 'lazy' | 'eager';
}

/**
 * Pack-cover art slot.
 *
 * Shows the pack illustration when the asset is present; silently falls back
 * to the supplied placeholder on failed load (404 / decode error / no `src`).
 * Lets the rest of the UI render unchanged while pack art is still being
 * produced — and the moment the file lands in `public/packs/`, it lights up
 * automatically. `PackShopCard` nests two of these (new cover → previous
 * cover → gradient) so a cover can be referenced before it ships.
 */
export function PackArt({ src, alt = '', fallback, className, loading = 'lazy' }: PackArtProps) {
  const [errored, setErrored] = useState(false);
  // A failed load must not poison a different asset — reset when src changes
  // (e.g. the same slot re-used for another pack tier).
  useEffect(() => { setErrored(false); }, [src]);
  if (!src || errored) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === '' || undefined}
      loading={loading}
      decoding="async"
      draggable={false}
      onError={() => setErrored(true)}
      className={cn('select-none pointer-events-none', className)}
      style={src === '/packs/gold.webp' ? {
        maskImage: GOLD_FOIL_MASK,
        WebkitMaskImage: GOLD_FOIL_MASK,
        maskSize: className?.includes('object-cover') ? 'cover' : 'contain',
        WebkitMaskSize: className?.includes('object-cover') ? 'cover' : 'contain',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      } : undefined}
    />
  );
}
