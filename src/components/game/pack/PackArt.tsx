import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
    />
  );
}
