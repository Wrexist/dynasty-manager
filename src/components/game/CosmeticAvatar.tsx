import { AssetImage } from './AssetImage';
import { AVATARS, type AvatarAssetId } from '@/assets/manifest';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CosmeticAvatarProps {
  /** Cosmetic id from the monetization catalogue (e.g. `avatar-veteran`). */
  avatarId?: string | null;
  className?: string;
}

/**
 * Cosmetic avatar overlay — a small portrait/icon representing a purchased
 * cosmetic from the shop. Distinct from the `ManagerAvatar` creation-wizard
 * emblem (which is an initials-based SVG badge). Falls back to the matching
 * Lucide silhouette when the designed PNG isn't yet present.
 */
export function CosmeticAvatar({ avatarId, className }: CosmeticAvatarProps) {
  const cls = cn(className);
  const entry = avatarId && (avatarId in AVATARS) ? AVATARS[avatarId as AvatarAssetId] : null;
  if (!entry) return <User className={cls} />;
  return <AssetImage entry={entry} className={cls} />;
}
