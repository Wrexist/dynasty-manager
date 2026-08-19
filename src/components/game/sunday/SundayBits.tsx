/**
 * Small shared pieces for the Sunday League screens.
 *
 * Kept in one file on purpose: each is a handful of lines and they are always
 * used together, so ten separate modules would be ceremony rather than
 * structure. Anything that grows past a screenful moves out.
 */
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { SUNDAY_FORM_COLD, SUNDAY_FORM_HOT } from '@/config/sundayLeague';
import { SUNDAY_AVAILABILITY_ICON, SUNDAY_ICON } from '@/config/sundayIcons';
import type { SundayAvailability, SundayAvailabilityStatus } from '@/types/game';

const HotFormIcon = SUNDAY_ICON.hotForm;

/**
 * Availability status → the one tone.
 *
 * The hub used to hand-roll its own emerald/amber/red pill row beside a list
 * built from `AvailabilityPill`, so the same status could be painted two
 * slightly different ways on one screen. One map, read by both.
 */
const AVAIL_TONE: Record<SundayAvailabilityStatus, string> = {
  available: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  doubt: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
  out: 'bg-destructive/15 text-destructive border-destructive/30',
};

/**
 * Availability at a glance. An unwarned absence reads as "no word from him"
 * rather than naming the reason — the manager does not know it yet.
 *
 * The prop is narrowed to the two fields it reads so a caller that holds only
 * `status` and `warned` — a memoized card whose props must all be scalars —
 * can build the pair inline instead of dragging a whole `SundayAvailability`
 * through its prop list. A full availability object still satisfies it.
 */
export function AvailabilityPill({ availability, className }: {
  availability: Pick<SundayAvailability, 'status' | 'warned'>;
  className?: string;
}) {
  const { t } = useTranslation();
  const { status, warned } = availability;
  const label = status === 'available'
    ? t('sunday.avail.available')
    : status === 'doubt'
      ? t('sunday.avail.doubt')
      : warned ? t('sunday.avail.out') : t('sunday.avail.noWord');
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-micro font-semibold', AVAIL_TONE[status], className)}>
      {label}
    </span>
  );
}

/**
 * How many are in each state, in the same three colours as the pill.
 *
 * Counts and statuses have to be painted identically or the eye reads them as
 * two different scales. The label is passed in already resolved because the
 * caller owns the number — see `sundayClubSummary`, which is the only honest
 * source of it.
 */
export function AvailabilityCount({ status, label }: { status: SundayAvailabilityStatus; label: string }) {
  const Icon = SUNDAY_AVAILABILITY_ICON[status];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full border text-micro font-semibold', AVAIL_TONE[status])}>
      <Icon className="w-3 h-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

/**
 * A club's last few results, newest first.
 *
 * Letters AND colour, never colour alone. Extracted from the match-day
 * briefing so the hub's fixture hero shows the opposition's form in exactly
 * the same shape the briefing does.
 */
export function FormPills({ form, size = 'md' }: {
  form: readonly ('W' | 'D' | 'L')[];
  size?: 'sm' | 'md';
}) {
  if (form.length === 0) return null;
  return (
    <span className="inline-flex gap-0.5" aria-label={form.join(', ')}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            'rounded text-micro font-bold inline-flex items-center justify-center shrink-0',
            size === 'sm' ? 'w-[18px] h-[18px]' : 'w-5 h-5',
            r === 'W' ? 'bg-emerald-500/25 text-emerald-300'
              : r === 'L' ? 'bg-destructive/25 text-destructive' : 'bg-amber-400/20 text-amber-300',
          )}
        >
          {r}
        </span>
      ))}
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
 *  colour alone. The optional glyph comes from `SUNDAY_ICON` and lets a row of
 *  meters be scanned without reading three labels. */
export function Meter({ label, value, icon: Icon, className }: {
  label: string;
  value: number;
  icon?: React.ElementType;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone = pct >= 66 ? 'bg-emerald-500/80' : pct >= 33 ? 'bg-amber-400/80' : 'bg-destructive/80';
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-micro text-muted-foreground truncate inline-flex items-baseline gap-1">
          {Icon && <Icon className="w-3 h-3 shrink-0 self-center" aria-hidden />}
          {label}
        </span>
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

/**
 * The four things about a player that change a selection decision: he has the
 * armband, he is on his way out, he is in form (or out of it), and you promised
 * him a start.
 *
 * Shared by the Squad list and the Teamsheet rows on purpose. The Teamsheet is
 * where the decision is actually made, and it used to show only job and OVR —
 * every input to the decision lived one screen away.
 *
 * FOUR SCALARS, NOT TWO OBJECTS. It used to take the whole `SundaySquadMember`
 * and the whole `Player`. The squad list now renders twenty memoized cards, and
 * `players` is rewritten by the store on every match, every training tick and
 * every week advance — so a card holding a `Player` re-renders whether or not
 * anything about that man changed. Values in, memo intact. Same reasoning as
 * `SundayFace`'s rule 2.
 */
export function PlayerFlags({ captain, unsettled, form, promised }: {
  captain?: boolean;
  /** He has told the manager he is thinking of leaving. */
  unsettled?: boolean;
  /** `Player.form`, 0-100. */
  form: number;
  /** He has been promised a start. */
  promised?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {captain && (
        <span className="text-micro font-bold text-primary shrink-0" aria-label={t('sunday.sheet.captain')}>C</span>
      )}
      {unsettled && (
        <span className="text-micro text-amber-300 shrink-0">{t('sunday.squad.unsettled')}</span>
      )}
      {form >= SUNDAY_FORM_HOT && (
        <span className="inline-flex items-center gap-0.5 text-micro font-semibold text-emerald-300 shrink-0">
          <HotFormIcon className="w-3 h-3" aria-hidden /> {t('sunday.bio.onFire')}
        </span>
      )}
      {form <= SUNDAY_FORM_COLD && (
        <span className="text-micro font-semibold text-sky-300/80 shrink-0">{t('sunday.bio.struggling')}</span>
      )}
      {promised && (
        <span className="text-micro font-semibold text-primary shrink-0">{t('sunday.bio.promised')}</span>
      )}
    </>
  );
}
