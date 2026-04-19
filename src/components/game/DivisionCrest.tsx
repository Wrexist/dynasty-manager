import { AssetImage } from './AssetImage';
import { DIVISIONS, getDivisionAssetId } from '@/assets/manifest';
import { cn } from '@/lib/utils';

interface DivisionCrestProps {
  /** League tier (1–4). Any other value renders the generic placeholder crest. */
  tier: number | undefined;
  className?: string;
}

/**
 * Division / league shield crest. Falls back to a generic Shield icon
 * (via the manifest's fallback) when the designed crest isn't in place.
 */
export function DivisionCrest({ tier, className }: DivisionCrestProps) {
  const assetId = getDivisionAssetId(tier);
  return <AssetImage entry={DIVISIONS[assetId]} className={cn(className)} />;
}
