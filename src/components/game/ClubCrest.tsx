import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTeamCrest } from '@/utils/teamCrest';

/**
 * Shared club identity: a bundled original crest resolved by stable club ID.
 * Unknown clubs and failed image loads keep the two-color roundel fallback.
 * Explicit children and non-club identities can bypass the image catalog.
 */

/** Minimal shape a crest needs — accepts Club, VirtualClub, or a nation. */
export interface CrestClub {
  id?: string;
  color?: string;
  secondaryColor?: string;
  shortName?: string;
  name?: string;
}

type CrestSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Size ramp. Each step pairs a box size with the label size that actually
 * fits inside it — the old ad-hoc crests mixed `w-6`/`w-9`/`w-10`/`w-12`/
 * `w-16` with unrelated text sizes, which is why they never looked like
 * siblings. All label sizes sit on the shared type scale and respect the
 * 11px floor. `xs` is label-less by design: a 24px roundel cannot hold a
 * 3–4 character short name at a legible size, so use it only in list rows
 * where the club name is already adjacent.
 */
const SIZE_MAP: Record<CrestSize, { box: string; label: string; labelled: boolean }> = {
  xs: { box: 'w-6 h-6', label: '', labelled: false },
  sm: { box: 'w-9 h-9', label: 'text-micro', labelled: true },
  md: { box: 'w-10 h-10', label: 'text-micro', labelled: true },
  lg: { box: 'w-12 h-12', label: 'text-caption', labelled: true },
  xl: { box: 'w-16 h-16', label: 'text-title', labelled: true },
};

interface ClubCrestProps {
  club: CrestClub | null | undefined;
  /** Known fixture ID when the caller has a narrowed club object. */
  clubId?: string;
  /** National teams and other explicit non-club identities bypass the catalog. */
  useAsset?: boolean;
  size?: CrestSize;
  /** `round` = roundel (match screens), `squircle` = club-header badge. */
  shape?: 'round' | 'squircle';
  /** Hide the short-name label (list rows where the name is already adjacent). */
  hideLabel?: boolean;
  /** Optional glyph rendered instead of the short name (e.g. a Shield icon). */
  children?: React.ReactNode;
  className?: string;
}

/** Neutral fallback so a missing/virtual club still renders a badge, not a hole. */
const FALLBACK_COLOR = 'hsl(222 20% 28%)';
const FALLBACK_TEXT = 'hsl(220 15% 90%)';

export const ClubCrest = memo(function ClubCrest({
  club,
  clubId,
  useAsset = true,
  size = 'md',
  shape = 'round',
  hideLabel = false,
  children,
  className,
}: ClubCrestProps) {
  const { box, label, labelled } = SIZE_MAP[size];
  const base = club?.color || FALLBACK_COLOR;
  const text = club?.secondaryColor || FALLBACK_TEXT;
  const short = club?.shortName || club?.name?.slice(0, 3).toUpperCase() || '';
  const showLabel = labelled && !hideLabel && !children;
  const src = useAsset && !children ? getTeamCrest(clubId ?? club?.id) : null;

  if (src) {
    return <CrestImage key={src} src={src} box={box} name={club?.name || short} className={className}
      fallback={<ClubCrest club={club} size={size} shape={shape} hideLabel={hideLabel} className={className} useAsset={false} />} />;
  }

  return (
    <div
      className={cn(
        box,
        label,
        'shrink-0 flex items-center justify-center font-bold leading-none select-none',
        shape === 'round' ? 'rounded-full' : 'rounded-2xl',
        className,
      )}
      style={{
        background:
          `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${base} 75%, white) 0%, ` +
          `${base} 55%, color-mix(in srgb, ${base} 70%, black) 100%)`,
        color: text,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.35), ' +
          '0 2px 8px -2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
        textShadow: '0 1px 0 rgba(0,0,0,0.35)',
      }}
    >
      {children ?? (showLabel ? short : null)}
    </div>
  );
});

/** Remounting by URL resets failures when the club or asset revision changes. */
function CrestImage({ src, box, name, className, fallback }: {
  src: string; box: string; name: string; className?: string; fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt={name} width={64} height={64} decoding="async" loading="lazy"
    className={cn(box, 'shrink-0 object-contain select-none', className)} draggable={false}
    onError={() => setFailed(true)} />;
}
