/**
 * Shared pieces for EARNED cosmetics (Manager Pass + Legacy tier): the banner
 * layer drawn behind the Pass and Legacy heroes, and the locker row used to
 * wear or take off an earned item. Presentation only — ownership and equipping
 * live in `managerPassSlice` / `utils/managerPass.ts`.
 */
import { Award, PartyPopper, Palette, Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { PROFILE_BANNER_STYLES } from '@/config/profileBanners';
import type { CosmeticCategory, CosmeticItem } from '@/types/game';
import type { TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';

/** Icon + label per earned-cosmetic category. */
const EARNED_CATEGORY_META: Partial<Record<CosmeticCategory, { icon: React.ElementType; labelKey: TranslationKey }>> = {
  title_badge: { icon: Award, labelKey: 'managerPass.category.title_badge' },
  celebration_text: { icon: PartyPopper, labelKey: 'managerPass.category.celebration_text' },
  profile_banner: { icon: Palette, labelKey: 'managerPass.category.profile_banner' },
};

/** The icon for an earned cosmetic's category. */
export function EarnedCategoryIcon({ category, className }: { category: CosmeticCategory; className?: string }) {
  const Icon = EARNED_CATEGORY_META[category]?.icon ?? Award;
  return <Icon className={className} />;
}

/** The worn banner as a background layer; the default gold glow when none. */
export function ProfileBannerLayer({ bannerId }: { bannerId?: string }) {
  const stops = bannerId ? PROFILE_BANNER_STYLES[bannerId] : undefined;
  if (stops) {
    return <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', stops)} />;
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-70"
      style={{ background: 'radial-gradient(130% 90% at 50% -10%, hsl(var(--gold) / 0.20) 0%, hsl(var(--gold) / 0.04) 42%, transparent 72%)' }}
    />
  );
}

interface EarnedCosmeticRowProps {
  item: CosmeticItem;
  /** Worn right now. */
  equipped: boolean;
  /** Owned and wearable. False renders the row locked, with `lockedLabel`. */
  owned: boolean;
  lockedLabel?: string;
  onEquip: () => void;
  onRemove: () => void;
}

/** One earned cosmetic: icon, name, category, and a 44px Wear / Take off button. */
export function EarnedCosmeticRow({ item, equipped, owned, lockedLabel, onEquip, onRemove }: EarnedCosmeticRowProps) {
  const { t } = useTranslation();
  const meta = EARNED_CATEGORY_META[item.category];
  const Icon = meta?.icon ?? Award;
  const banner = item.category === 'profile_banner' ? PROFILE_BANNER_STYLES[item.id] : undefined;
  return (
    <div className={cn('flex items-center gap-3 py-1.5', !owned && 'opacity-55')}>
      <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-white/[0.04] border border-white/10 flex items-center justify-center">
        {banner && <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br', banner)} />}
        <Icon className="relative w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
        <p className="text-micro text-muted-foreground">{meta ? t(meta.labelKey) : item.category}</p>
      </div>
      {!owned ? (
        <span className="text-micro text-muted-foreground shrink-0">{lockedLabel}</span>
      ) : equipped ? (
        <button
          type="button"
          onClick={onRemove}
          aria-pressed
          className="min-h-[44px] min-w-[44px] px-3 rounded-lg shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/30 transition-colors hover:bg-primary/15"
        >
          <Check className="w-3.5 h-3.5" />
          {t('managerPass.equipped')}
        </button>
      ) : (
        <button
          type="button"
          onClick={onEquip}
          aria-pressed={false}
          className="min-h-[44px] min-w-[44px] px-3 rounded-lg shrink-0 text-xs font-semibold text-foreground bg-white/[0.04] border border-white/10 transition-colors hover:bg-white/[0.08]"
        >
          {t('managerPass.equip')}
        </button>
      )}
    </div>
  );
}
