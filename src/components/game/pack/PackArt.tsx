import { useState } from 'react';
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
 * Shows the AI-generated pack illustration when the asset is present;
 * silently falls back to the supplied placeholder on failed load (404 /
 * decode error / no `src`). Lets the rest of the UI render unchanged
 * while pack art is still being produced — and the moment the user
 * drops a PNG into `public/packs/`, it lights up automatically.
 */
export function PackArt({ src, alt = '', fallback, className, loading = 'lazy' }: PackArtProps) {
  const [errored, setErrored] = useState(false);
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
