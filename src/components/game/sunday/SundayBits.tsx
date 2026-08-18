/**
 * Small shared pieces for the Sunday League screens.
 *
 * Kept in one file on purpose: each is a handful of lines and they are always
 * used together, so ten separate modules would be ceremony rather than
 * structure. Anything that grows past a screenful moves out.
 */
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { SundayAvailability } from '@/types/game';

/** Availability at a glance. An unwarned absence reads as "no word from him"
 *  rather than naming the reason — the manager does not know it yet. */
export function AvailabilityPill({ availability, className }: { availability: SundayAvailability; className?: string }) {
  const { t } = useTranslation();
  const { status, warned } = availability;
  const label = status === 'available'
    ? t('sunday.avail.available')
    : status === 'doubt'
      ? t('sunday.avail.doubt')
      : warned ? t('sunday.avail.out') : t('sunday.avail.noWord');
  const tone = status === 'available'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : status === 'doubt'
      ? 'bg-amber-400/15 text-amber-200 border-amber-400/30'
      : 'bg-destructive/15 text-destructive border-destructive/30';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-micro font-semibold', tone, className)}>
      {label}
    </span>
  );
}

/** A label/value pair, the mode's unit of dense data. */
export function StatChip({ label, value, tone, className }: {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'bad' | 'warn';
  className?: string;
}) {
  const valueTone = tone === 'good' ? 'text-emerald-300'
    : tone === 'bad' ? 'text-destructive'
      : tone === 'warn' ? 'text-amber-300'
        : 'text-foreground';
  return (
    <div className={cn('rounded-lg bg-white/[0.04] px-3 py-2 min-w-0', className)}>
      <p className="text-micro text-muted-foreground truncate">{label}</p>
      <p className={cn('text-body font-semibold truncate', valueTone)}>{value}</p>
    </div>
  );
}

/** 0-100 meter. Colour AND a numeric label, so the value is never carried by
 *  colour alone. */
export function Meter({ label, value, className }: { label: string; value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone = pct >= 66 ? 'bg-emerald-500/80' : pct >= 33 ? 'bg-amber-400/80' : 'bg-destructive/80';
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-micro text-muted-foreground truncate">{label}</span>
        <span className="text-micro font-semibold text-foreground tabular-nums">{pct}</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden bg-muted/30 mt-1"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Club crest stand-in — Sunday clubs do not have badges, they have colours
 *  and three letters someone printed at work. */
export function SundayCrest({ shortName, color, secondaryColor, size = 40, className }: {
  shortName: string;
  color: string;
  secondaryColor: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('rounded-full flex items-center justify-center font-bold shrink-0 ring-1 ring-inset ring-white/10', className)}
      style={{
        backgroundColor: color,
        color: secondaryColor,
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size / 3.6)),
      }}
    >
      {shortName.slice(0, 3).toUpperCase()}
    </div>
  );
}
