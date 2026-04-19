import { AssetImage } from './AssetImage';
import { TROPHIES, type CupAssetId } from '@/assets/manifest';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CupIconProps {
  cupId: CupAssetId | null | undefined;
  className?: string;
}

/**
 * Renders a trophy silhouette for the given competition id. Falls back to
 * the generic Lucide Trophy when the id is unknown or the matching asset
 * hasn't been produced yet.
 */
export function CupIcon({ cupId, className }: CupIconProps) {
  const cls = cn(className);
  const entry = cupId ? TROPHIES[cupId] : null;
  if (!entry) return <Trophy className={cls} />;
  return <AssetImage entry={entry} className={cls} />;
}
